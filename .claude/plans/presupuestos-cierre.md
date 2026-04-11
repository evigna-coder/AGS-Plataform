# Plan: Cierre del módulo Presupuestos

**Fecha:** 2026-04-10
**Objetivo:** Cerrar los gaps pendientes del módulo Presupuestos para dejarlo en producción. Foco especial en el tipo `contrato` (hoy subutilizado).
**Fuera de alcance:** Integración Bejerman (descartada). Módulo Facturación (será separado, no parte de este plan).

---

## Referencia: PDF real del cliente

Base de verdad: `CATCN0016R15C.pdf` — Contrato anual Catalent Pharma Solutions.

**Estructura observada** (lo que el sistema debe soportar):
- Agrupación por **Sector** (ej: "QC") como header de sección
- Cada Sector contiene múltiples **Sistemas/Equipos** (ej: "1.1 Sistema HPLC 1100 US70600681 LHPLC03LAB")
- Cada Sistema tiene **componentes hijos S/L** (sin cargo) listados para trazabilidad: 1.2 desgasificador, 1.3 bomba, 1.4 inyector, 1.5 compartimiento columnas, 1.6 detector DAD
- Cada Sistema tiene **servicios con precio**, numerados por tipo:
  - `X.10, X.11` → Mantenimientos Preventivos (MP1_CN_11B con consumibles, MP3_SN_11B sin consumibles)
  - `X.20, X.21` → Regulatorios (SR2_CN_11 validación, SR3_CN_11 recalificación post-reparación)
  - Consumibles sueltos (lámparas 5182-1530, G1314-60101, etc.)
- Columnas: ITEM | EQUIPO | Nro. Serie | ID Equipo (LHPLC03LAB) | Código Servicio (AT1_BAS_11) | CANT | DESCRIPCIÓN | PRECIO ARS | PRECIO USD
- **MIXTA real**: mismo presupuesto mezcla ARS y USD por línea
- **Notas amarillas inline**: "LLEVA SELLO DE FASE REVERSA", "No lo cotizamos porque aún falta realizar este servicio"
- **Bonificaciones** como line items negativos (código `BON_SP`)
- **Cuotas asimétricas**: 12 cuotas USD + 10 cuotas ARS (por pedido del cliente)
- **Vigencia del contrato**: Desde 01/JUL/2025 Hasta 30/JUN/2026 (distinto de la validez de la oferta = 15 días)
- **Revisión R15**: hay historial largo de revisiones sobre el mismo contrato base

---

## Estado actual (verificado 2026-04-10)

### Ya existe en el modelo (`PresupuestoItem`, `packages/shared/src/types/index.ts:785-817`)
- `grupo` (numérico), `subItem` (string "1.1", "1.20")
- `servicioCode` (ej "AT1_BAS_11", "MP1_CN_11B")
- `sistemaId`, `sistemaCodigoInterno`, `moduloId`
- `sistemaNombre`, `moduloNombre`, `moduloSerie`, `moduloMarca`
- `esBonificacion`
- `moneda` per-item (para MIXTA)

### Faltante en modelo
- `sectorNombre?: string | null` en `PresupuestoItem`
- `itemNotasAdicionales?: string | null` en `PresupuestoItem`
- `esSinCargo?: boolean` en `PresupuestoItem`
- `contratoFechaInicio?: string | null`, `contratoFechaFin?: string | null` en `Presupuesto`
- `cantidadCuotasPorMoneda?: Record<string, number> | null` en `Presupuesto`

### Faltante en UI (editor de items, `CreatePresupuestoItems.tsx`)
- Ningún campo contrato editable hoy: ni sector, ni sistema, ni subItem, ni servicioCode, ni notas, ni S/L, ni bonificación
- No hay diferenciación entre modo estándar y modo contrato
- No hay agrupamiento visual (ni por grupo ni por sistema)

### Faltante en PDF contrato (`PresupuestoPDFContrato.tsx`)
- No renderiza Sectors como headers de sección
- Asume moneda única (no soporta MIXTA con 2 columnas de precio)
- No renderiza notas por ítem
- No renderiza "S/L" en cantidad
- No muestra vigencia del contrato
- No renderiza cuotas
- Layout actual es imitación directa del form de Catalent (feo) → queremos moderno/limpio

### Faltante en cuotas (`PresupuestoCuotasSection.tsx:22-39`)
- Genera `cantCuotas` iguales para todas las monedas; no soporta asimétrico (12 USD + 10 ARS)

---

## Fases

### Fase 1 — Quick wins (cerrar gaps no-contrato)

**1.1 — PresupuestoDetail deep link → modal flotante** (30 min)
- `/presupuestos/:id` debe abrir automáticamente el modal flotante sobre la lista
- Tocar `PresupuestoDetail.tsx` y el App router
- Criterio: entrar por URL directa abre el modal correcto

