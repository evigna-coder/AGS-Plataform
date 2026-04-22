---
phase: 09-stock-atp-extendido
plan: 02
subsystem: infra
tags: [cloud-functions, firestore-triggers, denormalization, stock, firebase-admin]

# Dependency graph
requires:
  - phase: 09-01
    provides: computeStockAmplio pure fn + StockAmplio types + stockAmplioService constants
provides:
  - updateResumenStockOnUnidad — onDocumentWritten trigger (unidades collection)
  - updateResumenStockOnOC — onDocumentWritten trigger (ordenes_compra collection, multi-articuloId)
  - updateResumenStockOnRequerimiento — onDocumentWritten trigger (requerimientos_compra collection)
  - onOTCerrada — onDocumentUpdated safety-net trigger (ot collection, idempotent via sentinel)
  - computeStockAmplioAdmin — Admin SDK version of computeStockAmplio with sync-contract comment
  - articulos/{id}.resumenStock — self-maintaining denormalized field (consumers can onSnapshot safely)
affects:
  - 09-03 (reads articulos.resumenStock via onSnapshot — depends on this trigger keeping it fresh)
  - Phase 10 (presupuestos with ATP checks rely on fresh resumenStock)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onDocumentWritten covers create+update+delete — all mutation types handled by single trigger"
    - "OC multi-articuloId: extract unique IDs from before+after items union via Set<string>, fire parallel recomputeAndWrite()"
    - "Idempotency sentinel: ot_cierre_idempotency/{otId} document as a one-time-write guard"
    - "Admin SDK init guard: if (admin.apps.length === 0) admin.initializeApp() — safe across modules"
    - "Sync-contract comment: duplicated constants block references source of truth explicitly"

key-files:
  created:
    - functions/src/computeStockAmplioAdmin.ts
    - functions/src/updateResumenStock.ts
    - functions/src/onOTCerrada.ts
    - functions/src/__tests__/updateResumenStock.test.ts
  modified:
    - functions/src/index.ts
    - functions/package.json
    - functions/tsconfig.json

key-decisions:
  - "onOTCerrada is observational only in v2.0 — writes sentinel, does NOT send mail (mailQueue consumer deferred post-v2.0)"
  - "Sentinel doc schema: { otId, estadoAdminFecha, observedAt: Timestamp, observedBy: 'cf:onOTCerrada' }"
  - "OC trigger uses parallel Promise.all() for multi-articuloId recomputes — no serial dependency between articuloIds"
  - "articulos/ NOT used as trigger document — no feedback loop possible by design"

patterns-established:
  - "Sync-contract comment: when functions/ duplicates client-side constants, document the source of truth + full list explicitly"
  - "Admin SDK version of pure fn: mirrors client-side logic 1:1 but uses admin.firestore() instead of getFirestore(app)"

requirements-completed: [STKP-02]

# Metrics
duration: ~25min (Tasks 1+2 automated; Task 3 user-verified post-deploy)
completed: 2026-04-21
---

# Phase 09 Plan 02: Cloud Functions `updateResumenStock` + `onOTCerrada` Summary

**4 Cloud Functions deployed to `southamerica-east1` that self-maintain `articulos.resumenStock` via onDocumentWritten triggers on 3 collections, with idempotent OT closure safety net**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-21
- **Completed:** 2026-04-21
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 7

## Accomplishments

- Admin SDK version of `computeStockAmplio` (`computeStockAmplioAdmin.ts`, 121 LOC) with sync-contract block comment documenting the 7 OC open states + 3 REQ exclusion states that must match `stockAmplioService.ts`
- Three `onDocumentWritten` triggers deployed: `updateResumenStockOnUnidad`, `updateResumenStockOnOC` (multi-articuloId via `Set<string>` + parallel recomputes), `updateResumenStockOnRequerimiento`
- `onOTCerrada` safety-net trigger — idempotent via `ot_cierre_idempotency/{otId}` sentinel doc, observational only in v2.0 (mail deferred post-v2.0)
- Human-verified post-deploy: `resumenStock` updates live in production Firestore; **multi-articuloId OC scenario confirmed** (OC with 2 distinct articuloIds in items[] → both `articulos/{id}.resumenStock` updated within ~5s)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 + admin core: computeStockAmplioAdmin.ts + test stub** - `4b4b7b4` (feat)
2. **Task 2: updateResumenStock triggers (3 collections) + onOTCerrada safety net** - `c910891` (feat)
3. **Task 3: Deploy functions + human verify STKP-02 end-to-end** - checkpoint approved by user (no source changes — deploy artifact only)

