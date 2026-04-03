---
phase: 01-stock-requerimientos-oc
plan: "05"
subsystem: stock
tags: [requerimientos, inline-edit, multi-select, generar-oc, url-filters]
dependency_graph:
  requires: [01-01]
  provides: [RequerimientosList with useUrlFilters, useRequerimientoInlineEdit, useGenerarOC]
  affects: [RequerimientosList, ordenesCompraService, requerimientosService]
tech_stack:
  added: []
  patterns: [useUrlFilters, inline cell editing, multi-select checkboxes, grouped OC creation]
key_files:
  created:
    - apps/sistema-modular/src/hooks/useRequerimientoInlineEdit.ts
    - apps/sistema-modular/src/hooks/useGenerarOC.ts
    - apps/sistema-modular/src/pages/stock/RequerimientoRow.tsx
  modified:
    - apps/sistema-modular/src/pages/stock/RequerimientosList.tsx
decisions:
  - "Extracted RequerimientoRow to sibling file to keep RequerimientosList under 250 lines (199 lines)"
  - "omitted requerimientoIds from OrdenCompra.create() since field does not exist on OrdenCompra type; link preserved via ItemOC.requerimientoId"
  - "proveedorSugeridoId inline edit stores provider name in separate field; editing saves only the ID field (name must be updated separately if needed)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  files_changed: 4
---

# Phase 01 Plan 05: RequerimientosList Overhaul Summary

RequerimientosList refactored with URL-persisted filters, multi-select checkboxes, inline cell editing for cantidad/urgencia/proveedor, and a Generar OC button that creates OCs grouped by provider in one action.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useRequerimientoInlineEdit and useGenerarOC hooks | 50b694e | useRequerimientoInlineEdit.ts, useGenerarOC.ts |
| 2 | Refactor RequerimientosList | 62b54e6 | RequerimientosList.tsx, RequerimientoRow.tsx |

## Output Specification

- **useState for filters removed:** Confirmed — no `useState.*filters` in RequerimientosList.tsx
- **useUrlFilters added:** Confirmed — `useUrlFilters(FILTER_SCHEMA)` with schema-based definition at line 24
- **RequerimientosList.tsx line count after refactor:** 199 lines (under 250 limit)
- **RequerimientoRow.tsx line count:** 116 lines
- **New hook files:**
  - `apps/sistema-modular/src/hooks/useRequerimientoInlineEdit.ts`
  - `apps/sistema-modular/src/hooks/useGenerarOC.ts`
- **Confirmed 'en_compra' used:** Yes — `estado: 'en_compra'` at line 68 of useGenerarOC.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] useUrlFilters uses schema object, not simple defaults**
- **Found during:** Task 2 implementation
- **Issue:** The plan showed `useUrlFilters({ estado: '', origen: '', urgencia: '' })` but the actual hook signature requires `{ type: 'string'|'boolean', default: value }` per key
- **Fix:** Used correct schema format: `{ estado: { type: 'string', default: '' }, ... }`
- **Files modified:** RequerimientosList.tsx

**2. [Rule 2 - Missing field] requerimientoIds not on OrdenCompra type**
- **Found during:** Task 1 — useGenerarOC
- **Issue:** Plan suggested passing `requerimientoIds` to `ordenesCompraService.create()` but `OrdenCompra` type does not have this field
- **Fix:** Omitted `requerimientoIds` from create call; link is preserved via `ItemOC.requerimientoId` per plan instructions
- **Files modified:** useGenerarOC.ts

**3. [Rule 1 - Architectural] File line limit exceeded**
- **Found during:** Task 2 — after initial write
- **Issue:** Combined RequerimientosList.tsx reached 311 lines exceeding 250-line hard rule
- **Fix:** Extracted `RequerimientoRow` component + URGENCIA_COLORS/LABELS constants to sibling file `RequerimientoRow.tsx`
- **Files modified:** RequerimientosList.tsx (199 lines), RequerimientoRow.tsx (116 lines)

## Self-Check: PASSED

All files exist and commits are verified:
- FOUND: useRequerimientoInlineEdit.ts
- FOUND: useGenerarOC.ts
- FOUND: RequerimientoRow.tsx
- FOUND: RequerimientosList.tsx
- FOUND: commit 50b694e
- FOUND: commit 62b54e6
