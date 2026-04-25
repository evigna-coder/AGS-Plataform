---
phase: 10-presupuestos-partes-mixto-ventas
plan: 06
subsystem: ui
tags: [facturacion, dashboard, exports, deep-link, rbac, e2e]

# Dependency graph
requires:
  - phase: 10-presupuestos-partes-mixto-ventas
    provides: SolicitudFacturacion type + estado labels (10-01); cerrarAdministrativamente trigger (10-04); export helpers (10-05)
provides:
  - FacturacionList: date range filter (desde/hasta), Excel/PDF export buttons (admin gated), deep link ?solicitudId=xxx via getById
  - FacturacionDetail: Marcar enviada / Marcar facturada actions, nota del contable editor (admin gated)
  - 6 desfixmed Wave 0 specs (3.5, 3.6, 3.7, 3.8, 7.4, 7.5, 11.13b assertion, 14.1-14.5)
  - getSolicitudesFacturacion() helper in firestore-assert.ts
affects: [phase-11-e2e-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deep link resolution via service.getById (not list filter race) — toast/alert fallback if not found"
    - "Admin actions gated by useAuth().hasRole('admin','admin_soporte','administracion')"
    - "Filter-aware export: buildFiltrosLabel() builds human string passed as PDF subtitle"
    - "Wave 0 desfixme pattern: spec stays in code, fixme guard removed when implementing wave lands"

key-files:
  created: []
  modified:
    - apps/sistema-modular/src/pages/facturacion/FacturacionList.tsx
    - apps/sistema-modular/src/pages/facturacion/FacturacionDetail.tsx
    - apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts
    - apps/sistema-modular/e2e/circuits/07-facturacion.spec.ts
    - apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts
    - apps/sistema-modular/e2e/circuits/14-exports.spec.ts
    - apps/sistema-modular/e2e/helpers/firestore-assert.ts

key-decisions:
  - "Deep link resolution uses facturacionService.getById directly (not solicitudes.find) to avoid list-filter race when target solicitud has estado outside default filter"
  - "Routes registered for /facturacion and /facturacion/:id with allowedRoles=['admin', 'admin_soporte', 'administracion'] — administracion role added beyond plan spec ['admin','admin_soporte']; enables contable users without admin grant"
  - "RBAC tests 3.9 + 14.6 kept fixme — require role-switching fixture deferred to Phase 11 (TEST-01/TEST-05)"
  - "Replaced sonner toast with console.warn + alert for deep-link errors (sonner not installed in repo)"
  - "Used usuario.displayName (not .nombre) per UsuarioAGS interface for actor.name in audit fields"
  - "FacturacionDetail extended in place rather than rewritten — preserved existing AFIP factura form + cobro form + anulación path"

requirements-completed: [FMT-03, FMT-06]

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 10 Plan 06: Facturación Dashboard Extensions Summary

**FacturacionList + FacturacionDetail extendidas con admin actions, exports, deep link y nota del contable. Specs Wave 0 desfixmedas para Phase 10. Cierra FMT-03 y FMT-06.**

## Performance

- **Duration:** ~12 min (3 task commits + summary)
- **Started:** 2026-04-22T05:01:00Z
- **Completed:** 2026-04-22T05:13:00Z (final summary 2026-04-25)
- **Tasks:** 3 code + 1 deferred human-verify checkpoint (user runs separately)
- **Files modified:** 7 (2 source pages + 4 spec files + 1 helper)

## Accomplishments

- **FacturacionList.tsx (+88 lines):**
  - `fechaDesde` / `fechaHasta` filter fields added to FILTER_SCHEMA + applied in `filtradas` memo (range filter on `createdAt` ISO strings)
  - Date inputs in toolbar with monospace `DESDE` / `HASTA` labels (design system convention)
  - `Exportar Excel` + `Exportar PDF` buttons gated by `hasRole('admin', 'admin_soporte')` — filter-aware via `buildFiltrosLabel()`
  - Deep link `useEffect` reads `?solicitudId=xxx` query param and resolves via `facturacionService.getById()` directly (NOT via the list subscribe — avoids race when the target is `facturada` and outside the default filter)
  - Fallback `alert('Solicitud no encontrada')` + `console.warn` if id resolves to null
- **FacturacionDetail.tsx (+93 lines):**
  - `Marcar enviada` button (visible when estado=pendiente + admin role) → calls `facturacionService.marcarEnviada(id, actor)`
  - `Marcar facturada` button (visible when estado=pendiente|enviada + admin role) → calls `facturacionService.marcarFacturada(id, actor)`
  - Nota del contable section: textarea editable for admin, read-only `<p>` display for other roles. Persists via `facturacionService.agregarNota`
  - `reload()` helper extracted, used by all 3 new handlers + existing handleRegistrarFactura/Cobro
  - Confirm dialog before each transition (uses existing `useConfirm` hook)
- **E2E specs desfixmed (commit `c77429d`):**
  - `3.5` — ArticuloPickerPanel + ATP requerimiento condicional (Wave 2 / 10-02 landed)
  - `3.6` — PDF branching por tipo (Wave 2 / 10-03)
  - `3.7` — VentasMetadataSection + auto-OT trigger (Wave 3 / 10-04; later refactored to auto-ticket per 2204325 — spec adapts to current behavior)
  - `3.8` — Export buttons visibles en /presupuestos para admin (Wave 4 / 10-05)
  - `7.4` — Dashboard lista doc auto-creado pendiente (Wave 3)
  - `7.5` — Marcar enviada changes estado (Wave 5 / this plan)
  - `11.13b` — solicitudFacturacion assertion uncommented (Wave 3)
  - `14.1` `14.2` `14.3` `14.4` `14.5` — Export downloads + filter-aware (Wave 4)
- **Helper added:** `getSolicitudesFacturacion({ estado?, limit? })` in `firestore-assert.ts` — used by 11.13b for assertion

## Task Commits

1. **Task 1: Extend FacturacionList — date filters, exports, deep link, RBAC gate** — `4459546` (feat)
2. **Task 2: Extend FacturacionDetail with admin actions + nota editor** — `6761aa1` (feat)
3. **Task 3: Desfixme Wave 0 specs after circuito completo** — `c77429d` (test)

(Final docs commit pending — STATE/SUMMARY/ROADMAP updates separate.)

## Files Created/Modified

### Modified
- `apps/sistema-modular/src/pages/facturacion/FacturacionList.tsx` — filters, exports, deep link, RBAC (226 → 307 lines, +88)
- `apps/sistema-modular/src/pages/facturacion/FacturacionDetail.tsx` — admin actions + nota (265 → 347 lines, +93)
- `apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts` — desfixme 3.5/3.6/3.7/3.8 (3.9 still fixme — RBAC fixture)
- `apps/sistema-modular/e2e/circuits/07-facturacion.spec.ts` — desfixme 7.4/7.5
- `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — desfixme 11.13b assertion + import getSolicitudesFacturacion
- `apps/sistema-modular/e2e/circuits/14-exports.spec.ts` — desfixme 14.1-14.5 (14.6 still fixme — RBAC fixture)
- `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — added `getSolicitudesFacturacion()`

## Decisions Made

- **Deep link via `getById` (not list filter):** Plan 10-06 explicitly specified the W10 fix — querying directly avoids the spurious "Solicitud no encontrada" when the target is in a state filtered out by the default subscribe (e.g., `facturada` while the default view shows pending). Pattern: `service.getById(deepLinkId).then(navigate)`.
- **Route allowed roles include `administracion`:** Plan said `['admin', 'admin_soporte']`. Implementation used `['admin', 'admin_soporte', 'administracion']` — additive expansion to let users with the existing `administracion` role view facturación read-only without needing admin grant. Admin actions in the page itself remain gated by `hasRole('admin', 'admin_soporte')` (not `administracion`), preserving the plan's RBAC contract for write actions.
- **`administracion` is NOT in the admin actions gate:** The plan's `canAdminAction` check stays scoped to admin + admin_soporte. `administracion` users can navigate and view, but the Marcar enviada/facturada/Guardar nota/Exportar buttons remain hidden. Matches the plan's CONTEXT decision (admin_contable diferido).
- **`alert()` instead of `toast`:** Plan suggested `sonner` for the deep-link error fallback. The repo doesn't have sonner installed; using `alert()` + `console.warn()` matches the existing UX patterns elsewhere in the codebase.
- **Used `usuario.displayName`:** Plan example used `usuario?.nombre`; the actual `UsuarioAGS` interface in this codebase exposes `displayName`. Fixed at edit time.
- **RBAC tests 3.9 + 14.6 kept fixme:** Plan explicitly said this is acceptable — role-switching fixture is Phase 11 work (TEST-01/TEST-05). Fixme reason updated to reference the future plan.
- **Did NOT execute Task 4 (human-verify checkpoint):** Per user instruction in the executor prompt, the user runs the full circuit UAT separately on their dev server (Tier-1 fixes still pending). This SUMMARY does not claim circuito completo verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sonner package not available in repo**
- **Found during:** Task 1 (FacturacionList edit)
- **Issue:** Plan suggested `import { toast } from 'sonner'` for deep-link errors but sonner is not in `package.json`.
- **Fix:** Replaced with `console.warn` + `alert(...)` — matches existing error handling patterns in FacturacionDetail (e.g., handleRegistrarFactura uses `alert('Error al registrar la factura')`).
- **Files modified:** FacturacionList.tsx (deep link useEffect)
- **Committed in:** `4459546`

**2. [Rule 1 - Bug] usuario.nombre vs usuario.displayName**
- **Found during:** Task 2 (FacturacionDetail edit)
- **Issue:** Plan example used `usuario?.nombre` for actor.name. The `UsuarioAGS` interface in `@ags/shared` does not have `.nombre` — it has `.displayName`.
- **Fix:** Used `usuario?.displayName || undefined`.
- **Files modified:** FacturacionDetail.tsx (actor object)
- **Committed in:** `6761aa1`

**3. [Rule 2 - Missing critical functionality] administracion role read-access**
- **Found during:** Task 2 route registration
- **Issue:** Plan called for `allowedRoles=['admin', 'admin_soporte']` on /facturacion/:id. The existing `/facturacion` (list) route already had `'administracion'` in its allowedRoles. Restricting :id to only admin+admin_soporte would prevent a contable user (administracion role) from clicking a row and viewing the detail — breaking the read-only consumer flow.
- **Fix:** Used `['admin', 'admin_soporte', 'administracion']` for both routes; gated only the write actions (buttons, textarea) inside the page on `hasRole('admin', 'admin_soporte')`. Net: administracion can read, only admin/admin_soporte can write.
- **Files modified:** TabContentManager.tsx (route registration; not in plan's `files_modified` list but registration was part of Task 2)

### Manual extensions vs plan
- The plan's pseudo-component for FacturacionDetail in Task 2 was a minimal shape (~180 lines). The actual implementation extended the existing 265-line component (which already had the AFIP factura form, registrar cobro form, anulación path, and cobrada display) — preserving all existing functionality and adding the new admin actions / nota editor on top. Net file size: 347 lines (over 250-line budget — see Deferred Issues below).

## Deferred Issues

**Component size budget (`.claude/rules/components.md` soft warning):**

| File | Pre-plan | Post-plan | Budget | Status |
| --- | ---: | ---: | ---: | --- |
| FacturacionList.tsx | 226 | 307 | 250 | Over by 57 lines |
| FacturacionDetail.tsx | 265 | 347 | 250 | Over by 97 lines (already over pre-plan) |

Both files now exceed the 250-line budget. This is a **soft warning** per `.claude/rules/components.md` (warns on stderr, does not block). Recommended refactors when next touched:
- **FacturacionList:** extract `useFacturacionExports({ filtradas, filters, clientes })` hook to encapsulate the export onClick handlers + `buildFiltrosLabel()` helper.
- **FacturacionDetail:** extract `<RegistrarFacturaSection>` and `<RegistrarCobroSection>` as subcomponents (each is a self-contained Card with its own form state). The new admin-actions + nota sections fit in <60 lines and are appropriately colocated.

Not refactored in this plan because:
- Plan 10-06 was scope-bounded to the new features; refactoring an existing 265-line file mid-feature would mix concerns.
- Pre-existing budget violation in FacturacionDetail (265 lines pre-plan) → not introduced by 10-06.
- The size threshold is documented as soft / non-blocking by project convention.

## Manual Verification (User-driven)

The plan's Task 4 checkpoint (`type="checkpoint:human-verify"`) was NOT executed by this agent per the user's explicit instruction in the executor prompt. The user has Tier-1 fixes pending separately and will validate the full circuito comercial v2.0 end-to-end on their own dev server. Required checks (per plan):

1. `pnpm dev:modular`
2. **Flujo ventas:** crear ppto ventas → completar metadata → guardar → PDF → aceptar → verificar OT en /ordenes-trabajo → avanzar OT a CIERRE_ADMINISTRATIVO → /facturacion muestra doc pendiente → click row → Marcar enviada → Marcar facturada → editar nota → Exportar Excel + PDF
3. **Flujo partes:** crear ppto partes → ATP=0 → aceptar → confirm dialog → requerimiento condicional creado
4. **Flujo mixto:** PDF muestra 2 secciones con subtotales
5. **RBAC:** logout → login con rol no-admin → /facturacion: botones admin ocultos
6. **Deep link:** `/facturacion?solicitudId={id}` con id de solicitud `facturada` → abre detail directo

**Phase 10 verification status: NOT YET FULL — pending user UAT.** `/gsd:verify-work` should NOT run until user confirms.

## Issues Encountered

- None blocking. Deviations were minor inline corrections (sonner→alert, nombre→displayName) tracked above.
- Pre-existing TypeScript errors in unrelated files (e.g., `CalificacionesList.tsx`, `CreateColumnaModal.tsx`, `useLeadNotifications.ts`) — out of scope per `.claude/rules/components.md` boundary policy. Not introduced by this plan.

## User Setup Required

None — feature is enabled by default for users with admin/admin_soporte/administracion roles. Mail actual delivery still deferred to mailQueue consumer (post-v2.0); retry manual desde `/admin/acciones-pendientes` remains the authoritative path per CONTEXT.md.

## Next Phase Readiness

- **Phase 10 closure pending user UAT** — once approved, Phase 10 can be marked complete and `/gsd:verify-work` can run.
- **Phase 11 (E2E Playwright suite):**
  - 14 circuit specs are now all desfixmed except 3.9 + 14.6 (RBAC).
  - TEST-01 (role-switching fixture) + TEST-05 (RBAC tests) are first-class Phase 11 tasks.
  - `getSolicitudesFacturacion` helper joins existing `getSolicitudesFacturacionByOt`/`getSolicitudFacturacion` in firestore-assert.ts — full coverage for facturación assertions.
- **Phase 12 (Esquema Facturación Porcentual + Anticipos)** — separate milestone, opt-in, does not affect Phase 10 closure.

---

## Self-Check: PASSED

- FOUND: apps/sistema-modular/src/pages/facturacion/FacturacionList.tsx (307 lines, contains date filters + exports + deep link + RBAC)
- FOUND: apps/sistema-modular/src/pages/facturacion/FacturacionDetail.tsx (347 lines, contains marcar enviada/facturada + nota editor + RBAC gate)
- FOUND: apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts (3.5/3.6/3.7/3.8 desfixmed; only 3.9 fixme remains with Phase 11 reason)
- FOUND: apps/sistema-modular/e2e/circuits/07-facturacion.spec.ts (7.4 + 7.5 desfixmed)
- FOUND: apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts (11.13b assertion uncommented; getSolicitudesFacturacion imported)
- FOUND: apps/sistema-modular/e2e/circuits/14-exports.spec.ts (14.1-14.5 desfixmed; only 14.6 fixme with Phase 11 reason)
- FOUND: apps/sistema-modular/e2e/helpers/firestore-assert.ts (getSolicitudesFacturacion helper)
- FOUND: commit 4459546 (Task 1 — FacturacionList extensions)
- FOUND: commit 6761aa1 (Task 2 — FacturacionDetail extensions)
- FOUND: commit c77429d (Task 3 — desfixme specs)
- TypeScript: no new errors introduced in plan-target files (verified via `npx tsc --noEmit -p .` filtered to facturacion/ + circuits/)

---

*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed (code): 2026-04-22*
*Summary written: 2026-04-25*
*Phase 10 user-UAT: PENDING*
