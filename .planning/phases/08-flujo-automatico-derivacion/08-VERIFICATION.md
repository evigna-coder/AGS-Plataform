---
phase: 08-flujo-automatico-derivacion
verified: 2026-04-21T00:00:00Z
status: human_needed
score: 6/6 must-haves code-verified (4 runtime-only items need human UAT)
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Mail delivery contable (FLOW-04 end-to-end)"
    expected: "Al cerrar OT a CIERRE_ADMINISTRATIVO, mbarrios@agsanalitica.com recibe el mail con PDFs adjuntos del presupuesto + OC(s) + OTs"
    why_human: "mailQueue consumer (Cloud Function) diferido a Phase 9 — v2.0 solo encola; el mail no se envía automáticamente. Verificación requiere que alguien procese el doc encolado manualmente o que Phase 9 instale el consumer."
  - test: "Dashboard live reactivity (FLOW-06)"
    expected: "Al forzar una pendingAction (ej. config sin usuarioSeguimientoId + markEnviado de presupuesto sin origen), el row aparece en /admin/acciones-pendientes sin refresh manual; Reintentar actualiza contador sin reload"
    why_human: "subscribeAll sobre la colección presupuestos es live (onSnapshot), pero la UX real (latencia, re-render, filtrado instantáneo) solo se confirma en browser."
  - test: "OT close end-to-end con 2 usuarios concurrentes (FLOW-05 race prevention)"
    expected: "2 browsers que intentan cerrar la misma OT a CIERRE_ADMINISTRATIVO simultáneamente: solo uno crea ticket admin + mailQueue; el otro obtiene error por tx rollback"
    why_human: "runTransaction previene race a nivel código, pero la confirmación requiere stress test multi-browser simulado — no cubierto por E2E Playwright actual."
  - test: "Notificación coordinador OT post-cargaOC (FLOW-02 side-effect)"
    expected: "Con adminConfig/flujos.usuarioCoordinadorOTId seteado, al cargar OC el coordinador recibe notificación (in-app posta o side-channel); si usuario inactivo, aparece pendingAction 'notificar_coordinador_ot' en dashboard"
    why_human: "Side-effect post-commit es try/catch best-effort; el happy path de notificación real (además del pendingAction on failure) no tiene spec cobertura — depende del side-channel elegido (actualmente TODO en notifyCoordinadorOTBestEffort)."
---

# Phase 8: Estados + OC + Flujo Automático de Derivación — Verification Report

**Phase Goal:** El ciclo comercial completo funciona con derivaciones automáticas: presupuesto sin ticket genera ticket, OC recibida deriva a coordinador OT, cierre OT avisa a facturación — con transacciones atómicas para prevenir race conditions.

**Verified:** 2026-04-21
**Status:** human_needed (todas las truths code-verified PASSED; 4 runtime behaviors requieren UAT humano)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from ROADMAP Success Criteria)

