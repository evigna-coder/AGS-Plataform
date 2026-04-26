---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "05"
subsystem: billing
tags: [typescript, firestore, presupuestos, facturacion, cuotas, anticipos, BILL-02, BILL-06, sync-hooks]

# Dependency graph
requires:
  - phase: 12-01
    provides: "recomputeCuotaEstados, cuotasEqual, canFinalizeFromEsquema pure helpers"
  - phase: 12-03
    provides: "generarAvisoFacturacion cuotaId path; togglePreEmbarque uses this.update() so recompute fires automatically"
provides:
  - "_recomputeAndPersistEsquema private helper on presupuestosService"
  - "4 sync points wired: presupuestosService.update(), generarAvisoFacturacion post-tx, otService.cerrarAdministrativamente + _syncPresupuestoOnFinalize post-commit, facturacionService.update"
  - "trySyncFinalizacion extended with BILL-06 esquema branch (canFinalizeFromEsquema gate)"
  - "queryByBudget scoped query on ordenesTrabajoService (W4 fix)"
affects:
  - "12-06 (E2E tests — 11.51/11.52 validate reactive recompute end-to-end)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runRecompute closure in update() applied on all 3 branches (FLOW-01, FLOW-03, normal) — W3 fix"
    - "shouldRecompute guard: triggers on estado/ordenesCompraIds/preEmbarque/esquemaFacturacion; skips when caller sets esquemaFacturacion directly (infinite loop guard)"
    - "W4 fix: queryByBudget uses array-contains single-field query (no composite index) instead of getAll()"
    - "Pitfall 2: _recomputeAndPersistEsquema always post-commit, never inside runTransaction"
    - "Pitfall 5: facturacionService.update guard triggers recompute on any estado change, including anulada → cuota back to habilitada"
    - "W2 fix: cuotasEqual structural compare (not JSON.stringify) for idempotency — avoids write churn after Firestore round-trip key reordering"
    - "_syncPresupuestoOnFinalize (FINALIZADO path) also gets recompute before trySync"

key-files:
  created: []
  modified:
    - "apps/sistema-modular/src/services/presupuestosService.ts — _recomputeAndPersistEsquema helper + runRecompute in update() 3 branches + trySyncFinalizacion BILL-06 branch + generarAvisoFacturacion post-tx"
    - "apps/sistema-modular/src/services/otService.ts — queryByBudget method + cerrarAdministrativamente post-commit recompute + _syncPresupuestoOnFinalize recompute"
    - "apps/sistema-modular/src/services/facturacionService.ts — update() recompute+trySync hook on estado change + marcarFacturada simplified to delegate to update()"

key-decisions:
  - "runRecompute closure in update() rather than wrapping markEnviado/aceptarConRequerimientos — keeps change localized to update(); all 3 branches covered via shared closure defined at function top"
  - "facturacionService.marcarFacturada simplified: removed redundant post-commit trySync since update() now handles recompute+trySync when estado is in partial — DRY"
  - "_syncPresupuestoOnFinalize also gets recompute (FINALIZADO → todas_ots_cerradas hito) even though plan only mentioned cerrarAdministrativamente — both paths needed coverage"
  - "Private method exposed via (presupuestosService as any)._recomputeAndPersistEsquema in cross-service calls (existing codebase pattern)"
  - "canFinalizeFromEsquema dynamic import inside trySyncFinalizacion to break potential circular dep"

requirements-completed:
  - BILL-02
  - BILL-06

# Metrics
duration: ~15min
completed: 2026-04-26
---

# Phase 12 Plan 05: Recompute Hook Wiring (4 Sync Points) Summary

**recomputeCuotaEstados wired into all 4 sync points; trySyncFinalizacion gates on canFinalizeFromEsquema when esquema present (BILL-06 strict mode)**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-26
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

### Task 1: presupuestosService

- Added private helper `_recomputeAndPersistEsquema(presupuestoId)`: reads fresh ppto+OTs+solicitudes, runs `recomputeCuotaEstados`, persists only if `cuotasEqual` returns false (W2 idempotency guard). Uses `queryByBudget` (W4 scoped query) and lazy dynamic imports to avoid circular deps.
- Wired `runRecompute` closure into `update()` on all 3 branches:
  - FLOW-01 (borrador→enviado): `await runRecompute()` before `return`
  - FLOW-03 (borrador→aceptado): `await runRecompute()` before `return`
  - Normal path tail: `await runRecompute()` at end of function
  - Guard: `shouldRecompute` skips when `esquemaFacturacion` is explicitly in `partial` (infinite loop guard)
