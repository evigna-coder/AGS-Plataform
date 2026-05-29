---
phase: 16-entregas-visor-de-cumplimiento
plan: "02"
subsystem: database
tags: [firestore, presupuestos, requerimientos-compra, runTransaction, entregas-visor]

# Dependency graph
requires:
  - phase: 16-01
    provides: "Presupuesto.fechaAceptacion? and RequerimientoCompra.presupuestoItemId? optional fields in @ags/shared"
provides:
  - "aceptarConRequerimientos() writes fechaAceptacion (ISO) to Presupuesto doc on accept"
  - "aceptarConRequerimientos() writes presupuestoItemId to each created RequerimientoCompra doc"
  - "Both writes atomic within existing runTransaction — consistent timestamp"
affects:
  - "16-03 (entregasResolver buildEntregaRows uses presupuestoItemId for O(1) join)"
  - "16-05 (visor de entregas page reads fechaAceptacion for ETA computation)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "nowIso captured outside runTransaction for consistent cross-doc timestamp"
    - "presupuestoItemId as FK pattern: parent doc writes id into child collection docs atomically"

key-files:
  created: []
  modified:
    - path: "apps/sistema-modular/src/services/presupuestosService.ts"
      role: "aceptarConRequerimientos() now writes fechaAceptacion + presupuestoItemId in runTransaction"

key-decisions:
  - "nowIso captured once before runTransaction (not Timestamp.now() repeated) — guarantees same ISO value in presupuesto and all req docs"
  - "presupuestoItemId uses item.id ?? null — null-safe; deepCleanForFirestore keeps null (not strips it)"
  - "No changes to idempotency guard (pp.estado === 'aceptado' early-return) or audit chain (updatedAt/updatedBy/updatedByName)"

patterns-established:
  - "Phase 16 FK pattern: write parent-id into child collection at creation time for O(1) joins without collection-group queries"

requirements-completed: [ENT-03]

# Metrics
duration: 10min
completed: 2026-05-29
---

# Phase 16 Plan 02: Entregas Visor — Backend Patch Summary

**Patched `aceptarConRequerimientos()` to atomically write `fechaAceptacion` (ISO) to Presupuesto and `presupuestoItemId` (FK) to each created RequerimientoCompra within the existing runTransaction.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-29T~18:00Z
- **Completed:** 2026-05-29T~18:10Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `Presupuesto.fechaAceptacion` persisted as ISO string at accept-time — enables ETA computation in 16-03 resolver
- `RequerimientoCompra.presupuestoItemId` written at creation — enables O(1) item→req join in `buildEntregaRows` (16-03)
- Both writes atomic within the existing Phase 8 FLOW-03 `runTransaction` — no second transaction, no architectural change
- Idempotency (`if (pp.estado === 'aceptado') return;`) and audit chain (`updatedAt/updatedBy/updatedByName`) fully preserved

## Task Commits

1. **Task 1: Patch aceptarConRequerimientos — fechaAceptacion + presupuestoItemId** - `5cbe0a0` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `apps/sistema-modular/src/services/presupuestosService.ts` — 3 surgical additions within `aceptarConRequerimientos()`: `const nowIso`, `presupuestoItemId` in req payload, `fechaAceptacion` in presupuesto patch

## Diff Summary (3 atomic changes)

**(A) Before `await runTransaction(...)` — capture consistent ISO timestamp:**
```typescript
const nowIso = new Date().toISOString();
```

**(B) Inside `tx.set(reqRef, payload)` — after `presupuestoNumero: pp.numero,`:**
```typescript
presupuestoItemId: item.id ?? null,    // (Phase 16) join key para visor de entregas
```

**(C) Inside `tx.update(presRef, ...)` — after `estado: 'aceptado',`:**
```typescript
fechaAceptacion: nowIso,                  // (Phase 16) base para computar ETA por item
```

## Decisions Made

- `nowIso = new Date().toISOString()` captured once outside the transaction callback, not `Timestamp.now()` inline per write. This guarantees both the presupuesto doc and all req docs share the exact same ISO value — important for deterministic ETA computation in the resolver.
- `presupuestoItemId: item.id ?? null` — uses `?? null` so `deepCleanForFirestore` preserves it (deepClean strips `undefined`, not `null`).

## Deviations from Plan

None — plan executed exactly as written. Three lines added, zero lines changed elsewhere.

## Smoke Test (run in dev to verify Firestore persistence)

```bash
pnpm --filter @ags/sistema-modular dev
```

1. Create a `partes` presupuesto with an item that has `itemRequiereImportacion: true` and a `stockArticuloId`.
2. Accept it (click "Aceptar" in `EditPresupuestoModal`).
3. In browser console:
   ```js
   const { db } = await import('/src/services/firebase.ts');
   const { doc, getDoc } = await import('firebase/firestore');
   const snap = await getDoc(doc(db, 'presupuestos', '<id>'));
   console.log(snap.data().fechaAceptacion);   // ISO string non-null
   ```
4. Find the created `RequerimientoCompra` doc and confirm `presupuestoItemId === <item.id>`.

## Idempotency Conservada

```typescript
// line 973 — UNTOUCHED
if (pp.estado === 'aceptado') return;
```

Accepting an already-accepted presupuesto twice: the inner `runTransaction` early-returns on the second call — `fechaAceptacion` and `presupuestoItemId` are NOT re-written.

## Issues Encountered

Pre-existing TS errors in `tsc --noEmit` (27 errors across AgendaGridCell, otService, stockAmplioService, etc.) existed before this plan — same set documented in 16-01 SUMMARY. Zero errors in `presupuestosService.ts`.

## Next Phase Readiness

- **16-03** (pure-function impls): `buildEntregaRows` can now use `presupuestoItemId` for O(1) join and `fechaAceptacion` for ETA computation. Turns all 6 ENT-01..ENT-06 tests GREEN.
- **16-04+** (UI): Visor de entregas page consumes `EntregaRow[]` built from real Firestore data.

---
*Phase: 16-entregas-visor-de-cumplimiento*
*Completed: 2026-05-29*
