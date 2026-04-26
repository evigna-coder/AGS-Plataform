---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "03"
subsystem: billing
tags: [typescript, firestore, presupuestos, facturacion, cuotas, anticipos, MIXTA, BILL-03, BILL-04, BILL-07]

# Dependency graph
requires:
  - phase: 12-01
    provides: "MonedaCuota, PresupuestoCuotaFacturacion types + computeTotalsByCurrency I3 helper"
  - phase: 12-02
    provides: "togglePreEmbarque stub in presupuestosService (replaced with full impl here)"
provides:
  - "generarAvisoFacturacion: cuotaId path — anticipo before OT cerrada (BILL-03)"
  - "generarAvisoFacturacion: montoPorMoneda + porcentajeCoberturaPorMoneda persisted in solicitud (BILL-04)"
  - "generarAvisoFacturacion: atomic esquema patch (solicitudFacturacionId + montoFacturadoPorMoneda + estado=solicitada) in same runTransaction"
  - "togglePreEmbarque: full implementation with best-effort audit posta on linked ticket (BILL-07)"
  - "BILL-03 unit-stub test added to cuotasFacturacion.test.ts (guard validation — 24 tests total)"
affects:
  - "12-04 (mini-modal calls generarAvisoFacturacion with cuotaId + montoPorMoneda)"
  - "12-05 (recompute hook wiring — this.update() in togglePreEmbarque already triggers it)"
  - "12-06 (E2E tests validate generarAvisoFacturacion cuotaId path end-to-end)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cuotaId path: runTransaction READ PHASE re-validates cuota.estado inside tx (Pitfall 2-D race guard)"
    - "Pitfall 8 applied: otsListasParaFacturar NOT mutated in anticipo path even if otNumbers provided"
    - "I3 helper (computeTotalsByCurrency) imported in service to avoid duplicated totals logic"
    - "Lazy import of leadsService inside togglePreEmbarque to break circular dep (08-03 pattern)"
    - "Best-effort posta: try/catch around post-toggle audit write, console.warn on failure"
    - "Posta append: [...(lead.postas || []), posta] pattern (same as presupuestosService.ts:1697)"

key-files:
  created: []
  modified:
    - "apps/sistema-modular/src/services/presupuestosService.ts — generarAvisoFacturacion extended + togglePreEmbarque full impl"
    - "apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts — BILL-03 guard test added (24 tests total)"

key-decisions:
  - "Presupuesto has no leadId field — audit posta uses presupuestosIds array-contains query (same pattern as generarAvisoFacturacion post-commit block)"
  - "cuotaId path OT guard: skipped entirely when cuotaId present (anticipo path); legacy guard only fires when cuotaId absent"
  - "resolvedMontoPorMoneda resolution order: extras.montoPorMoneda > cuota.% * totals > extras.monto (legacy) > {}"
  - "porcentajeCoberturaPorMoneda: only entries with value > 0 included (Pitfall 1 — no undefined keys)"
  - "togglePreEmbarque uses this.update() not direct updateDoc so recompute hook in plan 12-05 fires automatically"

patterns-established:
  - "cuotaId anticipo path: guard pre-read + atomic re-validate-in-tx for double-billing safety (Pitfall 2-D)"
  - "resolvedMontoPorMoneda priority chain: explicit override > cuota% default > legacy monto > empty"

requirements-completed:
  - BILL-03
  - BILL-04
  - BILL-07

# Metrics
duration: ~8min
completed: 2026-04-26
---

# Phase 12 Plan 03: Service Extension (generarAvisoFacturacion cuotaId path + togglePreEmbarque) Summary

**generarAvisoFacturacion learns the cuotaId anticipo branch (atomic in runTransaction) + togglePreEmbarque ships full audit posta on linked ticket (best-effort)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-26T15:16:00Z
- **Completed:** 2026-04-26T15:24:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `generarAvisoFacturacion` signature with `extras.cuotaId?: string` and `extras.montoPorMoneda?: Partial<Record<MonedaCuota, number>>` — both optional, legacy callers unchanged (BILL-05)
- When `cuotaId` present: OT-listas guard skipped; cuota validated `habilitada` server-side; `otsListasParaFacturar` NOT mutated (Pitfall 8); cuota patched atomically in same `runTransaction` (Pitfall 2-D double-billing guard)
- Solicitud doc now includes `cuotaId`, `montoPorMoneda`, `porcentajeCoberturaPorMoneda` (BILL-03, BILL-04)
- `porcentajeCoberturaPorMoneda` computed as `(montoSolicitud[m] / totalPpto[m]) * 100` using `computeTotalsByCurrency` (I3 helper)
- All Firestore writes wrapped in `deepCleanForFirestore` — zero undefined literals
- Replaced `togglePreEmbarque` stub (12-02) with full implementation: guard (finalizado/anulado), idempotency check, `this.update()` write, best-effort audit posta on linked ticket via `presupuestosIds` query
- Lazy import of `leadsService` inside `togglePreEmbarque` avoids circular dependency (08-03 pattern)
- Added `[BILL-03 generarAviso-guard-no-habilitada]` unit-stub test; all 24 tests GREEN