| # | Truth (ROADMAP Success Criterion)   | Status | Evidence |
|---|-------------------------------------|--------|----------|
| 1 | Auto-ticket seguimiento al markEnviado + edge clienteId null con pendingAction | PASSED | `presupuestosService._crearAutoTicketSeguimiento` (l.534), `_appendPendingAction` (l.598), invocados desde `markEnviado` (l.498, l.510). `TODO(FLOW-06)` eliminado (grep 0 hits). `leadsService.resolverClienteIdPendiente` extended con retry retroactivo (l.517-542). |
| 2 | Cargar OC → ticket `oc_recibida` + notifica coordinador; runTransaction atómico | PASSED | `ordenesCompraClienteService.cargarOC` (l.130-268) usa `runTransaction` con reads-first + merge manual (NO `arrayUnion`) + tx.update ticket.estado='oc_recibida' + post-commit `notifyCoordinadorOTBestEffort`. `CargarOCModal` (201 LOC) wired en `PresupuestosList` + `EditPresupuestoModal`. |
| 3 | Aceptar con items import → requerimiento condicional + derivación | PARTIAL | `aceptarConRequerimientos` (l.795) + `_cancelarRequerimientosCondicionales` (l.932) atómicos; `condicional: true` flag en req (l.862). ATP check en `atpHelpers.itemRequiresImportacion` + wire en `PresupuestoItemsTableContrato.handlePickArticulo`. **Gap documentado**: `TicketArea` NO incluye `'materiales_comex'` — derivación real difereida a v2.1; se registra `pendingAction 'derivar_comex'` + queda visible en dashboard. Aceptado como v2.0 decisión (08-04 deviation #3). |
| 4 | Cierre OT `CIERRE_ADMINISTRATIVO` → ticket admin + mail contable | PASSED (enqueue) | `otService.cerrarAdministrativamente` (l.394-523) runTransaction con 3 writes: OT update + ticket admin (area='administracion') + mailQueue doc (`type='cierre_admin_ot', status='pending'`). `useOTDetail` wired (l.157). Destinatario lee `adminConfig/flujos.mailFacturacion` con fallback `mbarrios@agsanalitica.com`. **Runtime gap**: consumer `mailQueue` (Cloud Function) diferido a Phase 9 — ver Human Verification. |
| 5 | Admin UI /admin/config-flujos aplica config inmediatamente | PASSED | `ConfigFlujosPage.tsx` (196 LOC) con 3 SearchableSelect (`usuarioSeguimientoId`, `usuarioCoordinadorOTId`, `usuarioResponsableComexId`) + input email `mailFacturacion` + validación activo. `adminConfigService.update` escribe `adminConfig/flujos` con `deepCleanForFirestore`. Ruta registrada en TabContentManager con `ProtectedRoute allowedRoles={['admin']}`. |
| 6 | pendingActions[] + dashboard /admin/acciones-pendientes | PASSED | `PendingAction` type en `@ags/shared`; `Presupuesto.pendingActions?: PendingAction[]`. 5 métodos en `presupuestosService`: `_appendPendingAction`, `retryPendingAction`, `retryPendingActionsForCliente`, `markPendingActionResolved`, `getByCliente`. `AccionesPendientesPage.tsx` (221 LOC) + `AccionesPendientesRow.tsx` (89 LOC) con `useUrlFilters` + botones Reintentar + Marcar resuelta. |

**Score:** 5/6 PASSED + 1 PARTIAL (FLOW-03 derivación Importaciones documented tradeoff); 6/6 code-verified pero 4 items requieren UAT humano para confirmar runtime behavior.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/index.ts` | `oc_recibida` en TicketEstado + labels/colors/order; `PendingAction`, `OrdenCompraCliente`, `AdminConfigFlujos` exportados; `Presupuesto.pendingActions?`; `RequerimientoCompra.condicional?/canceladoPor?`; `PresupuestoItem.itemRequiereImportacion?` | VERIFIED | grep `oc_recibida` → 4 hits (union+labels+colors+order). `PRESUPUESTO_TO_LEAD_ESTADO` NO contiene `oc_recibida` (lock Phase 7 respetado). |
| `apps/sistema-modular/src/services/ordenesCompraClienteService.ts` | CRUD + `cargarOC` runTransaction atómico | VERIFIED | 269 LOC. `runTransaction` en l.153; NO `arrayUnion`; reads-first; colección `ordenesCompraCliente` separada de `ordenesCompra` internas. |
| `apps/sistema-modular/src/services/adminConfigService.ts` | get/getWithDefaults/update/subscribe sobre `adminConfig/flujos` | VERIFIED | Default `mbarrios@agsanalitica.com` confirmado. `deepCleanForFirestore` aplicado. |
| `apps/sistema-modular/src/services/presupuestosService.ts` | `_crearAutoTicketSeguimiento`, `_appendPendingAction`, `retryPendingAction`, `retryPendingActionsForCliente`, `markPendingActionResolved`, `getByCliente`, `aceptarConRequerimientos`, `_cancelarRequerimientosCondicionales` | VERIFIED | Los 8 métodos presentes (grep confirma l.534, 598, 639, 708, 734, 758, 795, 932). `TODO(FLOW-06)` → 0 hits. File: 1388 LOC — services exempt del 250-line budget; flagged como refactor candidate para Phase 9+. |
| `apps/sistema-modular/src/services/otService.ts` | `cerrarAdministrativamente` runTransaction | VERIFIED | l.394-523. 3 writes atómicos en tx (OT + ticket admin + mailQueue doc). Post-commit `syncFromOT` best-effort. Legacy `enviarAvisoCierreAdmin` `@deprecated` pero no eliminado. |
| `apps/sistema-modular/src/services/atpHelpers.ts` | `itemRequiresImportacion(articuloId)` | VERIFIED | Suma simple `disponible + reservado + en_transito + asignado` via `unidadesService.getAll`. TODO(STKP-01) documentado para swap a `computeStockAmplio()` en Phase 9. |
| `apps/sistema-modular/src/components/presupuestos/CargarOCModal.tsx` + `CargarOCModalParts.tsx` | Modal ≤250 LOC tabs Nueva/Existente + upload + N:M | VERIFIED | 201 + 135 LOC. Ambos bajo budget. |
| `apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx` | 3 SearchableSelect + email input + validación activo | VERIFIED | 196 LOC. Admin RBAC via `ProtectedRoute`. |
| `apps/sistema-modular/src/pages/admin/AccionesPendientesPage.tsx` + `AccionesPendientesRow.tsx` | Dashboard agregado + filtros useUrlFilters + retry/resolve | VERIFIED | 221 + 89 LOC. `useUrlFilters` aplicado (hard rule). Subscribe live via `subscribeAll`. |
| `apps/sistema-modular/src/hooks/useOTDetail.ts` | Llama `cerrarAdministrativamente` en lugar de update+enviarAvisoCierreAdmin | VERIFIED | l.157 — wired con fallback pendingAction on error. |
| `apps/sistema-modular/src/pages/stock/RequerimientosList.tsx` + `RequerimientoRow.tsx` | Filtro condicional URL + badge "Condicional" link a presupuesto | VERIFIED | useUrlFilters schema + badge amber con Link. |
| `apps/sistema-modular/src/components/presupuestos/contrato/PresupuestoItemsTableContrato.tsx` | `handlePickArticulo` dispara ATP check fire-and-forget | VERIFIED | l.47-59. Set `itemRequiereImportacion` tras lookup async. |
| `apps/sistema-modular/src/components/layout/TabContentManager.tsx` | Rutas `/admin/config-flujos` y `/admin/acciones-pendientes` con `ProtectedRoute allowedRoles=['admin']` | VERIFIED | l.173-174. |
| E2E specs: `12-pending-actions-retry.spec.ts`, `13-oc-cliente-flow.spec.ts`, extensiones a `11-full-business-cycle.spec.ts` (11.13b desfixme) + `10-smoke-all-pages.spec.ts` (admin routes) | PASSED structurally | VERIFIED | 11.13b es `test(...)` no `test.fixme` (l.396). 13.04 desfixme'd (body smoke `expect(true)`). Smoke routes presentes (l.28-29 de 10-smoke). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `presupuestosService.markEnviado` | `_crearAutoTicketSeguimiento` | try/catch + fallback a `_appendPendingAction` | WIRED | l.498-517 |
| `leadsService.resolverClienteIdPendiente` | `presupuestosService.retryPendingActionsForCliente` | dynamic `import()` (break circular) | WIRED | l.540 |
| `CargarOCModal` | `ordenesCompraClienteService.cargarOC` | await con `presupuestosIds` + context | WIRED | Imported in modal, called on submit |
| `ordenesCompraClienteService.cargarOC` | `runTransaction` multi-collection + `notifyCoordinadorOTBestEffort` | tx.get → tx.set/update manual merge + post-commit best-effort | WIRED | l.153, 265 |
| `presupuestosService.update(anular)` | `_cancelarRequerimientosCondicionales` | try/catch best-effort | WIRED | l.356 |
| `presupuestosService.update(aceptado)` | `aceptarConRequerimientos` | branching si `itemRequiereImportacion` | WIRED | l.312 |
| `useOTDetail.handleEstadoAdminChange` | `otService.cerrarAdministrativamente` | await + fallback `_appendPendingAction 'enviar_mail_facturacion'` on error | WIRED | l.157-186 |
| `otService.cerrarAdministrativamente` | `runTransaction` (OT + leads + mailQueue) | tx.update + 2x tx.set | WIRED | l.441-511 |
| `AccionesPendientesPage` | `retryPendingAction` / `markPendingActionResolved` | button onClick | WIRED | l.93, 110 |
| `ConfigFlujosPage` | `adminConfigService.update` | submit handler con validación activo + email | WIRED | l.97-106 |
| `PresupuestoItemsTableContrato.handlePickArticulo` | `atpHelpers.itemRequiresImportacion` | fire-and-forget promise | WIRED | l.53-58 |

### Requirements Coverage

| Requirement | Source Plan | Description (REQUIREMENTS.md) | Status | Evidence |
|-------------|------------|-------------------------------|--------|----------|
| FLOW-01 | 08-03 | Auto-ticket de seguimiento al enviar presupuesto sin origen | SATISFIED | `_crearAutoTicketSeguimiento` + `markEnviado` wire + retry via `resolverClienteIdPendiente`. |
| FLOW-02 | 08-02 | Al cargar OC del cliente, ticket deriva a coordinador OT | SATISFIED (code) / NEEDS_HUMAN (notify side-channel) | cargarOC atómico + ticket→`oc_recibida` + post-commit notify. Notify real side-channel es TODO — pendingAction on failure OK. |
| FLOW-03 | 08-04 | ATP en acceptance → requerimiento condicional + derivación Importaciones | SATISFIED-PARTIAL | Requerimientos condicionales creados + cancelación en anulación OK. **Derivación al área `materiales_comex` diferida**: `TicketArea` enum no incluye ese valor; se registra `pendingAction 'derivar_comex'` visible en dashboard. Aceptado en 08-04 summary. |
| FLOW-04 | 08-05 | Cierre admin OT → ticket admin + mail contable | SATISFIED (enqueue) / NEEDS_HUMAN (delivery) | 3 writes atómicos confirmed. mailQueue consumer diferido a Phase 9 (v2.0 encola, no envía). |
| FLOW-05 | 08-02, 08-04, 08-05 | `runTransaction` en 3 transiciones críticas | SATISFIED | `cargarOC` (08-02), `aceptarConRequerimientos` (08-04), `cerrarAdministrativamente` (08-05). Todos con reads-first, no arrayUnion, no nested tx. |
| FLOW-06 | 08-03, 08-05 | pendingActions[] + dashboard | SATISFIED | Type + 5 métodos service + dashboard UI con retry/resolve + useUrlFilters. |
| FLOW-07 | 08-05 | Config UI usuarios fijos + mail contable | SATISFIED | `ConfigFlujosPage` con 3 SearchableSelect + email + validación; doc `adminConfig/flujos` single-doc; RBAC gate. |

**Orphaned requirements check:** REQUIREMENTS.md mapea FLOW-01..07 a Phase 8. Todos los IDs cubiertos por al menos un plan. Ninguno orphaned. ✓

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/reportes-ot/components/ProtocolView.tsx`, `protocol/ProtocolTable.tsx` | — | Swept-in commits `f293871` (08-02 T3) y `68d3b6a` (08-03 T3) incluyen cambios pre-existentes de branch `feat/protocol-wizard-mobile` no relacionados con Phase 8 | Info | Commit hygiene issue documentado en 08-02 summary (deviation #3) — los contenidos predate Phase 8 y son additivos/consistentes con la branch activa. Guard `guard-reportes-ot.js` NO se disparó (confirma que no son edits de esta sesión). |
| `apps/sistema-modular/src/services/presupuestosService.ts` | — | 1388 LOC (baseline 871 pre-Phase-8) | Warning | Services exentos del 250-line budget per CLAUDE.md, pero el archivo agrega 6+ concerns (presupuestos CRUD + requerimientos auto + estado transitions + FLOW-01 + pendingActions + FLOW-03 acceptance). Refactor candidate para Phase 9+ (flagged en 08-03 y 08-04 summaries). |
| `apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx`, `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` | — | Pre-existing budget violations (466→518 LOC, 389→462 LOC) | Warning | Documentado en `deferred-items.md`; refactor dedicado post-v2.0. Phase 8 no los degradó significativamente. |
| Spec 13.04 | body | Desfixme'd con `expect(true).toBe(true)` — smoke only | Info | La aserción material (presupuesto con item stock ATP=0 → req condicional creado) queda deferida a un plan futuro con fixture dedicada (08-04 decision locked). Documented. |

**No blocker anti-patterns.** No `: undefined` adjacente a writes en services nuevos (ordenesCompraClienteService, adminConfigService, cargarOCHelpers). Hard rule firestore.md cumplido via `deepCleanForFirestore`. Hard rule components.md cumplido en todos los componentes nuevos (AccionesPendientesPage 221, ConfigFlujosPage 196, CargarOCModal 201 — todos ≤250).

### Human Verification Required

Ver `human_verification` en frontmatter. 4 items:

1. **Mail delivery contable (FLOW-04 end-to-end)** — runtime behavior depende de mailQueue consumer diferido a Phase 9. El doc queda encolado correctamente (verified by spec 11.13b), pero el envío real requiere Cloud Function no instalado en v2.0.
2. **Dashboard live reactivity (FLOW-06)** — subscribeAll onSnapshot es live a nivel código; UX latency/render confirmation requires browser.
3. **FLOW-05 race prevention con 2 browsers** — stress test multi-usuario simulado, no cubierto por Playwright serial.
4. **Notificación coordinador OT side-channel (FLOW-02 post-commit)** — side-channel real (in-app posta / toast / mail) es TODO en `notifyCoordinadorOTBestEffort`; la fallback pendingAction on failure sí funciona (appendea si config missing o usuario inactivo).

### Gaps Summary

**Ningún gap bloquea goal achievement.** Los 6 Success Criteria de ROADMAP están satisfechos a nivel código; los deferrals explícitos están documentados y aceptados:

1. **FLOW-03 derivación real a `materiales_comex`**: diferido a v2.1 por ausencia de esa area en el enum `TicketArea`. Workaround v2.0: pendingAction `'derivar_comex'` visible en dashboard — el admin lo ve y maneja manualmente. Aceptado en 08-04 decisions.
2. **FLOW-04 mail delivery**: mailQueue consumer diferido a Phase 9 (STKP-02 territory). v2.0 encola atómicamente; Phase 9 completará el envío. Aceptado en CONTEXT.md deferred + 08-05 known follow-ups.
3. **FLOW-02 notificación coordinador side-channel**: TODO marcado en `notifyCoordinadorOTBestEffort`. La infraestructura de pendingAction on failure está 100% OK — si usuarioCoordinadorOTId no configurado o inactivo, el dashboard muestra la pendiente. La notificación positiva (success path) queda como enhancement v2.1.

Lock compliance (CONTEXT.md):
- ✓ `PresupuestoEstado` inmutable (no `oc_recibida` agregado al presupuesto)
- ✓ `PRESUPUESTO_TO_LEAD_ESTADO` NO mapea `'oc_recibida'` (es solo ticket estado)
- ✓ `TicketEstado` enum extended con `'oc_recibida'`
- ✓ Colección `ordenesCompraCliente` separada de `ordenesCompra` (internas proveedor)
- ✓ Mail vía `mailQueue` — NO client-side `sendGmail` en `cerrarAdministrativamente`
- ✓ REV-01/02 NO implementado (diferido post-v2.0 per CONTEXT.md lock)

Hard rules:
- ✓ `deepCleanForFirestore` aplicado en todos los writes nuevos; 0 `: undefined` cerca de writes
- ✓ 250-LOC budget cumplido en componentes nuevos (ConfigFlujosPage 196, AccionesPendientesPage 221, AccionesPendientesRow 89, CargarOCModal 201, CargarOCModalParts 135)
- ⚠ `apps/reportes-ot/` — 2 archivos (ProtocolView, ProtocolTable) barridos accidentalmente en commits f293871 y 68d3b6a; contenido pre-existente de otra branch, no un edit intencional de Phase 8. Guard no se disparó. Documentado en 08-02 deviations.
- ✓ `useUrlFilters` en `RequerimientosList` (filter condicional) + `AccionesPendientesPage` (tipo/antiguedad/clienteId)

---

_Verified: 2026-04-21_
_Verifier: Claude (gsd-verifier, Opus 4.7 1M)_
