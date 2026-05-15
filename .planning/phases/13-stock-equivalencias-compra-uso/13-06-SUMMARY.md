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
    - apps/sistema-modular/e2e/equivalencias.spec.ts

key-decisions:
  - "mode='loading' is a first-class return value from useEquivalenciaDual (not just loading:true with another mode) — parent checks mode==='loading' before mode==='none' to prevent null→loading→destino flicker"
  - "discoveryDone flag set only after findOrigenDeDestino resolves — ensures mode stays 'loading' throughout the async window even if origenFetched/destinoFetched are both null"
  - "Row ordering: the article the user is currently viewing sits on top (m4 spec); mode='origen' → origen row first; mode='destino' → destino row first"
  - "CTA 'Desagregar ahora' always operates on the origen (lado compra) regardless of which article the user is viewing"
  - "E2E 13.40 and 13.50 un-fixmed via test.skip (seed helper deferred to plan 13-07)"

patterns-established:
  - "loading-aware hook pattern: return mode='loading' explicitly; parent renders skeleton on mode==='loading' BEFORE checking mode==='none'"
  - "dual-display row ordering: mode drives which row is on top; viewer's article is always anchor"

requirements-completed: [STKE-06]

# Metrics
duration: 6min
completed: 2026-05-15
---

# Phase 13 Plan 06: Stock Equivalencias — ArticuloDetail Dual Display Summary

**EquivalenciaDualDisplay card with loading-aware useEquivalenciaDual hook wired into ArticuloDetail, with 'Desagregar ahora' CTA opening DesagregarStockModal and row ordering by side (origen/destino)**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-15T13:08:08Z
- **Completed:** 2026-05-15T13:14:00Z (Tasks 1-3; Task 4 awaiting visual UAT)
- **Tasks:** 3/4 complete (Task 4 = checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments

- Created `useEquivalenciaDual` hook with M5 anti-flicker fix: `mode='loading'` is a real return value; `discoveryDone` flag prevents `mode='none'` during in-flight `findOrigenDeDestino` call
- Created `EquivalenciaDualDisplay` component (147 LOC) with m4 row ordering: the article being viewed sits on top; loading skeleton renders before discovery completes
- Wired dual display + `DesagregarStockModal` into `ArticuloDetail` (197 LOC, under 250); `dualRefreshKey` bumped on modal success to re-count stock
- Un-fixmed E2E describes 13.40 (desagregar) and 13.50 (detail.equivalencia) — replaced with `test.skip` pending seed helper from plan 13-07

## Task Commits

1. **Task 1: useEquivalenciaDual hook** - `beadd13` (feat)
2. **Task 2: EquivalenciaDualDisplay component** - `aa458b7` (feat)
3. **Task 3: Wire into ArticuloDetail + un-fixme E2E** - `4be16b2` (feat)
4. **Task 4: Visual UAT** — awaiting user checkpoint approval

## Files Created/Modified

- `apps/sistema-modular/src/hooks/useEquivalenciaDual.ts` (122 LOC) — hook with loading-aware mode derivation
- `apps/sistema-modular/src/components/stock/EquivalenciaDualDisplay.tsx` (147 LOC) — dual-row display card
- `apps/sistema-modular/src/pages/stock/ArticuloDetail.tsx` (197 LOC, +20) — dual display + modal mounted
- `apps/sistema-modular/e2e/equivalencias.spec.ts` — 13.40 and 13.50 un-fixmed

## Decisions Made

- `mode='loading'` as first-class return (not `{ loading: true, mode: 'none' }`) — parent can render skeleton without ambiguity
- `discoveryDone` flag prevents terminal `'none'` during async window (M5 fix)
- Row ordering: viewer's article is anchor — `mode='origen'` → origen row first; `mode='destino'` → destino row first (m4 spec)
- CTA operates on origen from both views (Open Question #4 resolved)
- `resolveStock` prefers `resumenStock?.disponible` (Phase 9 denormalized) with live Firestore fallback

## Deviations from Plan

None — plan executed exactly as written. The hook implementation closely follows the plan's pseudocode with one minor addition: a `cancelled` flag in the `useEffect` async body to prevent `setState` after unmount (standard React pattern not mentioned but required for correctness).

## UAT Outcome

**PENDING** — Task 4 (checkpoint:human-verify) awaits visual UAT approval.

UAT checklist per plan:
- [ ] Origen view: teal card with origen row first, destino row second, CTA visible when stock > 0
- [ ] Loading state: "Cargando equivalencia…" briefly visible, no null → loading → card flicker
- [ ] Conversion: click CTA → modal opens → confirm → dual display refreshes with new counts
- [ ] Destino view: destino row first with equivalentes sub-text, origen row second
- [ ] No equivalencia: card does not render
- [ ] Editorial Teal: teal-200 border, teal-50/30 bg, teal-700 button, mono uppercase label

## Confirmation of Plan Invariants

- Both 13.40 and 13.50 E2E fixmes removed (grep returns 0) ✓
- ArticuloDetail under 250 LOC (197 lines) ✓
- loading check comes BEFORE none check in EquivalenciaDualDisplay (mode==='loading' at line 62, before line 68) ✓
- Row ordering toggles by mode (m4 fix) ✓

## Next Phase Readiness

Tasks 1-3 complete and committed. Plan 13-06 pending visual UAT (Task 4). After UAT approval, plan 13-07 can proceed with ArticulosList badge + E2E seed helper.

---
*Phase: 13-stock-equivalencias-compra-uso*
*Completed: 2026-05-15 (Tasks 1-3; awaiting UAT)*
