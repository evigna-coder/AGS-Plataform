---
phase: 08-flujo-automatico-derivacion
plan: 00
subsystem: testing
tags: [playwright, e2e, firestore, wave-0, red-baseline]

# Dependency graph
requires:
  - phase: 07-presupuesto-per-incident
    provides: "markEnviado token-first flow, leadsService.syncFromPresupuesto"
  - phase: 05-pre-condiciones-migracion-infra
    provides: "/admin/revision-clienteid route, clienteId migration"
provides:
  - "firestore-assert.ts helper: 8 typed readers for Wave 1-3 verify blocks"
  - "Playwright fixture firebase-e2e.ts: client-SDK Firestore init for Node context"
  - "RED baseline specs: 12-pending-actions-retry (8 tests) + 13-oc-cliente-flow (5 tests)"
  - "Extended smoke: 2 admin routes (/admin/config-flujos, /admin/acciones-pendientes)"
  - "Extended 11-full-business-cycle: FLOW-04 mailQueue assertion (test.fixme)"
affects: [08-01, 08-02, 08-03, 08-04, 08-05]

# Tech tracking
tech-stack:
  added:
    - "firebase client SDK usage from Node/Playwright (was browser-only)"
  patterns:
    - "Local type aliases for types not yet in @ags/shared (upgrade pattern)"
    - "ensureFixture() helper generating minimal binary fixtures on-demand"
    - "pollUntil for Firestore eventual-consistency asserts"

key-files:
  created:
    - "apps/sistema-modular/e2e/fixtures/firebase-e2e.ts"
    - "apps/sistema-modular/e2e/helpers/firestore-assert.ts"
    - "apps/sistema-modular/e2e/circuits/12-pending-actions-retry.spec.ts"
    - "apps/sistema-modular/e2e/circuits/13-oc-cliente-flow.spec.ts"
  modified:
    - "apps/sistema-modular/e2e/circuits/10-smoke-all-pages.spec.ts"
    - "apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts"

key-decisions:
  - "Client SDK instead of Admin SDK: service-account wiring out-of-scope for this phase"
  - "Local type aliases PendingAction + OrdenCompraCliente: @ags/shared types land in Wave 1 (08-01); helper imports upgrade then"
  - "'oc_recibida' string-cast in specs: added to TicketEstado union in 08-01"
  - "RED baseline intentional: specs fail now, turn GREEN as Wave 1-3 ships"
  - "Fixture firebase-e2e.ts mirrors cleanup-e2e-data.mjs pattern (hardcoded public config); apiKey is browser-facing per Firebase docs"

patterns-established:
  - "e2e helpers directory: shared readers imported by multiple specs"
  - "Header RED baseline comment: every Wave-0-new spec declares which plans turn it GREEN"
  - "test.fixme with reason: placeholder for unbuilt flows (11.13b FLOW-04, 13.04 condicional)"

requirements-completed: [FLOW-01, FLOW-02, FLOW-04, FLOW-06, FLOW-07]

# Metrics
duration: ~55min
completed: 2026-04-21
---

# Phase 08 Plan 00: Wave 0 Test Specs + firestore-assert Helper Summary

**Playwright RED baseline for FLOW-01/02/04/06/07: typed Firestore readers + 13 new test cases + 2 admin smoke routes, all failing cleanly until Wave 1-3 lands the production code.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-04-21T10:40:00Z (approx)
- **Completed:** 2026-04-21T11:38:52Z
- **Tasks:** 3
- **Files created:** 4 (firebase-e2e.ts, firestore-assert.ts, 12-pending-actions-retry.spec.ts, 13-oc-cliente-flow.spec.ts)
- **Files modified:** 2 (10-smoke-all-pages.spec.ts, 11-full-business-cycle.spec.ts)
- **New tests added:** 15 (8 in spec 12, 5 in spec 13, 2 admin smoke, 1 FLOW-04 mailQueue fixme)

## Accomplishments

- **Helper ready for Wave 1-3 `<verify>` blocks:** `firestore-assert.ts` exposes 8 typed readers (`getPendingActions`, `getUnresolvedPendingActions`, `getTicketEstado`, `getOCCliente`, `getOCsByPresupuesto`, `getMailQueueDocs`, `getAdminConfigFlujos`, `getRequerimientosByPresupuesto`) plus `pollUntil` for eventual-consistency asserts. 192 lines, under the 200-line budget.
- **RED baseline established for every phase requirement that can be automated:** FLOW-01 edge case (`clienteId: null` → pendingAction → retroactive retry), FLOW-02 OC loading + N:M + idempotency, FLOW-04 mailQueue on CIERRE_ADMINISTRATIVO, FLOW-06 dashboard retry & manual resolve, FLOW-07 admin pages smoke.
- **Nyquist validation contract satisfied:** every `<automated>` command in plans 08-01 through 08-05 now has a concrete spec file to reference. VALIDATION.md's Wave 0 blocker is lifted.

