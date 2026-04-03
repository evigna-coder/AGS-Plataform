---
phase: 01-stock-requerimientos-oc
plan: 02
subsystem: stock
tags: [firestore, batch-writes, react-hooks, stock-reservations]

# Dependency graph
requires:
  - phase: 01-stock-requerimientos-oc/01-01
    provides: getOrCreateReservasPosition helper + UnidadStock reservation fields

provides:
  - reservasService.reservar(): atomic batch moves UnidadStock to RESERVAS position + writes MovimientoStock
  - reservasService.liberar(): atomic batch restores unit to disponible + clears reservation fields + writes MovimientoStock
  - useReservaStock hook wrapping both methods with React loading/error state

affects:
  - 01-03 (presupuestosService trigger uses reservasService)
  - 01-04 (PresupuestoDetail reservation buttons consume useReservaStock)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reservasService uses createBatch() for atomic multi-document writes (unit update + movimiento set + audit)"
    - "useReservaStock wraps async service methods with useState(loading/error) + useCallback"

key-files:
  created:
    - apps/sistema-modular/src/hooks/useReservaStock.ts
  modified:
    - apps/sistema-modular/src/services/stockService.ts

key-decisions:
  - "MovimientoStock.creadoPor used for solicitadoPorNombre (matches actual type, not custom field)"
  - "MovimientoStock.unidadId (not unidadStockId) per actual interface"
  - "liberar() keeps current ubicacion when no destino provided — caller supplies destino for relocation"

patterns-established:
  - "Reservation service: getOrCreateReservasPosition() + batch.update(unit) + batch.set(movimiento) in single commit"
  - "Hook pattern: useCallback wrapping async service methods, returns { action, loading, error }"

requirements-completed:
  - RES-02

# Metrics
duration: 15min
completed: 2026-04-03
---

# Phase 1 Plan 02: Reservation Service Layer Summary

**reservasService with atomic batch reservation/release operations for UnidadStock, wrapped by useReservaStock React hook with loading/error state**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-03T13:25:00Z
- **Completed:** 2026-04-03T13:40:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `reservasService.reservar()` atomically moves a unit to the RESERVAS position in a single Firestore batch (unit state update + MovimientoStock creation + audit log)
- `reservasService.liberar()` atomically restores a unit to `disponible` state, clears all 4 reservation reference fields, and creates a MovimientoStock audit trail
- `useReservaStock` hook provides React-friendly wrappers returning `{ reservar, liberar, loading, error }` for use in PresupuestoDetail (Plan 04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reservasService to stockService.ts** - `dce71fa` / `e7e9a5e` (feat)
2. **Task 2: Create useReservaStock hook** - `dce71fa` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/sistema-modular/src/services/stockService.ts` - Added `reservasService` export with `reservar()` and `liberar()` methods (~115 lines); added type imports `EstadoUnidad`, `TipoMovimiento`, `TipoOrigenDestino`, `UbicacionStock`
- `apps/sistema-modular/src/hooks/useReservaStock.ts` - New file, 60 lines; exports `useReservaStock`, `ReservarParams`, `LiberarParams` interfaces

## Decisions Made
- Used `MovimientoStock.creadoPor` field (not a custom `solicitadoPor` field) because the actual `MovimientoStock` interface uses `creadoPor: string` — the plan's code snippet was adapted to match the real type
- Used `unidadId` (not `unidadStockId`) in `MovimientoStock` payload — same reason
- Firestore collection for unidades is `'unidades'` (not `'unidades_stock'`) — matches the pattern used throughout `unidadesService`
- Removed unused `nuevaUbicacion` variable from `reservar()` (TypeScript TS6133 error) — `unitPayload` uses inline object literal instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected MovimientoStock field names in reservasService**
- **Found during:** Task 1 (Add reservasService to stockService.ts)
- **Issue:** Plan code used `unidadStockId`, `solicitadoPor`, and `referenciaTipo`/`referenciaId` fields that don't exist on the actual `MovimientoStock` interface
- **Fix:** Used `unidadId` and `creadoPor` per the real interface; removed non-existent fields; kept `motivo` which is optional
- **Files modified:** apps/sistema-modular/src/services/stockService.ts
- **Verification:** `npx tsc --noEmit` reports zero errors for stockService.ts
- **Committed in:** dce71fa (Task 1 commit)

**2. [Rule 1 - Bug] Removed unused `nuevaUbicacion` variable**
- **Found during:** Task 1 verification
- **Issue:** `nuevaUbicacion` was declared but never read — TypeScript TS6133 error
- **Fix:** Removed the unused variable; `unitPayload.ubicacion` uses an inline object literal directly
- **Files modified:** apps/sistema-modular/src/services/stockService.ts
- **Verification:** `npx tsc --noEmit` reports zero errors for stockService.ts
- **Committed in:** e7e9a5e (cleanup commit)

**3. [Rule 3 - Blocking] Removed duplicate `reservasService` export**
- **Found during:** Task 1 (append operation)
- **Issue:** File already contained `reservasService` from a prior partial execution; append created a second export causing TypeScript duplicate identifier error
- **Fix:** Removed the duplicate block via Python script
- **Files modified:** apps/sistema-modular/src/services/stockService.ts
- **Verification:** Only one `export const reservasService` at line 914
- **Committed in:** e7e9a5e (cleanup commit)

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 blocking)
**Impact on plan:** All fixes required for TypeScript correctness. The plan's code snippet used field names from a proposed/draft MovimientoStock interface, but the actual type differs. No scope creep.

## Issues Encountered
- A prior partial execution had already added `reservasService` (with `docRef('unidades', ...)`) and `useReservaStock` from commit `dce71fa`. This plan verified and cleaned up remaining issues (duplicate export, TypeScript errors) to reach a fully passing state.

## Next Phase Readiness
- `reservasService` is exportable from `stockService.ts` — Plan 03 (presupuestosService trigger) can import it directly
- `useReservaStock` is ready for Plan 04 (PresupuestoDetail UI) to consume
- Zero new TypeScript errors introduced

---
*Phase: 01-stock-requerimientos-oc*
*Completed: 2026-04-03*
