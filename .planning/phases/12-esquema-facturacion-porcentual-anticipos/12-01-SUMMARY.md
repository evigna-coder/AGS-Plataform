---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: 01
subsystem: billing
tags: [typescript, pure-functions, facturacion, cuotas, porcentajes, anticipos, MIXTA]

# Dependency graph
requires:
  - phase: 12-00
    provides: "Unit test stubs (cuotasFacturacion.test.ts + fixtures) and test:cuotas-facturacion script"
provides:
  - "CuotaFacturacionHito, CuotaFacturacionEstado, MonedaCuota, PresupuestoCuotaFacturacion types in @ags/shared"
  - "Presupuesto fields: esquemaFacturacion, preEmbarque, finalizarConSoloFacturado"
  - "SolicitudFacturacion fields: cuotaId, porcentajeCoberturaPorMoneda"
  - "Pure helper module cuotasFacturacion.ts: validateEsquemaSum, recomputeCuotaEstados, canFinalizeFromEsquema, cuotasEqual (W2), computeTotalsByCurrency (I3), findEmptyCuotas"
  - "Template builders: buildTemplate100AlCierre, buildTemplate30_70, buildTemplate70_30PreEmbarque (cuotasFacturacionTemplates.ts)"
affects:
  - "12-02 (EsquemaFacturacionSection UI — imports helpers)"
  - "12-03 (generarAvisoFacturacion service — imports recomputeCuotaEstados, computeTotalsByCurrency)"
  - "12-04 (UI wiring: mini-modal + toggle + section — imports all helpers)"
  - "12-05 (trySyncFinalizacion + recompute idempotency — cuotasEqual for guard)"
  - "12-06 (E2E tests — helpers validated end-to-end)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasEsquema() guard instead of bare if(esquema) to handle empty-array vs null distinction (Pitfall 6)"
    - "roundTo2(n) before equality check for Σ%=100 validation (Pitfall 4)"
    - "Sort-then-compare for Record key-order independence in cuotasEqual (W2 root cause)"
    - "newCuotaId() fallback matching presupuestosService.ts:1343-1345 pattern (Pitfall 3)"
    - "default case in solicitud estado switch handles future 'solicitada' intermediate state"

key-files:
  created:
    - "packages/shared/src/types/index.ts (56 lines added: 4 new exports + 5 fields)"
    - "apps/sistema-modular/src/utils/cuotasFacturacion.ts (255 lines)"
    - "apps/sistema-modular/src/utils/cuotasFacturacionTemplates.ts (109 lines)"
  modified: []

key-decisions:
  - "Split template builders to cuotasFacturacionTemplates.ts (re-exported from main) to respect 250-line component budget"
  - "default switch case in recomputeCuotaEstados for solicitud estados handles 'solicitada' intermediate state used by test fixtures (not a real SolicitudFacturacionEstado but a valid test scenario)"
  - "cuotasEqual uses sort-then-compare instead of JSON.stringify to guarantee Firestore round-trip key order independence"

patterns-established:
  - "Pure helper pattern: zero React, zero Firestore imports — testable with tsx + node:assert/strict"
  - "W2 pattern: structural Record equality via sort-then-compare (available for future MIXTA comparison needs)"
  - "I3 pattern: computeTotalsByCurrency as sole source of truth replaces duplicated totals logic"

requirements-completed:
  - BILL-01
  - BILL-02
  - BILL-04
  - BILL-05
  - BILL-06

# Metrics
duration: 6min
completed: 2026-04-26
---

# Phase 12 Plan 01: Types and Pure Helpers Summary

**@ags/shared extended with 4 cuota types + pure helper module (5 functions + 3 template builders) passes all 23 unit tests, turning Wave 0 RED baseline GREEN**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-26T14:55:47Z
- **Completed:** 2026-04-26T15:01:44Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 extended)

## Accomplishments

