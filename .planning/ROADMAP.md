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

**Plans:** TBD

Plans:
- [ ] 05-01: Migración batch clienteId null — script + UI de revisión admin
- [ ] 05-02: Migración batch contactos planos → contactos[]
- [ ] 05-03: Bootstrap workspace functions/ + Cloud Function de ejemplo
- [ ] 05-04: featureFlags en Firestore + UI admin de módulos

#### Phase 6: Catálogo de Servicios con Precios
**Goal:** El catálogo de servicios está completo con zonas geográficas, reglas de precio por zona y contrato, y la disciplina de snapshot de precios está establecida desde el primer día.
**Depends on:** Phase 5
**Requirements:** CSVC-01, CSVC-02, CSVC-03, CSVC-04, CSVC-05, PRIC-01, PRIC-02, PRIC-03, PRIC-04, PRIC-05
**Success Criteria** (what must be TRUE):
  1. Un admin puede crear, editar y desactivar servicios con categoría, precio base, y flags (requiereImportacion, generaOT) desde la UI — el servicio aparece disponible para usar en presupuestos
  2. Un admin puede definir zonas geográficas (AMBA / Interior BA / Interior país) con tarifas propias y asignar una zona a un establecimiento existente
  3. Un servicio puede tener un precio de override por zona o por contrato de cliente — al construir un presupuesto, el precio aplicado es el más específico disponible (contrato > zona > base)
  4. Al transicionar un presupuesto a estado `enviado`, cada ítem congela su `precioUnitarioSnapshot` — cambios posteriores en el catálogo no modifican el presupuesto ya enviado
  5. Un usuario puede editar manualmente el precio de un ítem; el flag `precioManual: true` lo protege de recálculos automáticos — la UI muestra un indicador visual de "precio personalizado"

**Plans:** TBD

Plans:
- [ ] 06-01: Tipos y colecciones — ConceptoServicio extendido + categorías + zonas geográficas
- [ ] 06-02: CRUD categorías de servicios (list + editor)
- [ ] 06-03: CRUD servicios — lista con filtros + editor con flags y reglas de precio
- [ ] 06-04: Zonas geográficas — colección + asignación a establecimientos + haversineKm
- [ ] 06-05: computePrecioServicio() — pure function con jerarquía contrato > zona > base
- [ ] 06-06: Disciplina snapshot — precioUnitarioSnapshot + precioManual + recálculo en borrador

#### Phase 7: Presupuesto Per-Incident — Editor, PDF y Mail
**Goal:** El tipo de presupuesto de mayor volumen está completo: el vendedor puede crear, editar, generar PDF y enviar por mail un presupuesto per_incident — estableciendo el pipeline PDF+mail reutilizable para todos los tipos restantes.
**Depends on:** Phase 6
**Requirements:** PTYP-01, FMT-01, FMT-02
**Success Criteria** (what must be TRUE):
  1. Un vendedor puede crear un presupuesto per_incident desde un ticket existente o desde cero, agregar ítems desde el catálogo con precios auto-calculados por zona/contrato, y guardarlo como borrador
  2. El vendedor puede generar un PDF del presupuesto en formato teal (template adaptado del contrato) con todos los datos del cliente, ítems, totales y condiciones comerciales
  3. El vendedor puede enviar el presupuesto por mail OAuth — el token se valida ANTES de cambiar el estado en Firestore; si el token expira, se ve un error con opción de reintentar sin pisar el estado
  4. Al hacer clic en "Enviar", el presupuesto transiciona a estado `enviado` y los precios quedan congelados — no se pueden modificar desde la UI

**Plans:** TBD

Plans:
- [ ] 07-01: Tipos compartidos y editor base per_incident — form + items desde catálogo
- [ ] 07-02: PDF template teal adaptado para per_incident
- [ ] 07-03: Mail OAuth con token-first order + EnviarPresupuestoModal generalizado

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

**Plans:** TBD

