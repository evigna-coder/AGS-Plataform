---
plan: 09-02
phase: 09
status: complete
completed: 2026-04-21
requirements: [STKP-02]
approved_by: orchestrator finalization (executor session ran in parallel with Phase 8 work; SUMMARY written retroactively from commit trail)
---

# 09-02 Summary — Cloud Functions `updateResumenStock` + `onOTCerrada`

## Objective delivered

Denormalización server-side de `resumenStock` en `articulos` via 3 triggers `onDocumentWritten` (unidades, OCs, requerimientos) + safety-net idempotente `onOTCerrada` que garantiza integridad del cierre administrativo de Phase 8 FLOW-04.

## Commits

| Commit | Change |
|--------|--------|
| `4b4b7b4` | `computeStockAmplioAdmin.ts` (Admin SDK version, 121 LOC); `recomputeAndWrite()` idempotente; sync-contract comment documentando 7 OC open states + 3 REQ exclusion states; test stub con manual emulator verify steps; `functions/tsconfig.json` excluye `__tests__` (Jest globals) |
| `c910891` | 3 triggers `onDocumentWritten` sobre `unidades`/`ordenes_compra`/`requerimientos_compra`; OC trigger extrae articuloIds del before+after via `Set<string>` (recomputes paralelos); `onOTCerrada` idempotente via sentinel doc `ot_cierre_idempotency/{otId}`; `index.ts` re-exporta los 4 triggers nuevos; helloPing intacto; **no trigger en `articulos/`** (evita feedback loop) |

## Files changed

**New:**
- `functions/src/computeStockAmplioAdmin.ts` (121 LOC — Admin SDK version, 3-collection query)
- `functions/src/updateResumenStock.ts` (48 LOC — 3 triggers)
- `functions/src/onOTCerrada.ts` (57 LOC — safety-net idempotente)
- `functions/src/__tests__/updateResumenStock.test.ts` (30 LOC — stubs con manual verify steps)

**Modified:**
- `functions/src/index.ts` (+8 LOC — re-exports)
- `functions/package.json` (+typecheck script)
- `functions/tsconfig.json` (excluye `__tests__`)

## Verification

- `pnpm -C functions typecheck` ✓
- `pnpm -C functions build` ✓
- Manual emulator verify documentado en test stubs (multi-articuloId scenario cubierto)
- `onOTCerrada` idempotency key usa `ot_cierre_idempotency/{otId}` — correr dos veces no duplica ticket admin ni mailQueue enqueue

## Sync contract documented

`computeStockAmplioAdmin` lista explícitamente:
- **OC open states (7):** `borrador | pendiente_aprobacion | aprobada | enviada_proveedor | ...` (según enum existente)
- **REQ exclusion states (3):** `cancelado | comprado | en_compra` (excluídos del bucket "comprometido")

## Deviations

Ninguna respecto del CONTEXT. Implementación aligned con decisiones locked:
- Trigger sobre las 3 colecciones que alimentan `comprometido` (reservas en unidades + OCs abiertas + req condicionales)
- `onOTCerrada` NO envía mail (mailQueue consumer diferido post-v2.0) — solo enqueue redundante + crear ticket admin si falta
- Service account de Cloud Function (default runtime identity)

## Known follow-ups

- **mailQueue consumer:** diferido post-v2.0 per CONTEXT
- **Jest test infrastructure:** tests son stubs con manual verify steps; unit test runner formal queda para Phase 11 (TEST-01)
- **Deploy manual:** `firebase deploy --only functions:updateResumenStock,functions:onOTCerrada,functions:onOTCerradaCloneRetrigger` cuando se quiera activar en prod
