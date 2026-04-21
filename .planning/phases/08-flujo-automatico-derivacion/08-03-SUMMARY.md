---
phase: 08-flujo-automatico-derivacion
plan: 03
subsystem: services + admin-page
tags: [flow-01, flow-06, auto-ticket, pending-actions, retry, wave-2]

# Dependency graph
requires:
  - phase: 08-flujo-automatico-derivacion
    provides: "08-01 Wave 1 — PendingAction type, Presupuesto.pendingActions?, adminConfigService, ordenesCompraClienteService. 08-00 RED baseline spec 12-pending-actions-retry Scenario A."
  - phase: 07-presupuesto-per-incident
    provides: "presupuestosService.markEnviado hook (TODO literal), leadsService.syncFromPresupuesto"
  - phase: 05-pre-condiciones-migracion-infra
    provides: "leadsService.resolverClienteIdPendiente, /admin/revision-clienteid page"
provides:
  - "presupuestosService._crearAutoTicketSeguimiento(pres) → {leadId} — auto-ticket builder"
  - "presupuestosService._appendPendingAction(presupuestoId, action) — pendingActions[] writer"
  - "presupuestosService.retryPendingAction(presupuestoId, actionId) → {success, error?} — dashboard entry point (08-05)"
  - "presupuestosService.retryPendingActionsForCliente(clienteId) → {retried, successful, failed}"
  - "presupuestosService.markPendingActionResolved(presupuestoId, actionId) — manual 'already done' resolution"
  - "presupuestosService.getByCliente(clienteId) → Presupuesto[] — raw query helper"
  - "leadsService.resolverClienteIdPendiente(ticketId, clienteId) → {retryResumen}"
  - "RevisionClienteIdPage ephemeral feedback banner (teal/red)"
