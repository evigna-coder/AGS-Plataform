---
phase: 03-presupuestos-plantillas-texto
plan: "03"
subsystem: presupuestos/plantillas-texto
tags: [ui, modal, crud, rich-text, filters]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [management-ui-for-plantillas-texto]
  affects: [PresupuestosList, plantillasTextoPresupuestoService]
tech_stack:
  added: []
  patterns: [useUrlFilters, PlantillaRow-subcomponent-extraction, modal-compose-subforms]
key_files:
  created:
    - apps/sistema-modular/src/components/presupuestos/PlantillaTextoForm.tsx
    - apps/sistema-modular/src/components/presupuestos/PlantillaRow.tsx
    - apps/sistema-modular/src/components/presupuestos/PlantillasTextoModal.tsx
  modified:
    - apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx
decisions:
  - "PlantillaRow extracted proactively (Task 2 before Task 3) to keep modal under 250-line budget"
  - "maxWidth='xl' used for PlantillasTextoModal — Modal.tsx exposes sm|md|lg|xl|2xl; xl (~900px) gives RichTextEditor comfortable space"
  - "useUrlFilters with const-typed schema (plantilla_seccion, plantilla_tipo, plantilla_soloActivas) — never useState for filter state"
  - "resetFilters() called on modal close so URL params don't bleed between sessions"
metrics:
  duration: "154s (~2.5 min)"
  completed: "2026-04-29"
  tasks: 4
  files: 4
requirements:
  - SCOPE-PLANTILLAS-UI
---

# Phase 03 Plan 03: Management UI for Plantillas de Texto Summary

**One-liner:** Full CRUD management modal for plantillas de texto presupuesto — list, filter by section/type, create/edit with RichTextEditor (with alignment from 03-02), delete with confirm.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PlantillaTextoForm component | 5e6b2c8 | PlantillaTextoForm.tsx (159 lines) |
| 2 | PlantillaRow presentational subcomponent | f97bc89 | PlantillaRow.tsx (56 lines) |
| 3 | PlantillasTextoModal (list + form + filters) | 6fc76d8 | PlantillasTextoModal.tsx (183 lines) |
| 4 | Wire toolbar button in PresupuestosList | 79e7696 | PresupuestosList.tsx (+4 lines) |

## Line Counts

| File | Lines | Budget | Status |
|------|-------|--------|--------|
| PlantillaTextoForm.tsx | 159 | ≤250 | OK |
| PlantillaRow.tsx | 56 | ≤100 | OK |
| PlantillasTextoModal.tsx | 183 | ≤250 | OK |

## Filter Mechanism Confirmation

`useUrlFilters` is the exclusive filter mechanism in `PlantillasTextoModal.tsx`. Schema keys: `plantilla_seccion`, `plantilla_tipo`, `plantilla_soloActivas`. Never `useState` for filter state. Filters persist via URL between modal open/close sessions, and are reset via `resetFilters()` when the modal is explicitly closed.

## PlantillaRow Extraction Confirmation

`PlantillaRow.tsx` was created in **Task 2, proactively before Task 3**, as planned. This allowed `PlantillasTextoModal` to delegate all `<tr>` markup to the subcomponent and land at 183 lines — comfortably under the 250-line budget even with loading/error states, filter controls, and confirm-delete logic.

## CRUD Wiring

- **Create:** `PlantillaTextoForm` (editing=null) → `handleSave` → `plantillasTextoPresupuestoService.create()` → reload
- **Edit:** `PlantillaRow` onEdit → `handleEdit` sets editing → `PlantillaTextoForm` pre-filled → `handleSave` → `plantillasTextoPresupuestoService.update()` → reload
- **Delete:** `PlantillaRow` onDelete → `handleDelete` → `useConfirm` dialog → `plantillasTextoPresupuestoService.delete()` → reload
- **Service access:** All via `plantillasTextoPresupuestoService` imported from `../../services/firebaseService` (re-exported from `presupuestosService`)

## Deviations from Plan

None — plan executed exactly as written.

- `TIPO_PRESUPUESTO_LABELS` confirmed present in `@ags/shared` (line 795). No inline fallback needed.
- `Modal` component confirmed to expose `maxWidth` prop with `sm|md|lg|xl|2xl` values. Used `xl` for the plantillas modal.
- TypeScript compilation: zero errors in the 4 files created/modified. Pre-existing errors in unrelated files (AgendaGridCell, loaners, etc.) are out of scope per 03-01 SUMMARY note.

## Self-Check: PASSED

Files exist:
- apps/sistema-modular/src/components/presupuestos/PlantillaTextoForm.tsx — FOUND
- apps/sistema-modular/src/components/presupuestos/PlantillaRow.tsx — FOUND
- apps/sistema-modular/src/components/presupuestos/PlantillasTextoModal.tsx — FOUND

Commits exist: 5e6b2c8, f97bc89, 6fc76d8, 79e7696 — all FOUND in git log.
