---
phase: 13-stock-equivalencias-compra-uso
plan: 06
subsystem: ui
tags: [react, firestore, stock, equivalencias, dual-display, hooks]

# Dependency graph
requires:
  - phase: 13-stock-equivalencias-compra-uso
    provides: "Plan 13-01: Articulo types + equivalencias[] + articuloIdDestinoEquivalencia field"
  - phase: 13-stock-equivalencias-compra-uso
    provides: "Plan 13-02: equivalenciasService (linkEquivalencia, findOrigenDeDestino, desagregarUnidades)"
  - phase: 13-stock-equivalencias-compra-uso
    provides: "Plan 13-05: DesagregarStockModal + useDesagregarStock hook"
provides:
  - "useEquivalenciaDual hook: loading-aware mode derivation (origen/destino/loading/none) with M5 anti-flicker fix"
  - "EquivalenciaDualDisplay component: dual-row card with m4 row ordering and loading skeleton"
  - "ArticuloDetail: mounts dual display + wires DesagregarStockModal CTA with refreshKey on success"
  - "ViewArticuloModal: mounts same dual display + DesagregarStockModal — real surface reached by Ver button in list"
affects:
  - "13-stock-equivalencias-compra-uso plan 13-07 (ArticulosList badge — builds on dual display patterns)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mode='loading' as explicit return value from hook (not just loading flag) — prevents parent render flicker during async discovery"
    - "discoveryDone flag gates 'none' return — hook never returns 'none' while findOrigenDeDestino is in-flight"
    - "Row ordering by mode: the article the user is looking at sits on top (m4 fix)"
    - "resolveStock prefers resumenStock?.disponible (denormalized, Phase 9) with live count fallback"
    - "cancelled flag in useEffect async body prevents setState after unmount"

key-files:
  created:
    - apps/sistema-modular/src/hooks/useEquivalenciaDual.ts
    - apps/sistema-modular/src/components/stock/EquivalenciaDualDisplay.tsx
  modified:
    - apps/sistema-modular/src/pages/stock/ArticuloDetail.tsx
    - apps/sistema-modular/src/components/stock/ViewArticuloModal.tsx
    - apps/sistema-modular/e2e/equivalencias.spec.ts

key-decisions:
  - "mode='loading' is a first-class return value from useEquivalenciaDual (not just loading:true with another mode) — parent checks mode==='loading' before mode==='none' to prevent null→loading→destino flicker"
  - "discoveryDone flag set only after findOrigenDeDestino resolves — ensures mode stays 'loading' throughout the async window even if origenFetched/destinoFetched are both null"
  - "Row ordering: the article the user is currently viewing sits on top (m4 spec); mode='origen' → origen row first; mode='destino' → destino row first"
  - "CTA 'Desagregar ahora' always operates on the origen (lado compra) regardless of which article the user is viewing"
  - "E2E 13.40 and 13.50 un-fixmed via test.skip (seed helper deferred to plan 13-07)"
  - "UAT gap: plan originally only wired ArticuloDetail (route); Ver button in list opens ViewArticuloModal — dual display must appear there too. Post-UAT fix mounts same wiring in ViewArticuloModal"

patterns-established:
  - "loading-aware hook pattern: return mode='loading' explicitly; parent renders skeleton on mode==='loading' BEFORE checking mode==='none'"
  - "dual-display row ordering: mode drives which row is on top; viewer's article is always anchor"

requirements-completed: [STKE-06]

# Metrics
duration: 9min
completed: 2026-05-15
---

# Phase 13 Plan 06: Stock Equivalencias — ArticuloDetail Dual Display Summary

**EquivalenciaDualDisplay card with loading-aware useEquivalenciaDual hook wired into ArticuloDetail AND ViewArticuloModal, with 'Desagregar ahora' CTA opening DesagregarStockModal and row ordering by side (origen/destino)**

## Performance

- **Duration:** ~9 min total (Tasks 1-3: ~6 min; post-UAT gap fix: ~3 min)
- **Started:** 2026-05-15T13:08:08Z
- **Completed:** 2026-05-15 (all 4 tasks + post-UAT fix)
- **Tasks:** 4/4 complete
- **Files modified:** 5

## Accomplishments

