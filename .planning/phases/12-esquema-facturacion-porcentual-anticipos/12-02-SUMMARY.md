---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "02"
subsystem: billing
tags: [react, typescript, presupuestos, facturacion, cuotas, porcentajes, MIXTA, BILL-01, BILL-07]

# Dependency graph
requires:
  - phase: 12-01
    provides: "Pure helpers (validateEsquemaSum, computeTotalsByCurrency, buildTemplate*) + Phase 12 types in @ags/shared"
provides:
  - "EsquemaFacturacionSection: editor UI for cuota schema with Σ% inline validation and quick-templates"
  - "EsquemaCuotaRow: single row (descripcion + hito dropdown + % per moneda + monto preview)"
  - "QuickTemplateButtons: 100%/30-70/70-30 quick-fill bar"
  - "EditPresupuestoModal wired with EsquemaFacturacionSection for all tipo != 'contrato'"
  - "usePresupuestoEdit extended: esquemaFacturacion + preEmbarque mirror + finalizarConSoloFacturado in form state"
  - "BILL-01 save guard: validates Σ%=100 per moneda before persisting in borrador"
  - "BILL-07 toggle: preEmbarque checkbox calls presupuestosService.togglePreEmbarque() directly (B2)"
  - "togglePreEmbarque stub in presupuestosService (full implementation in 12-03)"
affects:
  - "12-03 (togglePreEmbarque full implementation with audit posta on linked ticket)"
  - "12-04 (mini-modal for cuota solicitud generation — uses EsquemaFacturacionSection state)"
  - "12-06 (E2E tests for 30/70 and 70/30 schemas)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "B2 pattern: checkbox onChange calls service directly for side-effect (audit posta), bypasses form-state — documented with comment block"
    - "I3 pattern: EsquemaFacturacionSection uses computeTotalsByCurrency import, no inline duplication"
    - "Component split: EsquemaCuotaRow (143 lines) + QuickTemplateButtons (52 lines) + EsquemaFacturacionSection (229 lines) — all under budget"
    - "Save guard pattern: validateEsquemaSum + findEmptyCuotas called in hook save() before service.update"

key-files:
  created:
    - "apps/sistema-modular/src/components/presupuestos/EsquemaCuotaRow.tsx (143 lines)"
    - "apps/sistema-modular/src/components/presupuestos/QuickTemplateButtons.tsx (52 lines)"
    - "apps/sistema-modular/src/components/presupuestos/EsquemaFacturacionSection.tsx (229 lines)"
  modified:
    - "apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx — wired EsquemaFacturacionSection + preEmbarque B2 toggle"
    - "apps/sistema-modular/src/hooks/usePresupuestoEdit.ts — added 3 Phase 12 fields + save validation"
    - "apps/sistema-modular/src/services/presupuestosService.ts — added togglePreEmbarque stub"

key-decisions:
  - "togglePreEmbarque stub: writes preEmbarque field directly; audit posta side-effect deferred to plan 12-03 (same wave)"
  - "B2 pattern documented inline with multi-line comment explaining why this is the only field that bypasses form-state in the modal"
  - "EsquemaFacturacionSection derives monedasActivas from items at render time (same algorithm as save() in hook) — source of truth duplicated deliberately to keep component pure/standalone"
  - "preEmbarque checkbox uses presupuestosService.getById() re-read after toggle to refresh form-state atomically"

patterns-established:
  - "B2 bypass pattern: direct service call for fields with side-effects, with form-state refresh via getById after resolve"

requirements-completed:
  - BILL-01
  - BILL-07

# Metrics
duration: ~8min
completed: 2026-04-26
---

# Phase 12 Plan 02: EsquemaFacturacionSection UI Summary

**Three-component editor (EsquemaCuotaRow + QuickTemplateButtons + EsquemaFacturacionSection) wired in EditPresupuestoModal with Σ%=100 save guard and B2 preEmbarque direct-service toggle**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-26T15:06:10Z
- **Completed:** 2026-04-26T15:14:17Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Created `EsquemaCuotaRow.tsx` (143 lines): editable row with descripcion text, hito dropdown (5 hitos with Spanish labels), one `%` input per active moneda, monto preview calculation, delete button locked for solicitada/facturada/cobrada cuotas
- Created `QuickTemplateButtons.tsx` (52 lines): three quick-fill buttons calling `buildTemplate100AlCierre`, `buildTemplate30_70`, `buildTemplate70_30PreEmbarque` from plan 12-01
- Created `EsquemaFacturacionSection.tsx` (229 lines): full editor section with collapsible header, Σ% badges per moneda (green/red), all-zero cuota banner, computeTotalsByCurrency (I3), validateEsquemaSum (BILL-01)
- Extended `usePresupuestoEdit.ts`: 3 new form fields + BILL-01 save validation that blocks borrador save when Σ%≠100 per moneda
- Wired `EsquemaFacturacionSection` in `EditPresupuestoModal` for all `tipo !== 'contrato'`
- Added B2 preEmbarque checkbox (direct service call, bypasses form-state) — only visible when esquema has hito='pre_embarque' cuota
- Added `togglePreEmbarque` stub to `presupuestosService.ts` (full implementation in 12-03)

