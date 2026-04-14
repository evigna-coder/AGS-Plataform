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

**Plans:** 6/6 plans executed ✅ VERIFIED

Plans:
- [x] 02-01-PLAN.md — Type extensions: ItemImportacion + Importacion fields + dateFields fix + calcularProrrateo.ts
- [x] 02-02-PLAN.md — OCDetail "Crear Importación" button + ImportacionEditor fromOC prefill with item selector
- [x] 02-03-PLAN.md — ImportacionesList: migrate filters to useUrlFilters + ETA vencida badge
- [x] 02-04-PLAN.md — ImportacionStatusTransition field validation per state + numeroGuia in aduana + ImportacionItemsSection
- [x] 02-05-PLAN.md — ImportacionGastosSection prorrateo preview with calcularCostoConGastos
- [x] 02-06-PLAN.md — useIngresarStock hook + ImportacionIngresarStockModal + wire "Ingresar al stock" in ImportacionDetail

### Phase 3: Presupuestos — Plantillas de textos rich text
**Goal:** Habilitar gestión de plantillas rich text (condiciones comerciales, notas técnicas, garantía, etc.) por tipo de presupuesto con auto-aplicación de defaults, dropdown de selección por sección en el editor, y renderizado HTML formateado en el PDF. Hoy los textos default están hardcodeados en código y no son editables desde UI.

**Scope:**
- Tipo `PlantillaTextoPresupuesto` en `@ags/shared` con campos: `nombre`, `tipo` (6 secciones), `contenido` (HTML rich), `tipoPresupuestoAplica: TipoPresupuesto[]`, `esDefault`, `activo`
- Colección Firestore `plantillasTextoPresupuesto` + servicio CRUD
- Página `/presupuestos/plantillas-texto` (list + editor con RichTextEditor)
- Integración en editor de presupuesto:
  - Al crear: auto-aplicar plantillas `esDefault=true` filtradas por `tipoPresupuestoAplica`
  - Dropdown "Cargar plantilla" por sección para cambiar manualmente
- Adaptar `PresupuestoPDFEstandar.tsx` y editor de condiciones para HTML rich (negritas, listas, títulos)
- Seed inicial: migrar los textos default actuales de `PRESUPUESTO_TEMPLATES` a plantillas en Firestore

**Out of scope:** Relación plantilla ↔ condición de pago (queda para fase futura), PDF de contrato (Phase 4)

### Phase 4: Presupuestos — Anexo de consumibles por módulo
**Goal:** Generar automáticamente un PDF anexo con el listado de consumibles requeridos por módulo cuando un presupuesto incluye servicios tipo "Mantenimiento Preventivo con consumibles", matcheando los módulos del sistema seleccionado contra el catálogo exacto por `moduloModelo`, y adjuntar el anexo al email de envío.

**Scope:**
- Tipo `ConsumibleModulo` en `@ags/shared`: `{ moduloModelo, moduloDescripcion, consumibles[], activo }`
- Flag `generaAnexoConsumibles: boolean` en `ConceptoServicio`
- Colección `consumiblesPorModulo` + servicio CRUD
- Página `/presupuestos/consumibles-modulo` con CRUD
- Generador PDF anexo separado (matching exacto por `moduloModelo`)
- Adjuntar al email en `EnviarPresupuestoModal`

**Out of scope:** Matching por prefijo, edición ad-hoc del anexo por presupuesto
