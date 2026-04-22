---
phase: 09-stock-atp-extendido
plan: "03"
subsystem: stock
tags: [stock, atp, react, hooks, firestore, onSnapshot, url-filters, rbac, drawer]
dependency_graph:
  requires:
    - phase: 09-01
      provides: computeStockAmplio() + StockAmplio type + subscribeById
  provides:
    - useStockAmplio hook (live onSnapshot + client-side fallback)
    - StockAmplioIndicator component (4-bucket display + ATP neto)
    - StockAmplioBreakdownDrawer (2-section slide-over)
    - PlanificacionStockPage at /stock/planificacion
    - PlanificacionRow (per-row live stock + drawer + inline action)
  affects:
    - TabContentManager (route registered)
    - navigation.ts (sidebar entry added)
    - stock/index.tsx (export added)
tech-stack:
  added:
    - useStockAmplio.ts (hook wrapping onSnapshot + computeStockAmplio fallback)
    - StockAmplioIndicator.tsx (reusable 4-bucket indicator)
    - StockAmplioBreakdownDrawer.tsx (slide-over, 2 sections)
    - PlanificacionStockPage.tsx (planning view with useUrlFilters)
    - PlanificacionRow.tsx (per-row component with live updates)
  patterns:
    - Per-row useStockAmplio(id) for live onSnapshot with client-side fallback
    - marcaById lookup map passed from page to rows (avoid N+1 service calls)
    - proveedorIds is string[] — filter uses .includes() not equality
    - Drawer rendered as portal-like fixed overlay with stopPropagation
    - useUrlFilters schema-based (texto | marcaId | proveedorId | soloComprometido)
key-files:
  created:
    - apps/sistema-modular/src/hooks/useStockAmplio.ts (71 lines)
    - apps/sistema-modular/src/components/stock/StockAmplioIndicator.tsx (83 lines)
    - apps/sistema-modular/src/components/stock/StockAmplioBreakdownDrawer.tsx (117 lines)
    - apps/sistema-modular/src/pages/stock/PlanificacionStockPage.tsx (178 lines)
    - apps/sistema-modular/src/pages/stock/PlanificacionRow.tsx (79 lines)
  modified:
    - apps/sistema-modular/src/pages/stock/index.tsx (added PlanificacionStockPage export)
    - apps/sistema-modular/src/components/layout/TabContentManager.tsx (route + import)
    - apps/sistema-modular/src/components/layout/navigation.ts (sidebar entry)
key-decisions:
  - "marcasService (catalogService.ts) and proveedoresService (personalService.ts) both exist — dropdowns wired (Step 0 pre-check PASS)"
  - "proveedorIds is string[] on Articulo — filter uses .includes() not equality comparison"
  - "marcaById lookup map built in page and passed as prop to rows to avoid per-row service calls"
  - "Drawer renders exactly 2 sections — Reservas explicitly deferred, comment in code"
  - "RBAC locked to ['admin', 'admin_soporte'] on /stock/planificacion per RESEARCH.md"
  - "Breakdown drawer uses fixed overlay (not a Modal ui atom) — simpler slide-over pattern sufficient"
requirements-completed: [STKP-04, STKP-01]
duration: ~25min
completed: "2026-04-22"
---

# Phase 9 Plan 03: Stock Planning UI Summary

**`/stock/planificacion` torre de control: live 4-bucket stock table (onSnapshot per-row), 2-section OC/Reqs breakdown drawer, useUrlFilters persistence, and RBAC restricted to admin + admin_soporte**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-22T00:30:00Z
- **Completed:** 2026-04-22T01:00:00Z
- **Tasks:** 3 complete (Task 3 = checkpoint:human-verify, APPROVED by user 2026-04-22)
- **Files created:** 5
- **Files modified:** 3

## Accomplishments

- `useStockAmplio(articuloId)` hook wraps `articulosService.subscribeById` with transparent client-side fallback via `computeStockAmplio()` — source field distinguishes 'firestore' vs 'computed'; `~` indicator shown in UI when fallback active
- `StockAmplioIndicator` renders 4-bucket compact display (DISP | TRANS | RESERV | COMPROM | ATP) with red ATP on negative values; reusable across planning view, reserva modal, AddItemModal
- `StockAmplioBreakdownDrawer` renders exactly 2 sections (OCs pendientes + Requerimientos condicionales); Reservas section explicitly omitted with comment — deferred until CF populates `breakdown.reservas`
- `PlanificacionStockPage` at `/stock/planificacion`: `useUrlFilters` for all 4 filters (texto, marcaId, proveedorId, soloComprometido), marcas + proveedores dropdowns wired, zero serviceCache usage
- RBAC locked to `['admin', 'admin_soporte']` per RESEARCH.md decision — `ingeniero_soporte` excluded

