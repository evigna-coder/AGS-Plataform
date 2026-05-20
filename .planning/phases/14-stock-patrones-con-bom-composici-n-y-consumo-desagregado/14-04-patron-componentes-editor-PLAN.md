---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 04
type: execute
wave: 4
depends_on: [01, 02, 03]
files_modified:
  - apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx
  - apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx
  - apps/sistema-modular/src/services/patronesService.ts
  - apps/sistema-modular/src/__tests__/patronBom.test.ts
autonomous: false
requirements: [BOM-04]
must_haves:
  truths:
    - PatronEditorPage renders a new 'Componentes (BOM)' section that lets user add/edit/remove componentes with inline inputs (codigoComponente, descripcion, cantidadPorKit, unidadMedida, stockMinimo)
    - "Patron is persisted with `componentes?: ComponentePatron[]` via existing patronesService.update (deepCleanForFirestore)"
    - PatronComponentesEditor.tsx is extracted as a NEW file (sub-component) to keep PatronEditorPage under control — research notes it was already at 334 LOC; this plan must NOT push it higher
    - "UI guard (depth 1): rename of an existing codigoComponente is REJECTED in the editor (disabled input + lock icon) if any lote.componentesConsumidos still references it (RESEARCH pitfall 1)"
    - "Service guard (depth 2 — defense-in-depth per RESEARCH pitfall 1 'bloqueo duro es preferible a migración silenciosa'): patronesService.update THROWS if any incoming componentes[i].codigoComponente would orphan an existing componentesConsumidos[].codigoComponente on any lote of that patron"
    - "Guard: duplicate lote codes within the same patron are REJECTED (RESEARCH pitfall 3)"
    - "Editorial Teal applied: JetBrains Mono uppercase labels with text-[10px] tracking-wide; Newsreader serif for section header; primary buttons teal-700"
    - Legacy patron (componentes=[]) renders the section as empty with prominent '+ Agregar componente' CTA — does not break existing patrón viewing
    - "Unit test in patronBom.test.ts covers the service-layer throw (new test: rename of codigoComponente with active consumos → patronesService.update throws)"
  artifacts:
    - "path: "apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx"
    - "path: "apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx"
    - "path: "apps/sistema-modular/src/services/patronesService.ts"
  key_links:
    - "from: "apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx"
    - "from: "apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx"
    - "from: "apps/sistema-modular/src/services/patronesService.ts"
---

<objective>
Implement BOM-04: editable "Componentes (BOM)" section in `PatronEditorPage`, extracted into a NEW sub-component file `PatronComponentesEditor.tsx` to respect the 250-LOC component budget (`PatronEditorPage` is already at 334 LOC per RESEARCH — extraction is mandatory).

Defense-in-depth on the rename guard (RESEARCH pitfall 1 — "bloqueo duro es preferible a migración silenciosa"): the UI disables the input on locked codigos AND the service rejects rename attempts that would orphan existing componentesConsumidos. UI guard is the friendly fence; service guard is the load-bearing one.

Purpose: Give the user the ability to load BOM declaratively per patron. Caso simple (3 ampollas iguales) = 1 componente cantidadPorKit=3. Caso complejo (UV KIT 8 ampollas) = 8 componentes cantidadPorKit=1. Backwards-compat: existing patrones quedan con `componentes = []` y siguen funcionando.

Output:
- New `PatronComponentesEditor.tsx` (sub-component, ≤ 200 LOC)
- `PatronEditorPage.tsx` modified to import and render the new section + wire persistence
- `patronesService.update` hardened with defense-in-depth rename guard
- New unit test covering the service-layer throw
- Editorial Teal styling (JetBrains Mono uppercase labels, Newsreader header)
- Guards enforced (UI rename disable + service throw if consumos exist; duplicate code rejection)

This plan has `autonomous: false` because it ends with a `checkpoint:human-verify` for visual UI confirmation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@.planning/STATE.md
@apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx
@apps/sistema-modular/src/components/ui/Button.tsx
@apps/sistema-modular/src/components/ui/Input.tsx
@apps/sistema-modular/src/components/ui/Card.tsx
@apps/sistema-modular/src/services/patronesService.ts
@apps/sistema-modular/src/components/presupuestos/contrato/ServiciosEditor.tsx
@apps/sistema-modular/src/__tests__/patronBom.test.ts
@apps/sistema-modular/src/__tests__/fixtures/patronBom.ts
@packages/shared/src/types/index.ts

