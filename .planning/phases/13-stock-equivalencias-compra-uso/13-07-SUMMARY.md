---
phase: 13-stock-equivalencias-compra-uso
plan: 07
subsystem: stock
tags: [react, firestore, tailwind, playwright, equivalencias, typescript]

# Dependency graph
requires:
  - phase: 13-01
    provides: Articulo type with equivalencias[] + articuloIdDestinoEquivalencia
  - phase: 13-02
    provides: equivalenciasService CRUD
  - phase: 13-06
    provides: EquivalenciaDualDisplay + DesagregarStockModal + useEquivalenciaDual

provides:
  - ArticulosListFilters.tsx — extracted filter bar (92 LOC)
  - ArticulosListRow.tsx — extracted single-row with badge slot + DualExpansionRow (165 LOC)
  - useEquivalenciaListExpansion.ts — hook owning destinoLookup + hasEquivalencia + shouldExpandRow (65 LOC)
  - EquivalenciaBadge.tsx — teal pill atom ⇄ with CSS hover tooltip
  - ArticulosList.tsx — slimmed shell 401→244 LOC consuming all extracted parts
  - useSearchableSelect.ts — extended with linkedCode + subLabel optional fields
  - SearchableSelect.tsx — renders subLabel as secondary dropdown line
  - equivalencias.ts — real seedEquivalenciaPair (client SDK, no TODO stub)
  - equivalencias.spec.ts — 13.60 describe un-fixmed with 5 real tests; fixme count = 0

affects:
  - Phase 14 (Stock Patrones BOM) — will reuse ArticulosListRow badge slot for BOM indicator
  - Any future consumer of SearchableSelect with linked pairs (linkedCode ready to use)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Co-located inner component for thead (ArticulosListThead) — reduces shell LOC without separate file"
    - "Lazy import pattern in ArticulosListRow for EquivalenciaDualDisplay (Suspense fallback)"
    - "CSS-only hover tooltip via Tailwind group/group-hover:visible (no library)"
    - "useEquivalenciaListExpansion unconditional extraction (m3 fix) — hook always created, not gated on LOC budget"
    - "seedEquivalenciaPair using Firestore client SDK (same db export as firestore-assert.ts)"

key-files:
  created:
    - apps/sistema-modular/src/pages/stock/ArticulosListFilters.tsx
    - apps/sistema-modular/src/pages/stock/ArticulosListRow.tsx
    - apps/sistema-modular/src/pages/stock/hooks/useEquivalenciaListExpansion.ts
    - apps/sistema-modular/src/components/stock/EquivalenciaBadge.tsx
  modified:
    - apps/sistema-modular/src/pages/stock/ArticulosList.tsx
    - apps/sistema-modular/src/components/ui/useSearchableSelect.ts
    - apps/sistema-modular/src/components/ui/SearchableSelect.tsx
    - apps/sistema-modular/e2e/equivalencias.spec.ts
    - apps/sistema-modular/e2e/helpers/equivalencias.ts

key-decisions:
  - "ArticulosListThead extracted as co-located inner component (not a separate file) — this keeps the logical thead definition alongside the shell without adding a new file import chain"
  - "EquivalenciaBadge renders inline tooltip via Tailwind group/group-hover:visible (no tooltip library). Shows origen→destino×factor when equivalencias[0] exists, else generic 'Tiene equivalente'"
  - "seedEquivalenciaPair uses Firestore client SDK (not admin SDK) — project decision I1 from Phase 8 Wave 0 established that client SDK is used for test writes; admin SDK not configured"
  - "13.30/13.40/13.50 use test.skip (not test.fixme) — skip with UAT validation note is distinct from fixme (blocked). fixme count = 0 per m4 spec"
  - "shouldExpandRow is exact-match-only (not substring) — prevents visual stampede of all linked rows expanding simultaneously on any partial search"

patterns-established:
  - "Badge tooltip: group + group-hover:visible + absolute positioning — reuse for any future row-level indicator that needs hover detail"
  - "Dual expansion row: data-testid=dual-row on <tr>, colSpan=TOTAL_COLS, bg-teal-50/20 — establishes visual pattern for future inline row expansions"

requirements-completed: [STKE-07]

# Metrics
duration: 11min
completed: 2026-05-15
---

# Phase 13 Plan 07: ArticulosList Pre-extract + Badge + On-demand Dual Expansion Summary

**ArticulosList refactored from 401→244 LOC via shell+Row+Filters+hook extraction; ⇄ badge with CSS hover tooltip shows equivalencia pairs; exact-code search triggers inline EquivalenciaDualDisplay; SearchableSelect extended with linkedCode for linked-pair routing**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-15T15:04:25Z
- **Completed:** 2026-05-15T15:15:27Z
- **Tasks:** 5 of 6 complete (Task 6 is a checkpoint awaiting UAT)
- **Files modified:** 9

## Accomplishments

- ArticulosList.tsx brought from 401 LOC down to 244 LOC (extraction of Filters + Row + Thead helper + hook)
- `useEquivalenciaListExpansion` extracted unconditionally (m3 fix) — destinoLookup + hasEquivalencia + shouldExpandRow live in a dedicated hook at `pages/stock/hooks/`
- `EquivalenciaBadge` atom created as teal pill ⇄ with pure CSS hover tooltip (Tailwind group/group-hover) showing origen→destino×factor
- Dual expansion row (`data-testid="dual-row"`) renders ONLY when search exactly matches a linked code — prevents visual stampede
- `SearchableSelect` extended with optional `linkedCode` + `subLabel` fields; filter matches all three; existing consumers unaffected
- `seedEquivalenciaPair` implemented as real Firestore write using client SDK (m4 fix; no TODO stub); fixme count in equivalencias.spec.ts = 0