**Plan metadata:** `bf82cd5` (docs: finalize 09-02 summary)

## Files Created/Modified

- `functions/src/computeStockAmplioAdmin.ts` — Admin SDK version of computeStockAmplio; 121 LOC; sync-contract block comment at top of duplicated OC/REQ constants
- `functions/src/updateResumenStock.ts` — 3 onDocumentWritten triggers; OC trigger uses `Set<string>` to extract all articuloIds from before+after items union
- `functions/src/onOTCerrada.ts` — onDocumentUpdated trigger; sentinel write pattern; observational only (no mail) in v2.0
- `functions/src/__tests__/updateResumenStock.test.ts` — documentation stubs with manual emulator verify steps including multi-articuloId scenario
- `functions/src/index.ts` — re-exports 4 new triggers; helloPing untouched
- `functions/package.json` — added `typecheck` + `serve` + `deploy` scripts
- `functions/tsconfig.json` — excludes `__tests__/` directory (Jest globals incompatible with strict mode)

## Decisions Made

- `onOTCerrada` is observational only in v2.0 — writes sentinel doc but does NOT send mail. Phase 8's `pendingActions[]` + `/admin/acciones-pendientes` retry path remains authoritative. mailQueue consumer deferred post-v2.0 per CONTEXT.md.
- Sentinel doc schema chosen: `{ otId, estadoAdminFecha, observedAt: Timestamp.now(), observedBy: 'cf:onOTCerrada' }` — minimal, auditable, avoids over-engineering.
- OC trigger uses `Promise.all()` for parallel recomputes — no dependency between different articuloIds; parallel is correct and faster than serial.
- Log verbosity: `console.warn` for gracefully-skipped articulos (dangling articuloId), `console.log` for sentinel writes. No verbose logging on happy path to avoid log noise in prod.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm -C functions typecheck` passes
- `pnpm -C functions build` produces `functions/lib/` with 4 new .js files
- No grep hits for `document: 'articulos/` in `functions/src/` (no feedback loop)
- `grep "SYNC CONTRACT" functions/src/computeStockAmplioAdmin.ts` returns >0
- **STKP-02 validated by user post-deploy (Option A — production):**
  - 5 functions visible in Firebase console (helloPing + 4 new)
  - `articulos.resumenStock` field present and consistent with unidades count
  - Unidad state change → resumenStock.disponible updates within ~5s
  - **Multi-articuloId OC scenario (step 7) confirmed:** OC with 2 distinct articuloIds in items[] → both `articulos/{X}.resumenStock` AND `articulos/{Y}.resumenStock` updated

## Known Follow-ups

- **mailQueue consumer:** deferred post-v2.0 per CONTEXT — `onOTCerrada` currently writes sentinel only
- **Jest test infrastructure:** test stubs require Firebase emulator to run; formal unit test runner deferred to Phase 11 (TEST-01)
- **Sync-contract maintenance:** if `EstadoOC` union in `packages/shared` changes, `computeStockAmplioAdmin.ts` constants block must be updated manually (3 locations: shared types, stockAmplioService.ts, computeStockAmplioAdmin.ts)

## Next Phase Readiness

- `articulos.resumenStock` is now self-maintaining — 09-03 (`/stock/planificacion` page) can safely use `onSnapshot` on `articulos` collection for live zero-cache data
- No blocker for 09-03; `useStockAmplio` hook consuming `resumenStock` directly is the correct integration pattern

---
*Phase: 09-stock-atp-extendido*
*Completed: 2026-04-21*