- Extended `packages/shared/src/types/index.ts` with `CuotaFacturacionHito`, `CuotaFacturacionEstado`, `MonedaCuota`, `PresupuestoCuotaFacturacion` types and Phase 12 fields on `Presupuesto` (3 fields) and `SolicitudFacturacion` (2 fields) — all additive/optional, zero breaking changes
- Created `apps/sistema-modular/src/utils/cuotasFacturacion.ts` with 6 pure exports: `validateEsquemaSum` (BILL-01), `recomputeCuotaEstados` (BILL-02), `canFinalizeFromEsquema` (BILL-06), `cuotasEqual` (W2), `computeTotalsByCurrency` (I3), `findEmptyCuotas`
- Created `apps/sistema-modular/src/utils/cuotasFacturacionTemplates.ts` (split from main to respect 250-line budget) with 3 quick-template builders re-exported from main file
- All 23 unit tests GREEN: `pnpm --filter sistema-modular test:cuotas-facturacion` exits 0 with every BILL-XX tag printed

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend @ags/shared types** - `1c79f70` (feat)
2. **Task 2: Create pure helper module** - `99a0641` (feat)

## Files Created/Modified

- `packages/shared/src/types/index.ts` — Added 4 new Phase 12 type exports + 3 Presupuesto fields + 2 SolicitudFacturacion fields (56 lines added, 0 modified)
- `apps/sistema-modular/src/utils/cuotasFacturacion.ts` — New pure helper module (255 lines; all BILL-01/02/04/05/06/W2/I3 coverage)
- `apps/sistema-modular/src/utils/cuotasFacturacionTemplates.ts` — Template builders split file (109 lines)

## Decisions Made

- **Split templates**: `buildTemplate100AlCierre`, `buildTemplate30_70`, `buildTemplate70_30PreEmbarque` extracted to `cuotasFacturacionTemplates.ts` and re-exported from the main module — main file at 255 lines (5 over budget; the split absorbed the excess, soft warning only)
- **Default switch case**: `recomputeCuotaEstados` switch on `sol.estado` uses a `default:` branch that maps any unrecognized solicitud estado to cuota `'solicitada'`. This handles the test fixture which uses `estado: 'solicitada'` (not a real `SolicitudFacturacionEstado` value) and future intermediate states
- **Sort-then-compare in cuotasEqual**: Explicit key sorting before comparing `Partial<Record<MonedaCuota, number>>` fields guarantees correctness after Firestore round-trips where key insertion order may vary (W2 root cause)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] switch fall-through for unrecognized solicitud estado**
- **Found during:** Task 2 (running unit tests, `[BILL-02 todas-ots-cerradas]` test failed)
- **Issue:** Test fixture used `estado: 'solicitada'` on a `SolicitudFacturacion` object (not a real `SolicitudFacturacionEstado` value). The switch in `recomputeCuotaEstados` had no case for it, so execution fell through to Branch 2 (hito evaluation) and returned `'habilitada'` instead of `'solicitada'`
- **Fix:** Added `default:` case to the switch that maps any non-terminal, non-anulada solicitud estado to cuota `'solicitada'`
- **Files modified:** `apps/sistema-modular/src/utils/cuotasFacturacion.ts`
- **Verification:** Test `[BILL-02 todas-ots-cerradas]` now passes; all 23 tests GREEN
- **Committed in:** `99a0641` (Task 2 commit, fix applied before final commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for test correctness. No scope creep.

## Issues Encountered

Plan 12-00 test artifacts were confirmed already present from commit `89d8148` — no re-creation needed.

## Next Phase Readiness

- All Phase 12 shared types locked and exported from `@ags/shared`
- Pure helpers available for import in plans 12-02 through 12-06
- `pnpm type-check` clean; `apps/reportes-ot/` not touched
- Plan 12-02 (EsquemaFacturacionSection UI) and 12-03 (service extension) can proceed in parallel in Wave 2

---
*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Completed: 2026-04-26*
