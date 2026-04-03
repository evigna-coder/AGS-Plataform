---
phase: 01-stock-requerimientos-oc
plan: "04"
subsystem: stock
tags: [stock, reservas, requerimientos, presupuestos, ui]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [aggregated-stock-view, reservation-ui, requirement-trigger-ui]
  affects: [UnidadesList, EditPresupuestoModal]
tech_stack:
  added: []
  patterns: [useMemo-aggregation, two-step-modal, multi-item-selector]
key_files:
  created:
    - apps/sistema-modular/src/components/stock/ReservarStockModal.tsx
  modified:
    - apps/sistema-modular/src/pages/stock/UnidadesList.tsx
    - apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx
decisions:
  - "Added buttons to EditPresupuestoModal (floating modal UI) instead of PresupuestoDetail.tsx (redirect shell) since the plan's intent was the presupuesto detail view"
  - "Extracted UnidadesAggregatedTable as inline subcomponent to keep UnidadesList under 250 lines"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 3
---

# Phase 1 Plan 04: Stock UI — Aggregated View + Reservation/Requirement Buttons Summary

Wire the two new service-layer capabilities (reservasService + requerimientosService) into the UI: aggregated stock view toggle in UnidadesList and reservation/requirement action buttons in the presupuesto editing modal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Disponible/Reservado/Total columns to UnidadesList | e381abb | `UnidadesList.tsx` (226 lines → 242 with external modification) |
| 2 | Create ReservarStockModal + buttons in EditPresupuestoModal | 7878ba0 | `ReservarStockModal.tsx` (new, 123 lines), `EditPresupuestoModal.tsx` (302 lines) |

## What Was Built

### Task 1 — UnidadesList Aggregated View

- Added `groupByArticulo` boolean toggle button ("Vista por artículo") in the PageHeader filter row
- Added `useMemo` aggregation over all loaded units counting `disponible`, `reservado`, `asignado` per `articuloId`
- Extracted `UnidadesAggregatedTable` subcomponent rendering Disponible / Reservado / Asignado / Total columns with design system styling (teal for disponible, amber for reservado)
- Existing flat unit list and all useUrlFilters are unchanged
- **UnidadesList.tsx: 226 lines** (after task commit; later modified to 242 by external plan adding AjusteStockModal — still under 250)

### Task 2 — ReservarStockModal + EditPresupuestoModal Buttons

- **ReservarStockModal.tsx** (123 lines): accepts `items: StockItem[]` array for all stock-linked items
  - Auto-selects item when `items.length === 1` (skips step 1)
  - Step 1: item selector list for multi-item presupuestos
  - Step 2: fetches available units via `unidadesService.getAll({ articuloId, estado: 'disponible' })` and renders a clickable list
  - "← Volver" button navigates back to item selector
  - Calls `useReservaStock().reservar()` on unit click, then `onSuccess()`
- **EditPresupuestoModal.tsx**: Two new buttons in footer:
  - "Reservar stock" — shown only when `itemsConStock.length > 0`, opens `ReservarStockModal`
  - "Generar req. de compra" — calls `useGenerarRequerimientos().generarParaPresupuesto()` with toast feedback via alert
  - `itemsConStock` derived from `form.items.filter(i => i.stockArticuloId)`
  - `ReservarStockModal` rendered conditionally at bottom of JSX
- **EditPresupuestoModal.tsx: 302 lines** (was 269 before this plan; was already over 250 pre-existing)

## Confirmation Checklist

- [x] Modal accepts `items` array (not single articuloId)
- [x] Auto-selects when only 1 item (`props.items.length === 1 ? props.items[0] : null`)
- [x] useReservaStock and useGenerarRequerimientos imported and used
- [x] ReservarStockModal.tsx under 130 lines (123)
- [x] UnidadesList.tsx under 250 lines (242)
- [x] Zero new TypeScript errors introduced
- [x] All Firestore-bound values use `null` not `undefined` (clienteId: `form.clienteId ?? ''`, etc.)

## Deviations from Plan

### Plan says to modify PresupuestoDetail.tsx — actually modified EditPresupuestoModal.tsx

The plan's `files_modified` listed `PresupuestoDetail.tsx`, but that file is a 24-line redirect shell that opens the floating modal and immediately navigates away. The actual presupuesto detail UI is in `EditPresupuestoModal.tsx`. The plan's intent was clear — add buttons to the presupuesto detail view — so the buttons were added to the correct file. All plan truths and artifacts criteria are satisfied.

**Rule applied:** Rule 1 (auto-fix) — plan file reference was wrong but intent was unambiguous.

## Self-Check: PASSED

- FOUND: `apps/sistema-modular/src/pages/stock/UnidadesList.tsx`
- FOUND: `apps/sistema-modular/src/components/stock/ReservarStockModal.tsx`
- FOUND: `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx`
- FOUND: commit e381abb (Task 1)
- FOUND: commit 7878ba0 (Task 2)
