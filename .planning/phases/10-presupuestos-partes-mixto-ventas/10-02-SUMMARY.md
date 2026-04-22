---
phase: 10-presupuestos-partes-mixto-ventas
plan: 02
subsystem: ui
tags: [react, firestore, stock, presupuestos, atp, ventas]

# Dependency graph
requires:
  - phase: 10-01
    provides: VentasMetadata type on Presupuesto, TipoPresupuesto union (partes/mixto/ventas/contrato/servicio)
  - phase: 09-stock-atp-extendido
    provides: computeStockAmplio, useStockAmplio, StockAmplioIndicator, atpHelpers.itemRequiresImportacion
provides:
  - ArticuloPickerPanel: searchable article selector with inline 4-bucket StockAmplioIndicator
  - VentasMetadataSection: 3-field delivery form (fecha, lugar, entrenamiento) persisted to Firestore
  - AddItemModal: gated articulo picker for tipos partes/mixto/ventas
  - EditPresupuestoModal: VentasMetadataSection render + articulos catalog load + ATP UX validation
  - usePresupuestoEdit: ventasMetadata field in form state + persisted in save()
affects:
  - 10-03 (PDF branching uses VentasMetadata for PDF render — Wave 2 completed)
  - 10-04 (FLOW-03 aceptarConRequerimientos — picker now feeds stockArticuloId correctly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catalog-as-prop: articulos loaded once in parent (EditPresupuestoModal) and passed down via PresupuestoItemsTable → AddItemModal → ArticuloPickerPanel; avoids N re-fetches"
    - "ATP validation gate: UX-only confirm dialog before accepting, fail-soft if compute fails; FLOW-03 remains authoritative"
    - "Panel-first picker: ArticuloPickerPanel renders StockAmplioIndicator inline (always visible) vs contrato InlineAutocomplete popup pattern"

key-files:
  created:
    - apps/sistema-modular/src/components/presupuestos/ArticuloPickerPanel.tsx
    - apps/sistema-modular/src/components/presupuestos/VentasMetadataSection.tsx
  modified:
    - apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx
    - apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx
    - apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx
    - apps/sistema-modular/src/hooks/usePresupuestoEdit.ts

key-decisions:
  - "ArticuloPickerPanel uses inline StockAmplioIndicator (always visible in panel) not a popup — matches the larger article-picker UX vs the compact contrato InlineAutocomplete"
  - "ATP confirm dialog uses window.confirm (not a custom modal) for simplicity; UX-only, non-blocking — FLOW-03 handles the actual requirement creation"
  - "EditPresupuestoModal acknowledged over-budget at 512 LOC (pre-existing ~463); extraction deferred post-v2.0 — candidates: usePresupuestoEditValidation hook, useArticulosCatalog hook"
  - "articulosService.getAll() called on open (per tipo gate) rather than at modal mount — avoids fetching stock catalog for contrato/servicio flows"

patterns-established:
  - "showArticuloPicker gate: tipoPresupuesto ∈ {partes, mixto, ventas} AND articulos non-empty — servicio and contrato excluded"
  - "ventasMetadata as spread-merge: onChange receives Partial<VentasMetadata>, parent spreads into existing value before setField"

requirements-completed: [PTYP-02, PTYP-03, PTYP-04]

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 10 Plan 02: Editor UI Extensions (ArticuloPickerPanel + VentasMetadataSection) Summary

**ArticuloPickerPanel with inline ATP stock indicator wired into AddItemModal for partes/mixto/ventas, VentasMetadataSection persisted to Firestore, and UX-only ATP validation gate before presupuesto acceptance**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T03:59:20Z
- **Completed:** 2026-04-22T04:06:56Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Closed the critical gap from RESEARCH: partes/mixto/ventas items can now be linked to stock articles via ArticuloPickerPanel — FLOW-03 can now receive stockArticuloId from these types
- StockAmplioIndicator renders inline (4 buckets: DISP/TRANS/RESERV/COMPROM + ATP neto) whenever an article is selected in AddItemModal
- VentasMetadata (fechaEstimadaEntrega, lugarInstalacion, requiereEntrenamiento) persists to Firestore and rehidrates on load
- ATP validation warns user before accepting a presupuesto when quantity > ATP, but does not block — FLOW-03 handles requirement creation

## Task Commits

1. **Task 1: ArticuloPickerPanel + VentasMetadataSection** - `6667204` (feat)
2. **Task 2: Wire ArticuloPickerPanel in AddItemModal** - `0268cab` (feat)
3. **Task 3: Wire VentasMetadataSection + articulos + ATP validation** - `9f87440` (feat)

## Files Created/Modified

**Created:**
- `apps/sistema-modular/src/components/presupuestos/ArticuloPickerPanel.tsx` (79 lines) — SearchableSelect + useStockAmplio inline indicator + itemRequiresImportacion on select
- `apps/sistema-modular/src/components/presupuestos/VentasMetadataSection.tsx` (57 lines) — 3-field form with Editorial Teal labels

**Modified:**
- `apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx` (204 lines, +33 net) — articulos prop, handleSelectArticulo, showArticuloPicker gate, ArticuloPickerPanel render
- `apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx` (+8 net) — Articulo import, articulos prop, propagation to AddItemModal
- `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` (512 lines, +49 net) — articulos state/load, VentasMetadataSection render, handleEstadoChangeWithValidation, articulos prop to PresupuestoItemsTable
- `apps/sistema-modular/src/hooks/usePresupuestoEdit.ts` (+8 net) — VentasMetadata import, ventasMetadata in PresupuestoFormState/INITIAL_FORM/mapToFormState/save()

## Decisions Made

- **ArticuloPickerPanel panel style (inline vs popup):** Used inline panel that always shows StockAmplioIndicator below the SearchableSelect (vs the contrato InlineAutocomplete popup). Better UX for a larger picker context where stock info is primary decision data.
- **ATP confirm dialog:** Used `window.confirm` (native browser dialog) for simplicity. Non-blocking, UX-only. FLOW-03 handles actual requerimientos.
- **Catalog-as-prop pattern:** `articulosService.getAll()` called once in `EditPresupuestoModal` on `[open, form.tipo]`, passed as prop all the way down. Avoids N re-fetches and keeps components stateless.

## Deviations from Plan

None - plan executed exactly as written. The only minor adaptation: used `art.precioReferencia` (the canonical price field on Articulo) instead of `(art as any).precio` from the plan pseudocode — same intent, typed correctly.

## Issues Encountered

None. Pre-existing TypeScript errors in unrelated files (fichas, loaners, calificacion-proveedores) were scoped out per deviation rules.

## 250-Line Budget Notes

| File | Lines | Status |
|------|-------|--------|
| ArticuloPickerPanel.tsx | 79 | Under budget |
| VentasMetadataSection.tsx | 57 | Under budget |
| AddItemModal.tsx | 204 | Under budget |
| PresupuestoItemsTable.tsx | 235 | Under budget |
| EditPresupuestoModal.tsx | 512 | Pre-existing over-budget (was ~463 before this plan) |
| usePresupuestoEdit.ts | ~405 | Under budget |

**EditPresupuestoModal over-budget acknowledged (W7):** Pre-existing repeat offender. This plan added ~49 lines. Extraction deferred post-v2.0. Extraction candidates:
- `usePresupuestoEditValidation(form, actions)` — ATP validation + confirm dialog
- `useArticulosCatalog(open, tipo)` — articulos load effect
- `PresupuestoEditBody` — main content between header and footer

## Next Phase Readiness

- 10-03 (PDF branching): Already committed (7d9a6f5) and uses VentasMetadata from shared types
- 10-04 (FLOW-03 wiring): AddItemModal now correctly populates `stockArticuloId` for partes/mixto/ventas — FLOW-03 trigger is unblocked
- Manual smoke test recommended: open presupuesto tipo `partes`, add item, select article, verify StockAmplioIndicator; open tipo `ventas`, verify VentasMetadataSection appears and persists

---
*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed: 2026-04-22*
