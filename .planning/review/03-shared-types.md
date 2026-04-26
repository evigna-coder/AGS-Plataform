# `@ags/shared` Audit — Cross-checked against app usage

Scope: `packages/shared/src/index.ts`, `packages/shared/src/types/index.ts` (3896 LOC), `packages/shared/src/utils.ts`. Cross-referenced against every `from '@ags/shared'` import across the 3 apps (273 distinct imported names, 310 distinct exports).

---

### [P0] Calificación-Proveedores types missing from `@ags/shared`
**Type/File:** `CalificacionProveedor`, `CriterioEvaluacion`, `EstadoCalificacion`, `CRITERIOS_DEFAULT` — referenced from `apps/sistema-modular/src/pages/calificacion-proveedores/{CalificacionesList.tsx, CalificacionModal.tsx}` and `apps/sistema-modular/src/services/calificacionesService.ts`
**What:** All four symbols are imported from `@ags/shared` but the package never exports them. There is no `CalificacionProveedor` interface anywhere in `packages/shared/src/types/index.ts`.
**Why:** Module fails to compile. `pnpm build:modular` cannot produce a build until these are added or the imports moved to a local types file.
**Fix:** Add the four exports to `packages/shared/src/types/index.ts` (the service already type-asserts to `CalificacionProveedor`, so the shape is implicit in `calificacionesService.ts:14-22`). Include `Omit<CalificacionProveedor, 'id'|'createdAt'|'updatedAt'>` style fields plus the `CRITERIOS_DEFAULT: CriterioEvaluacion[]` constant.

---

### [P0] `ModuloId` union missing `'calificacion-proveedores'`
**Type/File:** `ModuloId` at `packages/shared/src/types/index.ts:3139-3159`
**What:** `apps/sistema-modular/src/components/layout/navigation.ts:57` declares `{ modulo: 'calificacion-proveedores' }` for the sidebar entry, but the union doesn't include that literal. Same gap will surface in `RUTA_MODULO`, `MODULO_LABELS`, and `ROLE_DEFAULTS.*.modulos[]` once anyone tries to gate the route.
**Why:** Without the literal in the union, the value falls through `ProtectedRoute` / `canAccessModulo` checks silently — TS only complains in the navigation file because that is one of the few sites where the field is typed as `ModuloId`.
**Fix:** Add `'calificacion-proveedores'` to `ModuloId`, `MODULO_LABELS`, `RUTA_MODULO`, and to `ROLE_DEFAULTS.admin.modulos` (and any other role meant to see it).

---

### [P0] `Ticket.updatedBy` referenced but not declared
**Type/File:** `Ticket` at `packages/shared/src/types/index.ts:691-745`
**What:** `apps/sistema-modular/src/hooks/useLeadNotifications.ts:117` reads `newLead.updatedBy !== userId`, but the `Ticket` interface only declares `createdBy?: string` — no `updatedBy`. Same pattern (`updatedBy` / `updatedByName`) exists on `Cliente`, `Establecimiento`, `Sistema`, `Pendiente`, `Presupuesto`, so the omission on `Ticket` is an oversight rather than a deliberate decision.
**Why:** TS error `Property 'updatedBy' does not exist on type 'Ticket'`. Notification logic also misfires for any ticket that does carry the field at runtime.
**Fix:** Add `updatedBy?: string | null;` and `updatedByName?: string | null;` to `Ticket`.

---

### [P0] `Ticket.createdAt` declared required but call sites omit it
**Type/File:** `Ticket.createdAt: string` at `packages/shared/src/types/index.ts:718`
**What:** Three documented callers don't pass `createdAt`:
- `apps/sistema-modular/src/hooks/useCrearLeadForm.ts:175` — only spread when `customCreatedAt` is set, otherwise omitted.
- `apps/sistema-modular/src/hooks/useOTActions.ts:103-129` — never includes `createdAt`.
- `apps/sistema-modular/src/services/presupuestosService.ts` — same omission per the prior typecheck.

The service's own `create()` signature works around this with `Omit<Lead, 'id' | 'updatedAt'> & { createdAt?: string }` (`leadsService.ts:192`), confirming the field is in fact optional at the API boundary.
**Why:** Compile fails and, more importantly, the parser fallback `data.createdAt?.toDate?.()?.toISOString() ?? ''` (`leadsService.ts:132`) returns a runtime empty string that lies to `Ticket.createdAt: string`. Sorting/formatting downstream silently treats it as the epoch.
**Fix:** Either (a) make `createdAt` optional on `Ticket` and update the parser to set `Timestamp.now().toDate().toISOString()` as default, or (b) keep it required and force every create to pass `Timestamp.now()` explicitly. Option (a) matches what the service already accepts.

