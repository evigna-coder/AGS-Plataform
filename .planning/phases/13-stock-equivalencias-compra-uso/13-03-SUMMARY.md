---
phase: 13-stock-equivalencias-compra-uso
plan: "03"
subsystem: stock
tags: [firestore, runTransaction, equivalencias, stock, conversion, typescript]

# Dependency graph
requires:
  - phase: 13-stock-equivalencias-compra-uso
    plan: "02"
    provides: "equivalenciasService.ts stub + FirestoreDouble interface + test infrastructure (FirestoreTxDouble, __setTestFirestore, STKE-02 passing)"
  - phase: 13-stock-equivalencias-compra-uso
    plan: "01"
    provides: "MovimientoStock type with 4 STKE-01 destino fields (articuloDestinoId, cantidadDestino, factorConversion, subtipo)"
provides:
  - "desagregarUnidades() — fully implemented (replaces stub from 13-02)"
  - "Atomic compra→uso conversion: marks N origen UnidadStock docs as consumido, creates N×factor new destino docs as disponible, writes 1 MovimientoStock with subtipo='conversion'"
  - "Test-mode path: direct MockEquivalenciasState mutations (no Firestore emulator needed)"
  - "Prod-mode path: real Firestore runTransaction with reads-first order"
affects:
  - "13-05-DesagregarStockModal — calls desagregarUnidades(), unblocked by this plan"
  - "stock-atp — any ATP computations for articles with equivalencias will now reflect correct consumido/disponible states"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-mode service function: _testState branch mutates MockEquivalenciasState directly; prod branch uses real Firestore runTransaction"
    - "Read-first runTransaction pattern: all tx.get() calls before any tx.update/tx.set (Firestore requirement)"
    - "Decimal-factor integer guard: Math.abs(rawQty - Math.round(rawQty)) > 1e-9 check before generating IDs"
    - "FIFO candidatas: sorted by createdAt asc, slice(0, cantidad)"

key-files:
  created: []
  modified:
    - apps/sistema-modular/src/services/equivalenciasService.ts

key-decisions:
  - "Atomic model confirmed (user decision): 1 UnidadStock doc = 1 physical unit — matches Phase 9 reservasService.reservar() convention"
  - "MovimientoStock does NOT write articuloDestinoCodigo/articuloDestinoDescripcion — those fields are intentionally absent per 13-01 trim; destino codigo embedded in motivo string instead"
  - "Test mode mutates MockEquivalenciasState inline (no FirestoreDouble.runTransaction staging for STKE-04 — fixture shape uses MockEquivalenciasState, not FirestoreDouble)"
  - "Helper functions _runConversionInTestMode / _runConversionInProd extracted within same file to keep desagregarUnidades() readable and avoid 250-LOC concerns on service layer"

patterns-established:
  - "desagregarUnidades({articuloOrigenId, cantidad, ubicacion, solicitadoPorNombre}): Promise<{movimientoId, cantidadDestino}> — public contract for plan 13-05"

requirements-completed: [STKE-04]

# Metrics
duration: 4min
completed: "2026-05-15"
---

# Phase 13 Plan 03: desagregarUnidades runTransaction — Atomic Conversion compra→uso (STKE-04)

**desagregarUnidades() implemented with runTransaction pattern: marks N origen UnidadStock docs consumido, creates N×factor destino docs disponible, writes 1 MovimientoStock subtipo='conversion' — all atomic (STKE-04a/b/c GREEN)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-15T12:54:39Z
- **Completed:** 2026-05-15T12:58:25Z
- **Tasks:** 1 implementation task (Task 0 checkpoint pre-resolved by user)
- **Files modified:** 1

## Accomplishments

- Replaced `desagregarUnidades` stub with full implementation following Phase 9 `reservasService.reservar()` pattern
- Test-mode path mutates `MockEquivalenciasState` inline: marks candidatas `consumido`, pushes N×factor new destino units `disponible`, pushes MovimientoStock with `subtipo='conversion'`
- Prod-mode path: pre-fetches candidatas outside tx, then `runTransaction` with reads-first (validate `disponible` under lock) followed by writes (bajas + altas + mov)
- MovimientoStock payload includes exactly the 4 STKE-01 destino-side fields: `subtipo:'conversion'`, `articuloDestinoId`, `cantidadDestino`, `factorConversion` — no `articuloDestinoCodigo`/`articuloDestinoDescripcion` (intentionally trimmed in 13-01)
- All 9 equivalencias tests pass: STKE-02a..f (no regression) + STKE-04a/b/c (new GREEN)

## Task Commits

1. **Task 1: Implement desagregarUnidades runTransaction (atomic model)** — `d4b77f1` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/services/equivalenciasService.ts` — replaced 24-line stub with full ~220-line implementation; extracted `_runConversionInTestMode` and `_runConversionInProd` helpers within the same file

## Decisions Made

- **Checkpoint resolution (Task 0):** User selected `atomic` — 1 UnidadStock doc = 1 physical unit. Matches Phase 9 convention. No migration required.
- **Test mode vs FirestoreDouble:** The test fixture (`FIXTURE_DESAGREGAR_HAPPY`) uses `MockEquivalenciasState` set via `__setTestFirestore`. The `_testState` branch directly mutates `state.collections` rather than going through `FirestoreDouble.runTransaction`. This is correct because STKE-04a/b test via `MockEquivalenciasState`, not via a `FirestoreDouble` instance.
- **MovimientoStock shape locked at 4 STKE-01 fields:** `articuloDestinoCodigo` and `articuloDestinoDescripcion` NOT written to the document — at display-time, resolve via `articulosService.getById(articuloDestinoId)` or read from the `motivo` human-readable string.

## Deviations from Plan

None — plan executed exactly as written. The implementation follows the documented Step 1–7 from the plan action spec verbatim.

The only structural note: `_runConversionInTestMode` signature was trimmed to exclude `eq`, `cantidadDestino`, `origen`, and `nowIso` parameters (unused in test mode) to satisfy TypeScript's `'declared but never read'` checks. These values are needed in the prod path only.

## Issues Encountered

None. TypeScript type check on `equivalenciasService.ts` is clean (zero errors introduced by this plan). Pre-existing TS6133/TS2345 errors in other files (`AgendaGridCell.tsx`, `equivalencias.test.ts` STKE-02b, `cuotasFacturacion.ts`) are pre-existing and out of scope.

## Next Phase Readiness

- `desagregarUnidades(params)` is exported and stable — plan 13-05 (DesagregarStockModal UI) can call it immediately
- Function throws descriptive errors suitable for toast display: `'Stock insuficiente: N disponibles, M solicitadas'`, `'Artículo origen no tiene equivalencia configurada'`, etc.
- Return shape `{ movimientoId: string, cantidadDestino: number }` is the contract for the modal to show confirmation toast

---

## Self-Check: PASSED

- `apps/sistema-modular/src/services/equivalenciasService.ts` — FOUND
- Commit `d4b77f1` — FOUND in git log
- All 9 equivalencias tests pass (STKE-02a..f + STKE-04a/b/c) — VERIFIED
- `articuloDestinoCodigo` / `articuloDestinoDescripcion` — grep returns 0 lines (NOT written to service) — VERIFIED
