---
phase: 02-comex-importaciones-y-despachos
plan: 02
subsystem: ui
tags: [react, firestore, comex, importaciones, navigation, location-state, prefill]

# Dependency graph
requires:
  - phase: 02-comex-importaciones-y-despachos
    plan: 01
    provides: ItemImportacion interface + Importacion fields + importacionesService
provides:
  - OCDetail: conditional "Crear Importacion" button for tipo='importacion' OCs
  - OCDetail: linked importaciones section showing estado badges and Ver links
  - ImportacionEditor: fromOC prefill mode via location.state.fromOC
  - ItemEmbarqueSelector: checkbox+quantity table mapping ItemOC -> ItemImportacion[]
affects:
  - 02-03-PLAN.md (ImportacionesList — can now have importaciones created from OC flow)
  - 02-04-PLAN.md (ImportacionStatusTransition — importaciones now have items array)
  - 02-06-PLAN.md (useIngresarStock — items array populated via item selector)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "location.state.fromOC prefill pattern (same as 01-06 OCEditor.prefill)"
    - "Extracted sub-components (OCImportacionesSection, ItemEmbarqueSelector) to keep pages under 250 lines"
    - "deepCleanForFirestore applied before create to ensure no undefined in Firestore"

key-files:
  created:
    - apps/sistema-modular/src/components/stock/OCImportacionesSection.tsx
    - apps/sistema-modular/src/components/stock/ItemEmbarqueSelector.tsx
  modified:
    - apps/sistema-modular/src/pages/stock/OCDetail.tsx
    - apps/sistema-modular/src/pages/stock/ImportacionEditor.tsx
    - apps/sistema-modular/src/services/importacionesService.ts

key-decisions:
  - "Extracted importaciones list and item selector to separate components to honor 250-line hard rule"
  - "importacionesService.getAll() extended with ordenCompraId filter (was missing, needed for OCDetail section)"
  - "ItemEmbarqueSelector uses local state + onChange callback pattern to feed mapped ItemImportacion[] up to editor"
  - "fromOC absent = manual mode unchanged; fromOC present = OC selector hidden, prefill active"

patterns-established:
  - "fromOC state pattern: read via (location.state as { fromOC?: T } | null)?.fromOC ?? null"
  - "Item selector maps OC items to importacion items at submit time, not on each checkbox change (uuid stable)"

requirements-completed: [COMEX-01, COMEX-02]

# Metrics
duration: 20min
completed: 2026-04-03
---

# Phase 2 Plan 02: OCDetail OC-to-Importacion Flow + ImportacionEditor fromOC Prefill Summary

**Conditional "Crear Importacion" button in OCDetail wired to ImportacionEditor with location.state.fromOC prefill and ItemEmbarqueSelector for choosing shipment items from the OC's item list**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-03T18:30:00Z
- **Completed:** 2026-04-03T18:50:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- OCDetail shows "+ Crear Importacion" button only for OCs with `tipo === 'importacion'` — clicking navigates to `/stock/importaciones/nuevo` with `location.state.fromOC` populated (ordenCompraId, numero, proveedorId, moneda, items)
- OCDetail shows a linked importaciones section below the items table, with estado badges and "Ver" links, filtered by `ordenCompraId`
- ImportacionEditor reads `location.state.fromOC` to switch between manual mode (unchanged) and prefill mode: OC selector replaced with read-only badge, ItemEmbarqueSelector rendered
- ItemEmbarqueSelector renders a checkbox+quantity table from OC items; checked items are mapped to `ItemImportacion[]` and passed to the editor for submission
- All files under 250 lines — sub-components extracted as required by project hard rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Crear Importacion button + linked importaciones section to OCDetail** - `0d312a4` (feat)
2. **Task 2: Extend ImportacionEditor with fromOC prefill mode + item selector** - `d719a7a` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `apps/sistema-modular/src/pages/stock/OCDetail.tsx` — Added useLocation, importaciones state, Crear Importacion button, OCImportacionesSection render
- `apps/sistema-modular/src/components/stock/OCImportacionesSection.tsx` — New: linked importaciones list with estado badges and Ver links
- `apps/sistema-modular/src/pages/stock/ImportacionEditor.tsx` — Added fromOC mode: location.state read, conditional OC badge vs selector, ItemEmbarqueSelector card, deepCleanForFirestore on submit
- `apps/sistema-modular/src/components/stock/ItemEmbarqueSelector.tsx` — New: checkbox + quantity table, maps selected ItemOC -> ItemImportacion[] via onChange callback
- `apps/sistema-modular/src/services/importacionesService.ts` — Extended getAll() to support `ordenCompraId` filter (added where clause)

## Decisions Made
- Extracted `OCImportacionesSection` and `ItemEmbarqueSelector` to keep both pages under 250 lines (project hard rule).
- Extended `importacionesService.getAll()` with `ordenCompraId` filter — was missing but required by the plan's interface spec. Auto-fixed as Rule 2 (missing critical functionality).
- `ItemEmbarqueSelector.notify()` generates new UUIDs for each `ItemImportacion.id` on every state change. This is acceptable since the items are only stored on final submit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ordenCompraId filter to importacionesService.getAll()**
- **Found during:** Task 1 (OCDetail importaciones section)
- **Issue:** Plan interfaces spec listed `importacionesService.getAll({ ordenCompraId?: string })` but actual implementation only accepted `{ estado?: string }`. Task 1 requires filtering importaciones by OC.
- **Fix:** Added `if (filters?.ordenCompraId) constraints.unshift(where('ordenCompraId', '==', filters.ordenCompraId))` to getAll() and updated the filter type signature.
- **Files modified:** `apps/sistema-modular/src/services/importacionesService.ts`
- **Verification:** TypeScript check passes with no errors on modified files.
- **Committed in:** `0d312a4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix was required for correctness — without it, the importaciones section in OCDetail would fetch all importaciones. No scope creep.

## Issues Encountered
None - all verification checks passed. Pre-existing TypeScript errors in unrelated files (CreateEquipoModal, CalificacionesList, etc.) are out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OCDetail correctly wired to ImportacionEditor via location.state.fromOC — 02-03 (ImportacionesList) can proceed
- Importaciones now carry items array from item selector — 02-04 (status transition + ImportacionItemsSection) and 02-06 (useIngresarStock) ready to consume
- No blockers for any downstream plan in this phase

---
*Phase: 02-comex-importaciones-y-despachos*
*Completed: 2026-04-03*
