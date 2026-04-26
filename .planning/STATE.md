---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 12-03-PLAN.md (generarAvisoFacturacion cuotaId path + togglePreEmbarque audit posta — Wave 3)
last_updated: "2026-04-26T15:25:41.519Z"
last_activity: 2026-04-25 — Plan 10-06 SUMMARY written; commits 4459546 (Task 1), 6761aa1 (Task 2), c77429d (Task 3) already on main from 2026-04-22.
progress:
  total_phases: 12
  completed_phases: 6
  total_plans: 44
  completed_plans: 38
  percent: 80
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Completed 10-06-PLAN.md (Wave 5 — facturación dashboard extensions); Phase 10 user-UAT pending before /gsd:verify-work"
last_updated: "2026-04-25T20:54:20.048Z"
last_activity: 2026-04-22 — Plan 10-03 human-verify checkpoint approved with migration-data limitation noted (historical items null stockArticuloId → Servicios bucket; backfill via /admin/relinkear-articulos separate commit)
progress:
  [████████░░] 80%
  completed_phases: 6
  total_plans: 37
  completed_plans: 34
  percent: 92
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 10-05-PLAN.md (Wave 4 — export helpers XLSX+PDF + PresupuestosList integration)
last_updated: "2026-04-22T04:57:55.964Z"
last_activity: 2026-04-22 — Plan 10-03 human-verify checkpoint approved with migration-data limitation noted (historical items null stockArticuloId → Servicios bucket; backfill via /admin/relinkear-articulos separate commit)
progress:
  [█████████░] 92%
  completed_phases: 5
  total_plans: 37
  completed_plans: 33
  percent: 86
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 10-03-PLAN.md (PDF branching by tipo — checkpoint approved with migration-data limitation noted)
last_updated: "2026-04-22T05:30:00.000Z"
last_activity: 2026-04-21 — Phase 9 complete; 09-02 STKP-02 human-verified (resumenStock live in prod, multi-articuloId OC confirmed)
progress:
  [█████████░] 86%
  completed_phases: 5
  total_plans: 37
  completed_plans: 30
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Completed 09-02 — Cloud Functions deployed + STKP-02 human-verified (resumenStock live, multi-articuloId OC confirmed)"
last_updated: "2026-04-22T02:00:00.000Z"
last_activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado
progress:
  total_phases: 11
  completed_phases: 5
  total_plans: 30
  completed_plans: 27
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 08-04 (Wave 3 — FLOW-03 aceptarConRequerimientos transaccional + cleanup condicionales + ATP wiring + RequerimientosList UI)
last_updated: "2026-04-21T12:34:11.465Z"
last_activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado
progress:
  total_phases: 11
  completed_phases: 3
  total_plans: 27
  completed_plans: 23
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Cerrar end-to-end el ciclo comercial desde la consulta inicial hasta el aviso de facturación — con trazabilidad, estados automáticos y sin datos que se pierdan entre áreas.
**Current focus:** v2.0 Circuito Comercial Completo — Phase 9: Stock ATP Extendido (complete)

## Current Position

Phase: 10 of 11 (Presupuestos Partes/Mixto/Ventas + Aviso Facturación + Exports) — CODE COMPLETE, USER UAT PENDING
Plan: 7 of 7 complete (10-00 specs RED, 10-01 tipos+schema, 10-02 ArticuloPickerPanel+VentasMetadataSection, 10-03 PDF branching, 10-04 cierreAdmin solicitudFacturacion, 10-05 export helpers, 10-06 facturación dashboard extensions)
Status: Phase 10 code complete. User UAT pending before /gsd:verify-work — Tier-1 fixes plus full circuito comercial v2.0 walkthrough (ventas/partes/mixto/RBAC/deep-link). Next: Phase 11 E2E suite once verified.
Last activity: 2026-04-25 — Plan 10-06 SUMMARY written; commits 4459546 (Task 1), 6761aa1 (Task 2), c77429d (Task 3) already on main from 2026-04-22.

