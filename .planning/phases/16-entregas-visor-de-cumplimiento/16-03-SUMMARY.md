---
phase: 16-entregas-visor-de-cumplimiento
plan: "03"
subsystem: entregas-visor
tags: [pure-functions, tdd, wave-1, green, resolver]
dependency_graph:
  requires:
    - "16-01 stubs (entregasResolver.ts NotImplemented baseline)"
    - "16-01 test suite RED baseline (ENT-01..ENT-06)"
  provides:
    - "computeSemaforo — semaforo classification (verde/amarillo/rojo/sin_eta/entregado)"
    - "computeEtaFecha — UTC-safe ETA date computation"
    - "buildEntregaRows — in-memory join chain ppto→req→oc→imp"
    - "test:entregas GREEN (6/6 ENT-01..ENT-06)"
  affects:
    - "apps/sistema-modular (resolver ready for useEntregas hook in 16-05)"
tech_stack:
  added: []
  patterns:
    - "Wave 1 GREEN pattern (mirrors Phase 14/15 TDD impl)"
    - "UTC start-of-day date math to avoid timezone off-by-one (Pitfall 5)"
    - "O(1) Map joins for ppto→req→oc→imp chain"
key_files:
  created: []
  modified:
    - path: "apps/sistema-modular/src/utils/entregasResolver.ts"
      role: "3 stubs replaced with real implementations (202 lines total, was 116)"
decisions:
  - "computeSemaforo: entregado opts override fires first — beats diasRestantes logic entirely"
  - "computeEtaFecha: uses Date.UTC(y, m, d + etaDias) not getFullYear/getMonth on local date — avoids DST drift"
  - "diasEntre: Math.round((etaUtc - nowUtc) / 86400000) — start-of-day UTC comparison, no floating point days"
  - "buildEntregaRows: ImpResumen inline type — entregado flag from imp.estado=recibido OR cantidadRecibida>=cantidadPedida"
  - "Legacy reqs (presupuestoItemId=null) silently skipped in join — shows row with req=null chain (as documented)"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 1
---

# Phase 16 Plan 03: Entregas Resolver — Implementacion GREEN Summary

**One-liner:** Replaced 3 NotImplemented stubs in entregasResolver.ts with pure UTC-safe implementations; test:entregas flips 0/6 → 6/6 GREEN with no regressions.

## What Was Built

### computeSemaforo

```typescript
export function computeSemaforo(diasRestantes: number | null, opts?: { entregado?: boolean }): Semaforo
```

Priority chain:
1. `opts?.entregado === true` → `'entregado'` (wins over everything, including rojo)
2. `diasRestantes === null` → `'sin_eta'`
3. `diasRestantes > 5` → `'verde'`
4. `diasRestantes >= 0` → `'amarillo'` (boundary 5 included here, NOT verde)
5. else → `'rojo'`

### computeEtaFecha

```typescript
export function computeEtaFecha(fechaAceptacionIso: string | null, etaDiasEstimados: number | null): string | null
```

Uses `Date.UTC(y, m, d + etaDias)` to sum days entirely in UTC space — avoids DST-induced off-by-one (Pitfall 5 from RESEARCH). Returns full ISO string (UTC midnight).

### buildEntregaRows

```typescript
export function buildEntregaRows(input: BuildEntregaRowsInput): EntregaRow[]
```

Three-phase Map construction then O(1) lookups:
1. `reqByItemId: Map<presupuestoItemId, RequerimientoCompra>` — uses 16-02's FK
2. `ocByReqId: Map<requerimientoId, {ocId, ocNumero}>` — from OC items
3. `impByReqId: Map<requerimientoId, ImpResumen>` — from importacion items; `entregado` flag computed here

For each `ppto.item`, all three lookups are O(1). `entregado` override passed to `computeSemaforo` so importacion.estado='recibido' wins over any diasRestantes value.

## Test Results (copy from stdout)

```
✔ [ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly (0.687ms)
✔ [ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly (4.7096ms)
✔ [ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId (0.4008ms)
✔ [ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash) (0.1012ms)
✔ [ENT-05] item con importacion.estado=recibido → semaforo = entregado (0.4825ms)
✔ [ENT-06] item sin requerimiento (stock available) sigue mostrando row (sin cadena req/oc/imp) (0.121ms)

tests 6 | pass 6 | fail 0 — exit 0
```

## Non-Regression Suite Results

```
test:patron-bom   → tests 18 | pass 18 | fail 0
test:venta-loaner → tests 5  | pass 5  | fail 0
type-check        → GREEN (packages/shared tsc --noEmit clean)
```

## Commits

| Hash | Message |
|------|---------|
| dcbeb7c | feat(16-03): implement computeSemaforo, computeEtaFecha, buildEntregaRows |

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the pseudocode in the PLAN verbatim. 202 lines total (under 250 budget).

## Next Steps

- **16-04** (UI fields): Editor de presupuestos — agregar campos `disponibilidad` + `etaDiasEstimados` + `otNumeroVinculada` en `AddItemModal` / `EditItemModal`. Modal-first parity.
- **16-05** (hook + page): `useEntregas` hook (loads Firestore, delegates to `buildEntregaRows`) + `EntregasList.tsx` visor de cumplimiento page.

## Self-Check: PASSED

Files exist:
- FOUND: apps/sistema-modular/src/utils/entregasResolver.ts (202 lines, 0 NotImplemented)

Commits exist:
- FOUND: dcbeb7c feat(16-03): implement computeSemaforo, computeEtaFecha, buildEntregaRows
