---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "00"
subsystem: facturacion-cuotas
tags: [testing, wave-0, red-baseline, unit-tests, e2e-scaffold, BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08]
dependency_graph:
  requires: []
  provides:
    - Wave 0 RED test scaffolding for Phase 12
    - cuotasFacturacion.test.ts with stubs for all BILL-XX behaviors
    - fixtures/cuotasFacturacion.ts with 12 recompute + 4 validator + 3 cuotasEqual + 2 totals fixtures
    - getPresupuestoEsquema helper in firestore-assert.ts
    - E2E sub-suites 11.50/11.51/11.52 in 11-full-business-cycle.spec.ts
    - test:cuotas-facturacion package script
  affects:
    - apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts
    - apps/sistema-modular/src/services/__tests__/fixtures/cuotasFacturacion.ts
    - apps/sistema-modular/e2e/helpers/firestore-assert.ts
    - apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts
    - apps/sistema-modular/package.json
tech_stack:
  added: []
  patterns:
    - tsx + node:assert/strict unit test driver (mirrors stockAmplio.test.ts)
    - [BILL-XX label] console.log stdout audit protocol (W1 fix)
    - test.fixme(true, 'Wave N — ...') for E2E scaffolding (mirrors Phase 10 pattern)
    - Local type alias in firestore-assert.ts with TODO(12-01) upgrade note
key_files:
  created:
    - apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts
    - apps/sistema-modular/src/services/__tests__/fixtures/cuotasFacturacion.ts
  modified:
    - apps/sistema-modular/e2e/helpers/firestore-assert.ts
    - apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts
    - apps/sistema-modular/package.json
decisions:
  - All-zero cuota guard: validateEsquemaSum([], ['ARS']) must return 1 error (sum=0, expected=100) — fixture and test cover this BILL-01 edge case
  - Fixture file uses mkCuota() factory helper to reduce boilerplate and keep fixture definitions readable
  - E2E sub-suites use the custom `test` from '../fixtures/test-base' (extended Playwright) not raw @playwright/test — avoids import conflicts with broken stock spec files
  - 12-01 parallel execution: plan 12-01 ran concurrently; it committed firestore-assert.ts and 11-full-business-cycle.spec.ts changes (which were staged by 12-00 Task 2) as part of commit 99a0641. This is expected behavior for parallel wave execution. The RED baseline was established by 12-00 commit 89d8148 first.
metrics:
  duration: "~7 minutes"
  completed_date: "2026-04-26"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 12 Plan 00: Wave 0 RED Test Scaffolding Summary

**One-liner:** Wave 0 RED unit test stubs (23 assertions) + E2E fixme sub-suites 11.50/11.51/11.52 covering every BILL-XX requirement before any implementation lands.

## What Was Built

### Task 1: Unit Test Fixtures + RED Stubs (commit 89d8148)

Created `fixtures/cuotasFacturacion.ts` with:
- 12 recompute fixtures covering all `recomputeCuotaEstados` branches: empty legacy (BILL-05), borrador, aceptado (BILL-02), todas_ots_cerradas, pre_embarque, oc_recibida, manual, anulada_regen, cobrada_mirror, MIXTA solo-USD/solo-ARS/combinada (BILL-04)
- 4 validator fixtures for `validateEsquemaSum`: mono OK, float tolerance, MIXTA both OK, MIXTA USD fails (BILL-01, BILL-04)
- 3 `cuotasEqual` fixtures (W2): same-order, shuffled keys (Firestore round-trip), not-equal
- 2 `computeTotalsByCurrency` fixtures (I3): mono ARS, MIXTA

Created `cuotasFacturacion.test.ts` with:
- 23 assertion blocks each preceded by `[BILL-XX label]` console.log for stdout audit
- Covers BILL-01 (5 assertions), BILL-02 (8 assertions), BILL-04 (5 assertions), BILL-05 (1 assertion), BILL-06 (4 assertions), W2 (3 assertions), I3 (2 assertions)
- RED baseline confirmed: `ERR_MODULE_NOT_FOUND` for `src/utils/cuotasFacturacion.js` before 12-01

Added `test:cuotas-facturacion` script to `package.json` (mirrors `test:stock-amplio`).

