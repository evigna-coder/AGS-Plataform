# Diseño: Cosecha de Items de Contrato → Órdenes de Trabajo

**Estado:** DISEÑO. No implementado. Referencia para futura implementación.
**Fecha:** 2026-04-10
**Contexto:** Fase 6 del plan de cierre de Presupuestos. Diseño explícito para no cerrarnos puertas en el modelo de datos durante Fase 2-3.

---

## 1. Problema

Un presupuesto de contrato anual (ej: Catalent CATCN0016R15C) lista ~50 servicios distribuidos entre sistemas del cliente:
- 17 sistemas (HPLC, UV/VIS, GC)
- Por cada sistema: 2 mantenimientos preventivos + 1 validación + 1 recalificación (S/L)
- Total: ~60 items ejecutables a lo largo de 12 meses

Hoy, cuando llega el momento de ejecutar un servicio (ej: "MP1 del HPLC 1100 de LHPLC03LAB, trimestre 2"), el ingeniero o admin **crea una OT manualmente** desde cero. Eso significa:
- Tipear datos del sistema (nombre, serie, ubicación)
- Elegir tipo de servicio
- Vincular al presupuesto (manual)
- Perder trazabilidad: nadie sabe qué items del contrato ya se ejecutaron

## 2. Objetivo

Desde el modal de un presupuesto contrato **en estado `en_ejecucion`**, permitir:
1. Seleccionar N items de servicio (checkboxes, agrupados por Sector → Sistema)
2. Pre-populado: datos del cliente, establecimiento, sistemas, tipos de servicio
3. Click → crea 1 OT consolidada o N OTs (decisión pendiente, ver §5)
4. Marca cada item cosechado con `otsGeneradas: [otNumber]`
5. Dashboard del presupuesto muestra progreso: "5/12 servicios ejecutados"

## 3. Cambios al modelo

### PresupuestoItem — campo nuevo
```typescript
interface PresupuestoItem {
  // ... existentes
  /** Lista de OTs que consumieron este item. Vacío = no cosechado. */
  otsGeneradas?: string[] | null;
}
```

- **Additive**, no breaking
- Se populan en el flow de creación de OT desde items
- Permite filtrar "items pendientes" y "items ejecutados"

### WorkOrder — campo nuevo
```typescript
interface WorkOrder {
  // ... existentes
  /** Items del presupuesto contrato que esta OT consumió (trazabilidad inversa). */
  presupuestoItemsOrigen?: {
    presupuestoId: string;
    presupuestoNumero: string;
    itemIds: string[];
  } | null;
}
```

- **Additive**, no breaking
- Permite desde la OT ver qué líneas del contrato está ejecutando
- Refuerza el link bidireccional agregado en Fase 1.3 (`presupuestoOrigenId`)

## 4. Cambios al service layer

### `presupuestosService.cosecharItems(presupuestoId, itemIds, otNumber)`

Método atómico (transacción):
1. Lee el presupuesto
2. Para cada `itemId` en `itemIds`:
   - Busca el item en `presupuesto.items[]`
   - Si `otsGeneradas` no incluye `otNumber`, lo appenda
3. Persiste `items` actualizado con un solo `update()`
4. No toca `otsVinculadasNumbers` (eso ya lo hace el flow de creación de OT)

### `ordenesTrabajoService.createFromPresupuestoItems(presupuestoId, itemIds, overrides?)`

Método de conveniencia (podría vivir en un hook):
1. Lee el presupuesto + items seleccionados
2. Agrupa items por sistema (un contrato puede cosechar items de múltiples sistemas a la vez — ver §5)
3. Crea 1 o N OTs según la política
4. Setea `presupuestoItemsOrigen`, `presupuestoOrigenId`, `clienteId`, `sistemaId` prepopulados
5. Llama a `presupuestosService.cosecharItems()` para marcar los items
6. Devuelve la lista de OT numbers creadas

## 5. Decisión pendiente: ¿1 OT consolidada o N OTs?

**Opción A — 1 OT por cosecha**:
- El ingeniero selecciona 5 items (ej: 3 MP de HPLCs distintos + 2 SR)
- Se crea **1 sola OT** con múltiples sistemas
- Problema: el modelo actual de OT solo soporta **un** sistema/módulo por OT. Habría que extenderlo o crear sub-OTs
- Ventaja: menos ruido para el ingeniero, una visita = una OT

