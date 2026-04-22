---
phase: 10-presupuestos-partes-mixto-ventas
plan: "00"
subsystem: testing
tags: [playwright, e2e, firestore, presupuestos, facturacion, exports, wave0]

requires:
  - phase: 08-flujo-automatico-derivacion
    provides: firestore-assert.ts helpers pattern (pollUntil, getMailQueueDocs), circuit spec conventions
  - phase: 09-stock-atp-extendido
    provides: StockAmplioIndicator shape, requerimientos pattern, circuit 03 baseline

provides:
  - "5 new Firestore reader helpers in firestore-assert.ts: getPresupuesto, getSolicitudFacturacion, getSolicitudesFacturacionByOt, getSolicitudesFacturacionByPresupuesto, getOTsByBudget"
  - "Circuit 03 extended with tests 3.5-3.9 covering partes/mixto/ventas/exports RBAC"
  - "Circuit 07 extended with tests 7.4-7.5 covering facturacion auto-docs + marcar enviada"
  - "Circuit 11 extended: 11.13b has Assert 3 scaffold for solicitudesFacturacion"
  - "New circuit 14: 6 tests covering FMT-04/05/06 export flows (all fixme Wave 4)"

affects:
  - 10-01-partes (Wave 1 — ArticuloPickerPanel, desfixmea 3.5)
  - 10-02-mixto (Wave 2 — mixto PDF, desfixmea 3.6)
  - 10-03-ventas (Wave 3 — VentasMetadata, auto-OT, solicitudFacturacion, desfixmea 3.7 + 7.4 + 11.13c)
  - 10-04-exports (Wave 4 — XLSX/PDF exports, desfixmea 3.8 + 14.1-14.6)
  - 10-05-facturacion-enviada (Wave 5 — marcar enviada, desfixmea 7.5)

tech-stack:
  added: []
  patterns:
    - "Wave 0 RED baseline: fixme marker pattern with Wave reference ('Wave N (plan 10-XX) desfixmeará')"
    - "getSolicitudesFacturacion* helpers follow getOCsByPresupuesto array-contains pattern"
    - "getOTsByBudget queries 'reportes' collection (canonical OT store per otService.ts:40)"

key-files:
  created:
    - apps/sistema-modular/e2e/circuits/14-exports.spec.ts
  modified:
    - apps/sistema-modular/e2e/helpers/firestore-assert.ts
    - apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts
    - apps/sistema-modular/e2e/circuits/07-facturacion.spec.ts
    - apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts

key-decisions:
  - "getOTsByBudget queries 'reportes' collection (not 'ordenesTrabajo') — per otService.ts:40 comment"
  - "Wave 1 TODO comments on getSolicitudFacturacion* — no 'enviada' estado imported yet (doesn't exist in SolicitudFacturacionEstado)"
  - "test.fixme pattern: all Phase 10 tests that require Wave N+ implementation use test.fixme(true, 'Wave N (plan 10-XX) ...')"
  - "11.13b extended with commented-out Assert 3 block (not active) — Wave 3 (10-04) uncomments it"

patterns-established:
  - "Phase 10 fixme convention: test.fixme(true, 'Wave N (plan 10-XX) lands [feature]. Desfixmear when [trigger].')"
  - "RED informative pattern: expect(value, 'Requires Wave N implementation: ...').toBeTruthy() instead of silent crash"

requirements-completed: [PTYP-02, PTYP-03, PTYP-04, FMT-03, FMT-04, FMT-05, FMT-06]

duration: 4min
completed: "2026-04-22"
---

# Phase 10 Plan 00: Wave 0 RED Baseline E2E Specs Summary

**Firestore helpers for solicitudesFacturacion + OTs-by-budget extended; 15 new RED/fixme Playwright tests across 4 spec files covering PTYP-02/03/04 and FMT-03/04/05/06 before any Wave 1-5 implementation.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T03:51:09Z
- **Completed:** 2026-04-22T03:55:17Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Extended `firestore-assert.ts` with 5 new reader helpers for Phase 10 (solicitudesFacturacion, presupuesto, OTs-by-budget)
- Added 9 tests to `03-presupuestos.spec.ts` (3.1-3.9) covering partes/mixto/ventas types, export RBAC
- Added 5 tests to `07-facturacion.spec.ts` (7.1-7.5) covering auto-doc dashboard + marcar enviada action
- Extended `11-full-business-cycle.spec.ts` test 11.13b with Phase 10 Assert 3 scaffold (commented, Wave 3 activates it)
- Created new `14-exports.spec.ts` with 6 tests covering all FMT-04/05/06 download scenarios

