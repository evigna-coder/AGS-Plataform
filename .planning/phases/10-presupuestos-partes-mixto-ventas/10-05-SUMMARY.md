---
phase: 10-presupuestos-partes-mixto-ventas
plan: 05
subsystem: ui
tags: [xlsx, react-pdf, export, presupuestos, facturacion]

# Dependency graph
requires:
  - phase: 10-presupuestos-partes-mixto-ventas
    provides: SolicitudFacturacion type + SOLICITUD_FACTURACION_ESTADO_LABELS (10-01); facturacionService (10-04)
provides:
  - exportToExcel<T> generic helper (plain strip, freeze header W8 compat)
  - exportToPDF<T> generic helper (@react-pdf/renderer landscape table)
  - exportPresupuestosExcel/PDF (FMT-04, 12 cols)
  - exportOCsPendientesExcel/PDF (FMT-05, 8 cols)
  - exportSolicitudesExcel/PDF (FMT-06, 10 cols)
  - PresupuestosList: Exportar Excel/PDF buttons + filtro OCs pendientes
affects: [10-06-facturacion-list-exports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Export wrapper pattern: buildColumns() fn + Excel helper + PDF helper + buildFilename()"
    - "Generic exportToExcel<T>: ExportColumn<T>.get() maps rows to primitives; freeze via !views+!freeze"
    - "Generic exportToPDF<T>: buildDocument() returns JSX; pdf().toBlob() + URL.createObjectURL download"

key-files:
  created:
    - apps/sistema-modular/src/utils/exportToExcel.ts
    - apps/sistema-modular/src/utils/exportToPDF.tsx
    - apps/sistema-modular/src/utils/exports/exportPresupuestos.ts
    - apps/sistema-modular/src/utils/exports/exportOCsPendientes.ts
    - apps/sistema-modular/src/utils/exports/exportSolicitudesFacturacion.ts
  modified:
    - apps/sistema-modular/src/utils/exportVentasInsumosExcel.ts
    - apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx

key-decisions:
  - "exportToExcel uses BOTH !views (xlsx free edition real freeze syntax) AND !freeze (legacy compat) — W8 dual-path"
  - "OC pendiente criterion: estado=aceptado + ordenesCompraIds.length === 0 (sin OC cargada del cliente)"
  - "exportVentasInsumosExcel migrado a plain strip (sin teal/yellow fill) — break visual documentado, firma publica intacta"
  - "Export helpers son inner functions (no hook) en PresupuestosList — el file ya tenia 518 lines pre-task (over budget preexistente)"
  - "pdfFonts.ts side-effect import en exportToPDF.tsx para registrar Inter/Newsreader antes de pdf().toBlob()"

patterns-established:
  - "Export wrapper: crea 2 funciones xxxExcel(rows, meta?) y xxxPDF(rows, meta?) por wrapper; columnas definidas en buildColumns()"
  - "Callers construyen PresupuestoExportRow[] antes de llamar al helper (separacion datos/presentacion)"
  - "filtrosLabel es string humano construido en el caller — subtitle del PDF refleja filtros activos"

requirements-completed: [FMT-04, FMT-05, FMT-06]

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 10 Plan 05: Export Helpers XLSX+PDF Summary

**2 helpers genericos (exportToExcel/exportToPDF) + 3 wrappers (Presupuestos/OCs/Solicitudes) + OC-pendiente filter + botones Export en PresupuestosList**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T04:47:57Z
- **Completed:** 2026-04-22T04:55:57Z
- **Tasks:** 3
- **Files modified:** 7 (2 created helpers, 3 created wrappers, 1 migrated, 1 integrated)

## Accomplishments

- Generic `exportToExcel<T>` helper: XLSX plain strip (headers bold only, no teal/yellow fill), auto-width columns, freeze pane via `!views` (xlsx free edition) + `!freeze` (legacy) for max compat (W8 fix)
- Generic `exportToPDF<T>` helper: @react-pdf/renderer landscape A4 table with title/subtitle/generated-at metadata
- 3 wrappers covering FMT-04 (12 cols presupuestos), FMT-05 (8 cols OCs pendientes), FMT-06 (10 cols solicitudes facturacion)
- `exportVentasInsumosExcel.ts` migrated to generic helper (plain strip) — W9 audit confirmed only 1 caller in `ReporteVentasInsumosModal.tsx`, public signature unchanged
- PresupuestosList: Exportar Excel + Exportar PDF buttons gated by `hasRole('admin', 'admin_soporte')`; filter-aware (PDF subtitle shows active filters); OC pendiente checkbox filter added to URL schema

## Task Commits

1. **Task 1: Helpers genericos + migrate exportVentasInsumosExcel** - `6f58100` (feat)
2. **Task 2: Wrappers exportPresupuestos + exportOCsPendientes + exportSolicitudesFacturacion** - `9124257` (feat)
3. **Task 3: Integrar exports en PresupuestosList + filtro OCs pendientes** - `93dd80e` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/utils/exportToExcel.ts` — Generic helper: ExportColumn<T>, exportToExcel<T>(), fmtDateShort()
- `apps/sistema-modular/src/utils/exportToPDF.tsx` — Generic helper: ExportPDFColumn<T>, exportToPDF<T>(), buildDocument()
- `apps/sistema-modular/src/utils/exportVentasInsumosExcel.ts` — Migrated to use exportToExcel generic (plain strip)
- `apps/sistema-modular/src/utils/exports/exportPresupuestos.ts` — 12-col wrapper (FMT-04)
- `apps/sistema-modular/src/utils/exports/exportOCsPendientes.ts` — 8-col wrapper (FMT-05)
- `apps/sistema-modular/src/utils/exports/exportSolicitudesFacturacion.ts` — 10-col wrapper (FMT-06)
- `apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx` — Added useAuth, canExport, ocPendiente filter, 2 export buttons

## Decisions Made

- **OC pendiente criterion confirmed:** `estado === 'aceptado' && ordenesCompraIds.length === 0` — "aceptado sin OC cargada aun". Wrappers don't re-filter; callers filter and pass result rows.
- **export helpers as inner functions (not hook):** PresupuestosList was already 518 lines pre-task (plan's 450-line threshold already violated by prior code). Functions are small and localized; extracting a hook would split context without significant benefit. Deferred to future refactor if file grows further.
- **exportVentasInsumosExcel plain strip:** Break visual is intentional per CONTEXT (Phase 10 plain consistency). No yellow fill, no teal fill. Documented here for visibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript `as const` in object literal causing TS1355 errors**
- **Found during:** Task 2 (wrappers)
- **Issue:** `{ align: 'right' as const }` inside an object literal causes TS1355 in strict mode; the `as const` assertion is not valid in that position.
- **Fix:** Replaced column definitions with typed `buildColumns(): Col[]` function returning plain objects with explicit typed fields — no inline `as const` needed.
- **Files modified:** exportPresupuestos.ts, exportOCsPendientes.ts, exportSolicitudesFacturacion.ts
- **Committed in:** `9124257` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed `WorksheetView` not exported from xlsx types**
- **Found during:** Task 1 (exportToExcel.ts)
- **Issue:** `XLSX.WorksheetView` does not exist in xlsx@0.18.5 type definitions.
- **Fix:** Used `as any` cast for `!views` entry; moved `!freeze` to `(ws as any)['!freeze']` instead of `@ts-expect-error`.
- **Files modified:** exportToExcel.ts
- **Committed in:** `6f58100` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - type errors in new code)
**Impact on plan:** Both auto-fixes were TypeScript compile errors in new code — zero behavior impact. Plan executed as specified.

## W9 Audit — exportVentasInsumosExcel callers

```
grep -rn "exportVentasInsumosExcel" apps/
```

Result: 1 caller found:
- `apps/sistema-modular/src/components/leads/ReporteVentasInsumosModal.tsx:69: exportVentasInsumosExcel(rows, range);`

The caller passes `(rows: VentasInsumosReportRow[], range: VentasInsumosRangeLabel)` — identical to the public signature. No breaking change.

## Break Visual — exportVentasInsumosExcel

Expected visual differences after migration:
- Headers: no longer teal (#0D6E6E) fill with white text — now plain bold text, no fill
- Manual columns (N° Presupuesto, Monto final, N° OC, Fecha entrega, Observaciones): no longer yellow (#FFFBEB) cell fill
- Data columns: same content, same widths, same freeze

This is intentional per Phase 10 CONTEXT (plain strip consistency with new exports). Not a regression.

## Pattern Reusable — Future Export Consumers

To add a new export for any list page:

1. Create `src/utils/exports/exportXxx.ts` following the wrapper pattern:
   - Define `type Col = ExportColumn<YourRowType>`
   - `buildColumns(): Col[]` returns the column definitions
   - `exportXxxExcel(rows, meta?)` calls `exportToExcel({ data, columns: buildColumns(), ... })`
   - `exportXxxPDF(rows, meta?)` calls `exportToPDF({ data, columns: pdfCols, ... })`
2. In the list page, add `canExport` gate + 2 buttons in actions
3. Build rows array in-component from filtered data + reference lookups

## Issues Encountered

None. Type-check ran cleanly for all new/modified files. Pre-existing type errors in unrelated files are out of scope.

## User Setup Required

None — no external service configuration required. All helpers are client-side (XLSX.writeFile / URL.createObjectURL).

Manual verification needed (plan section W8):
- Open generated .xlsx in real Excel (not browser preview) — scroll vertically — confirm first row stays pinned (freeze pane)
- Login as `ventas` role — verify Export buttons are NOT visible
- Login as `admin` — filter by cliente → Export → PDF subtitle should show `cliente=X`

## Next Phase Readiness

- 10-06 (facturacion list exports) can import `exportSolicitudesExcel/exportSolicitudesPDF` from `utils/exports/exportSolicitudesFacturacion.ts` — already built and typed
- Generic helpers available for any future export consumer in sistema-modular

---
*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed: 2026-04-22*