## Task Commits

1. **Task 1: Create EsquemaFacturacionSection + EsquemaCuotaRow + QuickTemplateButtons** — `3aedfd8` (feat)
2. **Task 2: Wire EsquemaFacturacionSection in modal + extend form state + B2 preEmbarque toggle** — `692a0b6` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/components/presupuestos/EsquemaCuotaRow.tsx` — Editable cuota row (descripcion, hito, % per moneda, monto preview, delete)
- `apps/sistema-modular/src/components/presupuestos/QuickTemplateButtons.tsx` — 100%/30-70/70-30 quick-template bar
- `apps/sistema-modular/src/components/presupuestos/EsquemaFacturacionSection.tsx` — Full editor section with validation, empty guard, collapsible header
- `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` — Added EsquemaFacturacionSection wire + preEmbarque B2 checkbox + preEmbarqueBusy state
- `apps/sistema-modular/src/hooks/usePresupuestoEdit.ts` — Added esquemaFacturacion/preEmbarque/finalizarConSoloFacturado fields + save validation
- `apps/sistema-modular/src/services/presupuestosService.ts` — Added togglePreEmbarque stub

## Decisions Made

- **togglePreEmbarque stub now, full in 12-03**: 12-02 and 12-03 run in the same wave. The UI needs the method to compile; the stub writes `preEmbarque` to Firestore. Plan 12-03 replaces with full implementation including audit posta on linked ticket.
- **B2 bypass documented inline**: The preEmbarque checkbox is the ONLY field in the modal that bypasses form-state. A multi-line comment block explains why (audit posta side-effect) and names the plan where the full side-effect lands.
- **monedasActivas derivation duplicated**: Both `EsquemaFacturacionSection` and `save()` in `usePresupuestoEdit` derive `monedasActivas` from items using the same algorithm. This is intentional — the component must be pure/standalone (no shared hook). Duplication documented.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type mismatch in deriveMonedasActivas**
- **Found during:** Task 1 (EsquemaFacturacionSection creation)
- **Issue:** `item.moneda` is typed `'USD'|'ARS'|'EUR'|null` — comparing `m !== 'MIXTA'` is flagged as always-true by tsc since 'MIXTA' is not in the type
- **Fix:** Removed the redundant `!== 'MIXTA'` guard; cast to `MonedaCuota | null | undefined`
- **Files modified:** `EsquemaFacturacionSection.tsx`
- **Verification:** `tsc --noEmit` passes for the component with no errors
- **Committed in:** `3aedfd8`

**2. [Rule 1 - Bug] Fixed unused import in EditPresupuestoModal**
- **Found during:** Task 2 (modal wiring)
- **Issue:** Added `useCallback` to React import but it was unused
- **Fix:** Removed `useCallback` from import
- **Files modified:** `EditPresupuestoModal.tsx`
- **Verification:** `tsc --noEmit` passes with no error for the file
- **Committed in:** `692a0b6`

**3. [Rule 1 - Bug] Fixed UsuarioAGS.nombre vs displayName**
- **Found during:** Task 2 (modal wiring)
- **Issue:** Used `usuario?.nombre` to build actor name for togglePreEmbarque — but `UsuarioAGS.nombre` doesn't exist; the field is `displayName`
- **Fix:** Changed to `usuario?.displayName`
- **Files modified:** `EditPresupuestoModal.tsx`
- **Verification:** `tsc --noEmit` passes, no TS2339 error
- **Committed in:** `692a0b6`

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** Minor type fixes, all caught before commit. No scope creep.

## Issues Encountered

- `presupuestosService.togglePreEmbarque` did not exist yet (plan 12-03 ships it); added a stub to compile the modal. Full implementation with audit posta lands in 12-03.
- Pre-existing tsc errors in unrelated files (agenda, columnas, etc.) — these are out of scope and were not touched.

## Next Phase Readiness

- EsquemaFacturacionSection UI is fully functional for creating and editing cuota schemas in borrador presupuestos
- `togglePreEmbarque` stub compiles and writes preEmbarque to Firestore; audit posta requires plan 12-03
- Plan 12-03 (service extension: generarAvisoFacturacion with cuotaId, full togglePreEmbarque with posta) can proceed
- Plan 12-04 (mini-modal for cuota solicitud generation, PresupuestoFacturacionSection refactor) can proceed in parallel

---
*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Completed: 2026-04-26*
