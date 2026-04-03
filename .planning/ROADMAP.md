# AGS Stock — Roadmap

## Milestone 1: Stock Operativo Completo

### Phase 1: Reservas, Movimientos, Requerimientos y OC
**Goal:** Completar el ciclo operativo de stock — reservas físicas para presupuestos, movimientos completos (consumos/ajustes/transferencias/reposición), requerimientos automáticos desde presupuestos aprobados con lógica de stock mínimo, grilla de requerimientos con edición inline y generación de OC agrupada por proveedor.

**Scope:**
- Posición física "Reservas": mover unidad al reservarla para un presupuesto/cliente
- Trigger automático de requerimiento al aprobar presupuesto (+ acción manual)
- Lógica: qty_disponible - qty_presupuesto < stock_mínimo → req por diferencia
- Grilla con edición inline (proveedor + urgencia + cantidad) + checkboxes
- Botón "Generar OC": selección multi-req → una OC por proveedor, precompletada
- Estado de requerimiento: pendiente → en OC → completado

**Out of scope:** Comex/DUAs, portal proveedor, stock por OT

**Plans:** 7/7 plans executed

Plans:
- [x] 01-01-PLAN.md — Type extensions: UnidadStock reservation fields + getOrCreateReservasPosition helper
- [x] 01-02-PLAN.md — reservasService (reservar/liberar) + useReservaStock hook
- [x] 01-03-PLAN.md — Auto-req trigger in presupuestosService + useGenerarRequerimientos hook
- [x] 01-04-PLAN.md — UnidadesList aggregated columns + PresupuestoDetail reservation/req buttons
- [x] 01-05-PLAN.md — RequerimientosList: useUrlFilters migration + checkboxes + inline edit + Generar OC
- [x] 01-06-PLAN.md — OCEditor: accept location.state.prefill for pre-populated items
- [x] 01-07-PLAN.md — handleReponer in useInventarioIngeniero + AjusteStockModal with mandatory justificación

### Phase 2: Comex — Importaciones y Despachos
**Goal:** Gestión de comercio exterior: DUAs, despachos de importación, tracking de embarques, vinculación con altas de stock.

**Requirements:** COMEX-01, COMEX-02, COMEX-03, COMEX-04, COMEX-05, COMEX-06, COMEX-07, COMEX-08

**Plans:** 5/6 plans executed

Plans:
- [x] 02-01-PLAN.md — Type extensions: ItemImportacion + Importacion fields + dateFields fix + calcularProrrateo.ts
- [x] 02-02-PLAN.md — OCDetail "Crear Importación" button + ImportacionEditor fromOC prefill with item selector
- [x] 02-03-PLAN.md — ImportacionesList: migrate filters to useUrlFilters + ETA vencida badge
- [x] 02-04-PLAN.md — ImportacionStatusTransition field validation per state + numeroGuia in aduana + ImportacionItemsSection
- [x] 02-05-PLAN.md — ImportacionGastosSection prorrateo preview with calcularCostoConGastos
- [ ] 02-06-PLAN.md — useIngresarStock hook + ImportacionIngresarStockModal + wire "Ingresar al stock" in ImportacionDetail
