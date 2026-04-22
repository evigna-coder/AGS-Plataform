---
phase: 10-presupuestos-partes-mixto-ventas
plan: 03
subsystem: ui
tags: [react-pdf, presupuestos, pdf, branching, mixto, partes, ventas]

# Dependency graph
requires:
  - phase: 10-presupuestos-partes-mixto-ventas
    provides: "Plan 10-01: TipoPresupuesto enum + VentasMetadata type + Presupuesto.tipo field in @ags/shared"
  - phase: 10-presupuestos-partes-mixto-ventas
    provides: "Plan 10-02: ArticuloPickerPanel + VentasMetadataSection editor UI (wave 2 parallel)"
provides:
  - "PresupuestoPDFEstandar.tsx with internal branching by presupuesto.tipo"
  - "ItemsTable sub-component extracted from existing renderer (Step 0 pre-refactor)"
  - "MixtoItemsBlock sub-component: 2-section layout (Servicios + Partes) with per-section subtotals"
  - "VentasMetadataBlock sub-component: delivery/install data block before items table"
  - "splitItemsByTipo helper: classifies items by stockArticuloId presence"
  - "sumSubtotal helper: sums subtotals for a given item subset"
affects: [presupuestos-pdf, facturacion, cierre-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PDF internal branching: single template file with switch-like conditional rendering by presupuesto.tipo"
    - "Item classification by stockArticuloId: null = Servicios bucket, non-null = Partes bucket"
    - "Sub-component extraction (Step 0) before adding branching — avoids code duplication in new paths"

key-files:
  created: []
  modified:
    - apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx

key-decisions:
  - "splitItemsByTipo classifies by stockArticuloId (non-null = Partes); items with only conceptoServicioId or manual text default to Servicios"
  - "ItemsTable extracted BEFORE branching (Step 0) so MixtoItemsBlock and default path share one implementation"
  - "VentasMetadataBlock inserted BEFORE items table for ventas type; items still use flat ItemsTable (not MixtoItemsBlock)"
  - "Contrato path untouched — still uses agruparPorSistemaSimple grouping; backward compat preserved"
  - "Checkpoint approved with limitation: historical Excel-migrated items have null stockArticuloId; backfill via separate admin page /admin/relinkear-articulos (parallel commit)"

patterns-established:
  - "PDF sub-component pattern: extract reusable block into internal function component in same file before adding type-specific branching"

requirements-completed: [PTYP-02, PTYP-03, PTYP-04]

# Metrics
duration: tasks 1+2 ~15min (prior executor); closeout ~5min
completed: 2026-04-22
---

# Phase 10 Plan 03: PDF Branching Interno por Tipo de Presupuesto Summary

**Single PDF template extended with internal type-branching: MixtoItemsBlock (2-section Servicios/Partes with per-section subtotals), VentasMetadataBlock (delivery/install metadata before items), and ItemsTable extracted as shared sub-component — servicio/contrato fully backward-compatible**

## Performance

- **Duration:** ~20 min total (Tasks 1+2 by prior executor; checkpoint closeout by current executor)
- **Started:** 2026-04-22
- **Completed:** 2026-04-22
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Extracted `ItemsTable` sub-component from existing `PresupuestoPDFEstandar` renderer as explicit Step 0 pre-refactor, enabling safe reuse in new branches without duplication
- Added `splitItemsByTipo` and `sumSubtotal` helpers for Servicios/Partes classification and per-bucket math
- Added `MixtoItemsBlock`: renders two labeled sections ("Servicios", "Partes") with independent subtotals; hides Servicios section if empty (pure-partes case)
- Added `VentasMetadataBlock`: "Datos de entrega e instalacion" panel (fechaEstimadaEntrega, lugarInstalacion, requiereEntrenamiento) inserted before items for ventas type
- Wired branching in Page body: mixto/partes use `MixtoItemsBlock`; ventas prepends `VentasMetadataBlock` then uses flat `ItemsTable`; servicio/contrato unchanged
- Human visual verification performed by user — servicio PDF identical to baseline; mixto PDF rendered "Servicios" section header confirming `MixtoItemsBlock` fired

## Task Commits

1. **Task 1: ItemsTable extraction + helpers + MixtoItemsBlock + VentasMetadataBlock** - included in `7d9a6f5` (feat)
2. **Task 2: Branching wire-up in Page body** - included in `7d9a6f5` (feat)
3. **Task 3: Human-verify checkpoint** - approved with limitation noted (see below)

**Implementation commit:** `7d9a6f5` — `feat(10-03): PDF branching interno por tipo de presupuesto`

## Files Created/Modified

- `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` — Added ItemsTable extracted sub-component, splitItemsByTipo/sumSubtotal helpers, MixtoItemsBlock, VentasMetadataBlock, and conditional branching in Page body by presupuesto.tipo

## Known Limitation: Historical Items Missing stockArticuloId

**IMPORTANT — affects mixto/partes PDF rendering for existing presupuestos**

Items migrated from Excel spreadsheets were created without linking to the stock catalog. As a result, their `stockArticuloId` field is `null`. The `splitItemsByTipo` helper classifies items as follows:

- `stockArticuloId !== null` → **Partes** bucket
- `stockArticuloId === null` (conceptoServicioId or manual text) → **Servicios** bucket (default)

Because historical items have `stockArticuloId: null`, they all fall into the **Servicios** bucket in the PDF, even if they represent physical parts. The Partes section will appear empty or absent for these presupuestos.

**This is correct behavior by current logic — not a rendering bug.**

**Remediation paths (two options):**

1. **Admin backfill page** `/admin/relinkear-articulos`: Separate commit by parallel agent. Matches `item.codigoProducto` against `articulo.codigo` in the stock catalog and backfills `stockArticuloId` in bulk. Once backfilled, PDF re-downloads will show correct Partes/Servicios split.

2. **Per-presupuesto re-link**: Users can open any presupuesto in the editor and re-select items via `ArticuloPickerPanel` (shipped in Plan 10-02). Newly selected articulos populate `stockArticuloId` correctly.

**New presupuestos** created after Plan 10-02 landed (where users select items via ArticuloPickerPanel) have `stockArticuloId` populated from day one — the split works correctly for all forward-going data.

**User decision:** Accepted this limitation for Phase 10 scope. Backfill admin page tracked as separate parallel work.

## Checkpoint Outcome

- **Checkpoint type:** human-verify (blocking gate)
- **Result:** Approved with limitation noted
- **servicio PDF:** Rendering identical to baseline — backward compat confirmed
- **mixto PDF:** Rendered "Servicios" section header, confirming `MixtoItemsBlock` fired correctly. All items fell into Servicios bucket (expected — historical data has null stockArticuloId). Partes section correctly absent when bucket is empty.
- **partes/ventas PDF:** Not tested with fresh data in this session; behavior follows same branching logic, verified correct by code review
- **Total general:** Not affected by sectioning — sum logic unchanged, impuestos/totales at bottom remain the same

## Decisions Made

- `splitItemsByTipo` uses `stockArticuloId` presence as the sole classifier (not `conceptoServicioId`). Items with neither are treated as Servicios by default since physical parts always have stock catalog linkage.
- Step 0 extraction of `ItemsTable` was made mandatory before branching to avoid future divergence between the default path and the mixto path.
- `VentasMetadataBlock` is inserted before the items table (not after), consistent with the plan spec and standard document structure (context before detail).
- Contrato type uses `agruparPorSistemaSimple` grouping — intentionally excluded from branching, its path untouched.

## Deviations from Plan

None in implementation. The checkpoint revealed a data quality limitation (null stockArticuloId in historical items) that was classified as an accepted limitation, not a plan failure. Remediation tracked as separate work.

## Issues Encountered

- Prior executor timed out before completing the human-verify checkpoint closeout. Implementation (Tasks 1+2) was fully committed as `7d9a6f5` before the timeout. Current executor closed out the checkpoint documentation only.

## Next Phase Readiness

- PDF template is ready for all 5 presupuesto types (servicio, contrato, mixto, partes, ventas)
- Backfill admin page `/admin/relinkear-articulos` needed to fully realize Partes section for historical data (parallel work)
- Plan 10-04 (Aviso Facturacion) can proceed — no dependency on backfill

---
*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed: 2026-04-22*
