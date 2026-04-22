---
phase: 09-stock-atp-extendido
plan: "01"
subsystem: stock
tags: [stock, atp, firestore, unit-tests, types, atomicity]
dependency_graph:
  requires: []
  provides:
    - computeStockAmplio (stockAmplioService.ts)
    - StockAmplio type (@ags/shared)
    - OC_OPEN_STATES constant (exported)
    - REQ_COMPROMETIDO_EXCL constant (exported)
    - Wave 0 E2E stubs (STKP-02/03/04)
  affects:
    - apps/sistema-modular/src/services/presupuestosService.ts
    - apps/sistema-modular/src/services/atpHelpers.ts
    - apps/sistema-modular/src/services/stockService.ts
tech_stack:
  added:
    - stockAmplioService.ts (pure function, lazy Firebase import)
    - tsx + node:assert/strict unit tests (no new devDep)
  patterns:
    - Lazy Firebase import for tsx-testable services (avoids import.meta.env in Node.js)
    - runTransaction for atomic stock reservations (Firestore tx pattern)
    - __setTestFirestore() DI hook for unit test injection
key_files:
  created:
    - apps/sistema-modular/src/services/stockAmplioService.ts (195 lines)
    - apps/sistema-modular/src/services/__tests__/stockAmplio.test.ts (78 lines)
    - apps/sistema-modular/src/services/__tests__/fixtures/stockAmplio.ts (110 lines)
    - apps/sistema-modular/e2e/stock-reserva-concurrent.spec.ts (23 lines)
    - apps/sistema-modular/e2e/stock-cf-trigger.spec.ts (24 lines)
    - apps/sistema-modular/e2e/stock-planificacion.spec.ts (28 lines)
  modified:
    - packages/shared/src/types/index.ts (added StockAmplio, StockAmplioBreakdownEntry, Articulo.resumenStock?)
    - apps/sistema-modular/src/services/atpHelpers.ts (replaced TODO with computeStockAmplio delegation)
    - apps/sistema-modular/src/services/presupuestosService.ts (replaced buggy formula lines 252-258)
    - apps/sistema-modular/src/services/stockService.ts (reservar() migrated to runTransaction)
    - apps/sistema-modular/package.json (added test:stock-amplio script)
decisions:
  - Lazy Firebase import in stockAmplioService.ts to allow tsx unit tests without import.meta.env (Vite-only)
  - Post-tx best-effort logAudit() for reservar() audit — audit is observational, not transactional
  - liberar() kept on createBatch — lower-concurrency path, TODO(STKP-03) comment added
  - E2E stubs placed in apps/sistema-modular/e2e/ (not root e2e/) matching existing Playwright config testDir
metrics:
  duration: "7m 25s"
  tasks_completed: 3
  files_created: 6
  files_modified: 5
  completed_date: "2026-04-22"
---

# Phase 9 Plan 01: StockAmplio Core + Bug Fix + Wave 0 Tests Summary

**One-liner:** Pure-function `computeStockAmplio()` with 4-bucket StockAmplio type, STKP-05 double-count bug fix in presupuestosService, runTransaction atomicity for reservar(), and full Wave 0 test infrastructure.

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Wave 0 + types: StockAmplio types + RED test stubs + E2E describe.skip stubs | c302526 | Done |
| 2 | Core pure fn + bug fix (GREEN): computeStockAmplio() + fix presupuestosService | 1400541 | Done |
| 3 | Atomicity (STKP-03): reservasService.reservar() uses runTransaction | d301548 | Done |

---

## Test Output

```
  ✓ Test 1 passed: STKP-01 happy path
  ✓ Test 2 passed: STKP-05 no double counting
  ✓ Test 3 passed: empty state all zeros
  ✓ Test 4 passed: stale reqs excluded
  ✓ Test 5 passed: closed OCs excluded

✅ All stockAmplio tests passed
```

Run: `pnpm --filter sistema-modular test:stock-amplio`

---

## Decisions Made

### 1. Lazy Firebase Import Pattern

`stockAmplioService.ts` uses a lazy `getFirebaseModules()` helper instead of top-level `import { db } from './firebase'`. This is necessary because `firebase.ts` reads `import.meta.env.VITE_FIREBASE_*` which is a Vite-only API — evaluating it in plain Node.js (tsx) throws `TypeError: Cannot read properties of undefined`. The lazy pattern means Firestore is only loaded in the production Vite bundle; unit tests never trigger the Firebase initialization path because `__setTestFirestore()` bypasses all fetchers.

### 2. Post-tx Audit for reservar()

The old `batchAudit(batch, ...)` was part of the WriteBatch. Since we switched to `runTransaction`, audit was moved to a post-commit `logAudit()` (fire-and-forget). The plan validates this as acceptable: "audit is observational." If atomicity of audit becomes a requirement, the audit write should be inlined inside the tx using `tx.set(auditRef, buildAuditEntry(...))` — but `buildAuditEntry` is a private function in `firebase.ts`, requiring refactoring first.

### 3. E2E Stubs Location

