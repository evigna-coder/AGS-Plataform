---
phase: 13-stock-equivalencias-compra-uso
plan: 05
subsystem: stock
tags: [react, typescript, firestore, hooks, modal, equivalencias]

# Dependency graph
requires:
  - phase: 13-03
    provides: desagregarUnidades runTransaction (atomic conversion service)
  - phase: 13-01
    provides: Articulo.equivalencias[] type + articulosService CRUD
provides:
  - DesagregarStockModal component — UI for executing compra→uso conversions
  - useDesagregarStock hook — state + ubicacion grouping + confirm action
affects: [13-06-articulo-detail-display-dual]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook owns all state (ubicacionGroups, selectedUbicacionId, cantidad, confirming, error, successMessage); modal is pure UI delegating to hook"
    - "Ubicacion grouping: getAll({articuloId, estado: disponible, activoOnly: true}) → group by ubicacion.referenciaId → label with count"
    - "Success block replaces form (not toast) to avoid auto-close while user reads result"
    - "canConfirm guard: cantidadNum > 0 && <= stockDisponible && factor > 0 && selectedUbicacion set"

key-files:
  created:
    - apps/sistema-modular/src/hooks/useDesagregarStock.ts
    - apps/sistema-modular/src/components/stock/DesagregarStockModal.tsx
  modified: []

key-decisions:
  - "Used auth.usuario?.displayName (not .nombre — UsuarioAGS has displayName, not nombre field)"
  - "Inline success block (not toast) so user sees N → M confirmation before closing modal"
  - "13.40 E2E fixme stays in place — un-fixme owned by plan 13-06 (CTA wiring in ArticuloDetail)"
  - "Import from '../services/stockService' directly (not firebaseService barrel) to keep import chain predictable"

patterns-established:
  - "DesagregarStockModal: open/onClose/articulo/onSuccess props — same as ReservarStockModal pattern"
  - "UbicacionGroup shape: {value: referenciaId, label: 'nombre — N disponibles', stockDisponible, ubicacion}"

requirements-completed: [STKE-05]

# Metrics
duration: 4min
completed: 2026-05-15
---

# Phase 13 Plan 05: DesagregarStockModal + useDesagregarStock hook Summary

**Conversion modal (form → preview → success block) + hook encapsulating ubicacion grouping, canConfirm guard, and desagregarUnidades runTransaction call**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-15T13:01:43Z
- **Completed:** 2026-05-15T13:05:27Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments

- `useDesagregarStock` hook loads UnidadStock docs grouped by ubicacion (referenciaId), exposes stock-per-location counts, calculates cantidadDestinoPreview = cantidadNum × factor, and calls `desagregarUnidades` runTransaction on confirm
- `DesagregarStockModal` renders Editorial Teal modal with info header (DESDE/HACIA/FACTOR), SearchableSelect for ubicacion (options show "nombre — N disponibles"), numeric cantidad input with max hint, teal preview panel (cantidad × factor = result), success block on confirm, inline error on failure
- 13.40 E2E fixme confirmed still in place — CTA wiring is plan 13-06's responsibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useDesagregarStock hook** - `8d112fc` (feat)
2. **Task 2: Create DesagregarStockModal component** - `d02009c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `apps/sistema-modular/src/hooks/useDesagregarStock.ts` — Hook: ubicacion groups from UnidadStock, cantidadNum/factor/preview computed, canConfirm guard, confirm() calls desagregarUnidades, reset() on close (148 LOC)
- `apps/sistema-modular/src/components/stock/DesagregarStockModal.tsx` — Modal UI: info header + ubicacion select + cantidad + preview + success block + inline error, data-testid attributes for Playwright (162 LOC)

## Decisions Made

- `auth.usuario?.displayName` used (not `.nombre`): `UsuarioAGS` interface has `displayName`, not `nombre`. Caught at TSC stage and fixed inline (Rule 1 auto-fix).
- Success block replaces form body rather than emitting a toast, so the user can see and copy `N → M unidades` before closing the modal.
- Modal returns `null` early when `articulo` has no `equivalencias[0]` (no equivalencia configured), keeping the CTA gating in ArticuloDetail (plan 13-06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong property name on UsuarioAGS**
- **Found during:** Task 1 (TSC verification after creating hook)
- **Issue:** Plan template used `auth.usuario?.nombre` but `UsuarioAGS` interface has `displayName`, not `nombre`
- **Fix:** Changed to `auth.usuario?.displayName || auth.firebaseUser?.displayName || 'unknown'`
- **Files modified:** `apps/sistema-modular/src/hooks/useDesagregarStock.ts`
- **Verification:** `npx tsc --noEmit` no errors on the new file
- **Committed in:** `8d112fc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - property name typo in plan template)
**Impact on plan:** Minor — type correction only, no logic change. `displayName` is the correct field per UsuarioAGS interface.

## Issues Encountered

None beyond the auto-fixed TSC error above.

## E2E Status

- `13.40` describe block in `e2e/equivalencias.spec.ts` retains `test.fixme(true, 'Wave 2 plan 13-05 implements DesagregarStockModal (CTA wired in 13-06)')` — intentionally NOT un-fixmed here. Plan 13-06 owns the un-fixme when it wires the "Desagregar ahora" CTA in ArticuloDetail.
- Manual smoke: CTA wiring not yet in place (13-06 pending) — component can be mounted manually for dev smoke testing.

## Next Phase Readiness

- Plan 13-06 (ArticuloDetail display dual + "Desagregar ahora" CTA) can now `import { DesagregarStockModal } from '../stock/DesagregarStockModal'` and open it with `articulo` prop when stock disponible > 0 in the compra side
- `onSuccess` callback propagates `movimientoId` to caller for optional deep link or list refresh
- The 13.40 fixme should be un-fixed in plan 13-06 after the CTA is wired and the test can reach the modal

---
*Phase: 13-stock-equivalencias-compra-uso*
*Completed: 2026-05-15*
