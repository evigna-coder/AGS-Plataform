---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 9
status: verifying
stopped_at: "Completed 16-02-PLAN.md (aceptarConRequerimientos patch: fechaAceptacion + presupuestoItemId writes in runTransaction)"
last_updated: "2026-05-29T18:01:35.947Z"
last_activity: 2026-05-29
progress:
  total_phases: 18
  completed_phases: 11
  total_plans: 82
  completed_plans: 76
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 9
status: Phase complete — ready for verification
stopped_at: "Completed 15-03-modal-ui-y-uat-PLAN.md (UAT 8/8 PASS firmado por usuario). Phase 15 (Venta loaner espejo a stock) COMPLETA end-to-end: 4/4 plans + 4/4 requirements operacionales (VLN-01..04). Release surface al usuario: pnpm --filter @ags/sistema-modular release:minor (MINOR — ships feature user-visible). Out-of-scope: firebase deploy --only firestore corrió OK adyacente a la sesión. Next: /gsd:verify-work para cerrar la fase formalmente."
last_updated: "2026-05-24T15:13:04.830Z"
last_activity: 2026-05-24
progress:
  total_phases: 15
  completed_phases: 11
  total_plans: 76
  completed_plans: 74
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 9
status: Phase complete — ready for verification
stopped_at: "Completed 14-08-PLAN.md (release-prep gate). Phase 14 cerrada: 8/9 plans done + 1 cancelled (14-07/BOM-07); 7/8 BOM-XX requirements complete + 1 cancelled. Validación full suite GREEN: type-check + 41/41 unit tests (test:patron-bom 18/18, test:stock-amplio 5/5, test:cuotas-facturacion 9/9, test:equivalencias 9/9) + builds (modular/reportes/portal) + AST lint clean. Playwright suite Wave 4-5 referenciada 13/13 GREEN (pre-validada en plans 14-04..14-06; re-run bloqueado por TLS corporate proxy SSL inspection, ambiental no funcional). Bump recomendado: MINOR (v1.3.3 → v1.4.0) — Phase 14 ships features user-visible. Comando surfaceado al usuario: `pnpm --filter @ags/sistema-modular release:minor` + push tag (user ejecuta manualmente; autonomous: false por diseño). Phase 15 (Venta loaner espejo a stock) ready to plan."
last_updated: "2026-05-24T06:05:00.000Z"
last_activity: "2026-05-24 — Plan 14-08: validación pre-release GREEN (41/41 unit tests + 3/3 builds + AST lint clean); delta vs sistema-modular-v1.3.3 = 28 commits totales (14 en sistema-modular+shared) incluyendo Phase 14 BOM stack completo + electron focus fixes (flash-focus, firestore wakeup, debounce gate) + portal-ingeniero bottom nav + reportes-ot Pendientes view + revert limpio del 14-07. SUMMARY 14-08 publicado con copy-paste del comando de release para el usuario."
progress:
  total_phases: 15
  completed_phases: 11
  total_plans: 72
  completed_plans: 70
---

# Decision log entry — 2026-05-24 (release-prep gate)

**[Phase 14-08 — release-prep gate cerrado, handoff al usuario]**: Validación pre-release ejecutada en full: type-check GREEN, 4/4 unit suites GREEN (test:patron-bom 18/18, test:stock-amplio 5/5, test:cuotas-facturacion 9/9, test:equivalencias 9/9 = 41/41 total), 3/3 builds GREEN (modular generó `AGS-Sistema-Modular-Setup-1.3.3.exe`, reportes + portal sanity), AST lint sin findings. Playwright suite Wave 4-5 (13 specs) referenciada como pre-validada 13/13 GREEN durante plans 14-04..14-06; re-run en esta sesión bloqueado por TLS corporate proxy (`unable to verify the first certificate`) — diagnosticado como bloqueo ambiental NO regresión de código (las unit tests con mock Firestore stub sí pasan).

**Bump recomendado**: MINOR. Phase 14 ships features user-visible (editor BOM componentes inline en PatronEditorPage, badges BOM/BLOQUEADO/AGOTADO + filtro 'Bloqueados' URL-persisted en PatronesList, banner PatronComponentesAlertBanner, paso 'Patrones consumidos' en OTCierreAdminSection con auto-prefill FIFO + dedupe + idempotency, SearchableSelect 'Requerimientos de patrón' en /admin/config-flujos para usuarioRequerimientosPatronId, auto-REQ patron_minimo con índice deployed). Sin breaking changes — patrones legacy sin componentes[] siguen funcionando (BOM-01 backwards-compat por extensión opcional).

**Surface-don't-execute**: Plan marcado autonomous: false; Claude NO ejecuta `pnpm release:minor`. El usuario corre el comando porque (a) es el único con `.exe` para smoke en su máquina real, (b) el push del tag dispara broadcast a PCs instaladas y necesita human gate explícito, (c) precedente en .claude/rules/release-flow.md. Comando exacto + checklist surfaceado en SUMMARY 14-08 y en mensaje final del orchestrator.

**Phase 14 status final**: Complete (8/9 plans + 1 cancelled). 7/8 BOM-XX Complete + 1 Cancelled (BOM-07). Phase 15 (Venta loaner espejo a stock) ready to plan via /gsd:plan-phase 15.

