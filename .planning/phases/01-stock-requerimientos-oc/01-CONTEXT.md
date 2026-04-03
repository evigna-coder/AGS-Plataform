# Phase 1: Stock — Reservas, Movimientos, Requerimientos y OC — Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Completar el módulo Stock con 4 capacidades conectadas:
1. **Reserva de posición** — reservar unidades físicas para un presupuesto/cliente en posición "Reservas"
2. **Movimientos completos** — consumos (minikit/remito), ajustes ±, transferencias, reposición de minikit
3. **Requerimientos automáticos** — generación desde presupuestos aprobados o por acción manual, con lógica de stock mínimo
4. **Grilla de requerimientos + Generar OC** — edición inline, selección multi-req, OC agrupada por proveedor

Comex (DUAs, importaciones) es la fase siguiente, fuera de este scope.

</domain>

<decisions>
## Implementation Decisions

### Reserva de posición
- La regla base es: presupuesto **aprobado** → se reserva el stock
- Existe también una **acción manual** en el detalle del presupuesto para anticipar la reserva sin aprobar (el vendedor sabe que va a cerrar)
- La reserva es una **posición física real** llamada "Reservas" en el sistema — la unidad se mueve a esa posición (no es solo un flag)
- La unidad reservada lleva referencia al presupuestoId + clienteId + número de presupuesto
- La reserva se **libera** cuando: se genera el remito de entrega (consumo real) O cuando el presupuesto se cancela/vence
- La UI de unidades muestra: **Disponible | Reservado | Total** — tres columnas separadas

### Movimientos de stock
- **Consumos**: los registra el admin en nombre del ingeniero (el ingeniero informa y el admin carga)
- **Ajustes ±**: cualquier admin puede ajustar con justificación obligatoria (queda en log de movimientos). Sin aprobación adicional.
- **Transferencias**: cubre dos casos en el mismo flujo — cambio de posición física en depósito E inter-ingeniero (minikit de Fanely → minikit de Juan)
- **Reposición de minikit**: se origina desde el inventario del ingeniero, botón "Reponer desde depósito"
  - El sistema propone la cantidad por defecto (déficit hasta completar el minikit)
  - La cantidad es **editable** — puede reponerse más que el estándar del minikit (ej: 6 equipos → minikit para 4 → se repone para 6)
- **Granularidad**: depende del artículo — artículos con número de serie se tracean por unidad individual; consumibles/repuestos se mueven por cantidad

### Requerimientos: trigger automático
- Trigger principal: presupuesto pasa a estado **aprobado**
- También disponible como **acción manual desde el presupuesto** (botón "Generar requerimiento de compra"), habilitado aun sin aprobar
- **Condición de generación**: se evalúa `qty_disponible - qty_presupuesto` vs `stock_mínimo` del artículo
  - Si el stock resultante cae por debajo del mínimo → se genera req por la diferencia faltante para volver al mínimo
  - Si no hay stock en absoluto → req por toda la cantidad del presupuesto
- Solo aplica a ítems de presupuesto con `stockArticuloId` seteado
- **Duplicados entre presupuestos**: un requerimiento por presupuesto (no se acumula). La OC los consolida después.

### Grilla de requerimientos
- Edición inline: **proveedor + urgencia + cantidad** directamente en la fila
- El resto de campos (artículo, origen, presupuesto) es solo lectura en la grilla
- Roles: **cualquier admin** puede cargar reqs manuales, asignar proveedor y generar OC

### Generar OC
- Flujo: usuario selecciona requerimientos (checkboxes en la grilla) → botón "Generar OC" → el sistema crea **una OC por proveedor distinto** involucrado en la selección
- La OC se precompone con: artículos + cantidades del requerimiento, proveedor preseleccionado
- El usuario **completa los precios unitarios** y la condición de pago antes de confirmar
- Al generar la OC, el requerimiento pasa a estado **"en OC"** con link a la OC generada (sale de la grilla de pendientes)
- El requerimiento pasa a "completado" cuando el alta de stock confirma la recepción de la mercadería

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RequerimientoCompra` type en `@ags/shared`: ya tiene `presupuestoId`, `presupuestoNumero`, `articuloId`, `proveedorSugeridoId`, `urgencia`, `origen` — el tipo está completo
- `PresupuestoItem.stockArticuloId`: FK ya existe, marcado como "integración futura" — este es el campo clave para auto-generación
- `requerimientosService` en `importacionesService.ts`: CRUD + subscribe ya implementado
- `OCEditor`, `OCList`, `OCDetail`: páginas de OC ya existen y rutadas
- `MovimientosPage`: página de movimientos ya existe
- `UnidadesList`: ya existe, necesita agregar columnas Disponible/Reservado/Total
- `AsignacionRapidaPage` + `InventarioIngenieroPage`: inventario por ingeniero ya implementado — la reposición se integra en `InventarioIngenieroPage`

### Established Patterns
- Servicios: objetos con métodos CRUD + `subscribe()` usando `onSnapshot` en `services/` — seguir el mismo patrón
- `cleanFirestoreData()` para top-level, `deepCleanForFirestore()` para nested
- Movimientos inmutables: cada mutación de stock ya crea `MovimientoStock` — mantener este invariante
- Remitos: `asignacionesService.create()` auto-genera Remito tipo `salida_campo` — el mismo patrón aplica para consumos desde remito

### Integration Points
- `PresupuestoDetail.tsx`: necesita botón "Reservar stock" (manual) y "Generar requerimiento de compra" (manual)
- Trigger automático en `presupuestosService.ts`: al cambiar estado a `aprobado`, verificar items con `stockArticuloId` y llamar `requerimientosService.create()`
- `RequerimientosList.tsx`: agregar checkboxes + edición inline (proveedor/urgencia/cantidad) + botón "Generar OC"
- `OCEditor.tsx`: debe aceptar requerimientos pre-cargados como origen
- `UnidadesList.tsx`: nueva lógica de visualización Disponible/Reservado/Total
- Colección Firestore nueva: `reservas_stock` o campo `reservadoParaPresupuestoId` en `unidades_stock`

</code_context>

<specifics>
## Specific Ideas

- La reposición de minikit es editable en cantidad para cubrir trabajo extra (ej: 6 equipos en vez de 4 del estándar)
- Los requerimientos de distintos presupuestos se consolidan en la OC (multi-req → una OC por proveedor)
- La reserva es física: la unidad "se mueve" a posición Reservas en el sistema, vinculada al presupuesto/cliente

</specifics>

<deferred>
## Deferred Ideas

- **Comex / DUAs / Importaciones**: fase siguiente, no incluir aquí
- **Portal del proveedor**: posibilidad de que el proveedor reciba y confirme la OC digitalmente — backlog futuro
- **Stock por OT**: consumos automáticos vinculados al cierre de OT — backlog futuro

</deferred>

---

*Phase: 01-stock-requerimientos-oc*
*Context gathered: 2026-04-03*
