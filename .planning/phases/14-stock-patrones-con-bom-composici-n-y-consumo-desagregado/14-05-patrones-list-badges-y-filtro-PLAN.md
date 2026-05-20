---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 05
type: execute
wave: 5
depends_on: [01, 04]
files_modified:
  - apps/sistema-modular/src/pages/patrones/PatronesList.tsx
  - apps/sistema-modular/src/pages/patrones/PatronRow.tsx
  - apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx
  - apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx
autonomous: false
requirements: [BOM-06]
must_haves:
  truths:
    - PatronesList shows a 'BOM' badge (teal pill) on rows where patron.componentes.length > 0
    - PatronesList shows a 'BLOQUEADO' or 'AGOTADO' badge (red pill) on rows where computePatronStatus is 'bloqueado' or 'agotado'
    - PatronesList has a new filter checkbox 'Bloqueados' persisted via useUrlFilters (schema-based, never useState)
    - Filter 'Bloqueados' when true filters list to only patrones whose status is 'bloqueado' or 'agotado'
    - PatronEditorPage renders an inline alert banner above the Lotes section listing which (lote, componente) pairs are below stockMinimo, with the saldo value, when any exist
    - "Component extraction performed: PatronRow.tsx + PatronComponentesAlertBanner.tsx are NEW files — RESEARCH notes PatronesList already at 330 LOC over budget; this plan reduces or holds (does not push higher)"
    - "Editorial Teal pills: 'BOM' uses bg-teal-100 text-teal-800; 'BLOQUEADO' uses bg-rose-100 text-rose-800"
  artifacts:
    - "path: "apps/sistema-modular/src/pages/patrones/PatronRow.tsx"
    - "path: "apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx"
    - "path: "apps/sistema-modular/src/pages/patrones/PatronesList.tsx"
  key_links:
    - "from: "apps/sistema-modular/src/pages/patrones/PatronesList.tsx"
    - "from: "apps/sistema-modular/src/pages/patrones/PatronesList.tsx"
---

<objective>
Implement BOM-06: visibility of BOM state across PatronesList (badges + filter) and PatronEditorPage (alert banner). All driven by pure helpers from `@ags/shared/utils/patronBom`.

Pre-extraction is mandatory: PatronesList.tsx at 330 LOC and PatronEditorPage at 334 LOC are both over the 250-LOC component budget. This plan EXTRACTS PatronRow + PatronComponentesAlertBanner before adding new code.

**Wave sequencing note:** This plan and 14-04 both touch `PatronEditorPage.tsx` (shared file). `depends_on: [01, 04]` forces 14-05 to run AFTER 14-04 — since 14-04 is wave 4, this plan resolves to wave 5. Parallel-safe with 14-07 (different app: reportes-ot).

Output:
- New `PatronRow.tsx` extracted from PatronesList rendering
- New `PatronComponentesAlertBanner.tsx` for the editor alert
- Updated `PatronesList.tsx` consuming PatronRow + new `bloqueados` filter via useUrlFilters
- Updated `PatronEditorPage.tsx` rendering the alert banner

Autonomous: false — ends with visual UAT checkpoint.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@apps/sistema-modular/src/pages/patrones/PatronesList.tsx
@apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx
@apps/sistema-modular/src/hooks/useUrlFilters.ts
@apps/sistema-modular/src/hooks/usePatrones.ts
@packages/shared/src/utils/patronBom.ts
@.claude/skills/list-page-conventions/SKILL.md

<interfaces>
useUrlFilters is schema-based per STATE.md line 321: `const [filters, setFilter, setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA)`. Schema fields use `{ type: 'string'|'boolean'|'number', default: ... }`.

From packages/shared/src/utils/patronBom.ts (landed in 14-01):
- `computePatronStatus(patron) returns 'active' | 'bloqueado' | 'agotado'`
- `computeLoteStatus(patron, lote)`
- `computeSaldoComponente(patron, lote, codigoComponente)`

Editorial Teal pill classes:
- BOM: `bg-teal-100 text-teal-800 border border-teal-200`
- BLOQUEADO: `bg-rose-100 text-rose-800 border border-rose-200`
- AGOTADO: `bg-rose-200 text-rose-900 border border-rose-300`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract PatronRow.tsx + add BOM and BLOQUEADO badges</name>
  <files>apps/sistema-modular/src/pages/patrones/PatronRow.tsx, apps/sistema-modular/src/pages/patrones/PatronesList.tsx</files>
  <action>
1. Read apps/sistema-modular/src/pages/patrones/PatronesList.tsx in full. Identify the JSX block that renders ONE row (inside the `.map(patron => ...)` block). That block is the extraction target.

2. Create apps/sistema-modular/src/pages/patrones/PatronRow.tsx with the row JSX extracted from PatronesList. Add an extra column (or extend the existing first column) with the badges:
   - Show "BOM" pill (teal-100/teal-800) when `(patron.componentes ?? []).length > 0`
   - Show "BLOQUEADO" pill (rose-100/rose-800) when `computePatronStatus(patron) === 'bloqueado'`
   - Show "AGOTADO" pill (rose-200/rose-900) when `computePatronStatus(patron) === 'agotado'`
   Use `text-[10px] font-mono uppercase tracking-wide`.
   Import `computePatronStatus` from `@ags/shared/utils/patronBom`.
   Preserve all existing columns and click behaviors of the original row JSX.
   Keep this file under 120 LOC.

3. Update PatronesList.tsx: replace the inline row JSX with `<PatronRow patron={p} ... />`. Import the new component.

4. Confirm LOC reduction: PatronesList.tsx should now be smaller; PatronRow.tsx ≤ 120 LOC.
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>PatronRow.tsx exists, exports a typed row component with badges driven by computePatronStatus, type-check passes; PatronesList.tsx imports it and the original row JSX is removed.</done>
</task>