---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 9
status: Ready to execute
stopped_at: "Plan 14-07 CANCELLED (model mismatch — technician selects caja maestra not components; BOM accounting is admin-only). Commit 6229cde reverted en 4be3b95. BOM-07 marked cancelled en REQUIREMENTS.md + ROADMAP.md. Next: 14-08 release-prep."
last_updated: "2026-05-24T05:35:00.000Z"
last_activity: "2026-05-24 — Plan 14-07 CANCELLED. User feedback: 'desde patrones del listado lo que se hace es seleccionar la muestra, la caja maestra. La descarga de la ampolla va a ser desde el cierre administrativo, no nos interesa que el ingeniero seleccione o aparezcan los componentes'. Plan 14-07 había implementado badge AGOTADO + disable selection sobre lotes con saldo BOM ≤ mínimo en reportes-ot — esto violaba el modelo de dominio (admin-side leak en frozen-surface app del técnico). Revert limpio via git revert 6229cde (commit 4be3b95). Frozen-surface restaurado al 100%. Phase 14 ahora: 7 done / 1 cancelled / 1 pending (14-08 release-prep)."
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 72
  completed_plans: 69
---

# Decision log entry — 2026-05-24

**[Phase 14-07 — CANCELLED]**: El plan agregaba badge "AGOTADO"/"BLOQUEADO" + disable selection sobre lotes con saldo BOM ≤ mínimo en `InstrumentoSelectorPanel.tsx` (commit `6229cde`). Cancelado tras feedback del usuario: el técnico en reportes-ot solo selecciona la caja maestra del kit; los componentes individuales (ampollas) son contabilidad EXCLUSIVA del cierre administrativo en sistema-modular. Exponer estado BOM en reportes-ot era un admin-side leak en la app del técnico (frozen-surface). Revert en commit `4be3b95`. BOM-07 marked `Cancelled` en REQUIREMENTS.md y `[~]` en ROADMAP.md. **Lección de planning**: cuando un plan toca una frozen-surface, validar el modelo de dominio con el usuario ANTES de planear la excepción.

---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 7
status: executing
stopped_at: Completed 14-06-PLAN.md (BOM-05 + BOM-08 UI cerrados end-to-end; Playwright UAT 8/8 GREEN post-deploy del índice requerimientos_compra(origen,createdAt))
last_updated: "2026-05-24T04:33:33.223Z"
last_activity: 2026-05-24
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 72
  completed_plans: 68
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 6
status: Ready to execute
stopped_at: "Completed 14-04-PLAN.md (BOM-04 editor 'Componentes (BOM)' + sub-componente extraído PatronComponentesEditor + defense-in-depth rename guard double-layer; suite test:patron-bom 14 → 18 GREEN; UAT Playwright 3/3 GREEN)"
last_updated: "2026-05-22T15:45:00.000Z"
last_activity: "2026-05-22 — Plan 14-04: feat(14-04) 1caf14f (PatronComponentesEditor 225 LOC sub-component) + 27c0e3b (wire en PatronEditorPage 335→374 LOC + validation extracted) + 4d492a2 (TDD RED 4 service-guard tests) + de02db4 (GREEN: buildUpdatePatron factory + validateNoOrphanConsumos throw). UAT Playwright 3/3 GREEN (specs 14.40/14.41/14.42 via commits e2f2153/4b3a5dd/69f7a06/30cd0f8/92a8f4c). Plan cerrado."
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 72
  completed_plans: 67
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
current_plan: 5
status: executing
stopped_at: Completed 14-03-PLAN.md (BOM-08 autoCrearRequerimientosPatron + idempotency; suite 14/14 GREEN; services layer del Phase 14 COMPLETE)
last_updated: "2026-05-22T15:30:05.994Z"
last_activity: 2026-05-22
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 72
  completed_plans: 66
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: Ready to execute
stopped_at: Phase 14 context gathered
last_updated: "2026-05-15T18:32:15.909Z"
last_activity: "2026-05-05 — Plan 04-05: feat(04-05) 6f1c458 (EnviarAnexosSection) + eecb2f6 (useEnviarPresupuesto extendido + useEnviarAnexos split a 90/217 LOC) + bdf8fcb (EnviarPresupuestoModal integration). Smoke E2E aprobado. Side-track commits f7aeb1f/3c8eb22/9f0124b durante smoke (fixes preexistentes, fuera de scope plan 04-05)."
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 63
  completed_plans: 62
  percent: 87
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Completed 04-05-PLAN.md (email integration + smoke E2E approved); Phase 4 (Anexo Consumibles) COMPLETA — 6/6 requirements"
last_updated: "2026-05-05T13:22:44.738Z"
last_activity: "2026-05-05 — Plan 04-05: feat(04-05) 6f1c458 (EnviarAnexosSection) + eecb2f6 (useEnviarPresupuesto extendido + useEnviarAnexos split a 90/217 LOC) + bdf8fcb (EnviarPresupuestoModal integration). Smoke E2E aprobado. Side-track commits f7aeb1f/3c8eb22/9f0124b durante smoke (fixes preexistentes, fuera de scope plan 04-05)."
progress:
  [█████████░] 87%
  completed_phases: 9
  total_plans: 55
  completed_plans: 54
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Completed 04-05-PLAN.md (email integration + smoke E2E approved); Phase 4 (Anexo Consumibles) COMPLETA — 6/6 requirements done"
last_updated: "2026-05-05T13:13:00.000Z"
last_activity: "2026-05-05 — Plan 04-05: feat(04-05) 6f1c458 (EnviarAnexosSection) + eecb2f6 (useEnviarPresupuesto extendido + useEnviarAnexos split) + bdf8fcb (modal integration). Smoke E2E aprobado por usuario. Side-track commits durante smoke: f7aeb1f (fix sistemaId/responsable persist), 3c8eb22 (firestore rule consumibles_por_modulo), 9f0124b (UX código+descripción desde catálogos). Phase 4 cerrada."
progress:
  total_phases: 12
  completed_phases: 9
  total_plans: 55
  completed_plans: 54
  percent: 98
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 04-04-PLAN.md (AnexoConsumiblesPDF + buildAnexosFromPresupuesto + barrel re-exports)
last_updated: "2026-04-29T15:45:45.906Z"
last_activity: "2026-04-29 — Plan 04-04: feat(04-04) e61f112 (AnexoConsumiblesPDF + generator) + 24cbb9a (buildAnexosFromPresupuesto orchestrator) + ede9c60 (re-exports en pdf/index.ts)."
progress:
  total_phases: 12
  completed_phases: 8
  total_plans: 55
  completed_plans: 53
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 04-02-PLAN.md (consumiblesPorModuloService + admin page + toolbar wiring)
last_updated: "2026-04-29T15:44:36.181Z"
last_activity: "2026-04-29 — Plan 04-02: feat(04-02) bbde394 (servicio CRUD + lookup) + b8147a1 (admin page + form) + 270b166 (route + toolbar wiring)."
progress:
  total_phases: 12
  completed_phases: 8
  total_plans: 55
  completed_plans: 53
  percent: 96
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 04-02-PLAN.md (consumiblesPorModuloService + admin page + toolbar wiring)
last_updated: "2026-04-29T15:43:46.311Z"
last_activity: "2026-04-29 — Plan 04-03: feat(04-03) a9b934c (Anexo column en ServiciosEditor) + 310f552 (hydrate/create/update normalize) + 6a28b7a (seed comment)."
progress:
  [██████████] 96%
  completed_phases: 8
  total_plans: 55
  completed_plans: 52
  percent: 95
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 04-03-PLAN.md (editor + service wiring del flag requiereAnexoConsumibles; columna Anexo + hydrate/create/update normalize)
last_updated: "2026-04-29T15:40:26.168Z"
last_activity: "2026-04-29 — Plan 04-01: feat(04-01) b1723b0 (TipoEquipoServicio.requiereAnexoConsumibles) + 3ba75b4 (ConsumibleModulo + ConsumiblesPorModulo)."
progress:
  [██████████] 95%
  completed_phases: 8
  total_plans: 55
  completed_plans: 51
  percent: 93
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Completed 04-01-PLAN.md (foundation types: requiereAnexoConsumibles flag + ConsumibleModulo + ConsumiblesPorModulo)"
last_updated: "2026-04-29T15:27:19.583Z"
last_activity: "2026-04-26 — Plan 12-06 finalized: 49a264d (data-testid), e703cb1 (E2E sub-suites 11.50/11.51/11.52), 00b2250 (SUMMARY Tasks 1-3). Gap discovered: create-flow esquema wiring missing."
progress:
  [█████████░] 93%
  completed_phases: 8
  total_plans: 55
  completed_plans: 50
  percent: 93
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Plan 12-06 complete (user-approved, e2e validation deferred to gap closure for unified create+edit flow). Ready for gap closure 12-07: EsquemaFacturacionSection in CreatePresupuestoModal."
last_updated: "2026-04-26T16:30:00Z"
last_activity: "2026-04-26 — Plan 12-06 closed: data-testid attributes (49a264d) + E2E sub-suites 11.50/11.51/11.52 implemented (e703cb1). Task 4 user-approved deferred — e2e + visual checks move to gap closure plan 12-07 (create-flow integration)."
progress:
  [█████████░] 93%
  completed_phases: 6
  total_plans: 44
  completed_plans: 41
  percent: 93
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

