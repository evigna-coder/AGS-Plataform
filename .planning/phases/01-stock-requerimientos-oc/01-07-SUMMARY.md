---
phase: 01-stock-requerimientos-oc
plan: 07
subsystem: stock
tags: [stock, movimientos, minikit, reponer, ajuste, ingeniero-inventory]
dependency_graph:
  requires: [01-01]
  provides: [handleReponer, AjusteStockModal]
  affects: [useInventarioIngeniero, InventarioIngenieroPage, UnidadesList]
tech_stack:
  added: []
  patterns: [movimientosService.create, posicionesStockService.getAll, mandatory-validation-before-firebase]
key_files:
  created:
    - apps/sistema-modular/src/hooks/useInventarioIngeniero.ts (modified — +handleReponer)
    - apps/sistema-modular/src/pages/stock/InventarioIngenieroPage.tsx (modified — Reponer button)
    - apps/sistema-modular/src/pages/stock/InventarioItemRow.tsx (new — extracted subcomponent)
    - apps/sistema-modular/src/components/stock/AjusteStockModal.tsx (new — 78 lines)
    - apps/sistema-modular/src/pages/stock/UnidadesList.tsx (modified — Ajustar button)
  modified: []
decisions:
  - handleReponer uses posicionesStockService to load real depot positions; Confirmar disabled until user selects one (no hardcoded IDs)
  - AjusteStockModal validates justificacion before calling movimientosService.create; empty justificacion shows inline error
  - ItemRow extracted to InventarioItemRow.tsx to keep InventarioIngenieroPage under 250 lines
  - Removed notas field from AjusteStockModal since MovimientoStock interface does not include it
  - Removed invalid p.tipo !== 'reserva' filter (TipoPosicionStock has no 'reserva' value); filter by codigo !== 'RESERVAS' only
metrics:
  duration: ~25min
  completed: 2026-04-03
  tasks_completed: 2
  files_changed: 5
---

# Phase 01 Plan 07: handleReponer + AjusteStockModal Summary

**One-liner:** Minikit replenishment from real depot positions (transferencia) and mandatory-justification stock adjustments (ajuste) — both writing immutable MovimientoStock records.

## What Was Built

**Task 1 — handleReponer + Reponer button in InventarioIngenieroPage**

Added `handleReponer` method to `useInventarioIngeniero.ts`. The method creates a `MovimientoStock` of `tipo: 'transferencia'` with `origenTipo: 'posicion'` and a real Firestore document ID supplied by the user at runtime (never hardcoded).

In `InventarioIngenieroPage.tsx`, depot positions are loaded on mount via `posicionesStockService.getAll(true)` (filtering out `RESERVAS` by code). For minikit items, a "Reponer" button appears in row actions. Clicking it opens an inline form: a `SearchableSelect` for depot position + a number input for quantity. The "OK" confirm button is disabled until a depot is selected. On confirm, `handleReponer` is called with the real Firestore `posicionId`.

`InventarioItemRow.tsx` was extracted as a subcomponent to keep `InventarioIngenieroPage.tsx` under the 250-line limit.

**Task 2 — AjusteStockModal + Ajustar button in UnidadesList**

`AjusteStockModal.tsx` (78 lines) shows unit info, a numeric delta field, and a required justificacion textarea. Validation runs before any Firebase call — empty justificacion shows inline error "La justificacion es obligatoria." and blocks submission. On valid submit, `movimientosService.create({ tipo: 'ajuste', motivo: justificacion })` is called.

`UnidadesList.tsx` imports and wires the modal via `ajustandoUnidad` state, with an "Ajustar" button in each flat-list row.

## File Line Counts

| File | Lines | Limit |
|---|---|---|
| useInventarioIngeniero.ts | 186 | 250 |
| InventarioIngenieroPage.tsx | 175 | 250 |
| InventarioItemRow.tsx | 85 | 250 (new) |
| AjusteStockModal.tsx | 78 | 100 |
| UnidadesList.tsx | 242 | 250 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TipoPosicionStock has no 'reserva' value**
- **Found during:** Task 1 TypeScript check
- **Issue:** `p.tipo !== 'reserva'` comparison flagged by TypeScript as TS2367 (no overlap) because `TipoPosicionStock` is `'cajonera' | 'estante' | 'deposito' | 'vitrina' | 'otro'`
- **Fix:** Removed `p.tipo !== 'reserva'` filter — reserved filtering is done by `p.codigo !== 'RESERVAS'` alone
- **Files modified:** InventarioIngenieroPage.tsx
- **Commit:** 7fe6891

**2. [Rule 1 - Bug] MovimientoStock interface has no 'notas' field**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan template included `notas: notas.trim() || null` but `MovimientoStock` (from @ags/shared) has no `notas` property — TS2353 error
- **Fix:** Removed `notas` state and textarea from AjusteStockModal; `motivo` carries the justification
- **Files modified:** AjusteStockModal.tsx
- **Commit:** 7fe6891

**3. [Rule 2 - Extraction] ItemRow extracted to InventarioItemRow.tsx**
- **Found during:** Task 1 line count check (263 lines before extraction)
- **Fix:** Moved `ItemRow` + `ActionBtn` + helper functions into new `InventarioItemRow.tsx` (85 lines); page file reduced to 175 lines
- **Files modified:** InventarioIngenieroPage.tsx (modified), InventarioItemRow.tsx (created)
- **Commit:** 9cc6835

## Confirmations

- Both movements use `movimientosService.create()` — confirmed
- `AjusteStockModal` validates `justificacion.trim()` before calling Firebase — confirmed
- No hardcoded `'DEPOSITO_DEFAULT'` or similar string IDs anywhere in new code — confirmed
- `UnidadesFlatRows.tsx` extraction: NOT needed (UnidadesList was 226 lines before, 242 after — within limit)
- Zero new TypeScript errors introduced in files owned by this plan

## Self-Check

- [x] InventarioIngenieroPage.tsx exists (175 lines)
- [x] InventarioItemRow.tsx exists (85 lines)
- [x] useInventarioIngeniero.ts has handleReponer
- [x] AjusteStockModal.tsx exists (78 lines)
- [x] UnidadesList.tsx has AjusteStockModal import and Ajustar button
- [x] Task 1 commit 9cc6835 exists
- [x] Task 2 commit 7fe6891 exists

## Self-Check: PASSED