Progress: [█████████░] 92% (v2.0 milestone)

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 4 (05-01, 05-02, 05-03, 05-04 — all pending user checkpoint verification for scripts / human-verify)
- Average duration: ~5.5min
- Total execution time: ~23min

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 05-pre-condiciones-migracion-infra | 01 | 10min | 4 | 8 |
| 05-pre-condiciones-migracion-infra | 02 | 2min | 1 | 1 |
| 05-pre-condiciones-migracion-infra | 03 | ~5min | 2 | 7 |
| 05-pre-condiciones-migracion-infra | 04 | 5min | 3 | 8 |

*Updated after each plan completion*
| Phase 08-flujo-automatico-derivacion P00 | 55min | 3 tasks | 6 files |
| Phase 08-flujo-automatico-derivacion P01 | 7min | 3 tasks | 8 files |
| Phase 08-flujo-automatico-derivacion P03 | ~35min | 3 tasks | 3 files |
| Phase 08-flujo-automatico-derivacion P02 | 14min | 3 tasks | 7 files |
| Phase 08-flujo-automatico-derivacion P04 | 14min | 3 tasks | 8 files |
| Phase 09-stock-atp-extendido P01 | 7m 25s | 3 tasks | 11 files |
| Phase 09-stock-atp-extendido P03 | 25min | 2 tasks | 8 files |
| Phase 10-presupuestos-partes-mixto-ventas P01 | 4min | 2 tasks | 1 files |
| Phase 10-presupuestos-partes-mixto-ventas P00 | 4min | 3 tasks | 5 files |
| Phase 10-presupuestos-partes-mixto-ventas P02 | 8min | 3 tasks | 6 files |
| Phase 10-presupuestos-partes-mixto-ventas P04 | 6min | 3 tasks | 3 files |
| Phase 10-presupuestos-partes-mixto-ventas P05 | 8min | 3 tasks | 7 files |
| Phase 10 P06 | 12min | 3 tasks | 7 files |
| Phase 12-esquema-facturacion-porcentual-anticipos P01 | 6min | 2 tasks | 3 files |
| Phase 12-esquema-facturacion-porcentual-anticipos P00 | 7min | 2 tasks | 5 files |
| Phase 12-esquema-facturacion-porcentual-anticipos P02 | 8 | 2 tasks | 6 files |
| Phase 12-esquema-facturacion-porcentual-anticipos P03 | 8min | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- 2026-04-25 — Phase 12 added: Esquema Facturación Porcentual + Anticipos (cuotas % + hitos + MIXTA per-moneda; opt-in, no rompe Tier-1 legacy). Plan de referencia: `.claude/plans/facturacion-anticipos-y-porcentajes.md`.

### Decisions