Phase: 14 of 15 (Stock — Patrones con BOM, composición y consumo desagregado) — IN PROGRESS (7/9 plans)
Current Plan: 9
Total Plans in Phase: 9 (14-00 ... 14-08)
Status: Services layer + Editor UI BOM-04 + Cierre Admin BOM-05/BOM-08 + List Badges/Filtro BOM-06 COMPLETE. Admin ve qué patrones necesitan atención sin entrar al editor (badges BOM/BLOQUEADO/AGOTADO + filtro 'Bloqueados' URL-persisted); técnico ve qué lotes están bloqueados sin abrir admin (14-07 selector badge); cierre admin descuenta con auto-REQ. Loop visual cerrado. Plan 14-07 (BOM-07 selector reportes-ot) ya commiteado previamente (commit 6229cde, frozen-exception scoped). Próximo: 14-08 (release prep — full suite validation + RELEASE-CHECKLIST smoke + pnpm release:minor user-cut).
Last activity: 2026-05-29

Progress: [█████████░] 95% (v2.0 milestone — 62/63 plans + Phase 14 ongoing 7/9)

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
| Phase 12-esquema-facturacion-porcentual-anticipos P04 | 441s | 3 tasks | 6 files |
| Phase 12-esquema-facturacion-porcentual-anticipos P05 | 15min | 2 tasks | 3 files |
| Phase 12-esquema-facturacion-porcentual-anticipos P07 | 20min | 6 tasks | 5 files |
| Phase 03-presupuestos-plantillas-texto P02 | 2min | 1 tasks | 1 files |
| Phase 03-presupuestos-plantillas-texto P01 | 136s | 2 tasks | 2 files |
| Phase 03-presupuestos-plantillas-texto P07 | 5min | 1 tasks | 1 files |
| Phase 03-presupuestos-plantillas-texto P03 | 154s | 4 tasks | 4 files |
| Phase 03-presupuestos-plantillas-texto P06 | 357s | 4 tasks | 5 files |
| Phase 03-presupuestos-plantillas-texto P04 | 90s | 1 tasks | 1 files |
| Phase 03-presupuestos-plantillas-texto P05 | 130s | 2 tasks | 1 files |
| Phase 04-presupuestos-anexo-consumibles P01 | 2min | 2 tasks | 1 files |
| Phase 04-presupuestos-anexo-consumibles P03 | 5min | 3 tasks | 3 files |
| Phase 04-presupuestos-anexo-consumibles P02 | 8min | 3 tasks | 6 files |
| Phase 04-presupuestos-anexo-consumibles P04 | 9min | 3 tasks | 3 files |
| Phase 04-presupuestos-anexo-consumibles P05 | 16min | 3 tasks + 1 checkpoint | 4 files |
| Phase 13-stock-equivalencias-compra-uso P01 | 12min | 1 tasks | 4 files |
| Phase 13-stock-equivalencias-compra-uso P00 | 268s | 3 tasks | 2 files |
| Phase 13-stock-equivalencias-compra-uso P02 | 626 | 2 tasks | 4 files |
| Phase 13-stock-equivalencias-compra-uso P04 | 5min | 2 tasks | 4 files |
| Phase 13-stock-equivalencias-compra-uso P03 | 226 | 1 tasks | 1 files |
| Phase 13-stock-equivalencias-compra-uso P05 | 224 | 2 tasks | 2 files |
| Phase 13 P06 | 6min | 3 tasks | 4 files |
| Phase 13-stock-equivalencias-compra-uso P06 | 9min | 5 tasks | 5 files |
| Phase 13-stock-equivalencias-compra-uso P07 | 11min | 5 tasks | 9 files |
| Phase 13-stock-equivalencias-compra-uso P07 | 11min | 6 tasks | 9 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P00 | 13min | 2 tasks | 4 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P01 | 17min | 2 tasks | 6 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P02 | 7min | 1 tasks | 2 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P03 | 3min | 2 tasks | 3 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P04 | ~30min | 4 tasks + 1 checkpoint UAT | 5 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P06 | ~3h (incl bug-fix + deploy índice + UAT 8/8) | 5 tasks | 5 files |
| Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado P05 | ~50min | 3 tasks + 1 checkpoint UAT | 4 files |
| Phase 15 P00 | 6 min | 2 tasks | 4 files |
| Phase 15 P01 | 5m | 2 tasks | 1 files |
| Phase 15-stock-venta-de-loaner-espejo-a-stock P02 | 30min | 2 tasks | 5 files |
| Phase 15 P03 | 22min | 3 tasks | 4 files |
| Phase 16-entregas-visor-de-cumplimiento P16-01 | 30 | 4 tasks | 6 files |
| Phase 16-entregas-visor-de-cumplimiento P02 | 10 | 1 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution

- 2026-04-25 — Phase 12 added: Esquema Facturación Porcentual + Anticipos (cuotas % + hitos + MIXTA per-moneda; opt-in, no rompe Tier-1 legacy). Plan de referencia: `.claude/plans/facturacion-anticipos-y-porcentajes.md`.
- 2026-05-15 — Phase 13 added: Stock — Equivalencias compra↔uso. Primera de 3 fases consecutivas. Diseño completo en `memory/project_stock_v2_decisions.md`. Driver: 2 semanas de runway con sistema viejo; user carga posiciones y minikits en paralelo a la implementación.
- 2026-05-15 — Phase 14 added: Stock — Patrones con BOM (composición y consumo desagregado). Diseño en `memory/project_stock_v2_decisions.md`. Depende de Phase 13.
- 2026-05-15 — Phase 15 added: Stock — Venta de loaner espejo a stock. Diseño en `memory/project_stock_v2_decisions.md`. Depende de Phase 14.
- 2026-05-29 — Phase 16 added: Entregas — Visor de cumplimiento. Campo `disponibilidad` + `etaDiasEstimados` en `PresupuestoItem` + vista `/entregas` que resuelve la cadena ppto-item→req→OC→IMP. Sin auto-cosecha items→OT (coherente con decisión cutover 2026-05-24). Pedido del dueño para visibilidad operativa pre-cutover sistema viejo.
- 2026-05-29 — Phase 17 added: OC — Paridad con presupuestos (PDF, email, status, auditoría). Cierra el envío al proveedor con la misma calidad operativa del envío de presupuestos: PDF de OC + clon de `useEnviarPresupuesto` → `useEnviarOC` + auto-transición `aprobada → enviada_proveedor` + auto-ticket a `usuarioResponsableComexId` + eventos de auditoría. Depende de Phase 16.
- 2026-05-29 — Phase 18 added: Importaciones — Liquidación NCM + factor de importación. Sumar alícuotas a `PosicionArancelaria` (DI/TE/IVA/IVA adic./IIBB/Ganancias) + liquidación CIF→base→tributos + factor por item, integrado con el prorrateo existente de `calcularProrrateo.ts`. Depende de Phase 17. No bloqueador del cutover.

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
- [Phase 12-esquema-facturacion-porcentual-anticipos]: W5 split executed from start: GenerarSolicitudCuotaInputs.tsx extracted to keep GenerarSolicitudCuotaModal at 219 lines
- [Phase 12-esquema-facturacion-porcentual-anticipos]: W6 applied: zero-percentage monedas hidden entirely in mini-modal (not disabled placeholders) — research-recommended, revisitable
- [Phase 12-esquema-facturacion-porcentual-anticipos]: runRecompute closure in update() applied on all 3 branches (FLOW-01, FLOW-03, normal) — W3 fix; shouldRecompute guard skips when caller sets esquemaFacturacion directly (loop guard)
- [Phase 12-esquema-facturacion-porcentual-anticipos]: facturacionService.marcarFacturada simplified: removed redundant post-commit trySync since update() now handles recompute+trySync when estado is present
- [Phase 12-07]: usePresupuestoEdit.save() does not write cuotas[] for any type — no Task 5 action needed; contrato cuotas managed via special paths
- [Phase 12-07]: PdfEsquemaFacturacionSection extracted as colocated PDF sub-component (pure fn, no hooks, safe for react-pdf tree)
- [Phase 03-presupuestos-plantillas-texto]: RichTextEditor alignment: TOOLBAR_BUTTONS.slice(0,5)+slice(5) with JSX divider keeps BtnId union clean; exec() is generic so no handler change needed for justifyLeft/Center/Right
- [Phase 03-presupuestos-plantillas-texto]: No cache for plantillasTextoPresupuesto reads (max ~8 docs, rare access); getDefaultsForTipo uses client-side filter to avoid composite index
- [Phase 03-presupuestos-plantillas-texto]: Seed script uses null for all absent audit fields; idempotency via (nombre, tipo) composite key; PRESUPUESTO_TEMPLATES inlined as single-quoted strings to avoid nested backtick escaping
- [Phase 03-presupuestos-plantillas-texto]: PlantillaRow extracted proactively before PlantillasTextoModal to keep modal under 250-line budget; maxWidth='xl' for modal gives RichTextEditor comfortable space
- [Phase 03-presupuestos-plantillas-texto]: react-pdf-html v2.1.5 chosen for HTML→PDF rendering; FontRenderer typed inline (HtmlRenderer not exported from package index); renderers cast as any for strict HtmlRenderers type; resetStyles=true mandatory per Pitfall 5; resetKey={html} on ErrorBoundary for fresh retry on content change
- [Phase 03-presupuestos-plantillas-texto]: 03-04: Gestionar plantillas link in card header (single entry point); per-section select dropdown resets after selection; loadPlantillas() on modal close refreshes dropdowns without page reload
- [Phase 03-presupuestos-plantillas-texto]: autoAppliedOnce flag gates once-per-open auto-apply; alphabetical-first conflict resolution; silent error path in v1 (console.error only)
- [Phase 04-presupuestos-anexo-consumibles]: Flag requiereAnexoConsumibles ortogonal a TipoServicioPlantilla — cualquier tipo (mantenimiento/regulatorio/consumible/otro) puede llevarlo, opcional con default omitido = false (back-compat sin migración)
- [Phase 04-presupuestos-anexo-consumibles]: ConsumibleModulo SIN precio ni periodicidad — anexo es informativo, precio implícito en ítem MPCC del PDF principal; periodicidad va a nivel de servicio
- [Phase 04-presupuestos-anexo-consumibles]: ConsumiblesPorModulo unique-key por codigoModulo (part number Agilent) — catálogo declarativo reusable entre plantillas (G7129A en HPLC 1260 y 1290 se declara una sola vez)
- [Phase 04-presupuestos-anexo-consumibles]: Plan 04-03: hydrate-normalize pattern — tiposEquipoService.hydrate() defaultea requiereAnexoConsumibles a false en read-time; create/update normalizan servicios[] antes de cleanFirestoreData. Sin migración: docs legacy se hidratan deterministicamente; el primer save persiste el flag automáticamente.
- [Phase 04-presupuestos-anexo-consumibles]: Plan 04-03: update() conditional-normalize — solo mapea servicios[] si el patch lo incluye, preserva semántica partial-update.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-02]: deepCleanForFirestore obligatorio en consumiblesPorModuloService — payload tiene array nested consumibles[]; cleanFirestoreData (shallow) NO recurriría dentro del array
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-02]: getByCodigoModulo no filtra por activo — política de inactivos queda en el caller (builder anexo plan 04-04 filtra; admin UI puede mostrar)
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-02]: codigoModulo case-sensitive (part numbers Agilent son códigos cerrados) + auto-uppercase on blur en form para capturar entrada inconsistente
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-02]: List + Form split (180 + 199 LOC) para mantener cada componente bajo 250 líneas (regla components.md); simplificación de TiposEquipoList layout (sin useResizableColumns/SortableHeader/ColAlignIcon) documentada como única desviación
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-04]: Detección de "código de módulo" en módulos reales — regex Agilent /^[A-Z][0-9]{3,5}[A-Z]?$/ sobre mod.nombre.trim(); ModuloSistema no tiene campo partNumber explícito. Si no matchea → placeholder caso (i) (warning + texto italics en PDF)
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-04]: Flag requiereAnexoConsumibles cross-plantilla — si CUALQUIER plantilla con mismo servicioCode lo marca, se respeta. Previene falsos negativos cuando el flag está tildado en HPLC 1260 pero no en HPLC 1260 Infinity.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-04]: buildAnexosFromPresupuesto recibe modulosBySistema + plantillas pre-cargados (mismo patrón que generatePresupuestoPDF.tsx). NO llama Firestore para módulos/plantillas. Solo lookup consumibles_por_modulo se hace inline (cacheado por código en Map con null-sentinel).
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-04]: 4 casos edge — (i) sin código + warning, (ii) código no en catálogo + warning, (iii) lista vacía intencional → SKIP silencioso, terminal (sin módulos ni plantilla) → no se genera anexo + warning. Si modulosOut.length === 0 después de procesar todos → skip-ear el anexo entero.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Default ON al abrir el modal: si hay anexos disponibles, includeAnexos arranca tildado. Operación natural ('mandar todo') = 1 click. Destildar es el caso excepcional.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Mandatory hook split — useEnviarAnexos.ts (90 LOC) extraído ANTES de pasar 280 LOC en useEnviarPresupuesto.ts (217 LOC). Razón: dos máquinas de estado entrelazadas (token-first OAuth + anexo prep) sobre el mismo archivo cruzan el umbral de revisión en una pasada. La API pública del orquestador NO cambia.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Stage 2.5 'preparing_anexos' insertado entre 'generating_pdf' y 'sending'. Token-first order de Phase 7 PRESERVADO: si Stage 2.5 falla, setStatus('error') + return ANTES de sendGmail. El presupuesto NO transiciona a 'enviado'.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Pre-load fire-and-forget en useEffect on open=true. loadAnexos() no bloquea el render; anexosLoading flag muestra spinner italic. El vendedor edita destinatarios/mensaje en paralelo a la carga de catálogos.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Preview por anexo individual (no merge). Si N>1, dropdown selector + 'Ver anexo' abre el seleccionado en nueva pestaña — paridad con el envío real (N adjuntos separados).
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Soft-warnings vs terminal-warnings UI distinction. Terminal (sistema_sin_modulos_ni_plantilla) → banner amarillo prominente. Soft (modulo_sin_codigo / codigo_no_en_catalogo) → <details> colapsado. Evita ruido visual cuando catálogo legacy tiene muchos módulos sin código identificable.
- [Phase 04-presupuestos-anexo-consumibles]: [Phase 04-05]: Smoke surfaceó 3 bugs preexistentes — commits separados (f7aeb1f sistemaId/responsable, 3c8eb22 firestore rule, 9f0124b UX código+descripción). NO atribuibles al plan 04-05; documentados en SUMMARY 'Side-track commits during smoke'.
- [Phase 13-stock-equivalencias-compra-uso]: articuloDestinoCodigo/articuloDestinoDescripcion dropped from MovimientoStock (CONTEXT M6 trim) — recover at display-time via articulosService.getById(articuloDestinoId)
- [Phase 13-stock-equivalencias-compra-uso]: articuloIdDestinoEquivalencia flat field on Articulo for Firestore where() index — source-of-truth stays in equivalencias[], always kept in sync by service
- [Phase 13-stock-equivalencias-compra-uso]: subtipo as string literal not enum on MovimientoStock — avoids forcing enum import on existing consumers that only read tipo
- [Phase 13-stock-equivalencias-compra-uso]: Wave 0 scaffolding files partially committed by 13-01; 13-00 added spec file + package.json script to complete baseline
- [Phase 13-stock-equivalencias-compra-uso]: MockEquivalenciasState (not FirestoreDouble) is what __setTestFirestore accepts — matches Wave 0 fixture shape from plan 13-00; FirestoreDouble is an exported interface for plan 13-03 tx-mock tests
- [Phase 13-stock-equivalencias-compra-uso]: Both directions of articulosService<->equivalenciasService are lazy imports — eliminates module-load cycle without barrel workarounds
- [Phase 13-stock-equivalencias-compra-uso]: useEquivalenciaSection self-loads articulo via articulosService.getById when prop absent — avoids extending useEditArticuloForm; EquivalenciaSection takes only articuloId prop
- [Phase 13-stock-equivalencias-compra-uso]: Atomic UnidadStock model confirmed (1 doc = 1 physical unit): desagregarUnidades marks N origen docs consumido + creates N*factor destino docs disponible + 1 MovimientoStock subtipo=conversion. MovimientoStock does NOT write articuloDestinoCodigo/Descripcion — recover at display-time via articulosService.getById(articuloDestinoId)
- [Phase 13-stock-equivalencias-compra-uso]: auth.usuario?.displayName used (not .nombre) — UsuarioAGS has displayName not nombre; corrected in useDesagregarStock
- [Phase 13-stock-equivalencias-compra-uso]: DesagregarStockModal uses success block (replaces form body) not toast — user sees N→M before closing; 13.40 E2E fixme stays until 13-06 wires CTA
- [Phase 13-stock-equivalencias-compra-uso]: mode='loading' is first-class return value from useEquivalenciaDual (M5 fix) — prevents null→loading→destino flicker during async discovery
- [Phase 13-stock-equivalencias-compra-uso]: Row ordering in dual display: viewer's article is anchor — mode=origen shows origen row first; mode=destino shows destino row first (m4 spec)
- [Phase 13]: ViewArticuloModal (Ver button) is the real articulo detail surface for list users — dual display must be wired there, not just in the route-based ArticuloDetail page
- [Phase 13-stock-equivalencias-compra-uso]: ArticulosListThead as co-located inner component: keeps thead definition alongside shell without new import chain
- [Phase 13-stock-equivalencias-compra-uso]: EquivalenciaBadge tooltip pure CSS/Tailwind (group/group-hover:visible) — no tooltip library; shows origen→destino×factor on hover
- [Phase 13-stock-equivalencias-compra-uso]: seedEquivalenciaPair uses Firestore client SDK (not admin) — project decision I1 from Phase 8 Wave 0; no admin SDK configured
- [Phase 13-stock-equivalencias-compra-uso]: shouldExpandRow exact-match-only (not substring) — prevents lista from expanding all linked rows simultaneously per CONTEXT spec
- [Phase 13-stock-equivalencias-compra-uso]: EquivalenciaBadge tooltip pure CSS/Tailwind (group/group-hover:visible) — no tooltip library; shows origen→destino×factor on hover
- [Phase 13-stock-equivalencias-compra-uso]: seedEquivalenciaPair uses Firestore client SDK (not admin) — project decision I1 from Phase 8 Wave 0; no admin SDK configured
- [Phase 13-stock-equivalencias-compra-uso]: shouldExpandRow exact-match-only (not substring) — prevents lista from expanding all linked rows simultaneously per CONTEXT spec
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: Fixtures usan as any para Patron.componentes / PatronLote.componentesConsumidos hasta que 14-01 landea los types extension — type-check pasa, value-imports fallan (RED esperado)
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: MockPatronBomState con Map<id, doc> en lugar de array (lookup O(1) para fixtures con N patrones); apartamiento del shape MockEquivalenciasState (array) justificado por patrón de acceso id-based
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: Test colocation en src/__tests__/ (no src/services/__tests__/) porque el suite cubre helpers de @ags/shared (BOM-02 puros) además del service; separa de los tests-de-services
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-02 debe refactor patronesService para lazy firebase imports (patrón equivalenciasService) — los stubs actuales heredan eager firebase y rompen tsx con import.meta.env undefined
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: Deep import via package.json exports map + tsconfig wildcard path enables 'from @ags/shared/utils/patronBom' across Vite/tsc/tsx-Node — utils.ts restructured to utils/index.ts directory
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: patronesService.ts refactored to lazy-firebase pattern (Phase 13 equivalenciasService 1:1) — required so tsx test runner can load the module without import.meta.env crash
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: __setTestFirestore + consumirComponentes stubs that THROW NOT_IMPLEMENTED (Phase 8 cargarOC pattern) — keeps 9/14 BOM-02 helper tests honest while leaving 5/14 BOM-03+BOM-08 tests RED for 14-02/14-03 to turn GREEN
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-02: consumirComponentes implementado via factory-pattern DI extraído a patronesConsumirHelpers.ts — patronesService.ts 247 LOC, helper 286 LOC. Factory recibe getTestState + getFirebaseModules deps, evita import circular y mantiene service como single source of truth del _testState.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-02: Compute-validate-mutate sequencing en test path — build updates[] para ALL patrones primero, validar cada uno, THEN mutar state.patrones. Sin esto la atomicity test BOM-03 dejaría partial mutations cuando segundo patron del payload falla validación.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-02: Idempotency check (BOM-08 first half) pre-tx, no inside-tx — query where(otNumber, entidadTipo=patron) antes de entrar runTransaction (Firestore tx no soporta where queries). Si descubrimos concurrency, agregar sentinel patronesConsumidos_idempotency/{otNumber} dentro de la tx (patrón Phase 9 ot_cierre_idempotency).
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-02: MovimientoStock.lote = string natural (NOT loteId sintético) — RESEARCH pitfall 3 confirmado. Audit triple = patronId + lote (string código) + codigoComponente. No hay PatronLote.id.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-03: autoCrearRequerimientosPatron en archivo separado (178 LOC) — best-effort post-commit con try/catch, NUNCA rollbackea el consumo si falla. Idempotency key = (patronId, loteId, codigoComponente) + estado abierto (!= comprado/cancelado).
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-03: Skip silencioso si adminConfigFlujos.usuarioRequerimientosPatronId === null — admin no obligado a configurarlo desde día 0 (UI editor del campo landea en 14-06). Warn en prod, silent en test.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-03: ADMIN_CONFIG_DEFAULTS Pick<> widened a 'mailFacturacion' | 'usuarioRequerimientosPatronId' — default null. ConsumirComponentesResult extendido con requerimientosCreados: string[] para que 14-06 muestre count en toast.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-04: PatronComponentesEditor extraído a 225 LOC (sub-componente nuevo, JSX-heavy table) — PatronEditorPage queda en 374 LOC dentro del soft-budget 380. Sub-componente landeado en Task 1 ANTES de wirearlo al padre en Task 2 para evitar el anti-pattern "implementar inline + refactorizar después".
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-04: patronComponentesValidation.ts (30 LOC) — pure function validator extraído. Detecta duplicados (case-sensitive, trim-aware) + filas con descripción sin código. Mantiene la validación fuera del componente, testeable sin React, reusable para 14-05 si quiere mostrar las mismas advertencias en la lista.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-04: patronesUpdateHelpers.ts (119 LOC) — buildUpdatePatron factory replica 1:1 el patrón factory de 14-02 (buildConsumirComponentes). Mantiene patronesService.ts en 248 LOC (bajo 250 hard limit) sin sacrificar DI test path. Factory recibe getTestState + getFirebaseModules como deps.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-04: Defense-in-depth rename guard double-layer — UI lockedCodigos prop (PatronComponentesEditor disabled-input + lock helper text + alert en delete) es la friendly fence; service layer validateNoOrphanConsumos THROWS con mensaje listando todos los códigos huérfanos en un solo error es el load-bearing guard. Captura bypass via DevTools console + futuros refactors UI que olviden el prop. Guard runs ONLY when patch.componentes !== undefined (cero overhead en patches no-relacionados).
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-06: ordenesTrabajoService.getPatronesSeleccionados (+18 LOC en otService 855 LOC) — read-only accessor para cumplir rules/firestore.md sin getDoc raw en hooks
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-06: useCierrePatronesConsumidos (223 LOC) — orquesta prefill (dedupe + FIFO por vencimiento), idempotency pre-render via movimientosService.getAll, submit a consumirComponentes con motivo 'Divergencia admin: sugerido=X, real=Y — ...'
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-06: CierrePatronesConsumidosSection (193 LOC) — 3 estados (loading / read-only banner verde / tabla editable); pre-extracción ANTES de tocar OTCierreAdminSection para mantenerlo en 258 LOC (soft budget 280 OK)
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-06: ConfigFlujosPage SearchableSelect para usuarioRequerimientosPatronId con default null + validación user-activo en handleSave; admin no obligado a setear desde día 0 (autoCrearRequerimientosPatron skipea silencioso si null)
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-06 PITFALL: requerimientos_compra(origen ASC, createdAt DESC) índice compuesto faltaba — sin él autoCrearRequerimientosPatron fallaba silenciosamente en prod (query Firestore 'FAILED_PRECONDITION' swallowed por try/catch best-effort wrapper). FIX: agregado en firestore.indexes.json + deployed via firebase deploy --only firestore:indexes. LECCIÓN: TODA query con where+orderBy necesita índice compuesto declarado upfront; los best-effort wrappers ocultan el error en prod. Documentar como hard rule transversal.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-05: PatronRow.tsx (122 LOC) extraído de PatronesList para meter 3 badges (BOM teal / BLOQUEADO rose / AGOTADO rose-darker) sin romper el budget — sub-componente con click-handlers preservados 1:1. PatronesList.tsx bajó de 330 → 303 LOC NETO tras la extracción + filtro 'Bloqueados' agregado (cleanup incidental de 2 imports muertos).
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-05: PatronComponentesAlertBanner.tsx (73 LOC) — pure presentational, return null cuando no hay entries (lote, componente) problematic. Padre renderiza UNCONDITIONALLY, el componente decide. Patrón reusable para warning banners en otras listas (cero overhead en patrones sanos).
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-05: PatronEditorPage.tsx 374 → 398 LOC (+24), dentro del soft budget 400 del plan. Banner agregado inline ANTES del Lotes card header (top-down flow: Header → Componentes (BOM) → Alert → Lotes → Footer).
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-05: Filtro 'Bloqueados' usa useUrlFilters schema-based con FILTER_SCHEMA = { bloqueados: { type: 'boolean', default: false } } — 1:1 con convención de memory/feedback_filter_persistence.md. Toggle = (computePatronStatus(p) === 'bloqueado' || === 'agotado'): 1 checkbox cubre ambos estados, AGOTADO es variante crítica de BLOQUEADO. URL ?bloqueados=true persiste refresh + share-link safe.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-05: Refactor + feature en el MISMO commit (Task 1 = `refactor` commit `261ba9a` extrae PatronRow Y agrega badges en una unidad de trabajo). Sin la extracción, agregar 3 badges habría empujado PatronesList a >360 LOC. Decisión: cuando el refactor es prerequisito mecánico del feature, commit unificado vence a scaffolding-commit-separado.
- [Phase 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado]: 14-05: data-testids específicos para UAT Playwright (patron-row, badge-bom, badge-bloqueado, badge-agotado, filter-bloqueados, patron-componentes-alert-banner). Convención: semantic testids, no class-based selectors. Spec 14.50 con 5 sub-specs (14.50/14.51/14.52/14.53/14.54) — 5/5 GREEN en primer intento.
- [Phase 15]: Wave 0 baseline shipped con runner intermedio scripts/test-venta-loaner.ts (mirror estricto Phase 14) + factory fixtures + 5 RED tests bajo describe('registrarVenta...') — Consistencia visual del bloque test:* en package.json y un único patrón runner que el lector reconoce. Factory functions evitan JSON.parse cloning pitfalls. RED por SyntaxError es señal limpia de que Wave 2 (15-02) debe aportar exports nombrados (no método de objeto).
- [Phase 15]: VLN-02d (rollback atómico) ships como assert.fail placeholder hasta Wave 2 agregue hook _throwOnUnidadCreate al DI simulator — El test queda RED-by-design con mensaje explícito. Comment inline documenta qué assertions hace cuando Wave 2 habilite el hook. Alternativa (skip) habría escondido la dependencia; mejor que falle visiblemente.
- [Phase 15]: Phase 15-01: union widening + 4 opcionales nullable en MovimientoStock+VentaLoaner. Backwards-compat 100%. JSDoc explica explicitamente que consumidores de subtipo==='conversion' siguen funcionando. Zero touch a Loaner/EstadoLoaner/CondicionUnidad/EstadoUnidad/UbicacionStock/TipoMovimiento/TipoOrigenDestino (locked en CONTEXT.md).
- [Phase 15-stock-venta-de-loaner-espejo-a-stock]: Plan 15-02: registrarVenta transaccional GREEN end-to-end. 5/5 unit tests pass. loanersVentaHelpers.ts extraído (precedente patronesConsumirHelpers Phase 14). loanersService.ts refactorizado a lazy firebase import. __setTestFirestore namespaced excluido del barrel firebaseService. Pitfalls 1-6 verificados con grep. Type-check 28 errores (todos pre-existentes, 0 Phase-15-related). LoanerDetail.tsx mantiene cast WIP hasta Wave 3 reemplace el modal. Suite adyacente sin regresión (test:patron-bom 18/18, test:equivalencias 9/9, test:stock-amplio 5/5, test:cuotas-facturacion 9/9 = 41/41 + 5 nuevos).
- [Phase 15]: Phase 15-03 cerrada: LoanerVentaModal extendido (233 LOC con SearchableSelect condicional + Costo/Precio separados + banner inline error) + LoanerArticuloPicker.tsx extraído (62 LOC, mantiene budget components.md) + LoanerDetail.handleVenta nueva signature + useLoaners.registrarVenta wrapper ELIMINADO (grep confirmó 0 call sites externos). UAT 8/8 PASS firmado por usuario. Phase 15 COMPLETA — invariante 'venta loaner deja espejo en stock' verificado end-to-end (modal → service tx → 3 docs Firestore). Out-of-scope contextual: firebase deploy --only firestore corrió OK contra agssop-e7353 entre checkpoint y aprobación (no introduce rules/indexes nuevos en Phase 15, traceability del cloud state).
- [Phase 16-01]: All new shared type fields optional — backwards-compat with legacy presupuestos/reqs pre-Phase16
- [Phase 16-01]: Disponibilidad as union type not enum — string literal ergonomics + tree-shaking
- [Phase 16-01]: FIXTURE_NOW=2026-06-01 hardcoded for deterministic ETA test assertions
- [Phase 16-02]: nowIso captured once outside runTransaction for consistent ISO timestamp across presupuesto and all req docs; presupuestoItemId uses ?? null (deepClean strips undefined not null)

### Pending Todos

- Definir límites de zonas geográficas (AMBA / Interior BA / Interior país) con equipo comercial antes de Phase 6 — sesión 30 min (pendiente)
- ~~Confirmar activación plan Blaze en Firebase~~ ✓ Confirmado 2026-04-19
- ~~Decidir política de `tipoCambioSnapshot` MIXTA~~ ✓ Resuelto 2026-04-19: snapshot al `oc_recibida`

### Blockers/Concerns

- **Zonas geográficas:** Los límites/tarifas de zonas (AMBA / Interior BA / Interior país) son decisión comercial. Sin ellos Phase 6 no puede completarse. Sesión con equipo prevista para 2026-04-20.

## Session Continuity

Last session: 2026-05-29T18:01:35.942Z
Stopped at: Completed 16-02-PLAN.md (aceptarConRequerimientos patch: fechaAceptacion + presupuestoItemId writes in runTransaction)
Resume file: None