## Task Commits

1. **Task 1: useStockAmplio hook + StockAmplioIndicator component** - `3823ca4` (feat)
2. **Task 2: /stock/planificacion page + row + 2-section drawer + nav wiring** - `006a589` (feat)
3. **Task 3: Human verify — planning view + STKP-04 cache bypass** - APPROVED (checkpoint:human-verify resolved 2026-04-22)

## Files Created/Modified

**Created:**
- `apps/sistema-modular/src/hooks/useStockAmplio.ts` (71 lines) — live hook + fallback
- `apps/sistema-modular/src/components/stock/StockAmplioIndicator.tsx` (83 lines) — 4-bucket display
- `apps/sistema-modular/src/components/stock/StockAmplioBreakdownDrawer.tsx` (117 lines) — 2-section slide-over
- `apps/sistema-modular/src/pages/stock/PlanificacionStockPage.tsx` (178 lines) — planning view
- `apps/sistema-modular/src/pages/stock/PlanificacionRow.tsx` (79 lines) — per-row component

**Modified:**
- `apps/sistema-modular/src/pages/stock/index.tsx` — added PlanificacionStockPage export
- `apps/sistema-modular/src/components/layout/TabContentManager.tsx` — import + route registration
- `apps/sistema-modular/src/components/layout/navigation.ts` — Planificación entry under Stock children

## Step 0 Pre-check Outcome (marcas/proveedores services)

Both services were found and are wired:

| Service | File | Method | Return shape |
|---------|------|--------|-------------|
| `marcasService` | `catalogService.ts` (line 343) | `getAll(activoOnly)` | `Marca[]` with `{id, nombre}` |
| `proveedoresService` | `personalService.ts` (line 108) | `getAll(activoOnly)` | `Proveedor[]` with `{id, nombre}` |

Both dropdowns appear in filter row 2. The conditional render (`marcas.length > 0`) means the row gracefully collapses if data fails to load.

**Key adaptation from plan:** `Articulo.proveedorIds` is a `string[]` (array of proveedor IDs), not a single `proveedorPrincipalId`. The filter uses `.includes()` instead of equality — adapated from the plan's stub without changing the service contract.

## Decisions Made

1. **marcaById lookup map in page** — instead of passing all marcas to each row and doing per-row lookup, the page builds a `Record<string, string>` map and passes `marcaNombre` as a prop to `PlanificacionRow`. Avoids N+1 rendering overhead in a table with potentially hundreds of rows.

2. **Fixed overlay drawer, not ui/Modal atom** — `StockAmplioBreakdownDrawer` uses a `fixed inset-0` pattern rather than the existing `Modal` component. Rationale: the breakdown is a slide-in panel from the right (semantic "inspector"), not a centered modal. The existing Modal atom is centered + backdrop-click-to-close — the slide-over UX is directionally different enough to warrant a dedicated pattern.

3. **Drawer 2-section decision (deferred Reservas)** — Reservas tracking requires server-side population in `computeStockAmplioAdmin`. The `breakdown.reservas` field is marked `optional` in `@ags/shared` StockAmplio type specifically for this deferral. A comment in `StockAmplioBreakdownDrawer.tsx` documents this explicitly.

4. **No `articulosService.subscribe()` at collection level** — the plan discussed a potential collection-level subscribe. The existing `articulosService.subscribe()` (lines 265-295 of stockService.ts) accepts filters but was not used here. Instead, each row subscribes via `subscribeById()`. This is acceptable per the plan's note ("planning views typically show tens to hundreds of rows, not thousands") and avoids re-fetching all rows on any single articulo change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Adaptation] proveedorIds is string[], not single proveedorPrincipalId**

- **Found during:** Task 2, Step 3 (PlanificacionStockPage filter logic)
- **Issue:** Plan template used `a.proveedorPrincipalId !== filters.proveedorId` (equality), but `Articulo` type defines `proveedorIds: string[]` (array FK). Equality check would always fail.
- **Fix:** Changed filter to `!a.proveedorIds?.includes(filters.proveedorId)` — semantically correct (article can have multiple suppliers).
- **Files modified:** `PlanificacionStockPage.tsx`
- **Verification:** TypeScript accepts the .includes() call on string[]; no type error.
- **Committed in:** `006a589`