<interfaces>
<!-- Atoms available — confirmed in apps/sistema-modular/src/components/ui/ -->

From components/ui/Button.tsx:
```tsx
export function Button({ variant?: 'primary'|'secondary'|'ghost'|'danger', size?, onClick, children, disabled }: ButtonProps): JSX.Element;
```

From components/ui/Input.tsx:
```tsx
export function Input({ label?, value, onChange, type?, placeholder?, error?, helperText?, className? }: InputProps): JSX.Element;
```

From components/ui/Card.tsx:
```tsx
export function Card({ children, className?, title? }: CardProps): JSX.Element;
```

From packages/shared (added in 14-01):
```typescript
export interface ComponentePatron {
  codigoComponente: string;
  descripcion: string;
  cantidadPorKit: number;
  unidadMedida: string;
  stockMinimo?: number | null;
}
```

From patronesService (existing — pre-14-02 CRUD):
```typescript
export const patronesService = {
  async update(id: string, patch: Partial<Patron>): Promise<void>,  // already deepCleanForFirestore-wraps
  // ... etc
};
```

From apps/sistema-modular/src/__tests__/fixtures/patronBom.ts (Wave 0 — fixture path is under `src/__tests__/`, NOT `src/services/__tests__/`):
```typescript
export interface MockPatronBomState { patrones: Map<string, any>; movimientos: Map<string, any>; ... }
export const buildState: (overrides?) => MockPatronBomState;
```

Pattern reference — Editorial Teal labels (from sistema-modular convention):
```tsx
const fieldLabel = "block uppercase tracking-wide text-[10px] font-mono text-slate-600 mb-1";
```

Pattern reference — ServiciosEditor (apps/sistema-modular/src/components/presupuestos/contrato/ServiciosEditor.tsx): table-based inline editor with add/remove rows. THIS plan should mirror its structure (table with rows, "+/x" inline buttons).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create PatronComponentesEditor.tsx sub-component (extracted from PatronEditorPage)</name>
  <files>apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx</files>
  <behavior>
- Component receives `componentes: ComponentePatron[]`, `onChange(next: ComponentePatron[])`, and `lockedCodigos: Set<string>` (codigos that cannot be renamed because lotes have consumos referencing them).
- Renders header "COMPONENTES (BOM)" in uppercase JetBrains Mono `text-[10px] tracking-wide`.
- Empty state: helpful copy "Sin componentes declarados. Este patrón funciona como kit entero (sin desagregación). Agregá componentes para activar el BOM." + "+ Agregar componente" CTA.
- Each row: codigoComponente (Input, type=text), descripcion (Input, text), cantidadPorKit (Input, type=number, min=1), unidadMedida (Input, text, placeholder="ampolla"), stockMinimo (Input, type=number, min=0), trash button on the right.
- When `lockedCodigos.has(row.codigoComponente)`, the codigoComponente input renders as readonly + a small lock icon + tooltip "Este componente ya tiene consumos registrados; no se puede renombrar".
- onChange propagates the entire new array (parent owns the source of truth).
- Inline validation per row: cantidadPorKit must be > 0; stockMinimo must be >= 0; codigoComponente must not be empty when descripcion is non-empty (visual hint, not blocker — parent does final validation on save).
  </behavior>
  <action>
1. Create apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx. Pattern: take ServiciosEditor.tsx as reference for the inline-table structure; adapt to the simpler ComponentePatron shape.

