---
phase: 08-flujo-automatico-derivacion
plan: 01
subsystem: shared-types + services + layout
tags: [shared-types, services, routing, sidebar, wave-1, types-foundation]

# Dependency graph
requires:
  - phase: 08-flujo-automatico-derivacion
    provides: "Wave 0 RED baseline specs (12-pending-actions-retry, 13-oc-cliente-flow) + firestore-assert helper"
  - phase: 07-presupuesto-per-incident
    provides: "Presupuesto interface locked + presupuestosService.markEnviado hook point"
  - phase: 05-pre-condiciones-migracion-infra
    provides: "/admin/* route pattern (RevisionClienteIdPage, ModulosAdminPage precedents)"
provides:
  - "@ags/shared types: 'oc_recibida' TicketEstado + PendingAction + OrdenCompraCliente + AdminConfigFlujos + Presupuesto.pendingActions? + RequerimientoCompra.condicional/canceladoPor"
  - "ordenesCompraClienteService: CRUD baseline + cargarOC stub (plan 08-02 fills the runTransaction)"
  - "adminConfigService: get/getWithDefaults/update/subscribe over adminConfig/flujos"
  - "Sidebar: single 'Admin' root grouping 5 children (importar, revision-clienteid, modulos, config-flujos, acciones-pendientes)"
  - "Routes /admin/config-flujos + /admin/acciones-pendientes with placeholder pages (plan 08-05 replaces content)"