**2. [Rule 1 - Adaptation] marcaNombre passed as prop, not read from articulo field**

- **Found during:** Task 2, Step 2 (PlanificacionRow implementation)
- **Issue:** Plan template used `articulo.marcaNombre ?? '—'` but `Articulo` type only has `marcaId: string` (FK to marcas collection). No `marcaNombre` denormalized field exists.
- **Fix:** Page builds a `marcaById` lookup map from the loaded marcas list; passes `marcaNombre={marcaById[a.marcaId]}` as prop to each `PlanificacionRow`. Row accepts `marcaNombre?: string` prop.
- **Files modified:** `PlanificacionStockPage.tsx`, `PlanificacionRow.tsx`
- **Verification:** TypeScript clean; marca name displays correctly when marcas load.
- **Committed in:** `006a589`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — type contract adaptations)
**Impact on plan:** Both adaptations are corrections to the plan's template code vs actual Articulo type. No scope creep, no new services needed.

## Audit Results

| Check | Command | Result |
|-------|---------|--------|
| Zero serviceCache imports | `grep -rn "import.*serviceCache\|from.*serviceCache" [touched files]` | PASS — 0 matches |
| RBAC excludes ingeniero_soporte | `grep "ingeniero_soporte" TabContentManager.tsx \| grep "planificacion"` | PASS — 0 matches |
| Drawer has exactly 2 sections | `grep -c "BreakdownSection" StockAmplioBreakdownDrawer.tsx` | PASS — 3 (2 calls + 1 definition) |
| Line counts under budget | wc -l on all new files | PASS — max 178 lines (< 250) |
| pnpm type-check | root-level type-check | PASS — shared package clean |
| Vite build | pnpm --filter sistema-modular build | PASS — vite built in 13.55s |

## Issues Encountered

Electron-builder step fails after Vite build succeeds — `electron\main.cjs` not found in asar. This is a pre-existing configuration issue unrelated to this plan's changes. The Vite (TypeScript) compilation is clean.

## User Setup Required

None — no external service configuration. The route is registered and accessible after `pnpm dev:modular`.

## Next Phase Readiness

- Hook + indicator component are reusable for: ArticulosList ATP column, Reserva modal, AddItemModal in presupuesto (4 surfaces from CONTEXT.md)
- Breakdown drawer can be extended when `breakdown.reservas` is populated by CF (add a 3rd `BreakdownSection` call)
- Task 3 human-verify PASSED — user confirmed live data, 2-section drawer, RBAC enforcement, and filter persistence

## Handoff Notes for /gsd:verify-work

Sample these paths:
1. `/stock/planificacion` route exists and requires admin or admin_soporte role
2. `useStockAmplio` subscribes via `articulosService.subscribeById` — no serviceCache
3. Drawer renders `BreakdownSection` exactly twice (OCs + Requerimientods); no Reservas section
4. `PlanificacionStockPage.tsx` uses `useUrlFilters(FILTER_SCHEMA)` — not useState for filters
5. RBAC: `ProtectedRoute allowedRoles={['admin', 'admin_soporte']}` on planificacion route

---
*Phase: 09-stock-atp-extendido*
*Completed: 2026-04-22 — Task 3 human verify approved*

## Human Verify Results (Task 3 — APPROVED 2026-04-22)

User walkthrough confirmed:
- Live data renders at `/stock/planificacion` with table showing all articulos
- Drawer opens with exactly 2 sections (OCs pendientes + Requerimientos condicionales) — no Reservas section
- RBAC enforced: `admin` and `admin_soporte` roles can access; `ingeniero_soporte` blocked (403/redirect)
- Filters persist via URL params on refresh (useUrlFilters confirmed working)
- STKP-04 verified live: data updates without 2-min cache delay

## Self-Check: PASSED

Files verified:
- FOUND: apps/sistema-modular/src/hooks/useStockAmplio.ts
- FOUND: apps/sistema-modular/src/components/stock/StockAmplioIndicator.tsx
- FOUND: apps/sistema-modular/src/components/stock/StockAmplioBreakdownDrawer.tsx
- FOUND: apps/sistema-modular/src/pages/stock/PlanificacionStockPage.tsx
- FOUND: apps/sistema-modular/src/pages/stock/PlanificacionRow.tsx

Commits verified in git log:
- 3823ca4: feat(09-03): useStockAmplio hook + StockAmplioIndicator component
- 006a589: feat(09-03): /stock/planificacion page + row + 2-section breakdown drawer + nav wiring