2. Skeleton:
   ```tsx
   import { useCallback, useMemo } from 'react';
   import type { ComponentePatron } from '@ags/shared';
   import { Button } from '../../components/ui/Button';
   import { Input } from '../../components/ui/Input';

   const labelCls = "block uppercase tracking-wide text-[10px] font-mono text-slate-600 mb-1";

   export interface PatronComponentesEditorProps {
     componentes: ComponentePatron[];
     onChange: (next: ComponentePatron[]) => void;
     /** Codigos que no se pueden renombrar (tienen consumos previos en lotes) */
     lockedCodigos?: Set<string>;
     disabled?: boolean;
   }

   export function PatronComponentesEditor({ componentes, onChange, lockedCodigos, disabled }: PatronComponentesEditorProps) {
     const locked = lockedCodigos ?? new Set<string>();

     const updateRow = useCallback((idx: number, patch: Partial<ComponentePatron>) => {
       const next = componentes.map((c, i) => i === idx ? { ...c, ...patch } : c);
       onChange(next);
     }, [componentes, onChange]);

     const addRow = useCallback(() => {
       onChange([...componentes, { codigoComponente: '', descripcion: '', cantidadPorKit: 1, unidadMedida: 'ampolla', stockMinimo: 0 }]);
     }, [componentes, onChange]);

     const removeRow = useCallback((idx: number) => {
       const target = componentes[idx];
       if (locked.has(target.codigoComponente)) {
         alert(`No se puede eliminar el componente "${target.codigoComponente}" porque tiene consumos registrados en lotes.`);
         return;
       }
       onChange(componentes.filter((_, i) => i !== idx));
     }, [componentes, onChange, locked]);

     return (
       <section className="border-t border-slate-200 pt-6 mt-6">
         <div className="flex items-baseline justify-between mb-4">
           <h2 className="font-serif text-xl text-slate-900">Componentes (BOM)</h2>
           <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
             {componentes.length} componente{componentes.length === 1 ? '' : 's'}
           </span>
         </div>

         {componentes.length === 0 ? (
           <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
             Sin componentes declarados. Este patrón funciona como kit entero (sin desagregación).
             Agregá componentes para activar el BOM (caso típico: ampollas dentro de un kit).
             <div className="mt-3">
               <Button variant="secondary" onClick={addRow} disabled={disabled}>+ Agregar componente</Button>
             </div>
           </div>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
               <thead>
                 <tr className="text-left text-[10px] font-mono uppercase tracking-wide text-slate-600 border-b border-slate-200">
                   <th className="py-2 pr-3">Código</th>
                   <th className="py-2 pr-3">Descripción</th>
                   <th className="py-2 pr-3">Cantidad por kit</th>
                   <th className="py-2 pr-3">Unidad</th>
                   <th className="py-2 pr-3">Stock mínimo</th>
                   <th className="py-2 w-10"></th>
                 </tr>
               </thead>
               <tbody>
                 {componentes.map((c, idx) => {
                   const isLocked = c.codigoComponente && locked.has(c.codigoComponente);
                   return (
                     <tr key={idx} className="border-b border-slate-100 align-top">
                       <td className="py-2 pr-3">
                         <Input
                           value={c.codigoComponente}
                           onChange={e => updateRow(idx, { codigoComponente: e.target.value })}
                           placeholder="amp-A"
                           disabled={disabled || isLocked}
                           helperText={isLocked ? '🔒 Con consumos previos' : undefined}
                         />
                       </td>
                       <td className="py-2 pr-3">
                         <Input
                           value={c.descripcion}
                           onChange={e => updateRow(idx, { descripcion: e.target.value })}
                           placeholder="Ampolla cafeína"
                           disabled={disabled}
                         />
                       </td>
                       <td className="py-2 pr-3">
                         <Input
                           type="number"
                           value={String(c.cantidadPorKit)}
                           onChange={e => updateRow(idx, { cantidadPorKit: Number(e.target.value) || 1 })}
                           disabled={disabled}
                           className="w-24"
                         />
                       </td>
                       <td className="py-2 pr-3">
                         <Input
                           value={c.unidadMedida}
                           onChange={e => updateRow(idx, { unidadMedida: e.target.value })}
                           placeholder="ampolla"
                           disabled={disabled}
                         />
                       </td>
                       <td className="py-2 pr-3">
                         <Input
                           type="number"
                           value={String(c.stockMinimo ?? 0)}
                           onChange={e => updateRow(idx, { stockMinimo: Number(e.target.value) || 0 })}
                           disabled={disabled}
                           className="w-24"
                         />
                       </td>
                       <td className="py-2">
                         <button
                           type="button"
                           onClick={() => removeRow(idx)}
                           disabled={disabled}
                           className="text-rose-600 hover:text-rose-800 disabled:opacity-30"
                           aria-label="Eliminar componente"
                         >×</button>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
             <div className="mt-3">
               <Button variant="secondary" onClick={addRow} disabled={disabled}>+ Agregar componente</Button>
             </div>
           </div>
         )}
       </section>
     );
   }
   ```