### Task 2: E2E Scaffold (included in 12-01 commit 99a0641)

Extended `firestore-assert.ts` with:
- `getPresupuestoEsquema(presId)` helper returning `Presupuesto.esquemaFacturacion ?? []` (BILL-08)
- Local `PresupuestoCuotaFacturacion` type alias with TODO(12-01) upgrade note

Extended `11-full-business-cycle.spec.ts` with 11 new tests across 3 sub-suites:
- `11.50` — 100% al cierre (1 test, fixme Wave 5)
- `11.51` — 30/70 anticipo+cierre (7 tests: editor-suma-100, esquema-locked-on-aceptado, generar-anticipo-sin-ot, hito-aceptado-recompute, finaliza-tras-ultima-cuota, MIXTA-mini-modal, no-orphan-solicitudes)
- `11.52` — 70/30 pre-embarque (3 tests: toggle-visibility, pre-embarque-toggle, flow-completo-70-30)

All tests use `test.fixme(true, 'Wave 5 (12-06) — ...')` — existing 11.01-11.30 tests untouched.

## Verification Results

```
# Unit RED baseline (before 12-01 ran):
pnpm --filter sistema-modular exec tsx src/services/__tests__/cuotasFacturacion.test.ts
→ ERR_MODULE_NOT_FOUND: Cannot find module '...cuotasFacturacion.js' — RED OK

# After 12-01 landed (concurrent execution):
pnpm --filter sistema-modular test:cuotas-facturacion
→ ✅ All cuotasFacturacion tests passed (23 assertions)

# E2E sub-suite listing:
pnpm exec playwright test --project=chromium e2e/circuits/11-full-business-cycle.spec.ts --list --grep "11.5"
→ 11 tests listed across 11.50 / 11.51 / 11.52

# stdout audit tags:
[BILL-01 validator-mono-ok], [BILL-01 validator-float-tolerance], [BILL-01 all-zero-guard]
[BILL-02 borrador-all-pendiente], [BILL-02 hito-aceptado], [BILL-02 todas-ots-cerradas]
[BILL-02 pre-embarque], [BILL-02 oc-recibida], [BILL-02 manual-always-habilitada]
[BILL-02 anulada-regen], [BILL-02 cobrada-mirror]
[BILL-04 validator-MIXTA-independent], [BILL-04 validator-MIXTA-USD-fails]
[BILL-04 MIXTA-solo-USD], [BILL-04 MIXTA-solo-ARS], [BILL-04 MIXTA-combinada]
[BILL-05 empty-legacy]
[BILL-06 strict-cobrada]
[BILL-W2 cuotasEqual-same-order], [BILL-W2 cuotasEqual-shuffled], [BILL-W2 cuotasEqual-not-equal]
[BILL-I3 computeTotals-mono-ARS], [BILL-I3 computeTotals-MIXTA]
```

## Deviations from Plan

### Note: Parallel wave execution

Task 2 files (`firestore-assert.ts`, `11-full-business-cycle.spec.ts`) were staged by plan 12-00 and then included in plan 12-01's commit `99a0641` (which ran concurrently). The Wave 0 RED baseline was established atomically in commit `89d8148` (Task 1). This is expected behavior for parallel wave execution — the plan coordinator runs 12-00 and 12-01 simultaneously, and they share the same working tree.

No production code changed. `apps/reportes-ot/` not touched. No new dependencies added.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 89d8148 | test(12-00): Wave 0 RED — unit test stubs + package script |
| Task 2 | 99a0641 | (included in 12-01 commit) firestore-assert + E2E fixme sub-suites |

## Self-Check: PASSED

- [x] `apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts` exists
- [x] `apps/sistema-modular/src/services/__tests__/fixtures/cuotasFacturacion.ts` exists (23+ named exports)
- [x] `apps/sistema-modular/e2e/helpers/firestore-assert.ts` contains `getPresupuestoEsquema`
- [x] `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` contains `test.describe('11.51`
- [x] `apps/sistema-modular/package.json` contains `test:cuotas-facturacion`
- [x] Commits 89d8148 and 99a0641 exist on main branch
- [x] 11 E2E tests listed for sub-suites 11.50/11.51/11.52
- [x] All 23 unit test assertions covered by [BILL-XX] stdout tags