**1.2 — Feedback visible de requerimientos auto-generados** (1-2 hs)
- `presupuestosService.create/update()` ya genera requerimientos silenciosamente
- Devolver lista de requerimientos creados al caller
- Toast de éxito + sección colapsable en `EditPresupuestoModal`: "Requerimientos generados (N)" con link a cada uno
- No toca data model

**1.3 — Bidireccionalidad Presupuesto ↔ OT** (2-3 hs)
- Auditar `otService`: ¿guarda `presupuestoId` al crear OT desde presupuesto?
- Si no, agregar persistencia bidireccional
- Backfill opcional (script manual, no auto) para OTs ya creadas
- Criterio: desde una OT puedo ver su presupuesto origen, y desde el presupuesto veo todas las OTs generadas

### Fase 2 — Data model contrato (1-2 hs, additive)

Cambios a `packages/shared/src/types/index.ts` — todos opcionales, sin breaking:

```typescript
// PresupuestoItem
sectorNombre?: string | null;
itemNotasAdicionales?: string | null;
esSinCargo?: boolean;

// Presupuesto
contratoFechaInicio?: string | null;  // ISO date
contratoFechaFin?: string | null;     // ISO date
cantidadCuotasPorMoneda?: Record<string, number> | null;
```

Ajustes en `cleanFirestoreData` / `deepCleanForFirestore` para manejar los nuevos nullables. Lectura defensiva en service (`?? null`).

### Fase 3a — Catálogo de servicios estándar por tipo de equipo (2-3 hs)

**Justificación**: en el PDF real, cada HPLC 1100 trae siempre los mismos servicios (MP1_CN_11B, MP3_SN_11B, SR2_CN_11, SR3_CN_11). Ingresarlos manualmente item por item es inviable. El usuario debe elegir "Sistema HPLC 1100 / LHPLC03LAB" y recibir autogenerados los componentes S/L + los servicios estándar con sus códigos.

**Diseño**:
- Nueva colección Firestore `/tiposEquipoServicios/{tipoId}` o extensión de `tableCatalog`
- Modelo:
  ```typescript
  interface TipoEquipoPlantilla {
    id: string;
    tipoEquipo: string;           // "HPLC 1100", "UV/VIS 8453", "GC 6890"
    componentes: {                 // S/L children
      orden: number;               // 1.2, 1.3...
      codigo: string;              // "G1322A"
      descripcion: string;         // "Desgasificador Estándar - HPLC 1100"
      servicioCode: string;        // "AT1_DEG_11A"
    }[];
    servicios: {                   // con precio
      orden: number;               // .10, .11, .20, .21
      servicioCode: string;        // "MP1_CN_11B"
      descripcion: string;
      cantidadDefault: number;     // 1, 2, S/L
      tipo: 'mantenimiento' | 'regulatorio' | 'consumible';
    }[];
  }
  ```
- CRUD mínimo en `sistema-modular` (página bajo `/catalogos/tipos-equipo`)
- Seed inicial: migrar los tipos HPLC 1100, HPLC 1200, HPLC 1260, UV/VIS 8453, UV/VIS G6860A, GC 6890, GC 8890A del PDF real

**Alternativa más simple** (validar con Esteban): reusar `conceptosServicio` existente, agregarle un campo `tipoEquipoAplicable?: string[]` y dejar que el usuario arme la plantilla manualmente una vez por tipo.

### Fase 3b — UI editor items modo contrato (4-6 hs)

Cuando `presupuesto.tipo === 'contrato'`, reemplazar `CreatePresupuestoItems` con `CreatePresupuestoItemsContrato`:

- **Flow agregar sistema**: botón "Agregar Sistema al Sector" → modal selecciona:
  - Sector (texto libre con autocomplete de sectores ya usados en el presupuesto)
  - Sistema del cliente (dropdown desde `sistemas` del establecimiento, filtrado por cliente)
  - Tipo de plantilla (dropdown desde Fase 3a)
- **Al confirmar**: genera automáticamente:
  - 1 item principal (X.1) con `esSinCargo=true`, sistema + serie + ID interno
  - N items S/L para cada componente (X.2, X.3...) con `esSinCargo=true`
  - N items de servicios (X.10, X.20...) con precio editable por el usuario
- **Numeración automática**: `grupo` correlativo por sistema (1, 2, 3...), `subItem` generado
- **Tabla agrupada**: headers Sector → Sistema (colapsable) → items, drag para reordenar
- **Edición por fila**: precio ARS, precio USD, nota inline, checkbox bonificación
- **Bonificaciones**: sección separada al final, crea items con `esBonificacion=true` y monto negativo
- **Split de componentes** (regla: <250 líneas): `CreatePresupuestoItemsContrato.tsx`, `ContratoSectorGroup.tsx`, `ContratoSistemaGroup.tsx`, `ContratoItemRow.tsx`, `AgregarSistemaContratoModal.tsx`

### Fase 4 — Rewrite PDF Contrato moderno (3-4 hs)