3. Confirm file is ≤ 200 LOC (budget guard).
  </action>
  <verify>
    <automated>cd apps/sistema-modular &amp;&amp; pnpm type-check &amp;&amp; node -e "const fs=require('fs'); const c=fs.readFileSync('src/pages/patrones/PatronComponentesEditor.tsx','utf8'); const lines=c.split('\\n').length; if(lines > 220) { console.error('LOC over budget:', lines); process.exit(1);} console.log('LOC ok:', lines);"</automated>
  </verify>
  <done>PatronComponentesEditor.tsx exists, exports a typed component, ≤ 220 LOC, passes type-check.</done>
</task>

<task type="auto">
  <name>Task 2: Wire PatronComponentesEditor into PatronEditorPage + persistence + lockedCodigos derivation</name>
  <files>apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx</files>
  <action>
1. Read apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx in full. Note its current state shape: probably uses `useState<Patron | null>` and a save handler that calls `patronesService.update(id, patch)`.

2. Import the new sub-component at the top:
   ```tsx
   import { PatronComponentesEditor } from './PatronComponentesEditor';
   import type { ComponentePatron } from '@ags/shared';
   ```

3. Derive `lockedCodigos` from the current patron's lotes' componentesConsumidos:
   ```tsx
   const lockedCodigos = useMemo(() => {
     const s = new Set<string>();
     for (const lote of patron?.lotes ?? []) {
       for (const cc of lote.componentesConsumidos ?? []) {
         s.add(cc.codigoComponente);
       }
     }
     return s;
   }, [patron]);
   ```

4. Render the section. Place it AFTER the "Lotes" card (or wherever the existing "Lotes" section ends — pick the natural position; if the file has tabbed sections, place it as a new tab/card adjacent to Lotes):
   ```tsx
   <PatronComponentesEditor
     componentes={patron?.componentes ?? []}
     onChange={next => setPatron(prev => prev ? { ...prev, componentes: next } : prev)}
     lockedCodigos={lockedCodigos}
     disabled={isSaving}
   />
   ```

5. In the existing save handler, ensure `componentes` is included in the patch sent to `patronesService.update`. Pre-save validation (block save with toast/alert):
   ```tsx
   // Validation (BOM-04 guards from RESEARCH pitfalls 1 + 3)
   const codigos = (patron.componentes ?? []).map(c => c.codigoComponente.trim());
   const duplicateCodigos = codigos.filter((v, i, a) => v && a.indexOf(v) !== i);
   if (duplicateCodigos.length > 0) {
     alert(`Códigos de componente duplicados: ${[...new Set(duplicateCodigos)].join(', ')}. Cada código debe ser único dentro del patrón.`);
     return;
   }
   const emptyCodigosWithDesc = (patron.componentes ?? []).some(c => !c.codigoComponente.trim() && c.descripcion.trim());
   if (emptyCodigosWithDesc) {
     alert('Hay filas con descripción pero sin código. Completá el código o eliminá la fila.');
     return;
   }
   ```
   Note: the lockedCodigos rename guard is enforced at the sub-component level by disabling the input. Defense-in-depth lives in the service (Task 3 below) — if the UI ever fails open, the service will still throw.

6. Run `pnpm type-check` from root.

7. Inspect line count of PatronEditorPage.tsx. RESEARCH says it was already 334 LOC. Goal: keep it from growing further. If the imports + the new section + the validation block push it over ~360, extract a custom hook `usePatronComponentesValidation` to keep size bounded. Document the LOC delta in SUMMARY.
  </action>
  <verify>
    <automated>pnpm type-check &amp;&amp; cd apps/sistema-modular &amp;&amp; node -e "const fs=require('fs'); const c=fs.readFileSync('src/pages/patrones/PatronEditorPage.tsx','utf8'); const lines=c.split('\\n').length; console.log('PatronEditorPage LOC:', lines); if(lines > 380) { console.warn('WARN: PatronEditorPage over soft budget; consider extracting more.'); }"</automated>
  </verify>
  <done>PatronComponentesEditor rendered in PatronEditorPage; componentes persisted via patronesService.update; type-check passes; PatronEditorPage LOC ≤ 380 (informational warn allowed).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Defense-in-depth — service-layer guard in patronesService.update against orphaning componentesConsumidos</name>
  <files>apps/sistema-modular/src/services/patronesService.ts, apps/sistema-modular/src/__tests__/patronBom.test.ts</files>
  <behavior>
