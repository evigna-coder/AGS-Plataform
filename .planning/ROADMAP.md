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

**Plans:** 7 plans

Plans:
- [x] 01-01-PLAN.md — Type extensions: UnidadStock reservation fields + getOrCreateReservasPosition helper
- [ ] 01-02-PLAN.md — reservasService (reservar/liberar) + useReservaStock hook
- [ ] 01-03-PLAN.md — Auto-req trigger in presupuestosService + useGenerarRequerimientos hook
- [ ] 01-04-PLAN.md — UnidadesList aggregated columns + PresupuestoDetail reservation/req buttons
- [ ] 01-05-PLAN.md — RequerimientosList: useUrlFilters migration + checkboxes + inline edit + Generar OC
- [ ] 01-06-PLAN.md — OCEditor: accept location.state.prefill for pre-populated items
- [ ] 01-07-PLAN.md — handleReponer in useInventarioIngeniero + AjusteStockModal with mandatory justificación

### Phase 2: Comex — Importaciones y Despachos
**Goal:** Gestión de comercio exterior: DUAs, despachos de importación, tracking de embarques, vinculación con altas de stock.

*(a planificar después de Phase 1)*
