---
phase: 02-comex-importaciones-y-despachos
plan: 04
subsystem: ui
tags: [react, typescript, firestore, stock, comex, importaciones]

# Dependency graph
requires:
  - phase: 02-01
    provides: ItemImportacion/Importacion types with fechaRecepcion, numeroGuia, items fields
  - phase: 02-02
    provides: ImportacionEditor creating items on importaciones

provides:
  - State-gated transition validation: 4 states blocked with specific field error messages
  - Inline fechaRecepcion input on 'recibido' transition in ImportacionStatusTransition
  - numeroGuia editable field in ImportacionAduanaSection (null-safe Firestore writes)
  - ImportacionItemsSection: read-only table component showing shipment items

affects:
  - 02-06 (ImportacionDetail wiring of ImportacionItemsSection)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - REQUIRED_FIELDS_FOR_STATE validation map pattern for state-gated UI
    - Inline field input inside modal for required-field collection before state transition
    - Immediate Firestore persist on inline input change (fechaRecepcion before confirm)

key-files:
  created:
    - apps/sistema-modular/src/components/stock/ImportacionItemsSection.tsx
  modified:
    - apps/sistema-modular/src/components/stock/ImportacionStatusTransition.tsx
    - apps/sistema-modular/src/components/stock/ImportacionAduanaSection.tsx

key-decisions:
  - "fechaRecepcion is persisted to Firestore immediately on input change (not just on confirm) to avoid data loss if modal is closed"
  - "Validation uses local copy of imp merged with in-flight fechaRecepcion value to correctly unblock the confirm button"
  - "ImportacionItemsSection is read-only; editing items happens in ImportacionEditor only"

patterns-established:
  - "REQUIRED_FIELDS_FOR_STATE: map of state -> validator function for state transition gating"
  - "Monospace GUIA label using font-mono uppercase tracking-wide text-[10px] convention"

requirements-completed:
  - COMEX-03

# Metrics
duration: 36min
completed: 2026-04-03
---

# Phase 02 Plan 04: ImportacionStatusTransition Validation + AduanaSection + ItemsSection Summary

**State-gated transition validation with 4 blocked states, inline fechaRecepcion input, numeroGuia field in aduana, and new read-only ImportacionItemsSection table**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-04-03T18:32:34Z
- **Completed:** 2026-04-03T19:08:25Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- ImportacionStatusTransition now blocks transitions missing required fields: booking+fechaEmbarque for embarcado, fechaArriboReal for en_aduana, despachoNumero for despachado, fechaRecepcion for recibido
- Inline fechaRecepcion date picker appears when 'recibido' is selected; immediately persists to Firestore
- ImportacionAduanaSection now includes editable GUIA field using JetBrains Mono label convention, null-safe on save
- New ImportacionItemsSection component: read-only table of shipment items (codigo/descripcion/cantidades/precio/moneda) with empty state handling

## Task Commits

Each task was committed atomically:

1. **Task 1: State-gated field validation in ImportacionStatusTransition** - `b4f6d81` (feat)
2. **Task 2: numeroGuia in AduanaSection + new ImportacionItemsSection** - `18942b6` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `apps/sistema-modular/src/components/stock/ImportacionStatusTransition.tsx` - Added REQUIRED_FIELDS_FOR_STATE map, validationError computation, disabled confirm button, inline fechaRecepcion input for recibido transition
- `apps/sistema-modular/src/components/stock/ImportacionAduanaSection.tsx` - Added numeroGuia field (GUIA label) to view and edit modes, null-safe Firestore writes
- `apps/sistema-modular/src/components/stock/ImportacionItemsSection.tsx` - New read-only table component: columns Codigo/Descripcion/Cant.Pedida/Cant.Recibida/PrecioUnit./Moneda, dash for null values, empty state message

## Decisions Made
- fechaRecepcion is persisted immediately on input change (not only on confirm) to prevent data loss if the modal is closed mid-flow
- Local copy of `imp` merges the in-flight `fechaRecepcion` input so the validator correctly unblocks the confirm button as soon as the date is entered
- ImportacionItemsSection is read-only; editing items happens in ImportacionEditor (Plan 02-02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in unrelated files (fichas, leads, loaners, calificacion-proveedores) were present before this plan and are out of scope. Zero new errors introduced in the three target files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ImportacionItemsSection is ready to be wired into ImportacionDetail (Plan 02-06)
- All 4 state transition validations are enforced; operators must fill required fields before advancing estado
- numeroGuia field available in aduana section for air/sea waybill tracking

---
*Phase: 02-comex-importaciones-y-despachos*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: apps/sistema-modular/src/components/stock/ImportacionStatusTransition.tsx
- FOUND: apps/sistema-modular/src/components/stock/ImportacionAduanaSection.tsx
- FOUND: apps/sistema-modular/src/components/stock/ImportacionItemsSection.tsx
- FOUND commit b4f6d81 (Task 1)
- FOUND commit 18942b6 (Task 2)
