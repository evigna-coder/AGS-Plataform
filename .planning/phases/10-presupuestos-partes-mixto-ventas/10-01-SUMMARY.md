---
phase: 10-presupuestos-partes-mixto-ventas
plan: "01"
subsystem: database
tags: [typescript, shared-types, presupuestos, facturacion, ventas]

# Dependency graph
requires:
  - phase: 10-00
    provides: Phase 10 research + context (PTYP-04, FMT-03 requirements)
provides:
  - VentasMetadata interface in @ags/shared (fechaEstimadaEntrega, lugarInstalacion, requiereEntrenamiento)
  - Presupuesto.ventasMetadata?: VentasMetadata | null field
  - SolicitudFacturacionEstado union extended with 'enviada' literal
  - SOLICITUD_FACTURACION_ESTADO_LABELS + _COLORS entries for 'enviada'
  - SolicitudFacturacion.ordenesCompraIds?: string[] | null
  - SolicitudFacturacion.enviadaAt?: string | null
affects:
  - 10-02 (editor UI — VentasMetadataSection consumes VentasMetadata)
  - 10-03 (PDF — renders VentasMetadata before items detail)
  - 10-04 (services — cerrarAdministrativamente sets enviada + ordenesCompraIds)
  - 10-06 (dashboard — shows enviada estado in FacturacionList)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-object grouping for domain-specific fields: VentasMetadata mirrors contratoFechaInicio/Fin pattern at same level"
    - "Union extension pattern: extend SolicitudFacturacionEstado without breaking existing consumers"
    - "All optional fields use ?: T | null convention (not just ?: T) for explicit null-empty semantics"

key-files:
  created: []
  modified:
    - packages/shared/src/types/index.ts

key-decisions:
  - "VentasMetadata as sub-object (not 3 root fields on Presupuesto): keeps root clean, semantic grouping, mirrors contratoFechaInicio/Fin pattern"
  - "enviada as intermediate SolicitudFacturacionEstado between pendiente and facturada: represents 'mail sent to accountant but not yet facturada'"
  - "ordenesCompraIds on SolicitudFacturacion is a back-ref snapshot at cierre admin — not synced with Presupuesto.ordenesCompraIds"

patterns-established:
  - "Phase 10 type-first ordering: interfaces land in @ags/shared before any downstream UI/service implementation"

requirements-completed: [PTYP-04, FMT-03]

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 10 Plan 01: Shared Types Foundation Summary

**Three additive type extensions in @ags/shared: VentasMetadata sub-object for ventas presupuestos, `enviada` intermediate state for SolicitudFacturacion, and ordenesCompraIds/enviadaAt audit fields**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T03:50:47Z
- **Completed:** 2026-04-22T03:58:20Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `VentasMetadata` interface exported from `@ags/shared` with 3 optional fields (fechaEstimadaEntrega, lugarInstalacion, requiereEntrenamiento)
- `Presupuesto.ventasMetadata?: VentasMetadata | null` added adjacent to contratoFechaFin (follows same pattern)
- `SolicitudFacturacionEstado` union extended: `'pendiente' | 'enviada' | 'facturada' | 'cobrada' | 'anulada'`
- LABELS + COLORS constants updated with `enviada` entries (existing values preserved exactly)
- `SolicitudFacturacion.ordenesCompraIds` + `.enviadaAt` fields added as back-ref snapshot fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add VentasMetadata interface + Presupuesto.ventasMetadata field** - `f748b83` (feat)
2. **Task 2: Extend SolicitudFacturacion + SolicitudFacturacionEstado** - `d489d5a` (feat)

**Plan metadata:** (docs commit — see final_commit step)

## Files Created/Modified
- `packages/shared/src/types/index.ts` — New VentasMetadata interface (lines ~1128-1147), ventasMetadata field on Presupuesto (line ~1210), 'enviada' in union + LABELS + COLORS, ordenesCompraIds + enviadaAt on SolicitudFacturacion (lines ~1325-1327)

## Decisions Made
- **VentasMetadata as sub-object** rather than 3 root fields: mirrors contratoFechaInicio/Fin pattern for type=contrato fields; keeps Presupuesto root clean
- **'enviada' color** `bg-blue-100 text-blue-800`: distinct from `facturada` (bg-blue-100 text-blue-700 — existing). Slight difference intentional to visually differentiate states
- **ordenesCompraIds as snapshot**: not synced with Presupuesto.ordenesCompraIds — captured at cierre admin moment only

## Deviations from Plan

None — plan executed exactly as written. The `pnpm --filter @ags/shared build` verification in the plan didn't apply (shared package has no build script, only type-check). Used `type-check` instead.

## Issues Encountered
- `pnpm --filter @ags/shared build` returns "None of the selected packages has a build script" — package only has `type-check` script. Switched to `type-check` which passes cleanly. Pre-existing type errors in sistema-modular are unrelated to our changes (verified with targeted grep).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All types ready for 10-02 (editor VentasMetadataSection), 10-03 (PDF rendering), 10-04 (cerrarAdministrativamente service), 10-06 (FacturacionList enviada state)
- Backward compat confirmed: union extension doesn't narrow existing consumers; all consumers type-check clean against our new fields

---
*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed: 2026-04-22*
