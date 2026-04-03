# Phase 2: Comex — Importaciones y Despachos — Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Completar el ciclo de comercio exterior: desde la vinculación OC→Importación, tracking de estados del embarque con campos obligatorios por estado, registro de DUA y gastos con prorrateo al costo unitario, hasta el alta de stock al recibir la mercadería con cierre automático de requerimientos.

Fuera de scope: portal del proveedor, notificaciones activas (email/push), integración con sistemas aduaneros externos.

</domain>

<decisions>
## Implementation Decisions

### OC → Importación: origen y estructura
- La Importación se crea desde el **detalle de la OC** cuando su tipo es `'importacion'` — botón "Crear Importación" en el OCDetail
- **1 OC puede tener múltiples Importaciones** (embarques parciales)
- Cada importación lleva sus **propios ítems** (subconjunto de los ítems de la OC) — el operador elige qué artículos y cantidades van en ese embarque al crear la importación
- Esto permite trackear recepciones parciales del mismo artículo en distintos embarques

### Tracking de estados y alertas
- Estados (en orden): `preparacion → embarcado → en_transito → en_aduana → despachado → recibido` — flujo confirmado, no se modifica
- **Campos mínimos obligatorios por estado** (no se puede avanzar sin ellos):
  - `embarcado`: fecha de embarque + número de booking
  - `en_aduana`: fecha de arribo real
  - `despachado`: número DUA (`despachoNumero`)
  - `recibido`: fecha de recepción
  - Resto de transiciones: libres
- **Alerta de ETA vencida**: badge visual en la lista de importaciones cuando `fechaEstimadaArribo` pasó y el estado aún no es `recibido` ni `cancelado`

### DUA y gastos de importación
- Campos del despacho: `despachoNumero` + `fechaDespacho` + `despachante` + **`numeroGuia`** (campo nuevo a agregar al tipo `Importacion`)
- Los gastos (flete, seguro, despachante, VEP, otros) se **distribuyen en el costo unitario** de los artículos
- Método de prorrateo: **por valor proporcional** — cada ítem absorbe el % del gasto según su valor relativo respecto al total de la importación
- El costo unitario calculado (precio OC + gastos prorrateados) se almacena en la `UnidadStock` al hacer el alta

### Alta de stock al recibir
- Flujo: importación llega a estado `recibido` → aparece botón **"Ingresar al stock"** en el ImportacionDetail
- El formulario de recepción por ítem permite ingresar:
  - Posición de depósito destino (SearchableSelect de posiciones existentes, excluyendo RESERVAS)
  - Números de serie (si el artículo los requiere) — uno por unidad
  - Cantidad real recibida (puede diferir de la cantidad pedida)
- El sistema crea las `UnidadStock` correspondientes y un `MovimientoStock` tipo `entrada` por cada unidad
- **Cierre automático de requerimientos**: al ingresar el stock, el sistema busca requerimientos en estado `en_compra` vinculados a esa OC. Si cantidad recibida >= cantidad del req → req pasa a `completado`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Importacion` type en `@ags/shared`: completo — tiene `ordenCompraId`, `gastos: GastoImportacion[]`, `documentos`, `despachoNumero`, `fechaDespacho`, `despachante`. Solo falta `numeroGuia`
- `EstadoImportacion` + `ESTADO_IMPORTACION_LABELS/COLORS`: tipos y labels ya definidos
- `GastoImportacion` type: concepto, monto, moneda, fecha, comprobante — listo para usar
- `DocumentoImportacion` type: completo
- `ImportacionesList.tsx` (119 líneas), `ImportacionEditor.tsx` (185 líneas), `ImportacionDetail.tsx` (84 líneas): páginas base existentes, necesitan extensión significativa
- `importacionesService` en `importacionesService.ts`: CRUD básico ya implementado
- `OCDetail.tsx` + `OCEditor.tsx`: existen, se integra el botón "Crear Importación" en OCDetail
- `reservasService`, `unidadesService`, `movimientosService`: listos desde Phase 1 para el alta de stock
- `requerimientosService`: listo para actualizar estado a `completado`
- `SearchableSelect`, `Modal`, `PageHeader`, `Button`, `Card`: UI atoms reutilizables
- `useUrlFilters`: para filtros de ImportacionesList (hard rule)

### Established Patterns
- Servicios: CRUD + `subscribe()` con `onSnapshot` — seguir el mismo patrón
- `deepCleanForFirestore()` para datos nested antes de escribir
- `createBatch()` + `batchAudit()` para mutaciones atómicas
- `MovimientoStock` inmutable en cada mutación de stock (hard rule Phase 1)
- Filtros de lista siempre con `useUrlFilters`, nunca `useState`

### Integration Points
- `apps/sistema-modular/src/pages/stock/OCDetail.tsx`: agregar botón "Crear Importación" + lista de importaciones vinculadas
- `packages/shared/src/types/index.ts`: agregar `numeroGuia?: string | null` a `Importacion`
- `apps/sistema-modular/src/pages/stock/ImportacionDetail.tsx`: agregar timeline de estados, formulario de gastos, botón "Ingresar al stock"
- `apps/sistema-modular/src/pages/stock/ImportacionEditor.tsx`: extender para crear con ítems (subconjunto de OC)
- `apps/sistema-modular/src/pages/stock/ImportacionesList.tsx`: migrar filtros a `useUrlFilters` + badge ETA vencida
- Colección Firestore: `importaciones` (ya existe), `unidades_stock` (se escriben al ingresar), `movimientos_stock`, `requerimientos_compra` (se cierran)

</code_context>

<specifics>
## Specific Ideas

- El número DUA es el `despachoNumero` — confirmado
- Nuevo campo `numeroGuia` en el tipo `Importacion` para el número de guía aérea/marítima
- El alta de stock al recibir calcula `costoUnitario = (precioOC_item + gastos_prorrateados_item) / cantidad`
- La alerta de ETA es solo visual en la lista — no activa (no requiere infraestructura extra)

</specifics>

<deferred>
## Deferred Ideas

- **Portal del proveedor** — que el proveedor confirme/actualice el estado del embarque digitalmente
- **Notificaciones activas** (email/push) por ETA vencida o cambio de estado
- **Integración con sistemas aduaneros** o plataformas de tracking de contenedores
- **Canal de selectividad / valor FOB declarado** — datos adicionales del DUA si se necesitan en el futuro

</deferred>

---

*Phase: 02-comex-importaciones-y-despachos*
*Context gathered: 2026-04-03*