- Created `useEquivalenciaDual` hook with M5 anti-flicker fix: `mode='loading'` is a real return value; `discoveryDone` flag prevents `mode='none'` during in-flight `findOrigenDeDestino` call
- Created `EquivalenciaDualDisplay` component (147 LOC) with m4 row ordering: the article being viewed sits on top; loading skeleton renders before discovery completes
- Wired dual display + `DesagregarStockModal` into `ArticuloDetail` (197 LOC, under 250); `dualRefreshKey` bumped on modal success to re-count stock
- **Post-UAT gap fix:** Wired same dual display + `DesagregarStockModal` into `ViewArticuloModal` (214 LOC, under 250) — the real surface the user reaches via "Ver" button in the artículos list; `load()` called on success to refresh modal unit list
- Un-fixmed E2E describes 13.40 (desagregar) and 13.50 (detail.equivalencia) — replaced with `test.skip` pending seed helper from plan 13-07

## Task Commits

1. **Task 1: useEquivalenciaDual hook** - `beadd13` (feat)
2. **Task 2: EquivalenciaDualDisplay component** - `aa458b7` (feat)
3. **Task 3: Wire into ArticuloDetail + un-fixme E2E** - `4be16b2` (feat)
4. **Task 4: Visual UAT** — APPROVED (dual display semantics correct; gap = surface coverage, not display itself)
5. **Post-UAT gap fix: Mount in ViewArticuloModal** - `4e208cc` (fix)

## Files Created/Modified

- `apps/sistema-modular/src/hooks/useEquivalenciaDual.ts` (122 LOC) — hook with loading-aware mode derivation
- `apps/sistema-modular/src/components/stock/EquivalenciaDualDisplay.tsx` (147 LOC) — dual-row display card
- `apps/sistema-modular/src/pages/stock/ArticuloDetail.tsx` (197 LOC, +20) — dual display + modal mounted
- `apps/sistema-modular/src/components/stock/ViewArticuloModal.tsx` (214 LOC, +22) — dual display + modal mounted (post-UAT fix)
- `apps/sistema-modular/e2e/equivalencias.spec.ts` — 13.40 and 13.50 un-fixmed

## Decisions Made

- `mode='loading'` as first-class return (not `{ loading: true, mode: 'none' }`) — parent can render skeleton without ambiguity
- `discoveryDone` flag prevents terminal `'none'` during async window (M5 fix)
- Row ordering: viewer's article is anchor — `mode='origen'` → origen row first; `mode='destino'` → destino row first (m4 spec)
- CTA operates on origen from both views (Open Question #4 resolved)
- `resolveStock` prefers `resumenStock?.disponible` (Phase 9 denormalized) with live Firestore fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Post-UAT gap] Surface coverage: ViewArticuloModal not wired**
- **Found during:** Task 4 (Visual UAT) — user reported "Ver" button opens a modal, not the route-based detail page
- **Issue:** Plan 13-06 originally wired `EquivalenciaDualDisplay` only into `ArticuloDetail.tsx` (the `/stock/articulos/{id}` route). The user actually reaches artículo details via the "Ver" button in the list, which opens `ViewArticuloModal.tsx` — a completely separate surface.
- **Fix:** Mounted same `EquivalenciaDualDisplay` + `DesagregarStockModal` wiring into `ViewArticuloModal.tsx` using identical pattern as `ArticuloDetail.tsx`. `load()` called on conversion success to refresh the modal's own unit list.
- **Files modified:** `apps/sistema-modular/src/components/stock/ViewArticuloModal.tsx`
- **Commit:** `4e208cc`

## UAT Outcome

**APPROVED** — User approved dual display behavior (semantics, row ordering, CTA, Editorial Teal tokens all correct). The gap was surface coverage only (modal vs route), not the display logic itself.

UAT checklist:
- [x] Dual display semantics approved by user
- [x] Row ordering accepted (origen/destino anchor per m4 spec)
- [x] CTA behavior accepted
- [x] Gap identified: "Ver" button opens ViewArticuloModal, not ArticuloDetail
- [x] Post-UAT fix: ViewArticuloModal now also mounts dual display

## Confirmation of Plan Invariants

- Both 13.40 and 13.50 E2E fixmes removed (grep returns 0) ✓
- ArticuloDetail under 250 LOC (197 lines) ✓
- ViewArticuloModal under 250 LOC (214 lines) ✓
- loading check comes BEFORE none check in EquivalenciaDualDisplay (mode==='loading' at line 62, before line 68) ✓
- Row ordering toggles by mode (m4 fix) ✓

## Next Phase Readiness

Plan 13-06 fully delivered including post-UAT gap fix. Plan 13-07 can proceed with ArticulosList badge + E2E seed helper.

---
*Phase: 13-stock-equivalencias-compra-uso*
*Completed: 2026-05-15 (all tasks + post-UAT gap fix)*