---

### [P1] `Ticket.contacto`/`email`/`telefono` are required but legacy docs lack them
**Type/File:** `Ticket` at `packages/shared/src/types/index.ts:701-705`
**What:** The three flat fields are typed as required `string` and marked `@deprecated`. `parseLeadDoc` defends with `data.contacto ?? ''` etc., so absent fields silently become empty strings. Code like `lead.razonSocial.toLowerCase()` (e.g. `DerivarLeadModal.tsx:58`) and `LeadCard` rely on this convention, but anything using the deprecated trio gets `''` for legacy tickets.
**Why:** The "required" type hides the migration in progress and prevents the compiler from finding sites that should be reading from `contactos[]` instead.
**Fix:** Mark `contacto?`, `email?`, `telefono?` as optional and audit consumers; the new source-of-truth is `contactos: ContactoTicket[]` plus `getContactoPrincipal()`.

---

### [P1] `TipoServicio.requiresProtocol` required but TiposServicio create-form omits it
**Type/File:** `TipoServicio` at `packages/shared/src/types/index.ts:648-656`
**What:** Field is required `boolean`. `apps/sistema-modular/src/pages/ordenes-trabajo/TiposServicio.tsx:50-53` calls `tiposServicioService.create({ nombre, activo: true })` with no `requiresProtocol`. `update()` at line 45-48 also omits it. Editing UI never exposes the toggle.
**Why:** Either compile fail or the row is persisted with `undefined` (which will then be stripped by `deepCleanForFirestore` → field missing → reads back as `undefined`, breaking the strict type and any `if (tipo.requiresProtocol)` gate in OT flow).
**Fix:** Default it to `false` at the create call site AND make the field optional on the type (`requiresProtocol?: boolean` with a `?? false` convention at every read), or expose the toggle in `TiposServicioModal.tsx`.

---

### [P1] `WorkOrder.createdAt` is optional but treated as load-bearing
**Type/File:** `WorkOrder.createdAt?: string` at `packages/shared/src/types/index.ts:86`
**What:** Most other audit-bearing entities (`Cliente`, `Sistema`, `Presupuesto`, `Pendiente`, `Ticket`) declare `createdAt: string` required. `WorkOrder` is the lone exception, despite being one of the most-listed entities. Several lists sort by `createdAt`.
**Why:** Forces every UI consumer to either non-null-assert or fall back to `''`, both of which mask data quality issues. Inconsistency vs. the rest of the audit-trail convention.
**Fix:** Make required; add a one-time backfill for any legacy OT missing the field.

---

### [P1] `ContactoTicket.email` optional but `ContactoEstablecimiento.email` required
**Type/File:** `ContactoTicket` at `packages/shared/src/types/index.ts:673-682` vs `ContactoEstablecimiento` at `211-221`
**What:** Same conceptual contact data, different shapes. `ContactoTicket.email?: string`, `ContactoEstablecimiento.email: string`. There is also `ContactoCliente` (deprecated, line 161-170) with required `email`, and `ContactoOption` (line 3560) with required `email`. Four shapes for one concept.
**Why:** Anywhere you copy a contact from one collection into another (lead → presupuesto → OT → factura) you have to widen/narrow the type, and the codebase already does this implicitly.
**Fix:** Standardize to optional `email?: string` and `telefono?: string` everywhere, since real data has gaps. Or extract a single `Contacto` base interface.

---

### [P1] `LeadEstado` / `LeadArea` / `LeadPrioridad` and `LEAD_*` constants are deprecated re-exports still imported widely
**Type/File:** Lines 633-643 and 748-750 of `packages/shared/src/types/index.ts`
**What:** `Lead`, `AdjuntoLead`, `LeadEstado`, `LeadArea`, `LeadPrioridad`, `LEAD_AREA_*`, `LEAD_PRIORIDAD_*`, `LEAD_ESTADO_*` all re-export the `Ticket*` equivalents under the `@deprecated` JSDoc tag. They are imported from 24+ files including new ones (`portal-ingeniero/src/services/firebaseService.ts`, `useLeadNotifications.ts`, `LeadCard.tsx`).
**Why:** Per memory, the rename Lead→Ticket is in progress. Every new file that imports the deprecated alias deepens the rollback burden.
**Fix:** Lint rule (or codemod) to forbid new imports of the `Lead*` / `LEAD_*` aliases; keep them only until the existing 24 files are migrated, then remove. `LEAD_PRIORIDAD_LABELS_LEGACY` looks unused in apps and can be deleted now.