## Tests Added by File

| File | Tests | Status |
|------|-------|--------|
| `03-presupuestos.spec.ts` | 3.5, 3.6, 3.7, 3.8, 3.9 | RED (3.5, 3.8) + fixme (3.6, 3.7, 3.9) |
| `07-facturacion.spec.ts` | 7.4, 7.5 | RED (7.4) + fixme (7.5) |
| `11-full-business-cycle.spec.ts` | 11.13b (extended) | Assert 3 commented block |
| `14-exports.spec.ts` | 14.1-14.6 | All fixme Wave 4 |

## Helpers Added to firestore-assert.ts

| Function | Collection | Wave that uses it |
|----------|------------|-------------------|
| `getPresupuesto(id)` | `presupuestos/{id}` | Wave 2-3 |
| `getSolicitudFacturacion(id)` | `solicitudesFacturacion/{id}` | Wave 3+5 |
| `getSolicitudesFacturacionByOt(otNumber)` | `solicitudesFacturacion` array-contains | Wave 3 (11.13c) |
| `getSolicitudesFacturacionByPresupuesto(presupuestoId)` | `solicitudesFacturacion` query | Wave 3+ |
| `getOTsByBudget(budgetNumber)` | `reportes` array-contains | Wave 3 (3.7) |

## Task Commits

1. **Task 1: Extend firestore-assert.ts with Phase 10 helpers** — `a060ac2` (test)
2. **Task 2: Extend 03/07/11 circuit specs** — `c50a54b` (test)
3. **Task 3: Create 14-exports.spec.ts** — `6c5539e` (test)

**Plan metadata:** (see final commit)

## Fixme Markers + Wave Desfixmear Map

| Test | Reason | Wave that desfixmeará |
|------|--------|----------------------|
| 3.6 | Mixto PDF branching not landed | Wave 2 (10-03) |
| 3.7 | VentasMetadataSection + auto-OT trigger not landed | Wave 3 (10-04) |
| 3.9 | Needs role fixture for non-admin login | Wave 4 (10-05) when RBAC gate lands |
| 7.5 | 'enviada' estado + marcar enviada action not landed | Wave 5 (10-06) |
| 14.1-14.6 | Export buttons (XLSX/PDF) not implemented | Wave 4 (10-05) |

## Files Created/Modified

- `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — 5 new helpers; import SolicitudFacturacion from @ags/shared; 193 → 267 lines
- `apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts` — 5 new tests (3.5-3.9); import helpers; ~350 lines total
- `apps/sistema-modular/e2e/circuits/07-facturacion.spec.ts` — 2 new tests (7.4-7.5); import helpers
- `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — 11.13b extended with Assert 3 scaffold
- `apps/sistema-modular/e2e/circuits/14-exports.spec.ts` — NEW, 6 tests, ~151 lines

## Decisions Made

- **getOTsByBudget uses 'reportes' collection** — per comment in otService.ts:40: the OT collection is 'reportes', not 'ordenesTrabajo'. This matches the existing codebase pattern.
- **Wave 1 TODO on SolicitudFacturacion helpers** — 'enviada' estado doesn't exist yet in SolicitudFacturacionEstado union; helpers use the existing type and document the TODO for when Wave 1 extends it.
- **11.13b Assert 3 is commented, not fixme** — since it's inside an existing test (not a new test), a comment block is cleaner than test.fixme.

## Deviations from Plan

None — plan executed exactly as written.

## A13 Self-Check Result

- `pnpm exec playwright test --list` correctly lists all new tests
- 03-presupuestos.spec.ts: 9 tests (3.1-3.9) confirmed
- 07-facturacion.spec.ts: 5 tests (7.1-7.5) confirmed
- 14-exports.spec.ts: 6 tests (14.1-14.6) confirmed
- RED tests fail with informative messages referencing Wave number (not generic TypeErrors)
- fixme tests show as "skipped" in Playwright run (not crashes)

## Next Phase Readiness

- Wave 0 baseline complete — Waves 1-5 executors have clear completion signals
- Each spec file's new tests define exact assertions Wave N must satisfy to turn GREEN
- `firestore-assert.ts` helpers ready for use by all subsequent plans

---
*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed: 2026-04-22*
