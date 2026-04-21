# Phase 08 — Deferred Items

Issues surfaced during Phase 8 execution that are out of scope for the current plan but should be addressed in a follow-up. Logged per the `<deviation_rules>` SCOPE BOUNDARY.

## From Plan 08-02

### `PresupuestosList.tsx` over 250-line budget (pre-existing, grew +52)

- **Found during:** Task 3 — wiring `CargarOCModal` into list.
- **File:** `apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx`
- **Baseline size:** 466 lines before plan 08-02 (already over 250).
- **After 08-02 edits:** 518 lines.
- **What added:** ordenesCompraClienteService import + new state slots + useEffect to resolve OCs del cliente + useMemo for otros presupuestos N:M + "Cargar OC" row action button + modal render. All surgical and necessary for FLOW-02 UI.
- **Rule:** `.claude/rules/components.md` — React component files should be ≤250 lines; when growing, extract hook or subcomponent.
- **Why deferred:** The parent was already over budget before this plan (Rule 4 — architectural refactor of the entire list page is out of 08-02 scope). A dedicated refactor extracting `usePresupuestosListData` hook + `PresupuestoRowActions` subcomponent would split the file cleanly.
- **Recommended follow-up:** Dedicated refactor plan (e.g. a new plan in Phase 11 TEST-01 cleanup wave, or post-v2.0 tech-debt sweep) that extracts:
  1. `hooks/usePresupuestosListFilters.ts` — FILTER_SCHEMA + useUrlFilters wiring
  2. `hooks/usePresupuestosListSubscriptions.ts` — clientes + usuarios + presupuestos + solicitudes subscriptions
  3. `components/presupuestos/PresupuestoRowActions.tsx` — row button cluster (Adjuntar OC / Cargar OC / Enviar / Solicitar factura / Crear OT / Revisión)
- **NOT fixing in 08-02:** would require touching unrelated logic (filters, subscribers, row rendering) and risks regressions in a critical list page the whole team uses.

### `EditPresupuestoModal.tsx` over 250-line budget (pre-existing, grew +73)

- **Found during:** Task 3 — wiring `CargarOCModal` from the detail UI.
- **File:** `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx`
- **Baseline size:** 389 lines before plan 08-02.
- **After 08-02 edits:** 462 lines.
- **What added:** import of CargarOCModal + presupuestosService + ordenesCompraClienteService + type; new state (`showCargarOC`, `ocsExistentesOfCliente`, `otrosPresupuestosParaOC`); useEffect lazy-resolving OCs previas + otros presupuestos del cliente; "Cargar OC" footer button gated by `estado === 'aceptado'`; modal render.
- **Rule:** `.claude/rules/components.md` — React component files should be ≤250 lines.
- **Why deferred:** Same reasoning as PresupuestosList. Pre-existing violation + refactor is Rule 4 (architectural). The hook `usePresupuestoActions` already exists — a follow-up could extract the modal-open state + async-resolution logic to a dedicated `usePresupuestoCargarOC` hook and the footer buttons to a `PresupuestoFooterActions` subcomponent.
- **Recommended follow-up:** Refactor `EditPresupuestoModal` by extracting: (1) `hooks/usePresupuestoCargarOC.ts` (state + async resolution), (2) `components/presupuestos/PresupuestoFooterActions.tsx` (footer button cluster). Both are mechanical splits with no behavior change.
- **NOT fixing in 08-02:** the component orchestrates 7+ other modals and 3 hooks; an extraction risks breaking unrelated flows (envío, revisión, stock reserve, OT creation).
