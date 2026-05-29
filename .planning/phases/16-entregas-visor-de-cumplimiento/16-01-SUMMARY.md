---
phase: 16-entregas-visor-de-cumplimiento
plan: "01"
subsystem: entregas-visor
tags: [types, tdd, wave-0, red-baseline, pure-functions]
dependency_graph:
  requires: []
  provides:
    - "@ags/shared Disponibilidad union + DISPONIBILIDAD_LABELS + DISPONIBILIDAD_COLORS"
    - "PresupuestoItem.disponibilidad / etaDiasEstimados / otNumeroVinculada (optional fields)"
    - "Presupuesto.fechaAceptacion (optional ISO field)"
    - "RequerimientoCompra.presupuestoItemId (optional FK for O(1) join)"
    - "entregasResolver.ts stubs (computeSemaforo, computeEtaFecha, buildEntregaRows)"
    - "test:entregas RED baseline (6/6 failing — ENT-01..ENT-06)"
  affects:
    - "packages/shared (type extensions consumed by all apps)"
    - "apps/sistema-modular (resolver utils + test suite)"
tech_stack:
  added: []
  patterns:
    - "Wave 0 RED baseline pattern (mirrors Phase 14/15)"
    - "node:test + node:assert/strict for pure-function unit tests"
    - "tsx scripts entry point pattern"
key_files:
  created:
    - path: "apps/sistema-modular/src/utils/entregasResolver.ts"
      role: "Pure-function stubs + EntregaRow/Semaforo types (16-03 will implement)"
    - path: "apps/sistema-modular/src/__tests__/entregasResolver.test.ts"
      role: "6 unit tests ENT-01..ENT-06 (RED — turn GREEN in 16-03)"
    - path: "apps/sistema-modular/src/__tests__/fixtures/entregas.ts"
      role: "Test fixtures: makePresupuestoBase, makeItem, makeRequerimiento, makeOC, makeImportacion + FIXTURE_NOW + CLIENTE_NOMBRE_BY_ID"
    - path: "apps/sistema-modular/scripts/test-entregas.ts"
      role: "tsx entry point for test:entregas (mirrors test-patron-bom.ts pattern)"
  modified:
    - path: "packages/shared/src/types/index.ts"
      role: "Extended PresupuestoItem, Presupuesto, RequerimientoCompra + added Disponibilidad union"
    - path: "apps/sistema-modular/package.json"
      role: "Added test:entregas script"
decisions:
  - "All new shared type fields are optional (?) — full backwards-compat with legacy presupuestos/reqs"
  - "Disponibilidad as union type (not enum) for tree-shaking + string literal ergonomics"
  - "FIXTURE_NOW hardcoded to 2026-06-01 for deterministic ETA assertions"
  - "Importacion fixture uses `as unknown as Importacion` cast for required fields (gastos/documentos) not relevant to tests"
  - "Pre-existing TS errors in tsc --noEmit are out-of-scope (not caused by this plan)"
metrics:
  duration: "~30 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 4
  tasks_total: 4
  files_created: 4
  files_modified: 2
---

# Phase 16 Plan 01: Entregas Visor — Wave 0 Baseline Summary

**One-liner:** Extended @ags/shared types for entregas (Disponibilidad union + 5 optional fields) and wired RED-baseline test suite (6/6 ENT-01..ENT-06 failing with NotImplemented) via entregasResolver.ts stubs.

## What Was Built

### @ags/shared Type Extensions

New fields added to existing interfaces — all optional, fully backwards-compatible:

| Interface | Field | Type | Purpose |
|---|---|---|---|
| `PresupuestoItem` | `disponibilidad?` | `Disponibilidad \| null` | Origin of promised delivery (stock/post_facturacion/a_importar/en_transito) |
| `PresupuestoItem` | `etaDiasEstimados?` | `number \| null` | Days from fechaAceptacion to expected delivery |
| `PresupuestoItem` | `otNumeroVinculada?` | `string \| null` | Manual OT reference (text, no FK) |
| `Presupuesto` | `fechaAceptacion?` | `string \| null` | ISO timestamp when ppto reached `aceptado` state |
| `RequerimientoCompra` | `presupuestoItemId?` | `string \| null` | FK for O(1) item→req join in resolver |