- New test case (test 15 in patronBom.test.ts): given a patron with `lotes[0].componentesConsumidos = [{codigoComponente:'amp-A', cantidadConsumida:1}]`, calling `patronesService.update(id, { componentes: [{codigoComponente:'amp-B', ...}] })` THROWS `Error` whose message contains `huérfano` and the orphaned code `amp-A`.
- Same patch where `componentes` still includes `amp-A` (even with reordered or extra entries) does NOT throw.
- Patch where `componentes` is undefined (only updating other fields like `descripcion`) does NOT trigger the guard.
- Patch where the patron has NO lote consumos (componentesConsumidos empty/absent) does NOT trigger the guard — rename is free.
- Use the existing `__setTestFirestore` DI hook from 14-02 to inject the MockPatronBomState. No new fixture file required — extend the existing `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` with a `patronConConsumos` helper if convenient.
  </behavior>
  <action>
1. Read apps/sistema-modular/src/services/patronesService.ts. Locate the existing `update(id, patch)` method (post-14-02).

2. Add a pre-update guard at the start of `update`. The guard runs ONLY when `patch.componentes` is provided (so unrelated patches like `{ descripcion: '...' }` are not penalized):
   ```typescript
   // Phase 14 BOM-04 — defense-in-depth: reject rename/removal that would orphan componentesConsumidos
   if (patch.componentes !== undefined) {
     const incomingCodigos = new Set((patch.componentes ?? []).map(c => c.codigoComponente.trim()).filter(Boolean));
     // Read current patron to inspect lote consumos
     const currentPatron = await _readPatronForGuard(id);   // tx-aware via testState, see step 4
     const huerfanos = new Set<string>();
     for (const lote of currentPatron?.lotes ?? []) {
       for (const cc of lote.componentesConsumidos ?? []) {
         if (!incomingCodigos.has(cc.codigoComponente)) {
           huerfanos.add(cc.codigoComponente);
         }
       }
     }
     if (huerfanos.size > 0) {
       throw new Error(
         `No se puede actualizar el patrón: los siguientes componentes tienen consumos previos en lotes y quedarían huérfanos si se renombran o eliminan: ${[...huerfanos].join(', ')}`,
       );
     }
   }
   ```

3. Implement `_readPatronForGuard(id)` as a small private helper that dispatches on `testState` (mirrors the 14-02 `_runInTest` / `_runInProd` split):
   ```typescript
   async function _readPatronForGuard(id: string): Promise<Patron | null> {
     if (testState) {
       return (testState.patrones.get(id) as Patron) ?? null;
     }
     const snap = await getDoc(doc(db, 'patrones', id));
     return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Patron) : null;
   }
   ```
   (Add `getDoc` to the firebase/firestore import line if not already present.)

4. Add the new test to apps/sistema-modular/src/__tests__/patronBom.test.ts (append at the end of the file, before any final exports). Import shape:
   ```typescript
   import { patronesService } from '../services/patronesService';
   // (__setTestFirestore already imported from 14-00)
   ```
   Test body (4 cases per `<behavior>`):
   ```typescript
   test('BOM-04 service guard: rename of consumed componente throws', async () => {
     const state = buildState();
     state.patrones.set('P-X', {
       id: 'P-X', codigoArticulo: 'X', descripcion: 'X',
       componentes: [{ codigoComponente: 'amp-A', descripcion: 'A', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 }],
       lotes: [{ lote: 'L1', cantidad: 1, fechaVencimiento: '2027-01-01',
         componentesConsumidos: [{ codigoComponente: 'amp-A', cantidadConsumida: 1 }] }],
       activo: true,
     });
     __setTestFirestore(state);
     await assert.rejects(
       () => patronesService.update('P-X', { componentes: [{ codigoComponente: 'amp-B', descripcion: 'B', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 }] }),
       /huérfano.*amp-A/,
     );
   });

   test('BOM-04 service guard: keeping all consumed codigos does NOT throw', async () => {
     /* setup as above */
     /* update with componentes that still includes amp-A (perhaps + amp-B added) → no throw */
   });

   test('BOM-04 service guard: patches WITHOUT componentes key do NOT trigger guard', async () => {
     /* update with { descripcion: 'nuevo' } only → no throw, no read of consumos required to throw */
   });

   test('BOM-04 service guard: patron with no consumos allows free rename', async () => {
     /* patron has empty componentesConsumidos → rename amp-A → amp-B does NOT throw */
   });
   ```
   Always call `__setTestFirestore(null)` at the end of the test (or in afterEach) so the next test starts clean.