## Task Commits

1. **Task 1: Extend generarAvisoFacturacion with cuotaId anticipo path** — `5347790` (feat)
2. **Task 2: Full togglePreEmbarque with BILL-07 audit posta** — `fbe4ae6` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/services/presupuestosService.ts` — Task 1 + Task 2 changes (163 lines added in Task 1, 44 lines net in Task 2)
- `apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts` — BILL-03 guard test (49 lines added; 24 tests total)

## Decisions Made

- **No leadId on Presupuesto**: Presupuesto type doesn't have a `leadId` field — the link is stored in `leads.presupuestosIds[]`. The audit posta in `togglePreEmbarque` uses the same `presupuestosIds array-contains` query pattern already used in `generarAvisoFacturacion`'s post-commit block
- **resolvedMontoPorMoneda priority chain**: explicit `extras.montoPorMoneda` > cuota percentage applied to `computeTotalsByCurrency` totals > legacy `extras.monto` > empty `{}`
- **togglePreEmbarque uses this.update()**: Direct `updateDoc` would bypass the recompute hook that plan 12-05 will add to `this.update()`. Using `this.update()` ensures cuotas with `hito='pre_embarque'` automatically transition to `habilitada` when the hook lands

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: Presupuesto has no leadId field**
- **Found during:** Task 2 (togglePreEmbarque implementation)
- **Issue:** Plan's pseudocode used `pres.leadId` to find the linked ticket. `Presupuesto` interface has no such field — the link is stored on `Lead.presupuestosIds[]`
- **Fix:** Replaced `pres.leadId` lookup with the existing `presupuestosIds array-contains` query pattern (same as the post-commit block in `generarAvisoFacturacion`)
- **Files modified:** `presupuestosService.ts`
- **Verification:** `tsc --noEmit` passes with no errors in presupuestosService
- **Committed in:** `fbe4ae6` (Task 2 commit, fix applied before commit)

**2. [Rule 1 - Bug] TypeScript error in BILL-03 unit test — fixed guard function signature**
- **Found during:** Task 1 TDD test writing
- **Issue:** Initial test used a typed struct for the guard function, causing TS2367 (comparison always false between literal types) and TS2345 (spread type mismatch)
- **Fix:** Simplified guard function to `(cuotaNumero: number, cuotaEstado: string): void` — matches the actual service behavior without tight literal types
- **Files modified:** `cuotasFacturacion.test.ts`
- **Verification:** `tsc --noEmit` clean; all 24 tests GREEN
- **Committed in:** `5347790`

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Type correctness fixes only. No scope creep.

## Success Criteria Check

- [x] BILL-03: `cuotaId` accepted, validated, persisted in solicitud and back-referenced in cuota
- [x] BILL-04: `montoPorMoneda` and `porcentajeCoberturaPorMoneda` persisted; MIXTA edge cases supported via I3 helper
- [x] BILL-07: audit posta written to linked ticket when preEmbarque toggled
- [x] Pitfall 1 (Firestore undefined) avoided — `deepCleanForFirestore` on every write, zero-value keys filtered from porcentajeCoberturaPorMoneda
- [x] Pitfall 2 (race) avoided — cuota estado re-validated inside `runTransaction` (double-billing guard)
- [x] Pitfall 8 (otsListas mutation) avoided — anticipo path leaves `otsListasParaFacturar` intact
- [x] Legacy path (no cuotaId) untouched — existing OT-listas guard still enforced when cuotaId absent
- [x] No new external dependencies
- [x] `apps/reportes-ot/` not touched

## Next Phase Readiness

- Plan 12-04 (mini-modal for cuota solicitud generation) can call `generarAvisoFacturacion` with `{ cuotaId, montoPorMoneda }` — service is ready
- Plan 12-05 (recompute hook wiring) can add the hook to `this.update()` — `togglePreEmbarque` already routes through `this.update()`
- Plan 12-06 (E2E tests) can validate the full cuotaId path end-to-end

---
*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Completed: 2026-04-26*