VALIDATION.md references the E2E stubs as `e2e/stock-*.spec.ts`. The actual Playwright config (`apps/sistema-modular/playwright.config.ts`) uses `testDir: './e2e'` pointing to `apps/sistema-modular/e2e/`. The stubs were placed at `apps/sistema-modular/e2e/stock-*.spec.ts` to match the Playwright config and existing circuit files.

### 4. liberar() Not Migrated

`reservasService.liberar()` stays on `createBatch`. It is a controlled admin-only action (one user releases a unit they own/manage), unlike `reservar()` which can be triggered concurrently from multiple users booking the same presupuesto. A `TODO(STKP-03 — liberar)` comment was added for future review.

### 5. enTransito Formula (STKP-05 Key Design)

`enTransito = unidades.en_transito + ocEnTransito` is additive, not deduplicating. Units with `estado='en_transito'` are PHYSICAL rows already in Firestore. OC pending items are EXPECTED future units not yet received. They cannot be the same item (received items lose their OC pending status). The old formula treated only one of these sources, causing under-counting. The STKP-05 regression test (Test 2) locks this behavior.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy Firebase import in stockAmplioService.ts**
- **Found during:** Task 2 — when running `pnpm test:stock-amplio` after creating stockAmplioService.ts
- **Issue:** Top-level `import { db } from './firebase'` caused `TypeError: Cannot read properties of undefined (reading 'VITE_FIREBASE_API_KEY')` in tsx (Node.js) because `import.meta.env` is undefined outside Vite
- **Fix:** Replaced with a `getFirebaseModules()` lazy async function that defers firebase/firebase.ts evaluation until first production use. Unit tests set `__testState` via `__setTestFirestore()` and never reach the fetchers, so Firebase is never initialized.
- **Files modified:** `apps/sistema-modular/src/services/stockAmplioService.ts`
- **Commit:** 1400541

**2. [Rule 1 - Bug] Re-added unidadesService import in presupuestosService.ts**
- **Found during:** Task 2 — removed `unidadesService` from import when fixing the bug, but it's still used at line 368 (separate update() accept-state path)
- **Fix:** Added `unidadesService` back to the import
- **Files modified:** `apps/sistema-modular/src/services/presupuestosService.ts`
- **Commit:** 1400541

---

## Verification Results

- `pnpm type-check` at root: PASS
- `pnpm --filter sistema-modular test:stock-amplio`: 5/5 PASS
- `grep -c "runTransaction" apps/sistema-modular/src/services/stockService.ts`: 3 (import + call + db param)
- `grep "TODO(STKP-01)" atpHelpers.ts`: not found
- `grep "qtyDisponible - qtyReservado + qtyEnTransito" presupuestosService.ts`: only in comment (not code)

---

## Handoff Notes for 09-02 (Cloud Function)

- `OC_OPEN_STATES` and `REQ_COMPROMETIDO_EXCL` are exported from `stockAmplioService.ts`
- Cloud Function (`functions/src/computeStockAmplioAdmin.ts`) **must mirror** these constants with a sync-contract comment — it uses Admin SDK, cannot cross-import from `apps/sistema-modular/src/services/`
- The computeStockAmplio logic is portable: same 3-collection query strategy works with Admin SDK; only the import paths change
- `Articulo.resumenStock?: StockAmplio | null` is available in `@ags/shared` for the CF to write to

## Handoff Notes for 09-03 (UI)

- `computeStockAmplio(articuloId)` client-side signature is stable: `Promise<StockAmplio>`
- `breakdown.reservas` is OMITTED in v2.0 (type is optional) — the drawer should only render `breakdown.requerimientosCondicionales` and `breakdown.ocsAbiertas` sections
- ATP formula for display: `disponible + enTransito - reservado - comprometido` (negative = red indicator)
- No `serviceCache.ts` — planning views must use live Firestore subscriptions (STKP-04)

## Wave 0 E2E Stub Status

All three stubs exist with `describe.skip()`:
- `apps/sistema-modular/e2e/stock-reserva-concurrent.spec.ts` — STKP-03, requires emulator
- `apps/sistema-modular/e2e/stock-cf-trigger.spec.ts` — STKP-02, requires emulator + functions
- `apps/sistema-modular/e2e/stock-planificacion.spec.ts` — STKP-04, requires seeded fixtures

`pnpm type-check` passes with all three files present. They do NOT execute against Playwright in v2.0.

---

## Self-Check: PASSED

All created files exist:
- FOUND: apps/sistema-modular/src/services/stockAmplioService.ts
- FOUND: apps/sistema-modular/src/services/__tests__/stockAmplio.test.ts
- FOUND: apps/sistema-modular/src/services/__tests__/fixtures/stockAmplio.ts
- FOUND: apps/sistema-modular/e2e/stock-reserva-concurrent.spec.ts
- FOUND: apps/sistema-modular/e2e/stock-cf-trigger.spec.ts
- FOUND: apps/sistema-modular/e2e/stock-planificacion.spec.ts

All commits recorded in git log:
- c302526: test(09-01): add StockAmplio types + failing unit test + Wave 0 E2E stubs (RED)
- 1400541: feat(09-01): computeStockAmplio pure fn + fix presupuestosService:252-258 double counting (GREEN)
- d301548: refactor(09-01): reservasService.reservar() uses runTransaction (STKP-03 atomicity)