<task type="auto">
  <name>Task 2: Add bloqueados filter to PatronesList via useUrlFilters schema</name>
  <files>apps/sistema-modular/src/pages/patrones/PatronesList.tsx</files>
  <action>
1. Locate the existing `useUrlFilters(...)` call (or the FILTER_SCHEMA constant) in PatronesList.tsx. If the file uses useState for filters (it should NOT per convention, but check) — migrate to useUrlFilters with the schema pattern.

2. Extend the FILTER_SCHEMA constant to include a boolean field:
   - Key: `bloqueados`
   - `{ type: 'boolean', default: false }`

3. In the filter rendering area (toolbar/topbar of the list), add a checkbox or toggle labeled "Bloqueados" wired to `filters.bloqueados` / `setFilter('bloqueados', v)`. Use the same atom and style as the other filter inputs already in the page.

4. In the filtering logic (the `.filter(...)` step applied to the patrones array before mapping), add:
   ```typescript
   const matchBloqueados = filters.bloqueados
     ? (() => { const s = computePatronStatus(p); return s === 'bloqueado' || s === 'agotado'; })()
     : true;
   ```
   And include `matchBloqueados &&` in the existing AND chain of conditions.

5. Persist verification: changing the filter updates the URL query string (e.g., `?bloqueados=true`); refreshing the page preserves the filter.
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>Filter "Bloqueados" rendered in PatronesList; schema-based useUrlFilters extended with the boolean field; filter wired into the patrones filtering logic; URL persistence confirmed by tests via type-check passing (visual UAT covers runtime).</done>
</task>

<task type="auto">
  <name>Task 3: Create PatronComponentesAlertBanner.tsx + wire into PatronEditorPage</name>
  <files>apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx, apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx</files>
  <action>
1. Create apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx:
   - Props: `{ patron: Patron }`
   - Compute the list of `(lote, componente)` pairs where `computeSaldoComponente(patron, lote, comp.codigoComponente) <= (comp.stockMinimo ?? 0)`
   - Compute `computeLoteStatus(patron, lote)` for each problematic lote
   - If the list is empty, return null (no alert)
   - Otherwise render an inline alert: rose background, rose border, list of "Lote {lote.lote} · componente {codigoComponente}: saldo {saldo} (mínimo {minimo})" entries
   - Header uses font-mono uppercase tracking-wide text-rose-700; body text uses text-sm text-rose-900
   - Keep this file ≤ 80 LOC

2. Update apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx: import the new component and render it ABOVE the "Lotes" section header (so the alert is the first thing the admin sees when opening a problematic patron). Note: this file was already modified by plan 14-04 (PatronComponentesEditor wiring); your edits MUST coexist — re-read the file first to see current state, then add the import + render at the correct location.
   ```tsx
   import { PatronComponentesAlertBanner } from './PatronComponentesAlertBanner';
   ...
   {patron && <PatronComponentesAlertBanner patron={patron} />}
   {/* existing Lotes section */}
   ```
   The banner self-hides when there are no problems, so unconditional rendering is fine.
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>PatronComponentesAlertBanner.tsx exists; renders only when problematic lotes exist; wired into PatronEditorPage above the Lotes section; type-check passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Visual smoke of badges + filter + alert banner</name>
  <what-built>BOM-06 visual surface: badges on PatronesList rows, "Bloqueados" filter persisted in URL, alert banner on PatronEditorPage for problematic lotes.</what-built>
  <how-to-verify>
1. `pnpm dev:modular`. Open `/patrones`.
2. Identify a patron that you loaded with componentes in plan 14-04 (or load one now). Verify:
   - The row shows the "BOM" pill (teal).
   - If the lote has no consumos yet, no "BLOQUEADO" badge appears.
3. Manually edit (via Firestore dev console) the patron's first lote to add `componentesConsumidos: [{ codigoComponente: '<first componente>', cantidadConsumida: <enough to deplete> }]`. Refresh `/patrones`. Verify:
   - The row now shows "BLOQUEADO" (rose).
4. Click the "Bloqueados" filter checkbox. Verify:
   - The URL gains `?bloqueados=true` (or similar).
   - The list filters to only show the affected patron(s).
   - Refreshing the page preserves the filter.
5. Open the affected patron's editor. Verify:
   - The alert banner appears at the top of the Lotes section, listing the lote + componente + saldo + minimo.
   - When you undo the consumed amount, the banner disappears on next reload.
6. Confirm: BOM patron without bloqueo (componentes loaded, no consumos) shows only "BOM" badge, NOT "BLOQUEADO".
7. Confirm: legacy patron (no componentes loaded) shows neither badge.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (badge color, filter persistence, banner placement).</resume-signal>
</task>

</tasks>

<verification>
- `pnpm type-check` GREEN
- `pnpm --filter @ags/sistema-modular test:patron-bom` still 14/14 GREEN
- Visual UAT approved (badges visible, filter persists, banner self-hides)
- LOC check: PatronesList.tsx not larger than before; PatronRow.tsx ≤ 120; PatronComponentesAlertBanner.tsx ≤ 80
</verification>

<success_criteria>
A user landing on `/patrones` can immediately spot which patrones have BOM declared and which have bloqueado lotes, filter to only the problematic ones via URL-persisted toggle, and drill into a problematic patron to see exactly which (lote, componente) needs reposición.
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-05-SUMMARY.md` documenting:
- LOC of all new/modified files
- Confirmation that PatronesList LOC did not grow despite added functionality (thanks to PatronRow extraction)
- URL pattern for the new filter (`?bloqueados=true`)
- Note for 14-07 (reportes-ot exception): the same helper `computeLoteStatus` is what drives the badge/disable in the technician selector — the contract is identical
</output>
