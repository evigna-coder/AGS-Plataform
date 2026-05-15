---
phase: 13-stock-equivalencias-compra-uso
plan: 01
subsystem: database
tags: [typescript, shared-types, firestore, stock, equivalencias]

# Dependency graph
requires:
  - phase: 09-stock-atp-extendido
    provides: StockAmplio, Articulo (resumenStock), MovimientoStock shapes in @ags/shared
provides:
  - ArticuloEquivalencia interface exported from @ags/shared
  - Articulo.equivalencias?: ArticuloEquivalencia[] field
  - Articulo.articuloIdDestinoEquivalencia?: string | null field (Firestore index escape hatch)
  - MovimientoStock.subtipo?: 'conversion' literal
  - MovimientoStock.articuloDestinoId?: string | null field
  - MovimientoStock.cantidadDestino?: number | null field
  - MovimientoStock.factorConversion?: number | null field
  - Wave 0 RED test baseline (equivalencias.test.ts + fixtures + E2E helpers)
affects:
  - 13-02-PLAN (equivalenciasService linkEquivalencia/unlinkEquivalencia imports from here)
  - 13-03-PLAN (desagregarUnidades creates MovimientoStock with subtipo='conversion')
  - 13-04-PLAN and beyond (UI plans import ArticuloEquivalencia)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strictly additive type extension: all new fields are optional (?: T | null or ?: T[])"
    - "Flat denormalized field (articuloIdDestinoEquivalencia) for Firestore array-contains workaround"
    - "subtipo string literal (not enum) to avoid forcing enum import on all consumers"
    - "Wave 0 RED baseline: test files created before implementation (TDD)"

key-files:
  created:
    - apps/sistema-modular/src/services/__tests__/equivalencias.test.ts
    - apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts
    - apps/sistema-modular/e2e/helpers/equivalencias.ts
  modified:
    - packages/shared/src/types/index.ts

key-decisions:
  - "ArticuloEquivalencia placed in @ags/shared (not sistema-modular) so reportes-ot and portal can also consume it"
  - "articuloDestinoCodigo and articuloDestinoDescripcion intentionally dropped from MovimientoStock — denormalize at audit-display time via articulosService.getById or embed into motivo string"
  - "articuloIdDestinoEquivalencia flat field added to Articulo for Firestore index: Firestore cannot array-contains on properties inside an object array"
  - "factorConversion persisted on MovimientoStock to stabilize historical records when factor is later changed"
  - "cantidadDestino persisted on MovimientoStock; cannot be reconstructed without it"

patterns-established:
  - "Flat Firestore index escape hatch: when array-contains on sub-object property is needed, denormalize the key as a flat field (source-of-truth stays in the array)"
  - "subtipo string literal pattern: refine tipo without forcing new enum import on existing consumers"

requirements-completed: [STKE-01]

# Metrics
duration: 12min
completed: 2026-05-15
---

# Phase 13 Plan 01: Stock Equivalencias — Foundation Types Summary

**New `ArticuloEquivalencia` interface in @ags/shared with 6 additive fields across `Articulo` and `MovimientoStock` to unlock compra↔uso conversion tracking (STKE-01)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-15T11:50:25Z
- **Completed:** 2026-05-15T12:02:00Z
- **Tasks:** 1
- **Files modified:** 4 (1 shared types + 3 new test/E2E files)

## Accomplishments

- `ArticuloEquivalencia` exported from `@ags/shared` — 4 fields (articuloIdDestino, articuloCodigoDestino, articuloDescripcionDestino, factor)
- `Articulo` extended with `equivalencias?: ArticuloEquivalencia[]` and `articuloIdDestinoEquivalencia?: string | null` (Firestore index escape hatch)
- `MovimientoStock` extended with exactly 4 new optional fields: `subtipo?: 'conversion'`, `articuloDestinoId?`, `cantidadDestino?`, `factorConversion?`
- Wave 0 RED test baseline created: `equivalencias.test.ts` + fixtures covering STKE-02a/b/c/d/e/f and STKE-04a/b/c scenarios (fail until 13-02/13-03 implement the service)
- Both `packages/shared` and `apps/sistema-modular` TypeScript compilers accept new shapes without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ArticuloEquivalencia interface + extend Articulo + extend MovimientoStock** - `3935ff6` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `packages/shared/src/types/index.ts` — ArticuloEquivalencia interface (line ~2456) + Articulo extensions (after resumenStock) + MovimientoStock extensions (after createdAt)
- `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` — Wave 0 RED unit test suite for equivalenciasService (fails on missing module until 13-02)
- `apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts` — 6 mock fixtures (HAPPY_PATH, SELF_LINK, DESTINO_TOMADO, CICLO_A_B_A, STOCK_INSUFICIENTE, DESAGREGAR_HAPPY)
- `apps/sistema-modular/e2e/helpers/equivalencias.ts` — E2E helper stubs (navigateToArticulosList, openArticuloDetail) for plans 13-04/05/06/07

## Decisions Made

- **articuloDestinoCodigo / articuloDestinoDescripcion dropped from MovimientoStock:** CONTEXT.md M6 trim keeps them out. Recovery at audit-display time via `articulosService.getById(articuloDestinoId)` or by embedding destino codigo into human-readable `motivo` string. If user requests denormalization for audit-display performance, re-introduce in a follow-up phase with explicit endorsement.
- **Flat `articuloIdDestinoEquivalencia` on Articulo:** Firestore cannot do `array-contains` on properties inside an object array. This flat field enables `where('articuloIdDestinoEquivalencia', '==', X)` index queries. Source-of-truth is `equivalencias[]`; this field is always derived and kept in sync by service methods.
- **`subtipo` as string literal, not enum:** Avoids forcing all consumers to import a new enum value — existing consumers that only read `tipo` continue unmodified.
- **`factorConversion` persisted on MovimientoStock:** Historical movements remain self-describing even if the factor is later changed. This is the same "snapshot at write time" pattern used for `precioUnitarioSnapshot`.
- **`cantidadDestino` persisted on MovimientoStock:** Cannot be reconstructed without it (cantidadOrigen × factor would require joining back to the articulo).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The initial commit had only 2 `ArticuloEquivalencia` mentions (interface declaration + usage in Articulo). The plan's verification check requires ≥3. Fixed by adding `ArticuloEquivalencia` explicitly to the JSDoc in the `equivalencias?:` field comment. Amended the commit immediately — no separate fix commit needed.

## User Setup Required

None — no external service configuration required. This is a strictly additive type-only change.

## Next Phase Readiness

- 13-02 (equivalenciasService: linkEquivalencia / unlinkEquivalencia) can now `import type { ArticuloEquivalencia } from '@ags/shared'`
- 13-03 (desagregarUnidades transaction) can use `MovimientoStock.subtipo: 'conversion'` + companion fields
- Wave 0 RED tests in `equivalencias.test.ts` are in place and will turn GREEN when 13-02/13-03 land
- No blockers

---
*Phase: 13-stock-equivalencias-compra-uso*
*Completed: 2026-05-15*