affects: [08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy dynamic `import('./presupuestosService')` inside leadsService — breaks circular import introduced by retry trigger"
    - "Per-type switch in retryPendingAction (handler dispatch); v2.0 no-ops for derivar_comex + notificar_coordinador_ot; 08-05 deferral marker for enviar_mail_facturacion"
    - "Ephemeral banner state pattern for feedback (local useState + setTimeout auto-dismiss) — project has no toast lib"

key-files:
  created: []
  modified:
    - "apps/sistema-modular/src/services/presupuestosService.ts"
    - "apps/sistema-modular/src/services/leadsService.ts"
    - "apps/sistema-modular/src/pages/admin/RevisionClienteIdPage.tsx"

key-decisions:
  - "Lazy import of presupuestosService inside leadsService.resolverClienteIdPendiente to break circular dependency — verified build:web warns but does not fail; dynamic import fallback semantics documented inline"
  - "motivoLlamado='ventas_equipos' + areaActual='ventas' for auto-ticket (no 'seguimiento_presupuesto' enum exists — closest semantic match)"
  - "razonSocial field left empty in auto-ticket payload: leadsService.create runs through syncFlatFromContactos which derives it from the principal contact; we pass contactos:[] so the lead starts with a clean slate and the admin/user can edit it later"
  - "_crearAutoTicketSeguimiento status check is `usuario.status === 'activo'` (UserStatus enum is 'pendiente' | 'activo' | 'deshabilitado'), NOT `usuario.activo === true` as the plan suggested — UsuarioAGS has no `activo` boolean"
  - "v2.0 derivar_comex and notificar_coordinador_ot handlers marked as no-op success — 08-04/08-05 can extend; spec coverage for these types is still open"
  - "enviar_mail_facturacion retry returns error with pointer to plan 08-05 — the real retry needs OAuth popup from admin context and belongs in the dashboard row action"
  - "File size (presupuestosService.ts = 1146 lines) flagged for refactor — services are exempt from the 250-line component budget per CLAUDE.md but this service now aggregates 6+ concerns; candidate for Phase 9+ cleanup"

requirements-completed: [FLOW-01, FLOW-06]

# Metrics
duration: ~35min
completed: 2026-04-21
---

# Phase 08 Plan 03: FLOW-01 Auto-ticket + FLOW-06 Base (pendingActions + retry retroactivo) Summary

**Replaced `TODO(FLOW-06)` literal at `presupuestosService.ts:435` with a production auto-ticket builder, added 5 new service methods covering the pendingActions retry lifecycle, and wired `/admin/revision-clienteid` to fire retries retroactively when admins resolve a missing `clienteId`.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-21T11:31:00Z (approx)
- **Completed:** 2026-04-21T12:06:39Z
- **Tasks:** 3
- **Files modified:** 3
- **New methods:** 6 in `presupuestosService`, 0 in `leadsService` (existing method extended)
- **Lines added:** +127 (Task 1) + +154 (Task 2) + ~44 page + ~25 service = ~350 net across the 3 files

## Accomplishments

- **`TODO(FLOW-06)` eliminated from `markEnviado`.** Grep returns 0 hits in `presupuestosService.ts`. The block is replaced by a dual-path guard — one branch keeps the existing `syncFromPresupuesto` call (now wrapped with pendingAction registration on failure), and a new branch calls `_crearAutoTicketSeguimiento` whenever the presupuesto did NOT come from a ticket. Both branches register appropriate pendingActions if they fail, so the send never blocks on lead-side errors.
- **Auto-ticket builder with full precondition contract.** `_crearAutoTicketSeguimiento(pres)` validates: origen is not already a lead (idempotency guard), `clienteId` is non-empty (runtime null-safe despite `Presupuesto.clienteId: string` typing), `adminConfig/flujos.usuarioSeguimientoId` is configured, and the target user has `status === 'activo'`. Every precondition failure throws with a human-readable message that lands in `pendingAction.reason`.
- **Dashboard/retroactive retry API complete.** `retryPendingAction` dispatches by `action.type`, always increments `attempts`, sets `resolvedAt` on success. `retryPendingActionsForCliente` iterates presupuestos of a cliente + their unresolved actions. `markPendingActionResolved` closes rows that were handled off-system. Plus `getByCliente` as a query helper.
- **Retroactive retry trigger wired.** `leadsService.resolverClienteIdPendiente` now returns `{retryResumen}` and dynamically imports `presupuestosService` (to break the circular) to fire `retryPendingActionsForCliente(clienteId)` after the ticket update commits. Soft-fail: a retry failure logs + returns zeros, never breaks the ticket resolve.
- **UI feedback in `/admin/revision-clienteid`.** Ephemeral banner (teal success / red error) with auto-dismiss after 6s, plus a Cerrar button. Shows retry counts when `retried > 0` ("ClienteId resuelto. N acciones pendientes reintentadas (X OK, Y falló).") or a neutral success message otherwise.

## Task Commits

1. **Task 1: Replace `TODO(FLOW-06)` + add `_crearAutoTicketSeguimiento` + `_appendPendingAction`** — `86203a6` (feat)
2. **Task 2: Add `retryPendingAction` + `retryPendingActionsForCliente` + `markPendingActionResolved` + `getByCliente`** — `b97722f` (feat)
3. **Task 3: Extend `resolverClienteIdPendiente` + feedback banner in `RevisionClienteIdPage`** — `68d3b6a` (feat)

Each commit stands alone against its predecessor. Task 1 compiles on its own (service-local methods, no external type changes). Task 2 only references types/methods from Task 1. Task 3 only references the retry method added in Task 2.

## Code Contracts Introduced

### `_crearAutoTicketSeguimiento(pres) → {leadId}`

Throws on any precondition failure:

| Condition | Thrown message fragment |
|-----------|-------------------------|
| `pres.origenTipo === 'lead' && pres.origenId` | "Presupuesto ya tiene ticket origen" |
| `clienteId` empty/null | "clienteId null — pendiente revisión manual..." |
| `cfg.usuarioSeguimientoId` falsy | "adminConfig/flujos.usuarioSeguimientoId no configurado" |
| `usuario?.status !== 'activo'` | "usuario fijo seguimiento no activo: {userId}" |

On success: creates a Lead (Ticket) document with `estado: 'esperando_oc'`, `areaActual: 'ventas'`, `motivoLlamado: 'ventas_equipos'`, `asignadoA: cfg.usuarioSeguimientoId`, `presupuestosIds: [pres.id]`, `sistemaId: pres.sistemaId ?? null`, `valorEstimado: pres.total ?? null`. Caller (markEnviado) catches the throw and registers pendingAction.

### `retryPendingAction` handler table

| `action.type` | Handler | Outcome |
|---------------|---------|---------|
| `crear_ticket_seguimiento` | `_crearAutoTicketSeguimiento(pres)` | Real retry — throws propagate to error |
| `derivar_comex` | — | v2.0 no-op success (plan 08-04 may extend) |
| `notificar_coordinador_ot` | — | v2.0 no-op success (plan 08-04/08-05 may extend) |
| `enviar_mail_facturacion` | — | Returns error pointing at plan 08-05 OAuth flow |
| (default) | — | Returns `{success: false, error: 'tipo no soportado: <type>'}` |

Post-dispatch: write `updateDoc` with `pendingActions.map(a => a.id === actionId ? {...a, attempts: attempts+1, ...(success ? {resolvedAt: now} : {})} : a)`, wrapped in `deepCleanForFirestore` + `getUpdateTrace`.

### `leadsService.resolverClienteIdPendiente` new signature

**Before:** `(ticketId, clienteId) → Promise<void>`
**After:** `(ticketId, clienteId) → Promise<{retryResumen: {retried, successful, failed}}>`

Existing consumers (1 callsite: `RevisionClienteIdPage`) are updated in the same commit. No migration for other callers — grep verified nothing else reads the return value.

## Decisions Made

- **`motivoLlamado: 'ventas_equipos'` for auto-tickets.** The `MotivoLlamado` enum has no `seguimiento_presupuesto` value; `ventas_equipos` is the closest fit (a sale is in progress, follow-up is about the product). Alternative `ventas_insumos` would trigger the `ventasInsumosStamp` side-effect in `leadsService.create` — avoided.
- **`razonSocial: ''` in the Lead payload.** `leadsService.create` runs through `syncFlatFromContactos` which derives the principal contact's name if contactos[] has entries. We pass `contactos: []` so the field stays empty and the system owner can edit it manually from the ticket view if needed. Populating `razonSocial` from `pres.razonSocial` is an option, but Presupuesto types don't have that field as required — skipped for robustness.
- **Lazy `import('./presupuestosService')` in leadsService.** Without it, there's a circular dependency (leads → presupuestos → leads). Vite reports it as a warning ("dynamic import will not move module into another chunk"), but the build succeeds. This is the same pattern used elsewhere in the codebase (e.g., contratosService interactions).
- **`UsuarioAGS.status === 'activo'` check**, not `.activo === true`. The type defines `UserStatus = 'pendiente' | 'activo' | 'deshabilitado'`. The plan's example used `usuario.activo === false` — that would never fire because the property doesn't exist. Semantic equivalent.
- **v2.0 no-op handlers for `derivar_comex` and `notificar_coordinador_ot`.** The CONTEXT/RESEARCH explicitly deferred these to 08-04 (derivar_comex) and 08-05 (notificar_coordinador_ot). Returning `success: true` lets the dashboard row disappear cleanly; the real handlers can replace them without breaking contract.
- **Ephemeral feedback banner instead of toast lib.** Inspected imports: no `react-hot-toast`, no `sonner`, no `notistack`. Rather than introduce a dependency for one screen, I used a local state + `setTimeout` dismiss pattern. The banner uses editorial-teal design tokens (`bg-teal-50 text-teal-800 border-teal-200` for success, red analogs for error) consistent with the project's design system.
- **File size of `presupuestosService.ts` now 1146 lines** (was 871 at start). CLAUDE.md says component budget is 250 lines and services are exempt, but I'm flagging this as a refactor candidate: the service now handles OCs internas, presupuestos CRUD, requerimientos auto-generation, estado transitions, auto-ticket logic, and pendingActions lifecycle. A split into `presupuestosService` + `pendingActionsService` (or similar) is reasonable for Phase 9+.

## Deviations from Plan

**Rule 2 — Auto-added critical correctness** (accepted silently):

1. **Spec's `usuario.activo === false` → changed to `usuario.status !== 'activo'`.** UsuarioAGS has no boolean `activo` field; the type uses a `UserStatus` union. This is a plan-authoring oversight (plan referenced the wrong field name). Implemented the real check.
2. **Plan suggested importing `usuariosService` from `./usuariosService`** — actual location is `./personalService` (the file exports `usuariosService` among other services). Import path corrected.
3. **Plan suggested `TicketEstado` type imported from `@ags/shared`** — also needed `TicketArea`, `Lead`, `PendingAction` for the `Lead` payload shape. All added in the same import line.
4. **Plan's feedback mechanism used `toast.success`/`toast.error`** — no toast lib is installed; implemented an inline banner. Functionally equivalent (user sees the retry counts after resolve).

None of these required a checkpoint (Rule 4) because they're type corrections and library assumptions that don't alter plan intent.

## Issues Encountered

- **Parallel-executor cross-staging at Task 3 commit time.** Plan 08-02 was running concurrently and had staged a new file `apps/reportes-ot/components/protocol/ProtocolCardList.tsx` in the index. When I ran `git add` for my two files and committed Task 3, the already-indexed new file was included in the commit (hash `68d3b6a`). I did NOT author or modify that file — it's content from plan 08-02 (or a related wave). The content is legitimate (it passes typecheck and is consistent with the protocol refactor pattern); it's just attributed to the wrong plan's commit. Documented here; the 08-02 executor may still want to reference its own commit for that file. Not destructive — no data loss.
- **Vite build warning on circular import.** `presupuestosService is dynamically imported by leadsService but also statically imported by CreateRevisionModal, PresupuestoDetail, firebaseService, otService`. This is the expected/documented cost of the lazy import pattern. Build succeeds, app runs fine — just no code-split gains.
- **Pre-existing TS error on `presupuestosService.ts:368 → 370`** (shifted by +2 lines due to my insertion). `clienteNombre: null` vs `string` expected. NOT caused by my edits — confirmed by baseline check (same count `48` before and after my changes). Documented in 08-01 SUMMARY deferred list.

## Scope Boundary Enforcement

The plan was tight on scope: only `presupuestosService.markEnviado` + related helpers, `leadsService.resolverClienteIdPendiente`, and `RevisionClienteIdPage`. I did not touch:
- `reportes-ot/**` (frozen surface)
- `ordenesCompraClienteService.ts` (08-02 territory — confirmed owned by parallel executor)
- `CargarOCModal.tsx`, `PresupuestosList.tsx`, `EditPresupuestoModal.tsx` (08-02 territory)
- Admin dashboard pages (08-05 territory)
- Phase 8 types in `@ags/shared` (08-01 already landed)

The only cross-file consequence is the new return shape of `resolverClienteIdPendiente` — one callsite (`RevisionClienteIdPage`), updated in the same commit.

## RED → GREEN progress (from 08-00 table)

| Test | Status | Notes |
|------|--------|-------|
| 12.02 — `markEnviado` dispara pendingAction | **GREEN-ready** | Code path exists; E2E will verify when Scenario A fixture creates a presupuesto with clienteId null |
| 12.03 — retry retroactivo desde `/admin/revision-clienteid` | **Partially GREEN** | `retryPendingActionsForCliente` wired; limitation: only matches presupuestos with `clienteId === {resolvedId}`, so the narrow "presupuesto.clienteId null at send time" path requires the presupuesto to have its clienteId separately resolved before the retry fires. Documented in Task 2 code comment. 08-05 dashboard UI or a follow-up plan may close this gap. |
| 12.04 — auto-ticket en `esperando_oc` | **GREEN-ready** | `estado: 'esperando_oc'` hardcoded in `_crearAutoTicketSeguimiento`. Spec needs the new lead's id extracted — plan 08-05 work if the spec wants to read it. |
| 12.05–12.08 (dashboard) | **Still RED** | Plan 08-05 builds the dashboard. |

## User Setup Required

None at runtime. To see the feature live, the admin must:
1. Visit `/admin/config-flujos` (placeholder page from 08-01) and save a `usuarioSeguimientoId` — the config page UI from 08-05 will expose this; until then, direct Firestore write to `adminConfig/flujos.usuarioSeguimientoId`.
2. Ensure the target user has `status: 'activo'` in `usuarios` collection.

After that, any presupuesto sent without an origen ticket auto-generates a follow-up ticket in `esperando_oc`.

## Next Phase Readiness

**Plan 08-04 (FLOW-03 Comex derivation)** — can start. Its `retry derivar_comex` entry point in `retryPendingAction` is a no-op success today; 08-04 may extend that handler to re-fire the Comex derivation if it missed at `aceptado` time.

**Plan 08-05 (FLOW-04 + FLOW-07 UIs)** — can start in parallel with 08-04. Inherits:
- `retryPendingAction` as the primary row-level action in `/admin/acciones-pendientes`
- `markPendingActionResolved` for the "Marcar resuelta manual" button
- `_crearAutoTicketSeguimiento` / `_appendPendingAction` — reusable utilities
- `enviar_mail_facturacion` retry is explicitly deferred to 08-05 OAuth flow (retry method returns error with plan pointer)

## Self-Check

Files expected to exist and contain the documented changes:

- `apps/sistema-modular/src/services/presupuestosService.ts` — modified (6 new methods, `TODO(FLOW-06)` removed). **Verified — grep 0 hits for `TODO(FLOW-06)`, grep confirms all 6 methods present (lines 443, 455, 479, 543, 584, 653, 679, 703).**
- `apps/sistema-modular/src/services/leadsService.ts` — modified (`resolverClienteIdPendiente` extended with retry trigger). **Verified — grep confirms `retryPendingActionsForCliente` import + return shape.**
- `apps/sistema-modular/src/pages/admin/RevisionClienteIdPage.tsx` — modified (feedback banner). **Verified — grep confirms `retryResumen` usage + banner JSX.**

Commits expected to exist:

- `86203a6` — feat(08-03): replace TODO(FLOW-06)... **Verified in git log.**
- `b97722f` — feat(08-03): add retryPendingAction... **Verified in git log.**
- `68d3b6a` — feat(08-03): extend resolverClienteIdPendiente... **Verified in git log.**

Build verification:
- `npx tsc --noEmit` → 48 errors (baseline, unchanged — zero new errors in my files). **Verified.**
- `pnpm --filter @ags/sistema-modular build:web` → green. **Verified — 10.38s build.**

## Self-Check: PASSED

---
*Phase: 08-flujo-automatico-derivacion*
*Completed: 2026-04-21*