5. Run `pnpm --filter @ags/sistema-modular test:patron-bom`. Expected: 18 tests pass (14 from Wave 0 already GREEN after 14-01/14-02/14-03 + 4 new from this task).
  </action>
  <verify>
    <automated>cd apps/sistema-modular &amp;&amp; pnpm test:patron-bom 2>&amp;1 | tail -30</automated>
  </verify>
  <done>patronesService.update throws when componentes patch would orphan existing consumos; 4 new tests GREEN; full test suite still 18/18 GREEN; existing tests not regressed.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Visual smoke of "Componentes (BOM)" editor + service guard regression</name>
  <what-built>BOM-04 editor in PatronEditorPage with extracted sub-component, Editorial Teal styling, add/remove/edit, UI + service guards on rename and duplicate codigos.</what-built>
  <how-to-verify>
1. `pnpm dev:modular` in repo root. Wait for Vite dev server.
2. Open browser at `http://localhost:5173/patrones` (or whatever port Vite picks). Sign in if required.
3. Open an EXISTING patron (e.g., one without componentes). Verify:
   - The new section "Componentes (BOM)" appears below Lotes.
   - Empty state copy is shown with the "+ Agregar componente" CTA.
4. Click "+ Agregar componente". A row appears. Fill in: código `amp-A`, descripción `Ampolla cafeína`, cantidadPorKit `3`, unidad `ampolla`, stockMínimo `1`. Save the patron.
5. Reload the page. Verify the componente persisted (open the patron again — row should be present with the same values).
6. Add a SECOND componente with the same código `amp-A`. Try to save. Verify: alert blocks the save with the message about duplicate codes.
7. Change the second row's código to `amp-B`. Save. Reload — both componentes present.
8. (UI locked guard) Manually edit a Firestore doc (via dev console) to add `componentesConsumidos: [{ codigoComponente: 'amp-A', cantidadConsumida: 1 }]` to one of the lotes. Reload the page. Verify:
   - Row `amp-A` shows the lock icon and the código input is disabled.
   - Trying to delete `amp-A` produces an alert.
9. (Service guard — bypass UI) In dev console (browser DevTools), run:
   ```js
   import('/src/services/patronesService.ts').then(m => m.patronesService.update('<patron-id>', { componentes: [{ codigoComponente: 'amp-Z', descripcion: 'Z', cantidadPorKit: 1, unidadMedida: 'amp', stockMinimo: 0 }] }))
     .then(() => console.log('UNEXPECTED success'))
     .catch(e => console.log('GOOD — service rejected:', e.message));
   ```
   Verify: console prints `GOOD — service rejected: ...huérfano...amp-A...`.
10. Style check: section header is Newsreader serif; labels are JetBrains Mono uppercase tiny; primary button (+ Agregar) is teal-700.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (specific copy, styling, broken validations, service guard not firing).</resume-signal>
</task>

</tasks>

<verification>
- `pnpm type-check` GREEN
- `pnpm --filter @ags/sistema-modular test:patron-bom` now 18/18 GREEN (14 from Wave 0 + 4 new for service guard)
- Visual UAT checkpoint approved (incl. service-bypass test step 9)
- No `check-component-size` hook warning on PatronComponentesEditor (≤ 220 LOC); soft warn on PatronEditorPage acceptable if ≤ 380 LOC
</verification>

<success_criteria>
The user can declaratively load BOM into any patron via UI. Caso simple (3 ampollas iguales) — 1 row with cantidadPorKit=3 — works. Caso complejo (UV KIT 8 ampollas) — 8 rows with cantidadPorKit=1 — works. Guards prevent both pitfall 1 (rename of consumed componente — UI + service) and pitfall 3 spillover (duplicate codes — UI).
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-04-SUMMARY.md` documenting:
- LOC of PatronComponentesEditor.tsx
- LOC delta of PatronEditorPage.tsx (before → after)
- LOC delta of patronesService.ts (Task 3 guard adds ~20 lines)
- Decision recorded: lockedCodigos derived from componentesConsumidos in real time (no cache); rename UX is disabled-input with lock icon; defense-in-depth service guard catches bypass attempts
- Sample patron loaded for manual smoke (id + descripción)
- Heads-up for 14-06 (cierre admin step): consumirComponentes will create componentesConsumidos entries that drive lockedCodigos on subsequent edits AND will be the source the new service guard reads to reject rename
</output>
