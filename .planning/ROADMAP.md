# Roadmap: AGS Plataforma

## Milestones

- ✅ **v1.0 Stock + Comex + Presupuestos Contrato** - Phases 1-4 (shipped 2026-04-10)
- 🚧 **v2.0 Circuito Comercial Completo** - Phases 5-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Stock + Comex + Presupuestos Contrato (Phases 1-4) - SHIPPED 2026-04-10</summary>

### Phase 1: Reservas, Movimientos, Requerimientos y OC
**Goal:** Completar el ciclo operativo de stock — reservas físicas para presupuestos, movimientos completos (consumos/ajustes/transferencias/reposición), requerimientos automáticos desde presupuestos aprobados con lógica de stock mínimo, grilla de requerimientos con edición inline y generación de OC agrupada por proveedor.

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

**Plans:** 6/6 plans executed

Plans:
- [x] 02-01-PLAN.md — Type extensions: ItemImportacion + Importacion fields + dateFields fix + calcularProrrateo.ts
- [x] 02-02-PLAN.md — OCDetail "Crear Importación" button + ImportacionEditor fromOC prefill with item selector
- [x] 02-03-PLAN.md — ImportacionesList: migrate filters to useUrlFilters + ETA vencida badge
- [x] 02-04-PLAN.md — ImportacionStatusTransition field validation per state + numeroGuia in aduana + ImportacionItemsSection
- [x] 02-05-PLAN.md — ImportacionGastosSection prorrateo preview with calcularCostoConGastos
- [x] 02-06-PLAN.md — useIngresarStock hook + ImportacionIngresarStockModal + wire "Ingresar al stock" in ImportacionDetail

### Phase 3: Presupuestos — Plantillas de textos rich text
**Goal:** Habilitar gestión de plantillas rich text (condiciones comerciales, notas técnicas, garantía, etc.) por tipo de presupuesto con auto-aplicación de defaults, dropdown de selección por sección en el editor, y renderizado HTML formateado en el PDF.

**Plans:** TBD

Plans:
- [ ] 03-01-PLAN.md — TBD
- [ ] 03-02-PLAN.md — TBD

### Phase 4: Presupuestos — Anexo consumibles por módulo
**Goal:** Generar automáticamente un PDF anexo con el listado de consumibles requeridos por módulo cuando un presupuesto incluye servicios tipo "Mantenimiento Preventivo con consumibles", matcheando los módulos del sistema seleccionado contra el catálogo exacto por `moduloModelo`, y adjuntar el anexo al email de envío.

**Plans:** TBD

</details>

---

### 🚧 v2.0 Circuito Comercial Completo (In Progress)

**Milestone Goal:** Cerrar el ciclo Ticket → Presupuesto → OC → OT → Facturación con derivaciones automáticas entre áreas, reglas de precios por contrato y distancia, y planificación de stock amplia para decidir si derivar a Importaciones.

**Timeline:** 2 semanas.

#### Phase 5: Pre-condiciones — Migración + Infra
**Goal:** Los datos legacy están saneados y la infraestructura base está lista para que los flujos automáticos funcionen sin errores silenciosos.
**Depends on:** Phase 4
**Requirements:** PREC-01, PREC-02, PREC-03, PREC-04
**Success Criteria** (what must be TRUE):
  1. Todos los tickets con `clienteId: null` tienen clienteId resuelto o están marcados para revisión manual visible en una vista admin
  2. Los tickets con contactos planos tienen `contactos[]` estructurado con principal marcado — el modal de envío de mail siempre encuentra un destinatario
  3. El workspace `functions/` existe en el monorepo y despliega una función de ejemplo sin errores
  4. La colección `featureFlags` existe en Firestore y la UI admin permite togglear módulos sin rebuild — un admin puede activar/desactivar un módulo y el cambio se refleja en la sidebar sin recarga

**Plans:** 4 plans

Plans:
- [x] 05-01-PLAN.md — Migración batch clienteId null — script + UI revisión admin + type extensions
- [x] 05-02-PLAN.md — Migración batch contactos planos → contactos[] (idempotente)
- [ ] 05-03-PLAN.md — Bootstrap workspace functions/ + helloPing Cloud Function (southamerica-east1)
- [x] 05-04-PLAN.md — featureFlags en Firestore + useNavigation() reactivo + /admin/modulos