- Extended `trySyncFinalizacion` with BILL-06 esquema branch: when `(pres.esquemaFacturacion?.length ?? 0) > 0`, gates on `canFinalizeFromEsquema(presFresh.esquemaFacturacion, presFresh.finalizarConSoloFacturado)`. Legacy Tier-1 path preserved literally after the new branch.
- Added post-tx recompute call in `generarAvisoFacturacion` (Pitfall 2: post-commit, never in-tx).

### Task 2: otService + facturacionService

- Added `queryByBudget(presupuestoNumero)` to `ordenesTrabajoService`: scoped `array-contains` query on `'budgets'` field in `'reportes'` collection. No composite index required for single-field array-contains.
- `cerrarAdministrativamente` post-commit: loop over `presupuestoIds` — calls `_recomputeAndPersistEsquema` BEFORE `trySyncFinalizacion` (so finalización sees fresh cuota estados).
- `_syncPresupuestoOnFinalize`: same pattern added for the FINALIZADO path via `otService.update()`.
- `facturacionService.update()`: added recompute + trySync when `'estado' in data` (covers all callers including `registrarCobro`, anulada Pitfall 5 regen).
- `facturacionService.marcarFacturada`: simplified — removed redundant post-commit trySync since `update()` now handles it when `estado` is present.

## Task Commits

1. **Task 1: presupuestosService recompute wiring** — `9bced0c` (feat)
2. **Task 2: otService + facturacionService recompute wiring** — `7377ce7` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/services/presupuestosService.ts` — 101 lines net added (helper + 3-branch wiring + BILL-06 branch + post-tx hook)
- `apps/sistema-modular/src/services/otService.ts` — 42 lines net added (queryByBudget + cerrarAdministrativamente loop + _syncPresupuestoOnFinalize update)
- `apps/sistema-modular/src/services/facturacionService.ts` — 26 lines net added (update hook), 12 lines removed (marcarFacturada simplification)

## Verification

- `pnpm --filter sistema-modular test:cuotas-facturacion` — 24/24 tests GREEN (all BILL-XX tags printed)
- `pnpm --filter sistema-modular exec tsc --noEmit` — zero new errors in modified files; pre-existing errors elsewhere unchanged
- No edits in `components/` (12-04 lane) or `apps/reportes-ot/` (frozen surface)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] _syncPresupuestoOnFinalize also needed recompute**
- **Found during:** Task 2 implementation review
- **Issue:** Plan specified recompute in `cerrarAdministrativamente` (CIERRE_ADMINISTRATIVO path), but `_syncPresupuestoOnFinalize` handles the FINALIZADO path via `otService.update()` and also needed recompute before trySync — otherwise cuotas with `hito='todas_ots_cerradas'` would not update reactively when OT goes to FINALIZADO
- **Fix:** Added `_recomputeAndPersistEsquema` call before `trySyncFinalizacion` in `_syncPresupuestoOnFinalize` (same pattern as cerrarAdministrativamente loop)
- **Files modified:** `otService.ts`
- **Verification:** No TypeScript errors; logic consistent with sync point 3 intent

---

**Total deviations:** 1 auto-fixed (Rule 2 - Missing Critical)
**Impact on plan:** Broader sync coverage. No scope creep — both paths are the same sync point 3 (OT cierre).

## Success Criteria Check

- [x] BILL-02: recompute fires reactively at all 4 sync points (update, generarAvisoFacturacion post-tx, cerrarAdministrativamente + _syncPresupuestoOnFinalize, facturacionService.update)
- [x] BILL-06: trySyncFinalizacion respects esquema mode + finalizarConSoloFacturado setting
- [x] BILL-07 reactive: preEmbarque toggle (via update) → runRecompute fires (estado 'preEmbarque' in fieldsThatTriggerRecompute)
- [x] Pitfall 2 (race) avoided: _recomputeAndPersistEsquema is post-commit best-effort, never in runTransaction
- [x] Pitfall 5 (anulada regen) handled: facturacionService.update hook covers 'estado' changes including 'anulada'
- [x] Pitfall 6 (empty vs null) handled: `(esquema?.length ?? 0) > 0` guard in _recomputeAndPersistEsquema and trySyncFinalizacion branch
- [x] No new external dependencies
- [x] apps/reportes-ot/ not touched
- [x] No edits in components/ (12-04's lane)
- [x] cuotasEqual short-circuit in place (no-op writes avoided)
- [x] Legacy Tier-1 path of trySyncFinalizacion preserved literally

## Next Phase Readiness

- Plan 12-06 (E2E tests) can validate the full reactive flow end-to-end: accept ppto → cuota 1 habilitada without manual reload, OT cierre → cuota 2 habilitada, facturar both → ppto finalizado
- E2E sub-suites 11.51 and 11.52 (currently test.fixme) can be enabled

---
*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Completed: 2026-04-26*
