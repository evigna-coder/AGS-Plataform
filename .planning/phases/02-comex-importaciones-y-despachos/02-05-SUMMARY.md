---
phase: 02-comex-importaciones-y-despachos
plan: 05
subsystem: ui
tags: [react, comex, importaciones, prorrateo, typescript]

# Dependency graph
requires:
  - phase: 02-comex-importaciones-y-despachos
    plan: 01
    provides: "calcularCostoConGastos pure function + ItemImportacion/GastoImportacion types"
  - phase: 02-comex-importaciones-y-despachos
    plan: 02
    provides: "ImportacionGastosSection CRUD foundation"
provides:
  - "ProrrateoPreview subcomponent showing per-item estimated unit cost after proportional expense distribution"
  - "Mixed-currency gastos excluded from calculation with user-visible disclaimer"
  - "Real-time preview updates on gastos add/delete via imp prop re-render"
affects:
  - 02-06

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local unexported subcomponent pattern for keeping parent under 250 lines"
    - "Derive monedaOC from items array (first item.moneda, default USD)"

key-files:
  created: []
  modified:
    - "apps/sistema-modular/src/components/stock/ImportacionGastosSection.tsx"

key-decisions:
  - "monedaOC derived from items[0].moneda (not Importacion.moneda which doesn't exist in type)"
  - "ProrrateoPreview extracted as local unexported function component to stay under 250-line limit"
  - "cantidadPedida used for preview (not cantidadRecibida) since stock hasn't been ingressed yet"

patterns-established:
  - "Prorrateo preview is purely derived — no Firestore reads, reacts to prop changes only"

requirements-completed: [COMEX-05]

# Metrics
duration: 15min
completed: 2026-04-03
---

# Phase 02 Plan 05: ImportacionGastosSection Prorrateo Preview Summary

**Per-item estimated unit cost preview using calcularCostoConGastos, with mixed-currency disclaimer and real-time update on gastos changes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-03T00:00:00Z
- **Completed:** 2026-04-03T00:15:00Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments
- Added `ProrrateoPreview` as a local unexported subcomponent in the same file
- Preview computes per-item `costoConGastos` using `calcularCostoConGastos` from `utils/calcularProrrateo`
- Gastos in different currency than `monedaOC` are excluded from calculation and trigger a disclaimer
- When no same-currency gastos exist, a hint note is shown instead of blank data
- Component stays at 242 lines (under 250 limit)

## Task Commits

1. **Task 1: Add prorrateo preview subsection** - `70a6018` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/sistema-modular/src/components/stock/ImportacionGastosSection.tsx` - Added ProrrateoPreview subcomponent and wired it below the gastos totals row

## Decisions Made
- `monedaOC` derived from `items[0].moneda` (defaulting to `'USD'`) because the `Importacion` type does not have a top-level `moneda` field — the plan's interface spec was ahead of the actual type definition
- `cantidadPedida` used instead of `cantidadRecibida` for the preview since stock has not been ingressed yet at this stage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resolved imp.moneda field access on Importacion type**
- **Found during:** Task 1 (add prorrateo preview)
- **Issue:** Plan's interface spec included `moneda` on `Importacion`, but the actual `@ags/shared` type does not have this field, causing TS2339 error
- **Fix:** Derived `monedaOC` from `(imp.items ?? []).find(i => i.moneda)?.moneda ?? 'USD'` — same semantic intent, correct typing
- **Files modified:** ImportacionGastosSection.tsx
- **Verification:** `pnpm tsc --noEmit` — zero errors on this file
- **Committed in:** 70a6018 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type mismatch between plan spec and actual type)
**Impact on plan:** Minimal — identical semantic behavior, just accessing the currency through items instead of a non-existent top-level field.

## Issues Encountered
None beyond the type deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Prorrateo preview complete; `ImportacionGastosSection` is ready
- Plan 02-06 (useIngresarStock hook + ImportacionIngresarStockModal) can proceed independently

---
*Phase: 02-comex-importaciones-y-despachos*
*Completed: 2026-04-03*