#### Phase 6: Catálogo de Servicios con Precios ⏸ DIFERIDA (2026-04-20)
**Status:** Motor de reglas de precios diferido a post-v2.0. Decisión tomada 2026-04-20: cada precio es manual (surge de comparación con año anterior + competencia + negociación; no reducible a reglas). Ver [memory/project_pricing_strategy.md] para los 4 anclajes de diseño cuando se retome. El snapshot al `oc_recibida` (PRIC-01) y la disciplina de precio manual (PRIC-03, PRIC-04 TC MIXTA) se mueven a ser parte del trabajo per_incident en Phase 7.
**Goal (original):** El catálogo de servicios está completo con zonas geográficas, reglas de precio por zona y contrato, y la disciplina de snapshot de precios está establecida desde el primer día.
**Depends on:** Phase 5
**Requirements (originales, diferidos):** CSVC-01, CSVC-02, CSVC-03, CSVC-04, CSVC-05, PRIC-01, PRIC-02, PRIC-03, PRIC-04, PRIC-05
**Success Criteria** (what must be TRUE — se retomarán en post-v2.0):
  1. Un admin puede crear, editar y desactivar servicios con categoría, precio base, y flags (requiereImportacion, generaOT) desde la UI — el servicio aparece disponible para usar en presupuestos
  2. Un admin puede definir zonas geográficas (AMBA / Interior BA / Interior país) con tarifas propias y asignar una zona a un establecimiento existente
  3. Un servicio puede tener un precio de override por zona o por contrato de cliente — al construir un presupuesto, el precio aplicado es el más específico disponible (contrato > zona > base)
  4. Al transicionar un presupuesto a estado `enviado`, cada ítem congela su `precioUnitarioSnapshot` — cambios posteriores en el catálogo no modifican el presupuesto ya enviado
  5. Un usuario puede editar manualmente el precio de un ítem; el flag `precioManual: true` lo protege de recálculos automáticos — la UI muestra un indicador visual de "precio personalizado"

**Plans:** DEFERRED — retomar post-v2.0

Plans (diferidos):
- [ ] 06-01: Tipos y colecciones — ConceptoServicio extendido + categorías + zonas geográficas
- [ ] 06-02: CRUD categorías de servicios (list + editor)
- [ ] 06-03: CRUD servicios — lista con filtros + editor con flags y reglas de precio
- [ ] 06-04: Zonas geográficas — colección + asignación a establecimientos + haversineKm
- [ ] 06-05: computePrecioServicio() — pure function con jerarquía contrato > zona > base
- [ ] 06-06: Disciplina snapshot — precioUnitarioSnapshot + precioManual + recálculo en borrador

#### Phase 7: Presupuesto per_incident — cerrar flow + token-first mail
**Goal:** El flow end-to-end del presupuesto tipo `'servicio'` (alias interno de per_incident) está validado y pulido — crear, editar, PDF estándar, mail OAuth con token-first order, transiciones de estado formalizadas. El pipeline PDF+mail reutilizable para los tipos `partes`, `mixto` y `ventas` de Phase 10 queda consolidado.
**Depends on:** Phase 5 (Phase 6 diferido — precios manuales)
**Requirements:** PTYP-01, FMT-01, FMT-02
**Success Criteria** (what must be TRUE):
  1. Un vendedor puede crear un presupuesto tipo `'servicio'` desde un ticket existente o desde cero, agregar ítems desde el catálogo `ConceptoServicio` (precio base = referencia editable), y guardarlo como borrador. El flow end-to-end está probado.
  2. El PDF del presupuesto tipo `'servicio'` se genera con `PresupuestoPDFEstandar` en formato Editorial Teal, con cliente/ítems/totales/condiciones comerciales, y se descarga correctamente.
  3. `EnviarPresupuestoModal` aplica **token-first order**: valida/obtiene OAuth token ANTES de cambiar estado en Firestore. Si el token falla o expira, el presupuesto NO transiciona a `enviado`; el usuario ve el error con opción de reintentar sin quedar el doc en estado inconsistente.
  4. Al transicionar a `enviado` por primera vez, se setea `fechaEnvio` (ya existe el comportamiento; verificarlo). **No hay snapshot técnico de precio** — la cláusula "oferta válida por N días" del PDF es la protección contractual (decisión 2026-04-20).

**Plans:** 2 plans

Plans:
- [ ] 07-01-PLAN.md — Audit + fixes flow `'servicio'` end-to-end: gate del panel equipo/módulo del AddItemModal a tipo=contrato, polish PDF estándar (validez prominente, cleanup header huérfano), PresupuestoNew con tipo:'servicio' explícito. Cubre PTYP-01 + FMT-01.
- [ ] 07-02-PLAN.md — Token-first order: `markEnviado()` atómico en service, EnviarPresupuestoModal reestructurado con etapas (auth/pdf/send/update) y errores diferenciados, EditPresupuestoModal.onSent simplificado. Cubre FMT-02 + cierre de PTYP-01.