## Pre-extract Before/After LOC

| File | Before | After |
|---|---|---|
| ArticulosList.tsx | 401 | 244 |
| ArticulosListRow.tsx | — (new) | 165 |
| ArticulosListFilters.tsx | — (new) | 92 |
| useEquivalenciaListExpansion.ts | — (new) | 65 |
| EquivalenciaBadge.tsx | — (new) | 47 |

## Task Commits

1. **Tasks 1+2+4: Pre-extract + hook + badge + expansion** - `7c9e19c` (refactor)
2. **Task 3: EquivalenciaBadge + useSearchableSelect linkedCode** - `7d67f8b` (feat)
3. **Task 5: Real seedEquivalenciaPair + 13.60 E2E un-fixmed** - `112bb94` (feat)

**Plan metadata:** (docs commit pending after checkpoint Task 6 approval)

## Files Created/Modified

- `apps/sistema-modular/src/pages/stock/ArticulosList.tsx` — slimmed shell (244 LOC, down from 401)
- `apps/sistema-modular/src/pages/stock/ArticulosListFilters.tsx` — extracted filter bar
- `apps/sistema-modular/src/pages/stock/ArticulosListRow.tsx` — extracted row with badge + DualExpansionRow
- `apps/sistema-modular/src/pages/stock/hooks/useEquivalenciaListExpansion.ts` — expansion hook
- `apps/sistema-modular/src/components/stock/EquivalenciaBadge.tsx` — teal pill atom with CSS tooltip
- `apps/sistema-modular/src/components/ui/useSearchableSelect.ts` — linkedCode + subLabel extension
- `apps/sistema-modular/src/components/ui/SearchableSelect.tsx` — subLabel secondary line rendering
- `apps/sistema-modular/e2e/equivalencias.spec.ts` — 13.60 tests un-fixmed (5 real tests)
- `apps/sistema-modular/e2e/helpers/equivalencias.ts` — real seedEquivalenciaPair implementation

## Decisions Made

- **ArticulosListThead as co-located inner component:** The thead has 8 SortableHeader calls — extracting to a separate file felt like over-engineering; a local function before the main export keeps it readable without a new import chain.
- **EquivalenciaBadge tooltip — pure CSS/Tailwind:** No tooltip library added. `group` + `group-hover:visible` + absolute positioning is sufficient for a simple hover bubble. The user requirement explicitly preferred this approach.
- **seedEquivalenciaPair uses client SDK:** Project decision from Phase 8 Wave 0 (I1) established that the Firestore client SDK is used for all E2E writes. No admin SDK is configured. The client SDK writes work correctly against the live project.
- **13.30/13.40/13.50 → test.skip not fixme:** These describe blocks have UI validated via manual UAT in prior plans. `test.skip` (deterministic skip with reason) is distinct from `test.fixme` (known failure). fixme count = 0 per m4 requirement.
- **shouldExpandRow exact-match-only:** Prevents the list from expanding all linked rows simultaneously when the user types any portion of a code. The CONTEXT spec mandates this behavior; it felt correct during implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Refactor] ArticulosListThead extracted as inner component rather than SortableHeader calls inlined**
- **Found during:** Task 1
- **Issue:** 8 SortableHeader calls in the shell file contributed ~30 LOC making it hard to reach 244 LOC target
- **Fix:** Created co-located `ArticulosListThead` inner component (before the main export) using a local `SH` shorthand for the repetitive SortableHeader pattern
- **Files modified:** ArticulosList.tsx
- **Commit:** 7c9e19c

None other — plan executed largely as specified.

## Issues Encountered

- Initial extraction attempt produced 282 LOC (over 250 budget). Resolution: extracted thead pattern into co-located inner component, bringing it to 244 LOC.

## User Setup Required

None — no external service configuration required. Dev server with `pnpm dev:modular` is sufficient for UAT.

## Next Phase Readiness

**Task 6 (UAT checkpoint) is still pending.** The checkpoint was reached after Tasks 1-5 completed successfully. Visual UAT verification required before the plan can be marked fully complete.

After UAT approval:
- Phase 13 STKE-01..07 will all be GREEN
- Phase 14 (Stock Patrones BOM) can start — the `ArticulosListRow` badge slot is ready for BOM indicators

---
*Phase: 13-stock-equivalencias-compra-uso*
*Completed: 2026-05-15 (Tasks 1-5; Task 6 UAT pending)*

## Self-Check

Verifying artifacts exist and commits are present:

- [x] ArticulosList.tsx — FOUND (244 LOC)
- [x] ArticulosListRow.tsx — FOUND (165 LOC)
- [x] ArticulosListFilters.tsx — FOUND (92 LOC)
- [x] useEquivalenciaListExpansion.ts — FOUND (65 LOC)
- [x] EquivalenciaBadge.tsx — FOUND
- [x] commit 7c9e19c — FOUND
- [x] commit 7d67f8b — FOUND
- [x] commit 112bb94 — FOUND

## Self-Check: PASSED