- **Phase 5 pre-condition (hard):** Migración clienteId null debe completarse ANTES de habilitar derivaciones automáticas (Pitfall 7-A). Sin esto, auto-tickets fallan silenciosamente.
- **Client-side triggers:** El pipeline comercial (ticket → presupuesto → OC → OT → facturación) usa client-side triggers. Cloud Functions SOLO para `resumenStock` aggregation.
- **Token-first mail order:** Siempre validar OAuth token ANTES de cambiar estado en Firestore (Pitfall 5-A). Implementar desde Phase 7.
- **runTransaction obligatorio:** Transiciones críticas de estado (acceptance, OC, cierre) usan `runTransaction` para prevenir race conditions (Pitfall 2-D). Desde Phase 8.
- **Snapshot de precios:** `precioUnitarioSnapshot` se congela al transicionar a `oc_recibida` (no al enviar). Antes de OC los precios pueden recalcularse (útil para negociaciones con el cliente). Establecer en Phase 6.
- **TC MIXTA snapshot (confirmado):** El tipo de cambio USD-ARS se congela al recibirse la OC, consistente con la política general de precios. Establecer en Phase 6.
- **Revisiones de presupuesto:** Al crear revisión (item 2, item 3...), por defecto se anula la anterior. Nuevo requerimiento REV-01: agregar pregunta "¿mantener ambas revisiones activas?" para casos donde el cliente recibe dos opciones (ej: con/sin una parte). Establecer en Phase 8.
- **Sin cache en stock views:** Las vistas de planificación de stock nunca usan serviceCache.ts (Pitfall 3-C). Aplicar en Phase 9.
- [Phase 05-pre-condiciones-migracion-infra]: Script migración contactos[] defaults a --dry-run; --run requiere flag explícito y ejecución manual del usuario (no se incluye service-account en repo)
- [Phase 05-01]: Ruta admin registrada en `components/layout/TabContentManager.tsx` (no `App.tsx`) — el routing real vive allí. Patrón a usar para futuras rutas admin.
- [Phase 05-01]: `useUrlFilters` es schema-based `(schema) => [filters, setFilter, setFilters, resetFilters]` — NO shape simple. Documentado en RevisionClienteIdPage como referencia.
- [Phase 05-01]: Plan 05-01 estableció que tickets con `clienteId: null` se matchean por CUIT (≥8 dígitos) → razón social exacta (NFD normalizada). Ambiguos quedan con `pendienteClienteId: true` + `candidatosPropuestos` con `score: 'cuit' | 'razonSocial'` para UI de revisión admin en `/admin/revision-clienteid`.
- [Phase 05-04]: Feature flags runtime vía colección Firestore `/featureFlags/modules` + `FeatureFlagsContext` + hook `useNavigation()` reactivo. `VITE_DESKTOP_MVP` queda como default de build; Firestore override por módulo gana. UI admin en `/admin/modulos` (icon 🧩). `DESKTOP_MVP_ALLOWED` ahora exportado desde `navigation.ts` con helper `isMvpDefault(path)` — source of truth única (no duplicar el set en la admin UI).
- [Phase 05-04]: `useAuth()` retorna `{ firebaseUser, usuario, ... }`; el uid real vive en `firebaseUser.uid`. Usar ese campo para `updatedBy` en writes (no `usuario.id`, que en transiciones puede ser null).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-00]: Wave 0 testing strategy: Playwright client SDK (not Admin) via fixtures/firebase-e2e.ts. Specs fail RED hasta Wave 1-3. Local type aliases en firestore-assert.ts para tipos que landea 08-01.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-00]: e2e/helpers/ pattern establecido: readers tipados compartidos entre specs, 192 líneas bajo budget, pollUntil para eventual consistency.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-00]: sistema-modular no tiene script type-check; Wave 3 (plan 08-05) podría agregarlo. Verificación manual via temp tsconfig+tsc --noEmit.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-01]: 'oc_recibida' landed en TicketEstado con color 'bg-orange-200 text-orange-900' (bg-amber-100 ya era pendiente_facturacion). PendingAction/OrdenCompraCliente/AdminConfigFlujos exportados. getSimplifiedEstado no se tocó (whitelist fallback ya cubre 'en_proceso').
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-01]: Sidebar consolidado en un único root 'Admin' (/admin, icon ⚙️) con 5 children. Antes había 2 items separados ('Importar Datos' + 'Módulos'). getAllModulePaths() ahora expone '/admin' unificado; overrides Firestore para '/admin/importar' y '/admin/modulos' quedan orphan (no bloqueante).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-01]: ordenesCompraClienteService.cargarOC implementado como stub que THROWS 'NOT_IMPLEMENTED — plan 08-02'. Esto falla loud cualquier caller prematuro, mejor que fake data. Plan 08-02 reemplaza con runTransaction real.
- [Phase 08-flujo-automatico-derivacion]: 08-03: Lazy import presupuestosService inside leadsService to break circular dependency for retry-after-resolve trigger
- [Phase 08-flujo-automatico-derivacion]: 08-03: Auto-ticket uses motivoLlamado='ventas_equipos', areaActual='ventas', estado='esperando_oc'; asignadoA=adminConfig.usuarioSeguimientoId
- [Phase 08-flujo-automatico-derivacion]: 08-03: v2.0 no-op success for derivar_comex and notificar_coordinador_ot retry handlers; 08-04/08-05 can extend
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-02]: cargarOC implementado con runTransaction multi-colección — reads-first + merge manual de arrays (NO arrayUnion) + writes inline (NO nested tx). 269 líneas; post-commit notifyCoordinadorOTBestEffort extraído a cargarOCHelpers.ts. NO appendea pendingAction 'derivar_comex' (W1 fix; 08-04 responsable); 'notificar_coordinador_ot' solo se appendea cuando el side-effect falla.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-02]: Modal CargarOCModal (201 + 135 Parts) con tabs 'Existente' (default si hay OCs previas) / 'Nueva' + upload multi-archivo + checkbox N:M filtrado por estado aceptado-sin-OC. Pre-genera ocId en client antes del upload a Storage → mismo id que la tx. Wire en PresupuestosList (row action gated) + EditPresupuestoModal footer (NO PresupuestoDetail.tsx: es redirector de 49 líneas, detail real es el floating modal).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-04]: FLOW-03 implementado con runTransaction atómico. aceptarConRequerimientos pre-reserva numeros REQ-XXXX fuera de tx (getNextNumber no es safe en runTransaction) y pre-carga articulos. _cancelarRequerimientosCondicionales respeta Regla G (skip comprado/en_compra). Collection reutilizada: requerimientos_compra snake_case legacy.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-04]: ATP check suma simple de unidades por estado (disponible+reservado+en_transito+asignado) en nuevo atpHelpers.ts. TODO(STKP-01) documentado para swap a computeStockAmplio() en Phase 9. Integration point real Task 2: PresupuestoItemsTableContrato.handlePickArticulo (no AddItemModal — ese modal no tiene selector de stock; solo conceptosServicio).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-04]: Derivación real a TicketArea='materiales_comex' deferida v2.1 — el union no incluye ese valor hoy. En lugar de derivar, el post-commit de aceptarConRequerimientos appendea pendingAction 'derivar_comex' con reason descriptivo. Retry handler de 08-03 ya trata ese tipo como no-op success.
- [Phase 09-stock-atp-extendido]: computeStockAmplio uses lazy Firebase import for tsx testability; enTransito = unit-estado + OC-pending (additive, not merged); reservar() uses runTransaction; audit is post-tx best-effort
- [Phase 09-stock-atp-extendido]: proveedorIds is string[] on Articulo — planificacion filter uses .includes() not equality
- [Phase 09-stock-atp-extendido]: marcaById lookup map in PlanificacionStockPage avoids N+1 per-row marca lookups; passed as prop to PlanificacionRow
- [Phase 09-stock-atp-extendido]: StockAmplioBreakdownDrawer renders exactly 2 sections (OCs + Requerimientos); Reservas deferred until CF populates breakdown.reservas
- [Phase 09-02]: onOTCerrada is observational only in v2.0 — writes sentinel ot_cierre_idempotency/{otId}, no mail send; mailQueue consumer deferred post-v2.0. Phase 8 pendingActions[] retry path remains authoritative.
- [Phase 09-02]: OC trigger extracts all articuloIds from before+after items union via Set<string>, fires parallel Promise.all() recomputes — multi-articuloId OC verified live in prod (STKP-02 confirmed 2026-04-21)
- [Phase 09-02]: Sync-contract pattern established: when functions/ duplicates client-side constants, use explicit block comment listing every state value + referencing source of truth (3 locations to update on change)
- [Phase 10-presupuestos-partes-mixto-ventas]: VentasMetadata as sub-object on Presupuesto (not 3 root fields): mirrors contratoFechaInicio/Fin pattern; keeps root clean
- [Phase 10-presupuestos-partes-mixto-ventas]: 'enviada' intermediate SolicitudFacturacionEstado: represents mail sent to accountant but not yet facturada; color bg-blue-100 text-blue-800
- [Phase 10-presupuestos-partes-mixto-ventas]: SolicitudFacturacion.ordenesCompraIds is snapshot at cierre admin — not synced with Presupuesto.ordenesCompraIds
- [Phase 10-presupuestos-partes-mixto-ventas]: getOTsByBudget queries 'reportes' collection (not 'ordenesTrabajo') — per otService.ts:40 comment; Wave 0 fixme pattern established for Phase 10 tests: test.fixme(true, 'Wave N (plan 10-XX) lands...')
- [Phase 10-presupuestos-partes-mixto-ventas]: ArticuloPickerPanel uses inline StockAmplioIndicator panel (not popup) for partes/mixto/ventas article selection — catalog loaded once in EditPresupuestoModal and passed as prop to avoid N re-fetches
- [Phase 10-presupuestos-partes-mixto-ventas]: ATP validation before accepting presupuesto is UX-only (window.confirm, non-blocking) — FLOW-03 aceptarConRequerimientos remains authoritative for requirement creation
- [Phase 10-presupuestos-partes-mixto-ventas]: splitItemsByTipo classifies by stockArticuloId (non-null = Partes); null defaults to Servicios. Historical Excel-migrated items have null stockArticuloId and fall into Servicios bucket in PDFs. Backfill via /admin/relinkear-articulos (separate commit). New items via ArticuloPickerPanel classified correctly from day one.
- [Phase 10-presupuestos-partes-mixto-ventas]: Lazy import de otService en presupuestosService para romper circular dep (post-commit auto-OT ventas, Phase 10-04)
- [Phase 10-presupuestos-partes-mixto-ventas]: cerrarAdministrativamente READ PHASE / WRITE PHASE separados: solicitudesFacturacion sentinels leídos en loop READ PHASE, ID determinístico {otNumber}_{presupuestoId} (Phase 10-04)
- [Phase 10-presupuestos-partes-mixto-ventas]: exportToExcel uses BOTH !views (xlsx free edition real freeze syntax) AND !freeze (legacy compat) for header freeze W8 dual-path
- [Phase 10-presupuestos-partes-mixto-ventas]: OC pendiente criterion: estado=aceptado + ordenesCompraIds.length===0 (sin OC cargada del cliente aun)
- [Phase 10-presupuestos-partes-mixto-ventas]: Export wrapper pattern: buildColumns() fn returns ExportColumn<T>[] used for both Excel and PDF helpers — single column definition drives both formats
- [Phase 10]: 10-06: Deep link facturación resuelve via service.getById, no via list filter (evita race con estados fuera del filtro default)
- [Phase 10]: 10-06: Routes /facturacion + /facturacion/:id allowedRoles incluyen administracion (read-only); admin actions siguen scoped a admin+admin_soporte
- [Phase 12-esquema-facturacion-porcentual-anticipos]: cuotasFacturacion.ts: default switch case handles 'solicitada' intermediate test fixture state + Firestore round-trip key-order independence via sort-then-compare in cuotasEqual
- [Phase 12-esquema-facturacion-porcentual-anticipos]: All-zero cuota guard: validateEsquemaSum([], ['ARS']) returns 1 error (sum=0, expected=100)
- [Phase 12-esquema-facturacion-porcentual-anticipos]: 12-00: mkCuota() factory helper in fixtures reduces boilerplate while keeping typed shape. E2E sub-suites use custom test from test-base, not raw @playwright/test.
- [Phase 12-esquema-facturacion-porcentual-anticipos]: togglePreEmbarque stub in 12-02 (writes field); full audit posta side-effect on linked ticket lands in plan 12-03 same wave
- [Phase 12-esquema-facturacion-porcentual-anticipos]: B2 bypass pattern: preEmbarque is the only field in EditPresupuestoModal that bypasses form-state; direct service call to fire audit posta side-effect (plan 12-03)
- [Phase 12-esquema-facturacion-porcentual-anticipos]: Presupuesto has no leadId field — togglePreEmbarque audit posta uses presupuestosIds array-contains query (same pattern as generarAvisoFacturacion post-commit block)
- [Phase 12-esquema-facturacion-porcentual-anticipos]: togglePreEmbarque uses this.update() not direct updateDoc so plan 12-05 recompute hook fires automatically when it lands

### Pending Todos

- Definir límites de zonas geográficas (AMBA / Interior BA / Interior país) con equipo comercial antes de Phase 6 — sesión 30 min (pendiente)
- ~~Confirmar activación plan Blaze en Firebase~~ ✓ Confirmado 2026-04-19
- ~~Decidir política de `tipoCambioSnapshot` MIXTA~~ ✓ Resuelto 2026-04-19: snapshot al `oc_recibida`

### Blockers/Concerns

- **Zonas geográficas:** Los límites/tarifas de zonas (AMBA / Interior BA / Interior país) son decisión comercial. Sin ellos Phase 6 no puede completarse. Sesión con equipo prevista para 2026-04-20.

## Session Continuity

Last session: 2026-04-26T15:25:41.515Z
Stopped at: Completed 12-03-PLAN.md (generarAvisoFacturacion cuotaId path + togglePreEmbarque audit posta — Wave 3)
Resume file: None