---

### [P2] Stale legacy types: `Customer`, `Module`, `Equipment`, `Equipo`
**Type/File:** `packages/shared/src/types/index.ts:1360` (`type Equipo = Sistema`), `3685-3709` (`Module`/`Customer`/`Equipment`)
**What:** `Equipo` alias is imported nowhere. `Customer`/`Module`/`Equipment` are imported only in `apps/reportes-ot/types.ts` and `apps/reportes-ot/mockData.ts` — they pre-date `Cliente`/`ModuloSistema`/`Sistema` and are never used in the production reportes-ot pipeline (only in mock data file).
**Why:** Three alternative shapes for the same domain entity invite drift. Anyone reaching for "Customer" in a new file gets a 6-field stub instead of `Cliente`.
**Fix:** Migrate `mockData.ts` to use `Cliente`/`Sistema`/`ModuloSistema`, then delete `Customer`, `Module`, `Equipment`, and `Equipo` from `@ags/shared`.

---

### [P2] reportes-ot bypasses `@ags/shared` via `@shared/types/index` deep import
**Type/File:** `apps/reportes-ot/types.ts:11`, `apps/reportes-ot/types/{entities,instrumentos,tableCatalog}.ts`
**What:** All four files `import ... from '@shared/types/index'` rather than `from '@ags/shared'`. The `@shared` alias is configured in both `apps/reportes-ot/tsconfig.json` and `vite.config.ts` to point at `../../packages/shared/src`.
**Why:** Bypasses the package boundary, so types reach reportes-ot before `pnpm build` builds `@ags/shared/dist`. If anyone publishes the package, reportes-ot keeps importing from source. Inconsistent with the other two apps.
**Fix:** Use `from '@ags/shared'` consistently; remove the `@shared/*` path mapping unless there's a specific reason (e.g. avoiding workspace symlink quirks in PWA build).

---

### [P2] `ServiceReport` exported but not consumed
**Type/File:** Defined at `packages/shared/src/types/index.ts:3763` (per scan); never imported by any app file.
**What:** Stale export carried over from an early reportes-ot iteration.
**Fix:** Delete after a quick cross-check in scripts/. Same applies to `RenderSpec` (1819), `QuoteItem` (1350), `AreaIngeniero` (2064) — all are exported but no app imports them.

---

### [P2] `MEDIO_PAGO_LABELS` / `VIATICO_ESTADO_*` placement and viático shape
**Type/File:** `MedioPago` and `ViaticoPeriodoEstado` at `packages/shared/src/types/index.ts:3714-3732`
**What:** Block of viático types lives at the bottom of the file, far from the `WorkOrder`/OT cluster they belong to. Plus `ViaticoPeriodo` and `GastoViatico` are imported from both apps but sit 3000 lines apart from related OT types.
**Fix:** Cosmetic regroup; lower priority but the file's organization makes finding things difficult (3896 lines, single file).

---

## TOP 5 to fix first

1. **Add `CalificacionProveedor`/`CriterioEvaluacion`/`EstadoCalificacion`/`CRITERIOS_DEFAULT` to `@ags/shared`** — module is broken, blocks `pnpm build:modular`.
2. **Add `'calificacion-proveedores'` to `ModuloId` union (and `RUTA_MODULO` / `MODULO_LABELS` / `ROLE_DEFAULTS`)** — needed for sidebar gate to compile and the route to be access-controlled.
3. **Make `Ticket.createdAt` optional and add `Ticket.updatedBy`/`updatedByName`** — three call sites omit `createdAt` and notifications crash on missing `updatedBy`.
4. **Loosen the deprecated trio `Ticket.contacto/email/telefono` to optional** and either (a) drop `requiresProtocol: boolean` to optional on `TipoServicio` or (b) update `TiposServicio.tsx` to write a default — pick one to match real data.
5. **Codemod the 24 files still importing `Lead*` / `LEAD_*` aliases to use `Ticket*`** so the deprecated re-exports can be deleted; while at it, drop unused `Customer`/`Module`/`Equipment`/`Equipo`/`ServiceReport`/`RenderSpec`/`QuoteItem` exports.