affects: [08-02, 08-03, 08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-doc service over `adminConfig/{docId}` (first of its kind in sistema-modular)"
    - "Stub-with-typed-throw pattern: `cargarOC` throws NOT_IMPLEMENTED with a plan pointer — makes downstream plans fail loud"
    - "Consolidated admin sidebar root with children (replaces fragmented top-level admin items)"

key-files:
  created:
    - "apps/sistema-modular/src/services/ordenesCompraClienteService.ts"
    - "apps/sistema-modular/src/services/adminConfigService.ts"
    - "apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx"
    - "apps/sistema-modular/src/pages/admin/AccionesPendientesPage.tsx"
  modified:
    - "packages/shared/src/types/index.ts"
    - "apps/sistema-modular/src/components/layout/navigation.ts"
    - "apps/sistema-modular/src/components/layout/TabContentManager.tsx"
    - "apps/sistema-modular/src/pages/admin/index.ts"

key-decisions:
  - "TICKET_ESTADO_COLORS['oc_recibida'] = 'bg-orange-200 text-orange-900' (not bg-amber-100 per plan's alternative — amber-100 is already used by pendiente_facturacion)"
  - "No edit to getSimplifiedEstado: whitelist fallback already sends 'oc_recibida' to 'en_proceso'"
  - "@ags/shared barrel uses `export *` — no barrel update needed for the 3 new interfaces"
  - "Admin root icon '⚙️' + path '/admin' (new root; previous nav had no /admin root, only fragmented /admin/importar + /admin/modulos entries)"
  - "cargarOC throws NOT_IMPLEMENTED (not placeholder returning fake id) so 08-02 tests fail loud until the runTransaction lands"
  - "Placeholder pages render a serif heading + 'plan 08-05 implementa esta página' copy; enough content for the smoke spec's heading assertion"

requirements-completed: [FLOW-02, FLOW-04, FLOW-06, FLOW-07]

# Metrics
duration: ~7min
completed: 2026-04-21
---

# Phase 08 Plan 01: Shared Types + Services + Sidebar Foundation Summary

**Wave 1 foundation: 8 surgical edits in @ags/shared types + 2 new services (ordenesCompraCliente + adminConfig) + consolidated Admin sidebar root with 5 children and 2 placeholder routes — everything the rest of Phase 8 imports, writes to, and navigates.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-21T11:44:16Z
- **Completed:** 2026-04-21T11:50:51Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 4

## Accomplishments

- **Types foundation cemented for Phase 8.** `TicketEstado` now includes `'oc_recibida'` (union + labels + colors + order). Three new interfaces (`PendingAction`, `OrdenCompraCliente`, `AdminConfigFlujos`) cover FLOW-02/06/07 shape needs. `Presupuesto.pendingActions?` + `RequerimientoCompra.condicional?/canceladoPor?` land unblocking FLOW-03 and FLOW-06 downstream.
- **Two new services expose the Firestore interface that Waves 2-3 consume.** `ordenesCompraClienteService` holds CRUD baseline (`getAll`, `getById`, `getByPresupuesto`, `getByCliente`, `subscribe`, `update`, `delete`) with a typed `cargarOC` stub that throws `NOT_IMPLEMENTED` and points at plan 08-02. `adminConfigService` exposes `get`/`getWithDefaults`/`update`/`subscribe` over single doc `adminConfig/flujos` + a constant `ADMIN_CONFIG_DEFAULTS` with `mailFacturacion: 'mbarrios@agsanalitica.com'`.
- **Sidebar consolidated + routes registered.** Previous two separate admin entries in the sidebar (`Importar Datos` expanded to 2 children + standalone `Módulos`) were collapsed into one `Admin` root with 5 children: Importar Excel, Revisión clienteId, Módulos, Config Flujos (with separator), Acciones Pendientes. The 2 new routes resolve with placeholder page components so the smoke spec `10-smoke-all-pages` can assert heading text.

## Task Commits

1. **Task 1: Edit types/index.ts (8 surgical edits)** — `749d495` (feat)
2. **Task 2: Add ordenesCompraClienteService + adminConfigService** — `ae4ba09` (feat)
3. **Task 3: Sidebar Admin root + placeholder routes** — `cdd12bd` (feat)

Each commit stands alone: Task 1 is pure type additions and compiles independently; Task 2 only imports types Task 1 provided; Task 3 only adds routes that reference page components created in the same commit.

## Lines Touched in `packages/shared/src/types/index.ts`

| Edit # | Location (current line) | Change |
|--------|-------------------------|--------|
| 1 | 522 | Insert `\| 'oc_recibida'` in `TicketEstado` union (between `esperando_oc` and `espera_importacion`) |
| 2 | 540 | Insert `oc_recibida: 'OC recibida'` in `TICKET_ESTADO_LABELS` |
| 3 | 559 | Insert `oc_recibida: 'bg-orange-200 text-orange-900'` in `TICKET_ESTADO_COLORS` |
| 4 | 575 | Insert `'oc_recibida'` in `TICKET_ESTADO_ORDER` after `'esperando_oc'` |
| 5 | 896-955 | New block `--- Flujo Automático de Derivación (Phase 8) ---` with 3 exported interfaces: `PendingAction`, `OrdenCompraCliente`, `AdminConfigFlujos` |
| 6 | 1126-1128 | Insert `pendingActions?: PendingAction[]` in `Presupuesto` (before `--- Audit ---` block) |
| 7 | 2677-2685 | Insert `condicional?: boolean` + `canceladoPor?: 'presupuesto_anulado' \| 'manual' \| string \| null` in `RequerimientoCompra` |
| — | 599-603 | `getSimplifiedEstado` **not edited** (whitelist fallback already covers `'oc_recibida' → 'en_proceso'`) |

## Service Contracts Exported

### `ordenesCompraClienteService` (CRUD + stub)

```ts
export const ordenesCompraClienteService = {
  getAll(filters?: { clienteId?: string }): Promise<OrdenCompraCliente[]>;
  getById(id: string): Promise<OrdenCompraCliente | null>;
  getByPresupuesto(presupuestoId: string): Promise<OrdenCompraCliente[]>; // array-contains
  getByCliente(clienteId: string): Promise<OrdenCompraCliente[]>;
  subscribe(filters, callback, onError?): () => void;
  update(id, data: Partial<OrdenCompraCliente>): Promise<void>;
  delete(id): Promise<void>;
  cargarOC(payload, context): Promise<{ id: string; numero: string }>;  // ← throws NOT_IMPLEMENTED
};
```

### `adminConfigService` (single-doc)

```ts
export const ADMIN_CONFIG_DEFAULTS = { mailFacturacion: 'mbarrios@agsanalitica.com' };

export const adminConfigService = {
  get(): Promise<AdminConfigFlujos | null>;
  getWithDefaults(): Promise<AdminConfigFlujos>;  // ← default mail + current ISO timestamp
  update(data, updatedBy, updatedByName?): Promise<void>;  // setDoc merge:true + deepClean
  subscribe(callback, onError?): () => void;
};
```

## Sidebar Admin Root Shape

```ts
{
  name: 'Admin', path: '/admin', icon: '⚙️', modulo: 'admin',
  children: [
    { name: 'Importar Excel',      path: '/admin/importar' },
    { name: 'Revisión clienteId',  path: '/admin/revision-clienteid' },
    { name: 'Módulos',             path: '/admin/modulos' },
    { name: 'Config Flujos',       path: '/admin/config-flujos', separator: true },
    { name: 'Acciones Pendientes', path: '/admin/acciones-pendientes' },
  ],
}
```

Previous 2 fragmented entries removed. Routes for the 2 new paths registered in `TabContentManager.tsx` with `<ProtectedRoute allowedRoles={['admin']}>`.

## Decisions Made

- **Color for `oc_recibida`: `bg-orange-200 text-orange-900`.** Plan's primary suggestion `bg-amber-100 text-amber-800` is already assigned to `pendiente_facturacion`. Plan explicitly allowed the alternative; picked the darker orange so the state reads as "progressed past `esperando_oc`" visually.
- **`getSimplifiedEstado` not edited.** The function is a whitelist mapping only `'nuevo' | 'finalizado' | 'no_concretado'` explicitly; everything else falls through to `'en_proceso'`. Since `'oc_recibida'` is semantically "in progress", the fallback gives the correct answer with zero code change. Plan's Edit 5 called this out — documented as verification-only.
- **Barrel `packages/shared/src/index.ts` untouched.** It uses `export *` from `./types`, so `PendingAction`/`OrdenCompraCliente`/`AdminConfigFlujos` are re-exported automatically.
- **`cargarOC` throws with a plan pointer instead of returning fake data.** Any Wave-2 code that tries to call it before 08-02 lands fails loud with `NOT_IMPLEMENTED — plan 08-02 implementa la runTransaction completa`. Better than silently letting integration bugs through.
- **Single-doc service shape for `adminConfig`.** This is the first service in the codebase that operates on a single well-known doc (`adminConfig/flujos`). The shape — `get()` returning `null | T`, `getWithDefaults()` returning `T` never null — makes callers' null-checks trivial.
- **`mailFacturacion` required (not optional) on `AdminConfigFlujos`.** Justified by the orchestrator's note: `getWithDefaults()` always returns a value, so caller code in Wave 3 can use `cfg.mailFacturacion` without null-checks. Any `update()` that tries to clear it to undefined will get stripped by `deepCleanForFirestore` and leave the stored value intact.
- **Placeholder pages use `<h1 className="font-serif text-2xl">` heading.** That's enough content for the smoke spec `10-smoke-all-pages.spec.ts` to assert the expected heading text when plan 08-05 is run.

## Deviations from Plan

**None — plan executed as written.** Three minor notes / verification results:

1. **Pre-existing type errors in sistema-modular (out of scope).** Running `tsc --noEmit` surfaces ~35 pre-existing errors in unrelated files (CreateColumnaModal, CreateEquipoModal, CalificacionesList, etc.). None are from Task 1/2/3 edits — confirmed by grepping for `oc_recibida|PendingAction|OrdenCompraCliente|AdminConfigFlujos|pendingActions|condicional|canceladoPor|ConfigFlujosPage|AccionesPendientesPage` in the tsc output (empty result). Per the scope boundary rule, these are deferred — they predate Phase 8 and are documented here rather than fixed.
2. **`sistema-modular` has no `type-check` script.** Plan's `pnpm --filter @ags/sistema-modular type-check` was run via `cd apps/sistema-modular && npx tsc --noEmit`. The 08-00 summary already flagged this as a gap for plan 08-05 (add a script). Not blocking.
3. **`getAllModulePaths()` now returns a single `/admin` root instead of two.** `ModulosAdminPage` consumes that helper to render module toggles. Previously it showed two separate admin module rows (`/admin/importar`, `/admin/modulos`); now it shows one `/admin` row. Any Firestore override docs keyed by the old paths become orphan (the admin root falls back to its default: visible). This is the intended behaviour of the consolidation — documented in the Task 3 commit body.

## Issues Encountered

- **`TICKET_ESTADO_COLORS` — original plan suggestion was already taken.** `bg-amber-100 text-amber-800` is `pendiente_facturacion` (line 563). Switched to the plan's documented alternative `bg-orange-200 text-orange-900`. Logged as a decision above.
- **Pre-existing `navigation.ts:55` error.** `modulo: 'calificacion-proveedores'` is flagged because `'calificacion-proveedores'` isn't in the `ModuloId` union. This predates Phase 8 (confirmed by reading the line before editing). Not caused by my edit; out of scope.

## Deferred Issues (pre-existing, surfaced by tsc --noEmit)

Logged for future reference — fixing any of these is out of scope for 08-01:

- `src/components/{columnas,patrones}/Create*.tsx`: `ModalProps` doesn't have `size` — plural places, small fix.
- `src/components/{fichas,loaners,equipos}/Create*.tsx`: number-vs-string type mismatches on Input handlers.
- `src/pages/calificacion-proveedores/*`: missing exports from `@ags/shared` (`CalificacionProveedor`, `CriterioEvaluacion`, `EstadoCalificacion`, `CRITERIOS_DEFAULT`).
- `src/services/presupuestosService.ts:368`: `null` not assignable to `string`.
- `src/pages/admin/ImportacionDatos.tsx`: summary types missing index signature.
- `src/pages/equipos/EquipoNew.tsx:238`: `ModuloSistema` shape mismatch.
- Various `noUnusedLocals` / `noUnusedParameters` warnings.

These should be addressed separately — a dedicated clean-up phase or plan 08-05 if the scope allows.

## User Setup Required

None — types, services, and routes are runtime-only artefacts. No env vars, no Firestore migration, no Cloud Function deployments.

## Next Phase Readiness

**Ready for parallel Wave 2.** Plans 08-02 through 08-05 can each import types from `@ags/shared`, call the new services, and navigate to the new routes:

- Plan 08-02 (FLOW-02 `cargarOC`): replaces the `NOT_IMPLEMENTED` stub with the real `runTransaction` that touches `ordenesCompraCliente` + `presupuesto.ordenesCompraIds` + `ticket.estado = 'oc_recibida'` + `Posta` + `pendingAction`.
- Plan 08-03 (FLOW-01 auto-ticket): uses `Presupuesto.pendingActions?[]` for the `clienteId: null` retry path + integrates with `leadsService.resolverClienteIdPendiente`.
- Plan 08-04 (FLOW-03 Comex derivation): uses `RequerimientoCompra.condicional` + `canceladoPor` for the acceptance/anulación linkage.
- Plan 08-05 (FLOW-04 + FLOW-07 UIs): replaces the 2 placeholder pages with real UI (`ConfigFlujosPage` — 3 SearchableSelect + 1 email Input; `AccionesPendientesPage` — dashboard list with retry buttons).

## Self-Check

Files expected to exist:
- `packages/shared/src/types/index.ts` — verified
- `apps/sistema-modular/src/services/ordenesCompraClienteService.ts` — verified
- `apps/sistema-modular/src/services/adminConfigService.ts` — verified
- `apps/sistema-modular/src/components/layout/navigation.ts` — verified (modified)
- `apps/sistema-modular/src/components/layout/TabContentManager.tsx` — verified (modified)
- `apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx` — verified
- `apps/sistema-modular/src/pages/admin/AccionesPendientesPage.tsx` — verified
- `apps/sistema-modular/src/pages/admin/index.ts` — verified (modified)

Commits expected to exist:
- `749d495` — feat(08-01): extend shared types for flow derivation (Task 1)
- `ae4ba09` — feat(08-01): add ordenesCompraCliente + adminConfig services (Task 2)
- `cdd12bd` — feat(08-01): consolidate sidebar admin root + placeholder routes (Task 3)

## Self-Check: PASSED

---
*Phase: 08-flujo-automatico-derivacion*
*Completed: 2026-04-21*