**Opción B — 1 OT por sistema**:
- El ingeniero selecciona 5 items de 3 sistemas distintos
- Se crean **3 OTs** (una por sistema), cada una con sus servicios respectivos
- Ventaja: encaja con el modelo actual, no requiere refactor
- Desventaja: si el ingeniero va al mismo laboratorio y hace 3 HPLCs en una visita, son 3 OTs separadas

**Opción C — Híbrida con agrupación por establecimiento**:
- 1 OT por establecimiento-sistema (la mayoría de casos es 1 OT por sistema)
- Si el mismo sistema tiene múltiples servicios seleccionados, van juntos en la misma OT
- Es equivalente a Opción B pero más explícito

**Recomendación para cuando se implemente**: Opción B. Es la que menos fricción tiene con el modelo actual. Si en la práctica el ingeniero molesta con "quiero agrupar estos 3 en una visita", se puede iterar a A/C después.

## 6. UI

### Botón en `EditPresupuestoModal` header bar
- Nuevo botón "Generar OT desde items"
- Visible solo cuando:
  - `presupuesto.tipo === 'contrato'`
  - `presupuesto.estado === 'en_ejecucion'`
  - Hay al menos un item ejecutable (no `esSinCargo`, no `esBonificacion`, no ya cosechado)

### Nuevo modal `CosecharItemsModal`
- Lista agrupada por Sector → Sistema → items ejecutables
- **Oculta** items `esSinCargo` y `esBonificacion` (no tiene sentido cosecharlos)
- **Tacha** items con `otsGeneradas` no vacío y muestra un link "Ya ejecutado en OT {num}"
- Checkboxes: permite multi-selección
- Al confirmar:
  - Por cada sistema con items seleccionados, llama a `createFromPresupuestoItems`
  - Muestra loading con progress
  - Al terminar: toast "{N} OTs generadas. {M} items marcados como ejecutados."
  - Refresh del modal del presupuesto (los items seleccionados ahora aparecen tachados)

### Dashboard del presupuesto
- Nueva card en `PresupuestoSidebar` o cerca del header: "Progreso del contrato"
  - `Items ejecutados: X / Y`
  - Barra de progreso visual
  - Si 100%: se sugiere pasar a `estado: 'finalizado'`

## 7. Consideraciones

- **Idempotencia**: si el usuario re-ejecuta la cosecha sobre items ya cosechados, el método `cosecharItems` debe ser idempotente (el `otNumber` no se agrega si ya está presente). El modal UI debería deshabilitar los items ya cosechados para evitar esto.
- **Rollback**: si una OT se elimina, ¿se "des-cosecha" el item? Sí — al eliminar OT, buscar los items que tienen ese `otNumber` en `otsGeneradas` y quitarlo. Nuevo método `presupuestosService.descosecharItems(presupuestoId, otNumber)` invocado por `ordenesTrabajoService.delete()`.
- **Revisiones**: al crear una revisión del presupuesto, el `otsGeneradas` NO se copia al nuevo presupuesto (los items de la revisión son nuevos). Eso está bien — el histórico queda en el presupuesto original.
- **Estabilidad de IDs**: el `PresupuestoItem.id` debe ser estable a través de saves. Hoy lo es (se genera con `crypto.randomUUID()` y no se regenera en updates). Esta fase depende de esa estabilidad.

## 8. Requisitos previos cumplidos en fases anteriores

- ✅ `PresupuestoItem.id` estable (Fase 3b)
- ✅ `grupo`, `subItem`, `sistemaId`, `sectorNombre` presentes en cada item (Fase 2)
- ✅ `esSinCargo`, `esBonificacion` para filtrar items ejecutables (Fase 2)
- ✅ `otsVinculadasNumbers` array bidireccional (Fase 1.3)
- ✅ `presupuestoOrigenId` en WorkOrder (Fase 1.3)
- ✅ Tipo `contrato` con estado workflow (`en_ejecucion`)

Todo el andamiaje necesario ya está en su lugar. Implementar esta fase es ~1-2 días de trabajo cuando se priorice.

## 9. Criterio de "listo"

- [ ] `PresupuestoItem.otsGeneradas` en shared types
- [ ] `WorkOrder.presupuestoItemsOrigen` en shared types
- [ ] `presupuestosService.cosecharItems()` implementado con tests
- [ ] `presupuestosService.descosecharItems()` implementado
- [ ] `CosecharItemsModal` con UI y filtrado
- [ ] Botón "Generar OT desde items" visible condicionalmente
- [ ] Progress card en el modal del presupuesto
- [ ] Hook en `ordenesTrabajoService.delete()` para descosechar
- [ ] Validación end-to-end: cosechar 5 items, verificar OT creada, verificar marca, eliminar OT, verificar desmarca