## Task Commits

1. **Task 1: Create firestore-assert.ts helper + firebase-e2e fixture** — `e3e1eed` (feat)
2. **Task 2: Create 12-pending-actions-retry spec** — `a713f68` (test)
3. **Task 3: Create 13-oc-cliente-flow + extend 11 + 10** — `c234042` (test)

_Each commit stands alone: Task 2 type-checks even if Task 3 isn't merged yet, etc._

## Files Created/Modified

### Created

- `apps/sistema-modular/e2e/fixtures/firebase-e2e.ts` — Client-SDK Firestore init for Node/Playwright (hardcoded public config mirroring `cleanup-e2e-data.mjs`). 30 lines.
- `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — 8 typed readers + `pollUntil` + local type aliases for `PendingAction` and `OrdenCompraCliente` (upgrade to `@ags/shared` imports once 08-01 lands). 192 lines.
- `apps/sistema-modular/e2e/circuits/12-pending-actions-retry.spec.ts` — 8 tests across Scenario A (FLOW-01 edge: clienteId null → pendingAction → retroactive retry → auto-ticket in `esperando_oc`) and Scenario B (FLOW-06 dashboard: list, retry button, negative path with inactive user, manual resolve).
- `apps/sistema-modular/e2e/circuits/13-oc-cliente-flow.spec.ts` — 5 tests covering OC carga simple (FLOW-02 core), Firestore shape + back-refs + ticket estado `oc_recibida`, N:M (one OC, two presupuestos), condicional importación (FLOW-02→FLOW-03 linkage, fixme until 08-04), and idempotency (second OC doesn't break ticket state).

### Modified

- `apps/sistema-modular/e2e/circuits/10-smoke-all-pages.spec.ts` — Added `ADMIN_ROUTES` array + loop: `/admin/config-flujos` and `/admin/acciones-pendientes` with expected heading asserts. Navigation via direct URL (sidebar "Admin" root decision still open in Research).
- `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — Imported `getMailQueueDocs` + `pollUntil`. Added `test 11.13b` as `test.fixme` asserting mailQueue doc with `type='cierre_admin_ot'` + `status='pending'` after transition to CIERRE_ADMINISTRATIVO. Plan 08-05 will remove the fixme.

## Decisions Made

- **Client SDK via `fixtures/firebase-e2e.ts`** (orchestrator-locked I1). Admin SDK requires service-account + env-var wiring that isn't justified for read-only assertions. The client SDK runs from Node under Playwright as long as security rules allow the reads.
- **Hardcoded Firebase config** in the e2e fixture (mirrors `cleanup-e2e-data.mjs`). The `apiKey` is a browser-facing identifier per Firebase docs; no secrets are committed.
- **Local type aliases instead of importing from `@ags/shared`** for `PendingAction` and `OrdenCompraCliente`. These types don't exist yet (plan 08-01 adds them). The helper declares the shapes locally and documents the upgrade path — no circular blocker on Wave 0.
- **String cast for `'oc_recibida'`** in spec 13 assertions. The literal isn't in the `TicketEstado` union until 08-01; casting to `string` keeps the comparison honest (it still asserts the exact literal) while type-checking today.
- **`test.fixme` for flows without any harness today** (11.13b FLOW-04 mailQueue, 13.04 presupuesto con ítem importación). The fixme has a reason string pointing to the plan that will unblock it; executors can search `test.fixme` to find all pending removals.
- **Admin smoke tests navigate by URL** not by sidebar click. Research left the "Admin root" sidebar decision open; tests shouldn't assume sidebar structure that doesn't exist.

## Deviations from Plan

**None** — plan executed as written. Three minor notes:

1. The plan's verify command `cd apps/sistema-modular && pnpm type-check` does not run because `@ags/sistema-modular` has no `type-check` script in its `package.json` (only the root workspace has one, and it scopes to `packages/*`). This was verified independently by running `npx tsc --noEmit` with a temporary tsconfig including the new files — 0 errors. Logged as a gap for the Wave 3 executor (plan 08-05 can add a `type-check` script if desired).
2. The fixture helper `ensureOcSamplePdf()` creates a minimal PDF on-demand (not a real PDF, just enough bytes for Firebase Storage to accept the upload). Documented inline in spec 13.
3. Plan's Task 1 mentions "Admin SDK (or client if Admin not wired)" — orchestrator locked this to client SDK. Helper doc comment makes the decision explicit so future contributors don't re-open it.

