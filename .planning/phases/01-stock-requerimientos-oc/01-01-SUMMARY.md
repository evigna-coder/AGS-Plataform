---
phase: 01-stock-requerimientos-oc
plan: 01
subsystem: database
tags: [typescript, firestore, stock, reservas, types]

# Dependency graph
requires: []
provides:
  - "UnidadStock interface with 4 optional nullable reservation reference fields"
  - "getOrCreateReservasPosition() exported from stockService.ts"
  - "requerimientosService confirmed as re-exported from firebaseService.ts barrel"
affects:
  - 01-02-PLAN.md
  - 01-03-PLAN.md
  - 01-04-PLAN.md

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reservation fields use optional + nullable (?: string | null) to align with Firestore never-undefined rule"
    - "getOrCreate pattern for well-known Firestore documents (idempotent by unique code lookup)"

key-files:
  created: []
  modified:
    - packages/shared/src/types/index.ts
    - apps/sistema-modular/src/services/stockService.ts

key-decisions:
  - "Reservation fields placed after observaciones and before activo in UnidadStock to group optional reference fields together"
  - "getOrCreateReservasPosition uses getAll(false) (include inactive) for RESERVAS lookup to avoid creating duplicates if position was deactivated"
  - "requerimientosService barrel export confirmed as already working via wildcard export * from importacionesService — no change needed"

patterns-established:
  - "Well-known position pattern: getOrCreate by unique code field, not by document ID"
  - "Reservation field naming convention: reservadoPara{Entity}{Field} (e.g., reservadoParaPresupuestoId)"

requirements-completed: [RES-02, RES-03]

# Metrics
duration: 6min
completed: 2026-04-03
---

# Phase 01 Plan 01: Type Extensions Summary

**UnidadStock extended with 4 reservation reference fields (string | null) and getOrCreateReservasPosition() idempotent helper exported from stockService**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-03T13:32:32Z
- **Completed:** 2026-04-03T13:38:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `reservadoParaPresupuestoId`, `reservadoParaPresupuestoNumero`, `reservadoParaClienteId`, `reservadoParaClienteNombre` optional nullable fields to `UnidadStock` interface (lines 1709-1712 in index.ts)
- Exported `getOrCreateReservasPosition()` from `stockService.ts` at line 132 — idempotent helper that finds or creates the RESERVAS position by code
- Confirmed `requerimientosService` is already re-exported via `export * from './importacionesService'` in `firebaseService.ts` (line 18)
- Zero new TypeScript errors introduced; `@ags/shared` compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reservation fields to UnidadStock type** - `b0a4fe4` (feat)
2. **Task 2: Verify requerimientosService barrel export + add getOrCreateReservasPosition helper** - `e18e82f` (feat)

**Plan metadata:** _(pending final docs commit)_

## Files Created/Modified
- `packages/shared/src/types/index.ts` - Added 4 reservation fields to UnidadStock at lines 1709-1712
- `apps/sistema-modular/src/services/stockService.ts` - Added getOrCreateReservasPosition() export at line 132

## Decisions Made
- Reservation fields placed after `observaciones` and before `activo` to group optional reference fields together without disrupting required field ordering
- `getOrCreateReservasPosition` uses `getAll(false)` (include inactive) to prevent duplicate creation if position was deactivated
- No changes needed to `firebaseService.ts` — wildcard barrel already covers `requerimientosService`

## Deviations from Plan

None — plan executed exactly as written.

**Note on pre-existing state:** The file `stockService.ts` already contained a duplicate `reservasService` export (TS2451 error) from a prior commit (`dce71fa`) that ran Plans 01-01 and 01-02 prerequisites ahead of schedule. This pre-existing error was not introduced by this plan. Error count in `sistema-modular` decreased from 54 to 52 after this plan's changes.

## Issues Encountered
- `stockService.ts` had a duplicate `reservasService` declaration at lines 914 and 1030 from a previous out-of-order commit. This is a pre-existing issue to be resolved by Plan 01-02. Not introduced by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01-02 (reservasService) can now proceed — UnidadStock types are extended, getOrCreateReservasPosition is available
- Plan 01-03 (auto-req trigger) can proceed — requerimientosService is confirmed importable from firebaseService barrel
- Downstream plans 01-04 through 01-07 depend on Plan 01-02 completing first

---
*Phase: 01-stock-requerimientos-oc*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: packages/shared/src/types/index.ts (reservadoParaPresupuestoId at line 1709)
- FOUND: apps/sistema-modular/src/services/stockService.ts (getOrCreateReservasPosition at line 132)
- FOUND: .planning/phases/01-stock-requerimientos-oc/01-01-SUMMARY.md
- FOUND commit b0a4fe4: feat(01-01): add reservation fields to UnidadStock interface
- FOUND commit e18e82f: feat(01-01): add getOrCreateReservasPosition helper to stockService.ts
