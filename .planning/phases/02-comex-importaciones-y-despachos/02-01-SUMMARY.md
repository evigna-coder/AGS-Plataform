---
phase: 02-comex-importaciones-y-despachos
plan: 01
subsystem: database
tags: [typescript, firestore, types, shared, comex, importaciones]

# Dependency graph
requires: []
provides:
  - ItemImportacion interface (12 fields) exported from @ags/shared
  - Importacion extended with numeroGuia, items, fechaRecepcion, stockIngresado
  - importacionesService dateFields includes fechaRecepcion (Timestamp write fix)
  - calcularCostoConGastos pure function in utils/calcularProrrateo.ts
affects:
  - 02-02-PLAN.md (OCDetail + ImportacionEditor — depends on ItemImportacion)
  - 02-04-PLAN.md (ImportacionStatusTransition — depends on fechaRecepcion field)
  - 02-05-PLAN.md (ImportacionGastosSection prorrateo — depends on calcularCostoConGastos)
  - 02-06-PLAN.md (useIngresarStock hook — depends on calcularCostoConGastos and items field)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure utility functions extracted to apps/sistema-modular/src/utils/ for testability"
    - "dateFields array pattern in service CRUD for Timestamp conversion"
    - "null union types on optional fields per project hard rule (never undefined)"

key-files:
  created:
    - apps/sistema-modular/src/utils/calcularProrrateo.ts
  modified:
    - packages/shared/src/types/index.ts
    - apps/sistema-modular/src/services/importacionesService.ts

key-decisions:
  - "calcularCostoConGastos scoped to same-currency gastos only; cross-currency gastos are informational"
  - "fechaRecepcion stored as Firestore Timestamp (not string) — ensures timestamp comparisons work correctly"
  - "ItemImportacion uses uuid local id, not FK to another collection — denormalizes key OC fields"

patterns-established:
  - "Utility pure functions: no external deps, pure arithmetic, exported as named functions"
  - "dateFields array: add new date fields here to ensure Timestamp write in Firestore"

requirements-completed: [COMEX-05, COMEX-06]

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 2 Plan 01: Type Extensions + dateFields Fix + calcularProrrateo Summary

**ItemImportacion type (12 fields), four new Importacion fields, Firestore dateFields fechaRecepcion fix, and calcularCostoConGastos pure prorrateo utility**

## Performance

- **Duration:** ~5 min (artifacts already implemented, verified and committed)
- **Started:** 2026-04-03T18:20:00Z
- **Completed:** 2026-04-03T18:22:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `ItemImportacion` interface with 12 fields exported from `@ags/shared` — all downstream plans can reference it
- `Importacion` extended with `numeroGuia`, `items`, `fechaRecepcion`, `stockIngresado` under a `// Recepcion` comment block
- `importacionesService.create()` and `update()` now include `fechaRecepcion` in `dateFields` — prevents silent Firestore corruption (string stored instead of Timestamp)
- `calcularCostoConGastos` pure function created in `utils/calcularProrrateo.ts` — ready for prorrateo preview in plan 02-05 and stock ingress in plan 02-06

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ItemImportacion type and extend Importacion** - `faa69fb` (feat)
2. **Task 2: Fix dateFields pitfall + create calcularProrrateo.ts** - `4693e84` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `packages/shared/src/types/index.ts` — Added `ItemImportacion` interface + 4 new fields on `Importacion`
- `apps/sistema-modular/src/services/importacionesService.ts` — Added `fechaRecepcion` to dateFields (create + update) + deserialization in read paths
- `apps/sistema-modular/src/utils/calcularProrrateo.ts` — New file: pure `calcularCostoConGastos` function

## Decisions Made
- `calcularCostoConGastos` only prorratea gastos in the same currency as the OC. Cross-currency gastos are referenced separately (known limitation documented in JSDoc).
- `fechaRecepcion` uses `string | null` in the TypeScript interface (ISO string) but is persisted as Firestore Timestamp — consistent with all other date fields in the service.
- `ItemImportacion.id` is a local uuid, not a FK — key fields from ItemOC are denormalized to avoid extra reads.

## Deviations from Plan

None - plan executed exactly as written. All artifacts were already implemented in a prior session; this execution verified them, committed the uncommitted Task 2 artifacts, and created documentation.

## Issues Encountered
None - all verification checks passed. Pre-existing TypeScript errors in unrelated files (CreateEquipoModal, CreateFichaModal, etc.) are out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `@ags/shared` exports `ItemImportacion` — ready for 02-02 (OCDetail + ImportacionEditor)
- `Importacion.fechaRecepcion` field exists — ready for 02-04 (status transition validation)
- `calcularCostoConGastos` exported — ready for 02-05 (prorrateo preview) and 02-06 (stock ingress)
- No blockers for any downstream plan in this phase

---
*Phase: 02-comex-importaciones-y-despachos*
*Completed: 2026-04-03*