New exports in `@ags/shared`:
- `Disponibilidad` union type: `'stock' | 'post_facturacion' | 'a_importar' | 'en_transito'`
- `DISPONIBILIDAD_LABELS`: human-readable labels (Editorial Teal Spanish)
- `DISPONIBILIDAD_COLORS`: Tailwind classes for badge rendering

### entregasResolver.ts Exports

File: `apps/sistema-modular/src/utils/entregasResolver.ts`

| Export | Type | Status |
|---|---|---|
| `Semaforo` | union type | Stable |
| `SEMAFORO_COLORS` | Record<Semaforo, string> | Stable |
| `SEMAFORO_LABELS` | Record<Semaforo, string> | Stable |
| `EntregaRow` | interface (16 fields) | Stable |
| `BuildEntregaRowsInput` | interface | Stable |
| `computeSemaforo` | function stub | NotImplemented until 16-03 |
| `computeEtaFecha` | function stub | NotImplemented until 16-03 |
| `buildEntregaRows` | function stub | NotImplemented until 16-03 |

### Test Command

```bash
pnpm --filter @ags/sistema-modular test:entregas
```

### RED Baseline Confirmation

```
✖ [ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly
✖ [ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly
✖ [ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId
✖ [ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash)
✖ [ENT-05] item con importacion.estado=recibido → semaforo = entregado
✖ [ENT-06] item sin requerimiento (stock available) sigue mostrando row

tests 6 | pass 0 | fail 6 — exit 1
```

All failures are `Error: NotImplemented — Plan 16-03`. This is the correct Wave 0 state.

## Commits

| Hash | Message |
|---|---|
| b51883c | feat(16-01): extend @ags/shared types for Phase 16 Entregas |
| b95b664 | feat(16-01): add entregasResolver.ts pure-function stubs |
| b5cab06 | feat(16-01): add test fixtures for ENT-01..ENT-06 scenarios |
| f300103 | test(16-01): add entregasResolver test suite RED baseline (ENT-01..ENT-06) |

## Deviations from Plan

**One minor deviation:**

**[Rule 2 - Missing required fields] Importacion fixture includes gastos/documentos required arrays**
- **Found during:** Task 3
- **Issue:** `Importacion.gastos` and `Importacion.documentos` are required (non-optional) arrays in `@ags/shared`. The plan's fixture code did not include them.
- **Fix:** Added `gastos: []` and `documentos: []` to `makeImportacion` factory. Used `as unknown as Importacion` cast for the overall shape (same pattern as patronBom fixtures).
- **Files modified:** `apps/sistema-modular/src/__tests__/fixtures/entregas.ts`
- **Commit:** b5cab06

**Pre-existing TS errors in `pnpm --filter @ags/sistema-modular exec tsc --noEmit`:** 27 errors across unrelated files (AgendaGridCell, otService, stockAmplioService, etc.) existed before this plan. Zero errors in any file created/modified by 16-01. Logged as out-of-scope per deviation rules.

## Next Steps

- **16-02** (backend): `aceptarConRequerimientos` transaction writes `fechaAceptacion` to Presupuesto and `presupuestoItemId` to each created RequerimientoCompra.
- **16-03** (resolver impl): Implements `computeSemaforo`, `computeEtaFecha`, `buildEntregaRows` — turns all 6 tests GREEN.
- **16-04+** (UI): Consumes `EntregaRow[]` + `Semaforo` + `Disponibilidad` for the visor de entregas page.

## Self-Check: PASSED

Files exist:
- FOUND: packages/shared/src/types/index.ts (extended)
- FOUND: apps/sistema-modular/src/utils/entregasResolver.ts
- FOUND: apps/sistema-modular/src/__tests__/entregasResolver.test.ts
- FOUND: apps/sistema-modular/src/__tests__/fixtures/entregas.ts
- FOUND: apps/sistema-modular/scripts/test-entregas.ts

Commits exist (git log confirms):
- FOUND: b51883c feat(16-01): extend @ags/shared types
- FOUND: b95b664 feat(16-01): add entregasResolver.ts stubs
- FOUND: b5cab06 feat(16-01): add test fixtures
- FOUND: f300103 test(16-01): add test suite RED baseline