Plans:
- [ ] 08-01: PresupuestoEstado lifecycle completo — estados, transiciones, UI de estados
- [ ] 08-02: OC tracking — carga de OC (número + adjunto) + cambio de estado atómico (runTransaction)
- [ ] 08-03: Auto-ticket desde presupuesto sin origen + FLOW-07 configuración usuarios fijos
- [ ] 08-04: Derivación a importaciones en acceptance + auto-requerimiento Comex
- [ ] 08-05: Aviso a Facturación al cierre OT + pendingActions[] + dashboard errores

#### Phase 9: Stock ATP Extendido
**Goal:** La planificación de stock muestra disponible + tránsito + reservas + comprometido en tiempo real — sin cache y con atomicidad garantizada — para que el equipo pueda decidir si derivar a Importaciones con datos confiables.
**Depends on:** Phase 8
**Requirements:** STKP-01, STKP-02, STKP-03, STKP-04, STKP-05
**Success Criteria** (what must be TRUE):
  1. La vista de planificación de stock muestra para cada artículo: disponible, en tránsito, reservado y comprometido — los datos son siempre frescos (sin cache de 2 min)
  2. La función `computeStockAmplio(articuloId)` calcula ATP correcto sin doble conteo — el bug en líneas 252-258 de `presupuestosService.ts` está corregido y verificado con test
  3. Las mutaciones críticas de stock (reservas, movimientos, requerimientos) usan `runTransaction` — no es posible reservar más unidades de las disponibles aunque dos usuarios actúen simultáneamente
  4. La Cloud Function `updateResumenStock` actualiza el campo denormalizado en el artículo cuando cambia cualquier unidad/reserva/OC — la lista de planificación lee solo la colección `articulos`

**Plans:** TBD

Plans:
- [ ] 09-01: computeStockAmplio() pure function + fix doble conteo + runTransaction en reservas
- [ ] 09-02: Cloud Function updateResumenStock — trigger onDocumentWritten + denormalización
- [ ] 09-03: StockAmplioIndicator component + vista de planificación sin cache

#### Phase 10: Presupuestos Partes/Mixto/Ventas + Aviso Facturación + Exports
**Goal:** Todos los tipos de presupuesto están operativos con PDF y mail, el aviso de facturación cierra el circuito comercial, y los datos exportables permiten reconciliación con Bejerman.
**Depends on:** Phase 9
**Requirements:** PTYP-02, PTYP-03, PTYP-04, FMT-03, FMT-04, FMT-05, FMT-06
**Success Criteria** (what must be TRUE):
  1. Un vendedor puede crear un presupuesto de tipo partes o ventas de equipos: los ítems de stock muestran ATP al agregarlos; al aceptar, se cruza disponibilidad y se auto-genera requerimiento si falta stock
  2. Un vendedor puede crear un presupuesto mixto (servicios + partes) en un único documento con PDF y mail
  3. Al llegar el aviso de facturación, el contable recibe un mail con el presupuesto PDF, la OC adjunta y el detalle de OTs vinculadas — el destinatario es configurable desde la UI
  4. Un admin puede exportar a Excel el listado de presupuestos con filtros aplicados, las OCs pendientes por cliente/coordinador, y las solicitudes de facturación pendientes

**Plans:** TBD

Plans:
- [ ] 10-01: Presupuesto partes — editor con ATP + reserva + PDF adaptado
- [ ] 10-02: Presupuesto mixto básico (servicios + partes) — editor + PDF
- [ ] 10-03: Presupuesto ventas de equipos — editor + PDF + generación OT
- [ ] 10-04: Template mail aviso facturación + solicitudesFacturacion collection
- [ ] 10-05: Excel exports — presupuestos, OCs pendientes, solicitudes facturación

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
| 5. Pre-condiciones — Migración + Infra | v2.0 | 0/4 | Not started | - |
| 6. Catálogo de Servicios con Precios | v2.0 | 0/6 | Not started | - |
| 7. Presupuesto Per-Incident — Editor, PDF y Mail | v2.0 | 0/3 | Not started | - |
| 8. Estados + OC + Flujo Automático | v2.0 | 0/5 | Not started | - |
| 9. Stock ATP Extendido | v2.0 | 0/3 | Not started | - |
| 10. Presupuestos Partes/Mixto/Ventas + Exports | v2.0 | 0/5 | Not started | - |
| 11. Suite E2E Playwright | v2.0 | 0/4 | Not started | - |