Reescribir `PresupuestoPDFContrato.tsx` desde cero. **No copiar layout de Catalent** — diseño limpio y moderno alineado al Editorial Teal del sistema.

**Sugerencia de layout** (a validar con Esteban cuando lleguemos):
- **Hoja 1 — Portada contrato**:
  - Título "Presupuesto de Contrato" en Newsreader serif
  - Número grande, cliente, vigencia del contrato (Desde/Hasta) en bloque destacado
  - Totales por moneda en tarjetas (ARS total, USD total)
  - Responsable + validez de la oferta al pie
- **Hojas intermedias — Detalle por Sector**:
  - Header de Sector con tipografía grande (Newsreader)
  - Por cada Sistema: card con nombre del sistema, código interno, serie en header; tabla interna con componentes S/L (grises, cantidad "S/L") y servicios con precio (columnas ARS / USD visibles solo si MIXTA)
  - Notas inline en italic, fondo sutil (no amarillo chillón)
  - Subtotal por sistema al final del card
- **Hoja de cuotas**:
  - Tabla por moneda (dos tablas si MIXTA con cuotas asimétricas)
  - Totales + forma de pago (30DFF/60DFF) + notas sobre tipo de cambio
- **Hoja de condiciones y aceptación**:
  - Condiciones comerciales (configurables desde seccionesVisibles)
  - Bloque de aceptación con: firma cliente, OC number, vigencia, CUIT

**Criterio**: el PDF debe verse sobrio, profesional, navegable, y mantener la identidad del sistema (teal, serif titles, mono labels).

### Fase 5 — Cuotas asimétricas por moneda (1-2 hs)

- UI: en `PresupuestoCuotasSection.tsx`, cuando `moneda === 'MIXTA'`, reemplazar input único por inputs per-moneda
- Generador: iterar `presupuesto.cantidadCuotasPorMoneda[currency]` en vez de global
- Fallback: si `cantidadCuotasPorMoneda` es null, usar `cantidadCuotas` para todas (comportamiento legado)
- Validación: al menos 1 cuota por moneda con total > 0
- PDF: ya cubierto en Fase 4

### Fase 6 — Diseño (no implementación) de Item → OT

**Objetivo**: desde un contrato aceptado/en ejecución, seleccionar N items de servicio y cosecharlos como una OT programada. Caso típico: contrato anual, cada trimestre se generan las OTs de los MP1/SR2 programados.

**Diseño** (documento, no código):
- Nuevo campo en `PresupuestoItem`: `otsGeneradas?: string[]` — IDs de OTs que consumieron este item
- Nuevo campo en `OT`: `presupuestoItemsOrigen?: { presupuestoId: string; itemIds: string[] }` — trazabilidad inversa
- Nuevo botón "Generar OT desde items" en `EditPresupuestoModal` header, visible solo si:
  - `presupuesto.estado === 'en_ejecucion'`
  - `presupuesto.tipo === 'contrato'`
- Modal de selección:
  - Lista agrupada por Sector → Sistema
  - Solo muestra items con `esSinCargo=false`, `esBonificacion=false`
  - Items ya cosechados (con `otsGeneradas` no vacío) aparecen tachados con link a la OT existente
  - Checkboxes para seleccionar items
- Al confirmar: crea 1 OT con `origenTipo='presupuesto'`, `origenId=presupuestoId`, sistemas/equipos prepopulados de los items seleccionados, y agrega los itemIds a `otsGeneradas` de cada item
- Dashboard del presupuesto: barra de progreso "5/12 servicios ejecutados"

**Por qué diseñarlo ahora sin implementarlo**: el modelo de Fase 2 y la numeración/estabilidad de `PresupuestoItem.id` deben contemplar este caso de uso para no cerrarnos puertas.

### Fase 7 — OAuth email producción

Diferido hasta que haya credenciales de test y tiempo para verificar el flow end-to-end en Electron.

---

## Orden de ejecución confirmado

1. Fase 1 (1.1 → 1.2 → 1.3)
2. Fase 2
3. Fase 3a (catálogo)
4. Fase 3b (UI items)
5. Fase 4 (PDF)
6. Fase 5 (cuotas asimétricas)
7. Fase 6 (diseño doc)
8. Fase 7 (OAuth prod)

## Decisiones tomadas

- **Facturación**: módulo separado, fuera de este plan
- **Bejerman**: descartado
- **Items contrato**: usar plantilla por tipo de equipo (no manual uno a uno)
- **PDF contrato**: layout moderno/limpio, no copiar 1:1 el de Catalent
- **Data model**: cambios additive, sin migraciones destructivas

## Preguntas abiertas (resolver al llegar a cada fase)

- Fase 3a: ¿catálogo dedicado `tiposEquipoServicios` o extender `conceptosServicio` existente?
- Fase 4: validar mockup del layout moderno antes de implementar
- Fase 5: ¿mantenemos fallback de cuotas simétricas o forzamos siempre per-moneda en MIXTA?
