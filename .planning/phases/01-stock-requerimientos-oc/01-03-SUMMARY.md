---
phase: 01-stock-requerimientos-oc
plan: 03
subsystem: api
tags: [typescript, firestore, stock, presupuestos, requerimientos, reservas]

# Dependency graph
requires:
  - phase: 01-stock-requerimientos-oc
    plan: 01
    provides: "UnidadStock reservation fields + getOrCreateReservasPosition helper"
  - phase: 01-stock-requerimientos-oc
    plan: 02
    provides: "reservasService.reservar() + reservasService.liberar() in stockService.ts"
provides:
  - "Auto-req trigger in presupuestosService.update() when estado === 'aceptado'"
  - "Auto-reserva trigger in same aceptado block via reservasService.reservar()"
  - "useGenerarRequerimientos hook for manual req generation from PresupuestoDetail"
  - "Extended requerimientosService.getAll() to accept presupuestoId + articuloId filters"
affects:
  - 01-04-PLAN.md
  - 01-05-PLAN.md

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Side-effect pattern: service method triggers sub-actions after main mutation, never blocking on failure"
    - "Duplicate-guard pattern: check existingReqs before creating to ensure idempotency"
    - "Per-item try/catch: iterate items with individual error isolation so one failure doesn't block others"

key-files:
  created:
    - apps/sistema-modular/src/hooks/useGenerarRequerimientos.ts
  modified:
    - apps/sistema-modular/src/services/presupuestosService.ts
    - apps/sistema-modular/src/services/importacionesService.ts

key-decisions:
  - "Auto-req only fires when qtyResultante < stockMinimo (avoids noise for well-stocked items)"
  - "Auto-reserva fires unconditionally for all available units up to item.cantidad regardless of stock minimum"
  - "clienteNombre not available on Presupuesto type — uses clienteId as clienteNombre fallback in reservar() call"
  - "requerimientosService.getAll() extended with presupuestoId + articuloId Firestore where() filters (no composite index needed — single-field queries)"
  - "qtyReq = max(stockMinimo - qtyResultante, item.cantidad - qtyDisponible) covers both shortage and replenishment needs"

patterns-established:
  - "Service side-effect block: add new triggers inside existing if(data.estado) block after lead sync, all in same outer try/catch"
  - "Manual hook = same logic as auto trigger but state-agnostic and less strict (also triggers when stock < cantidad even if above min)"

requirements-completed: [RES-01]

# Metrics
duration: 25min
completed: 2026-04-03
---

# Phase 01 Plan 03: Auto-req + Auto-reserva Triggers Summary

**presupuestosService.update() fires auto requerimiento creation and stock reservation when estado changes to 'aceptado', plus useGenerarRequerimientos hook for manual triggering from PresupuestoDetail UI**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-03T14:00:00Z
- **Completed:** 2026-04-03T14:25:00Z
- **Tasks:** 2
- **Files modified:** 3 (+ 1 created)

## Accomplishments
- Added auto-req + auto-reserva block to `presupuestosService.update()` guarded by `data.estado === 'aceptado'` (lines 242-307 in presupuestosService.ts)
- Auto-req creates a `RequerimientoCompra` per item when `qtyResultante < stockMinimo`, skipping duplicates
- Auto-reserva calls `reservasService.reservar()` for each available unit up to `item.cantidad`
- Created `useGenerarRequerimientos` hook enabling manual triggering from PresupuestoDetail UI
- Extended `requerimientosService.getAll()` to accept `presupuestoId` and `articuloId` filters

## Task Commits

Each task was committed atomically:

1. **Task 1: Add auto-req + auto-reserva triggers to presupuestosService.update()** - `46ecf2c` (feat)
2. **Task 2: Create useGenerarRequerimientos hook for manual triggering** - `76ea1ff` (feat)

**Plan metadata:** _(pending final docs commit)_

## Files Created/Modified
- `apps/sistema-modular/src/services/presupuestosService.ts` - Added auto-req + auto-reserva block at lines 242-307; added imports for articulosService, unidadesService, reservasService, requerimientosService
- `apps/sistema-modular/src/services/importacionesService.ts` - Extended requerimientosService.getAll() to accept presupuestoId + articuloId filters
- `apps/sistema-modular/src/hooks/useGenerarRequerimientos.ts` - New hook (88 lines) for manual req generation

## Decisions Made
- `clienteNombre` is not a field on the `Presupuesto` interface — uses `clienteId` as fallback value when calling `reservasService.reservar()` (acceptable for audit purposes; detail page can enrich later)
- Auto-req and auto-reserva share a single outer try/catch with per-item inner try/catch — outer catch handles lead sync + presupuesto fetch failures, inner handles per-item failures
- `requerimientosService.getAll()` extended with Firestore single-field where() filters (not composite) to avoid requiring new Firestore indexes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plans 01-01 and 01-02 prerequisites were missing**
- **Found during:** Pre-execution verification
- **Issue:** `reservasService` and `getOrCreateReservasPosition` did not exist in stockService.ts. Plan 01-03 depends on `reservasService.reservar()`.
- **Fix:** Executed Plan 01-01 Task 2 Step B (getOrCreateReservasPosition) and Plan 01-02 Tasks 1-2 (reservasService + useReservaStock) as blocking prerequisites. Committed as `dce71fa`.
- **Files modified:** apps/sistema-modular/src/services/stockService.ts, apps/sistema-modular/src/hooks/useReservaStock.ts
- **Verification:** TypeScript compiles with no new errors
- **Committed in:** `dce71fa` (prerequisite block)

**2. [Rule 1 - Bug] requerimientosService.getAll() missing presupuestoId/articuloId filter support**
- **Found during:** Task 1 (implementing duplicate check for auto-req)
- **Issue:** Plan template used `requerimientosService.getAll({ presupuestoId, articuloId })` but the actual method only accepted `{ estado, origen }`. TypeScript would reject the call and the duplicate check would fetch all reqs.
- **Fix:** Extended `requerimientosService.getAll()` filter type to include `presupuestoId?: string` and `articuloId?: string` with corresponding Firestore where() clauses.
- **Files modified:** apps/sistema-modular/src/services/importacionesService.ts
- **Verification:** TypeScript compiles with no errors; grep confirms new where() clauses in getAll()
- **Committed in:** `46ecf2c` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep. Prerequisite work was planned in the roadmap but hadn't been executed yet.

## Issues Encountered
- `Presupuesto` interface lacks `clienteNombre` field — only `clienteId`. The `reservasService.reservar()` requires `clienteNombre`. Used `clienteId` as fallback. This is a minor data quality tradeoff acceptable for the auto-reservation context.

## User Setup Required
None - no external service configuration required. Auto-triggers fire automatically on presupuesto estado change; no manual setup needed.

## Next Phase Readiness
- Plan 01-04 (UnidadesList aggregated columns + PresupuestoDetail reservation/req buttons) can proceed — auto-triggers are wired, hook is ready
- Plan 01-05 (RequerimientosList) can proceed — requerimientosService.getAll() now supports presupuestoId filter for linking back to source presupuesto
- `useGenerarRequerimientos` hook is exported and ready to be consumed by PresupuestoDetail in Plan 04

---
*Phase: 01-stock-requerimientos-oc*
*Completed: 2026-04-03*
