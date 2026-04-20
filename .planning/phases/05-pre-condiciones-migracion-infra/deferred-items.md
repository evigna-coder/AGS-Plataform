# Deferred Items — Phase 05

Out-of-scope pre-existing TypeScript errors found during execution of Plan 05-01, NOT introduced by this plan's changes. Left for future dedicated cleanup.

## Pre-existing errors in sistema-modular (as of Plan 05-01 execution, 2026-04-20)

Running `pnpm --filter sistema-modular exec tsc --noEmit` surfaces these errors BEFORE any plan changes:

- `src/pages/calificacion-proveedores/CalificacionesList.tsx` — `CalificacionProveedor` not exported from `@ags/shared`; SortableHeader `current` prop mismatch.
- `src/pages/calificacion-proveedores/CalificacionModal.tsx` — missing exports from `@ags/shared` (`CalificacionProveedor`, `CriterioEvaluacion`, `EstadoCalificacion`, `CRITERIOS_DEFAULT`).
- `src/services/calificacionesService.ts` — same `CalificacionProveedor` import issue.
- `src/pages/equipos/EquipoNew.tsx:238` — `Omit<ModuloSistema, ...>` vs state shape mismatch.
- `src/pages/leads/LeadsList.tsx:325` — `canModify` declared but never read.
- `src/pages/ordenes-trabajo/TiposServicio.tsx:50` — missing `requiresProtocol` on `TipoServicio`.
- `src/pages/presupuestos/ConceptosServicio.tsx` — multiple `string` assigned to `number`.
- `src/services/catalogService.ts:5` — unused `invalidateCache` import.
- `src/services/geocodingService.ts:60` — unused `reject` parameter.
- `src/services/presupuestosService.ts:368` — `null` assigned to `string`.
- `useStockMigration` hook — `StockMigrationSummary` missing index signature.

None of these are in the files touched by Plan 05-01. Verified with:
```bash
pnpm --filter sistema-modular exec tsc --noEmit 2>&1 | grep -iE "leadsService|migrate-tickets|types/index"
# (empty result — no errors in our files)
```

`pnpm type-check` (runs only `packages/*`) passes cleanly — that's the command the plan's `<verify><automated>` uses.

## Recommended follow-up

Create a dedicated plan `05-XX-cleanup-typescript-errors.md` in a future phase to fix these one by one. None of them block the v2.0 milestone per se, but they may mask real errors introduced by future plans.