## Issues Encountered

- **TS2367 on literal `'oc_recibida'` comparison** (spec 13.02 + 13.05): caught by `tsc --noEmit`. Resolved with `(e as string) === 'oc_recibida'` cast + `expect(estado as string).toBe('oc_recibida')` — the comparison still verifies the exact literal. Plan 08-01 will add `'oc_recibida'` to the `TicketEstado` union; at that point the casts can be removed (Wave 2 executor clean-up item).
- **No existing `e2e/helpers/` directory** (was empty). Created during Task 1.
- **sistema-modular has no `type-check` script.** Used a temp tsconfig with `extends: './tsconfig.json'` + `include: [e2e/**]` to get the strict check the plan implied.

## RED Baseline — Which Plan Turns Each Test GREEN

| Test | Fails because... | GREEN after plan |
|------|------------------|------------------|
| 12.01 — crear presupuesto con clienteId: null | UI option not exposed / no fixture injection | 08-03 (auto-ticket + pendingActions) |
| 12.02 — markEnviado dispara pendingAction | `pendingActions[]` field doesn't exist | 08-01 + 08-03 |
| 12.03 — retry retroactivo desde /admin/revision-clienteid | `leadsService.resolverClienteIdPendiente` no integra pendingActions | 08-03 |
| 12.04 — auto-ticket en esperando_oc | Hook no creado + lead estado placeholder | 08-03 |
| 12.05 — /admin/acciones-pendientes lista | Ruta no existe | 08-05 |
| 12.06 — Reintentar desaparece row | Dashboard no implementado | 08-05 |
| 12.07 — retry con usuario inactivo | Validation no existe | 08-05 |
| 12.08 — Marcar resuelta manual | Botón no existe | 08-05 |
| 13.01 — Cargar OC desde list | Modal + action no existen | 08-02 |
| 13.02 — Firestore shape + back-refs | Colección `ordenesCompraCliente` no existe | 08-01 + 08-02 |
| 13.03 — N:M OC cubre 2 presupuestos | Modal "OC existente" no existe | 08-02 |
| 13.04 — condicional importación (fixme) | `itemRequiereImportacion` + posta materiales_comex no existen | 08-04 (desfixmea) |
| 13.05 — idempotencia 2da OC | Depende de 13.01 | 08-02 |
| 11.13b — FLOW-04 mailQueue (fixme) | `cerrarAdministrativamente` no implementado | 08-05 (desfixmea) |
| 10 Smoke /admin/config-flujos | Ruta no existe | 08-05 |
| 10 Smoke /admin/acciones-pendientes | Ruta no existe | 08-05 |

## User Setup Required

None — helpers are test-only, no runtime config or env changes.

## Next Phase Readiness

**Ready:** Plans 08-01 through 08-05 can now each reference concrete spec files in their `<verify><automated>` blocks. Example for plan 08-02's `cargarOC` Task: `pnpm playwright test e2e/circuits/13-oc-cliente-flow.spec.ts -g "13.01|13.02"`.

**To clean up in Wave 1-3 as types land:**
- Replace local `PendingAction` / `OrdenCompraCliente` aliases in `firestore-assert.ts` with `import type { … } from '@ags/shared'` (08-01 executor).
- Remove `(e as string)` casts in spec 13 once `'oc_recibida'` is in the union (08-01 executor).
- Desfixme `11.13b` once `cerrarAdministrativamente` lands (08-05 executor).
- Desfixme `13.04` once `itemRequiereImportacion` + `aArea: 'materiales_comex'` land (08-04 executor).

**Known ambient assumption:** the spec's UI selectors (placeholder role/name) are best-effort ARIA-first. Some Wave 2/3 executors may need to tighten them against the actual modals they build. This is acknowledged in every spec's header.

## Self-Check

Files expected to exist:
- `apps/sistema-modular/e2e/fixtures/firebase-e2e.ts` — verified
- `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — verified
- `apps/sistema-modular/e2e/circuits/12-pending-actions-retry.spec.ts` — verified
- `apps/sistema-modular/e2e/circuits/13-oc-cliente-flow.spec.ts` — verified
- `apps/sistema-modular/e2e/circuits/10-smoke-all-pages.spec.ts` — verified (modified)
- `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — verified (modified)

Commits expected to exist:
- `e3e1eed` — verified
- `a713f68` — verified
- `c234042` — verified

## Self-Check: PASSED

---
*Phase: 08-flujo-automatico-derivacion*
*Completed: 2026-04-21*
