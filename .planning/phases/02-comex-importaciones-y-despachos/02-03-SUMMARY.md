---
phase: 02-comex-importaciones-y-despachos
plan: 03
subsystem: ui
tags: [react, typescript, url-filters, comex, importaciones]

# Dependency graph
requires:
  - phase: 02-comex-importaciones-y-despachos
    provides: Importacion types + importacionesService + useImportaciones hook

provides:
  - ImportacionesList with URL-persisted filters via useUrlFilters
  - ETA vencida red badge on overdue non-terminal importaciones

affects:
  - 02-04-importacion-status-transitions
  - 02-05-importacion-gastos

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useUrlFilters schema pattern with { type, default } objects for list page filter persistence"
    - "isEtaVencida pure function for overdue shipment detection"

key-files:
  created: []
  modified:
    - apps/sistema-modular/src/pages/stock/ImportacionesList.tsx

key-decisions:
  - "sortField and sortDir also migrated to useUrlFilters for full URL-based state persistence"
  - "thClass constant extracted to follow list-page-conventions"

patterns-established:
  - "All filter state (including sort) in ImportacionesList via useUrlFilters — no useState for UI filters"
  - "ETA vencida badge placed inline in Estado column after existing estado badge"

requirements-completed: [COMEX-04, COMEX-08]

# Metrics
duration: 12min
completed: 2026-04-03
---

# Phase 2 Plan 03: ImportacionesList Filter Migration Summary

**URL-persisted filter state + red ETA vencida badge via useUrlFilters in ImportacionesList**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-03T00:00:00Z
- **Completed:** 2026-04-03T00:12:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced all useState filter declarations (estadoFilter, sortField, sortDir) with a single useUrlFilters schema
- Filter state (estado filter + sort field/direction) now survives page reload via URL search params (COMEX-08)
- Added isEtaVencida pure function: returns true when fechaEstimadaArribo is in the past and estado is not 'recibido' or 'cancelado'
- Rendered red "ETA vencida" badge inline in the Estado column for all overdue non-terminal importaciones (COMEX-04)
- Extracted thClass constant and added whitespace-nowrap/truncate to table cells following list-page-conventions

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate ImportacionesList.tsx — useUrlFilters + ETA vencida badge** - `3276d03` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `apps/sistema-modular/src/pages/stock/ImportacionesList.tsx` - Migrated to useUrlFilters; added isEtaVencida + badge; 148 lines (under 250 limit)

## Decisions Made
- sortField and sortDir were also managed with useState; migrated both to useUrlFilters schema so all URL-bearing state is consistent and no useState for any filter remains
- FILTER_SCHEMA defined as a top-level constant (not inline) to avoid schema object recreation on each render

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — pre-existing TypeScript errors in unrelated files confirmed zero impact on ImportacionesList.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ImportacionesList is ready: URL-persisted estado filter works, ETA vencida badge renders for overdue shipments
- 02-04 (status transitions + ImportacionItemsSection) can proceed with full confidence ImportacionesList is compliant

---
*Phase: 02-comex-importaciones-y-despachos*
*Completed: 2026-04-03*
