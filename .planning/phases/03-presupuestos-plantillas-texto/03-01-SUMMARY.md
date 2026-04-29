---
phase: 03-presupuestos-plantillas-texto
plan: "01"
subsystem: presupuestos
tags: [types, firestore-service, plantillas-texto]
dependency_graph:
  requires: []
  provides: [PlantillaTextoPresupuesto-type, plantillasTextoPresupuestoService]
  affects: [packages/shared, apps/sistema-modular/src/services/presupuestosService.ts]
tech_stack:
  added: []
  patterns: [batchAudit, cleanFirestoreData, getCreateTrace/getUpdateTrace, newDocRef]
key_files:
  created: []
  modified:
    - packages/shared/src/types/index.ts
    - apps/sistema-modular/src/services/presupuestosService.ts
decisions:
  - No cache for plantillasTextoPresupuesto reads (max ~8 docs, rare access)
  - getDefaultsForTipo uses client-side filter (not Firestore where()) to avoid composite index requirement
  - Optional audit fields typed as string | null (not undefined — per hard rule)
metrics:
  duration: "2m 16s"
  completed_date: "2026-04-29"
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 01: Shared Type + Firestore Service for Plantillas de Texto Summary

**One-liner:** Firestore CRUD service for `plantillas_texto_presupuesto` collection with `PlantillaTextoPresupuesto` shared type — data-layer foundation for all Phase 03 UI and seed plans.

## Tasks Completed

| # | Task | Commit | Files Modified |
|---|------|--------|----------------|
| 1 | Add PlantillaTextoPresupuesto interface to @ags/shared | 4902920 | packages/shared/src/types/index.ts |
| 2 | Add plantillasTextoPresupuestoService to presupuestosService.ts | 9c5d344 | apps/sistema-modular/src/services/presupuestosService.ts |

## Implementation Details

### Task 1 — PlantillaTextoPresupuesto interface

Inserted at `packages/shared/src/types/index.ts` **line 1172**, immediately after `PRESUPUESTO_SECCIONES_DEFAULT` constant (line 1163).

Interface shape:
- `id: string`
- `nombre: string` — human-readable label ("Condiciones Comerciales — Servicio estándar")
- `tipo: keyof PresupuestoSeccionesVisibles` — one of the 6 section keys
- `contenido: string` — rich HTML from RichTextEditor
- `tipoPresupuestoAplica: TipoPresupuesto[]` — multi-type applicability
- `esDefault: boolean` — auto-apply on presupuesto creation
- `activo: boolean`
- Audit: `createdAt`, `updatedAt`, `createdBy?`, `createdByName?`, `updatedBy?`, `updatedByName?` (all `string | null`, never `undefined`)

### Task 2 — plantillasTextoPresupuestoService

Inserted at `apps/sistema-modular/src/services/presupuestosService.ts` **line 2159**, between `condicionesPagoService` (ends line 2150) and `conceptosServicioService` (now at ~line 2237).

6 methods confirmed:
1. `getAll()` — fetches all, sorts by nombre
2. `getById(id)` — single doc lookup, returns null if missing
3. `getDefaultsForTipo(tipo)` — client-side filter: `activo && esDefault && tipoPresupuestoAplica.includes(tipo)`
4. `create(data)` — `cleanFirestoreData` + `batchAudit`, returns new doc ID
5. `update(id, data)` — `cleanFirestoreData` + `batchAudit`
6. `delete(id)` — batch delete + `batchAudit`

Collection name literal: `'plantillas_texto_presupuesto'` (snake_case, consistent with `'condiciones_pago'` pattern).

`PlantillaTextoPresupuesto` added to `@ags/shared` import at line 2.

## Verification Results

- `pnpm --filter @ags/shared exec tsc --noEmit` — PASS (0 errors, 1 engine WARN ignored)
- `pnpm --filter @ags/sistema-modular exec tsc --noEmit` — pre-existing errors in unrelated files only (AgendaGridCell, CreateEquipoModal, etc.); no new errors introduced
- `grep -n "PlantillaTextoPresupuesto" packages/shared/src/types/index.ts` — line 1172 (interface definition)
- `grep -n "plantillasTextoPresupuestoService"` — line 2159 (service export)
- `grep -n "plantillas_texto_presupuesto"` — 7 matches (collection name consistently used across all methods)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `packages/shared/src/types/index.ts` — PlantillaTextoPresupuesto interface at line 1172
- [x] `apps/sistema-modular/src/services/presupuestosService.ts` — plantillasTextoPresupuestoService at line 2159
- [x] Commit 4902920 — Task 1
- [x] Commit 9c5d344 — Task 2
- [x] `@ags/shared` compiles with 0 TS errors
- [x] No new TS errors introduced in sistema-modular