#### Phase 8: Estados + OC + Flujo Automático de Derivación
**Goal:** El ciclo comercial completo funciona con derivaciones automáticas: presupuesto sin ticket genera ticket, OC recibida deriva a coordinador OT, cierre OT avisa a facturación — con transacciones atómicas para prevenir race conditions.
**Depends on:** Phase 7
**Requirements:** FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07
**Success Criteria** (what must be TRUE):
  1. Al crear un presupuesto sin ticket de origen, se auto-crea un ticket de seguimiento asignado al usuario configurable — si el cliente no tiene `clienteId`, la UI muestra un warning claro en lugar de fallar silenciosamente
  2. Al adjuntar una OC (número + PDF obligatorio), el ticket de seguimiento cambia de estado y se notifica al coordinador configurado — el cambio de estado del presupuesto ocurre en una `runTransaction` que previene duplicaciones
  3. Al aceptar un presupuesto con ítems que requieren importación, se auto-crea un requerimiento para Comex y el ticket se deriva al área Importaciones
  4. Cuando una OT llega a `CIERRE_ADMINISTRATIVO`, se crea un ticket interno al área Administración y se envía mail al contable con el presupuesto, OC y OTs vinculadas
  5. Un admin puede configurar desde la UI los usuarios fijos para seguimiento, coordinador OT y mail de facturación — los cambios se aplican a los flujos automáticos inmediatamente
  6. Los errores en derivaciones automáticas quedan registrados en `pendingActions[]` del presupuesto y son visibles en un dashboard de "acciones pendientes"

**Plans:** 6 plans

Plans:
- [x] 08-00-PLAN.md — Wave 0 test specs + firestore-assert helper (specs RED baseline pre-impl)
- [ ] 08-01-PLAN.md — Tipos + servicios base (TicketEstado+oc_recibida, PendingAction, OrdenCompraCliente, AdminConfigFlujos) + sidebar Admin root + rutas placeholder
- [ ] 08-02-PLAN.md — FLOW-02/05: cargarOC atómico (runTransaction) + CargarOCModal + wire list/detail
- [ ] 08-03-PLAN.md — FLOW-01/06 base: auto-ticket al markEnviado + pendingActions + retry retroactivo desde /admin/revision-clienteid
- [ ] 08-04-PLAN.md — FLOW-03/05: aceptarConRequerimientos (tx) + cleanup condicionales al anular + itemRequiereImportacion en AddItemModal + badge/filter Condicional
- [ ] 08-05-PLAN.md — FLOW-04/06/07: cerrarAdministrativamente (tx + mailQueue) + /admin/config-flujos UI + /admin/acciones-pendientes dashboard

#### Phase 9: Stock ATP Extendido
**Goal:** La planificación de stock muestra disponible + tránsito + reservas + comprometido en tiempo real — sin cache y con atomicidad garantizada — para que el equipo pueda decidir si derivar a Importaciones con datos confiables.
**Depends on:** Phase 8
**Requirements:** STKP-01, STKP-02, STKP-03, STKP-04, STKP-05
**Success Criteria** (what must be TRUE):
  1. La vista de planificación de stock muestra para cada artículo: disponible, en tránsito, reservado y comprometido — los datos son siempre frescos (sin cache de 2 min)
  2. La función `computeStockAmplio(articuloId)` calcula ATP correcto sin doble conteo — el bug en líneas 252-258 de `presupuestosService.ts` está corregido y verificado con test
  3. Las mutaciones críticas de stock (reservas, movimientos, requerimientos) usan `runTransaction` — no es posible reservar más unidades de las disponibles aunque dos usuarios actúen simultáneamente
  4. La Cloud Function `updateResumenStock` actualiza el campo denormalizado en el artículo cuando cambia cualquier unidad/reserva/OC — la lista de planificación lee solo la colección `articulos`

**Plans:** 3/3 plans complete

Plans:
- [x] 09-01-PLAN.md — computeStockAmplio() pure fn + fix double counting + reservasService.reservar() runTransaction (STKP-01, STKP-03, STKP-05)
- [x] 09-02-PLAN.md — Cloud Functions: updateResumenStock (3 triggers) + onOTCerrada safety net (STKP-02)
- [x] 09-03-PLAN.md — /stock/planificacion page + StockAmplioIndicator + useStockAmplio hook + no cache (STKP-04, STKP-01 consumer)

#### Phase 10: Presupuestos Partes/Mixto/Ventas + Aviso Facturación + Exports
**Goal:** Todos los tipos de presupuesto están operativos con PDF y mail, el aviso de facturación cierra el circuito comercial, y los datos exportables permiten reconciliación con Bejerman.
**Depends on:** Phase 9
**Requirements:** PTYP-02, PTYP-03, PTYP-04, FMT-03, FMT-04, FMT-05, FMT-06
**Success Criteria** (what must be TRUE):
  1. Un vendedor puede crear un presupuesto de tipo partes o ventas de equipos: los ítems de stock muestran ATP al agregarlos; al aceptar, se cruza disponibilidad y se auto-genera requerimiento si falta stock
  2. Un vendedor puede crear un presupuesto mixto (servicios + partes) en un único documento con PDF y mail
  3. Al llegar el aviso de facturación, el contable recibe un mail con el presupuesto PDF, la OC adjunta y el detalle de OTs vinculadas — el destinatario es configurable desde la UI
  4. Un admin puede exportar a Excel el listado de presupuestos con filtros aplicados, las OCs pendientes por cliente/coordinador, y las solicitudes de facturación pendientes

**Plans:** 1/7 plans executed

Plans:
- [ ] 10-00-PLAN.md — Wave 0 E2E specs RED baseline + firestore-assert helpers (PTYP-02/03/04 + FMT-03/04/05/06)
- [ ] 10-01-PLAN.md — @ags/shared extensions: VentasMetadata + SolicitudFacturacion.enviada/ordenesCompraIds + Presupuesto.ventasMetadata
- [ ] 10-02-PLAN.md — Editor UI: ArticuloPickerPanel (ATP wire-up) + VentasMetadataSection + pre-accept UX validation
- [ ] 10-03-PLAN.md — PDF PresupuestoPDFEstandar branching interno por tipo (mixto/partes/ventas bloques)
- [ ] 10-04-PLAN.md — Services: aceptarConRequerimientos ventas (post-commit auto-OT) + cerrarAdministrativamente tx+solicitudesFacturacion + facturacionService methods
- [ ] 10-05-PLAN.md — Export helpers genéricos XLSX+PDF + 3 wrappers específicos + integración PresupuestosList
- [ ] 10-06-PLAN.md — /facturacion dashboard extensions (acciones admin + exports + deep link) + desfixme specs Wave 0

#### Phase 11: Suite E2E Playwright
**Goal:** El circuito comercial completo está cubierto por tests E2E confiables que corren en CI con emulador Firestore y mocks de servicios externos, garantizando que las ramas críticas del flujo no se rompen en futuras iteraciones.
**Depends on:** Phase 10
**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. El emulador Firestore se levanta para tests con `clearFirestoreData()` entre suites — los tests no se contaminan entre sí y pasan en cualquier orden
  2. El camino feliz completo (ticket → presupuesto → enviar → OC → OT → aviso facturación) tiene un test E2E que pasa en CI con `expect.poll()` para asserts async
  3. Las ramas críticas están cubiertas: presupuesto standalone → auto-ticket; derivación a importaciones; precio congelado post-envío; multi-moneda MIXTA
  4. Los tests E2E no envían mails reales ni llaman a Google Maps — Gmail y Maps están mockeados via `page.route()`
  5. La suite corre en GitHub Actions en < 10 minutos con cache de emulador y pnpm install

**Plans:** TBD

Plans:
- [ ] 11-01: Setup emulador Firestore + fixtures base + clearFirestoreData() + CI config
- [ ] 11-02: Suite E2E camino feliz — full pipeline con expect.poll()
- [ ] 11-03: Suite E2E branches — standalone, importaciones, MIXTA, precio congelado
- [ ] 11-04: Mocks Gmail + Maps via page.route() + CI GitHub Actions integration

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Reservas, Movimientos, Reqs y OC | v1.0 | 7/7 | Complete | 2026-04-10 |
| 2. Comex — Importaciones y Despachos | v1.0 | 6/6 | Complete | 2026-04-10 |
| 3. Presupuestos — Plantillas rich text | v1.0 | TBD | Deferred | - |
| 4. Presupuestos — Anexo consumibles | v1.0 | TBD | Deferred | - |
| 5. Pre-condiciones — Migración + Infra | v2.0 | 3/4 | In Progress | - |
| 6. Catálogo de Servicios con Precios | v2.0 | 0/6 | Not started | - |
| 7. Presupuesto Per-Incident — Editor, PDF y Mail | v2.0 | 0/2 | Not started | - |
| 8. Estados + OC + Flujo Automático | v2.0 | 0/6 | Not started | - |
| 9. Stock ATP Extendido | 3/3 | Complete   | 2026-04-22 | - |
| 10. Presupuestos Partes/Mixto/Ventas + Exports | 1/7 | In Progress|  | - |
| 11. Suite E2E Playwright | v2.0 | 0/4 | Not started | - |
