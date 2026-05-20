---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 07
type: execute
wave: 5
depends_on:
  - 01
  - 02
  - 03
  - 06
files_modified: [apps/reportes-ot/components/InstrumentoSelectorPanel.tsx]
autonomous: false
requirements: [BOM-07]
must_haves:
  truths:
    - InstrumentoSelectorPanel.tsx (tab 'Patrones' block) renders 'AGOTADO' badge on lotes where computeLoteStatus(patron, lote) is 'agotado' or 'bloqueado'
    - Affected lote checkbox is disabled (cannot be selected by the technician)
    - "Change is SCOPED: only the patrones tab section; no edits to ProtocolSection, hojas, html2canvas, html2pdf, pdf-lib merge, firma del protocolo, or any other component"
    - "Import added: computeLoteStatus from @ags/shared/utils/patronBom (the shared utils package — same module sistema-modular consumes)"
    - Hook guard-reportes-ot.js must be bypassed for this task ONLY via env var CLAUDE_ALLOW_REPORTES_OT=1; the executor MUST export it before running file edits
    - No refactor of InstrumentoSelectorPanel.tsx (already at 619 LOC, but in-scope is just this acotada insertion — DO NOT touch other code in the file)
    - PDF generation pipeline is verified intact via visual UAT (technician generates a PDF before and after; diff should be visually identical)
  artifacts:
    - "path: "apps/reportes-ot/components/InstrumentoSelectorPanel.tsx"
  key_links:
    - "from: "apps/reportes-ot/components/InstrumentoSelectorPanel.tsx"
---

<objective>
Implement BOM-07: the SINGLE authorized exception to the frozen-surface rule for `apps/reportes-ot/`. Add a visual "AGOTADO" badge and disable selection for lotes that `computeLoteStatus` reports as `'agotado'` or `'bloqueado'`. The technician should not be able to start a protocol with a depleted kit.

Scope is INTENTIONALLY MINIMAL: this is a frozen surface; the change is gated by the hook `guard-reportes-ot.js`. The executor MUST set `CLAUDE_ALLOW_REPORTES_OT=1` in the environment before invoking the file edit tools, and MUST limit edits to the patrones-tab block (~lines 144-249 per RESEARCH). No other files in `apps/reportes-ot/` are touched; the PDF pipeline is untouched.

Output:
- `InstrumentoSelectorPanel.tsx` patrones tab now imports `computeLoteStatus` and uses it to:
  - Render an `AGOTADO` pill (rose) next to the lote line when status is `bloqueado` or `agotado`
  - Disable the lote selection checkbox in that case
- Visual smoke confirms: PDF generation works unchanged (regression check)
- Visual smoke confirms: bloqueado lote shows badge + cannot be selected
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@.claude/rules/reportes-ot.md
@.claude/hooks/guard-reportes-ot.js
@apps/reportes-ot/components/InstrumentoSelectorPanel.tsx
@packages/shared/src/utils/patronBom.ts

<interfaces>
From packages/shared/src/utils/patronBom.ts (14-01):
```typescript
export function computeLoteStatus(patron: Patron, lote: PatronLote): 'active' | 'bloqueado' | 'agotado';
```

From apps/reportes-ot/components/InstrumentoSelectorPanel.tsx (per RESEARCH source map):
- Total LOC: 619
- Patrones tab section: lines ~144-249
- The patrones tab iterates `availablePatrones` and for each patron iterates `patron.lotes`, rendering a checkbox per lote with key `${patronId}__${loteIdx}`
- The checkbox checked-state lives in `checkedPatronesKeys: Set<string>` (or similar)

DO NOT MODIFY:
- Pipeline PDF (`ProtocolSection`, hojas, html2canvas, html2pdf, pdf-lib merge)
- Other components UI outside the patrones tab
- `hooks/useReportForm.ts` (`patronesSeleccionados` write path)
- `services/firebaseService.ts`
- ANY other file in `apps/reportes-ot/`

The hook `.claude/hooks/guard-reportes-ot.js` reads `process.env.CLAUDE_ALLOW_REPORTES_OT`; if not `'1'`, blocks the edit. The executor must set this env BEFORE running Edit/Write tools.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add AGOTADO badge + disable bloqueado lote selection in InstrumentoSelectorPanel (frozen-exception authorized)</name>
  <files>apps/reportes-ot/components/InstrumentoSelectorPanel.tsx</files>
  <action>
1. **CRITICAL**: Before invoking any file-edit tool on `apps/reportes-ot/*`, the executor MUST set the environment variable `CLAUDE_ALLOW_REPORTES_OT=1`. In Claude's shell tool invocations, this means EVERY bash command that targets edits to this file should be prefixed with `CLAUDE_ALLOW_REPORTES_OT=1`. The hook `guard-reportes-ot.js` blocks otherwise.

   Example bash invocation pattern for any edit-tool that proxies to a shell:
   ```bash
   CLAUDE_ALLOW_REPORTES_OT=1 <command that triggers the edit>
   ```
   For the Edit/Write tools themselves, ensure the env is exported in the shell session running the agent. If the agent uses a different mechanism, the executor must verify that `process.env.CLAUDE_ALLOW_REPORTES_OT === '1'` is observed by the hook script before saving.

2. Read apps/reportes-ot/components/InstrumentoSelectorPanel.tsx in full. Locate:
   - The import block at the top
   - The patrones tab block (~lines 144-249 per RESEARCH; verify line numbers in the current file)
   - The lote-row JSX that renders each `patron.lotes[i]` with a checkbox

3. Add to the imports (top of file):
   ```typescript
   import { computeLoteStatus } from '@ags/shared/utils/patronBom';
   ```
   Verify that `@ags/shared/utils/patronBom` resolves from `apps/reportes-ot/` — the barrel was set up in 14-01. If the import doesn't resolve, fix by importing from the flat barrel: `import { computeLoteStatus } from '@ags/shared'` (whichever form works in the reportes-ot tsconfig setup).

4. Inside the lote-row JSX (per patron, per lote), compute the status and use it to:
   - Determine `disabled` flag for the checkbox
   - Conditionally render an `AGOTADO` pill next to the lote info

   Minimal-diff patch:
   ```tsx
   // BEFORE (approximate — read actual code first):
   {patron.lotes.map((lote, idx) => (
     <label key={`${patron.id}__${idx}`} className="...">
       <input type="checkbox" checked={checked.has(`${patron.id}__${idx}`)} onChange={...} />
       <span>{lote.lote}</span>
       {/* vencimiento, etc. */}
     </label>
   ))}

   // AFTER:
   {patron.lotes.map((lote, idx) => {
     const status = computeLoteStatus(patron, lote);
     const isBloqueado = status === 'bloqueado' || status === 'agotado';
     return (
       <label
         key={`${patron.id}__${idx}`}
         className={`... ${isBloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}
         title={isBloqueado ? 'Lote bloqueado: algún componente está bajo stock mínimo. Avisar a administración.' : undefined}
       >
         <input
           type="checkbox"
           checked={checked.has(`${patron.id}__${idx}`)}
           onChange={...}
           disabled={isBloqueado}
         />
         <span>{lote.lote}</span>
         {isBloqueado && (
           <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200">
             {status === 'agotado' ? 'AGOTADO' : 'BLOQUEADO'}
           </span>
         )}
         {/* preserve vencimiento, etc. */}
       </label>
     );
   })}
   ```
   The exact JSX form (label vs div, className) must match the existing pattern in the file. The KEY behavioral changes are: `disabled={isBloqueado}` on the checkbox and the conditional badge.

5. **DO NOT** touch any other code in the file. No imports beyond `computeLoteStatus`. No state changes. No refactor of the 619 LOC mass.

6. Run `pnpm type-check` from repo root to confirm the new import resolves and the JSX compiles.

7. Run `pnpm build:reportes` to confirm the reportes-ot app builds without errors (PDF pipeline regression smoke).
  </action>
  <verify>
    <automated>pnpm type-check &amp;&amp; pnpm build:reportes</automated>
  </verify>
  <done>The patrones tab in InstrumentoSelectorPanel now renders the AGOTADO/BLOQUEADO badge and disables the checkbox for bloqueado lotes; no other code in the file is touched (diff size ≤ ~15 lines + 1 import); `pnpm build:reportes` succeeds; hook `guard-reportes-ot.js` did NOT block the edit (env var was set).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Visual UAT on the technician PWA + PDF regression check</name>
  <what-built>BOM-07 frozen-surface exception: AGOTADO badge + disabled checkbox in the patrones tab of the technician selector.</what-built>
  <how-to-verify>
1. `pnpm dev:reportes` from repo root. Open the PWA URL (Vite picks the port).
2. Sign in. Open an OT from the technician PWA.
3. Navigate to the patrones tab of the `InstrumentoSelectorPanel`.
4. Identify a patron whose lote you bloqueaste in plan 14-06 UAT (saldo ≤ stockMinimo). Verify:
   - The lote row shows "AGOTADO" (or "BLOQUEADO") in a rose pill.
   - The checkbox is greyed out and clicking it does NOT toggle the state.
   - Hovering shows the tooltip "Lote bloqueado: algún componente está bajo stock mínimo. Avisar a administración."
5. Select a HEALTHY lote of a BOM-aware patron. Verify:
   - No badge appears.
   - Checkbox toggles normally.
   - `patronesSeleccionados` updates as expected (this confirms the OnChange wiring of the existing code wasn't broken).
6. Select a legacy patron (no componentes loaded). Verify:
   - All its lotes behave as before (no badge, no disabled state).
7. **PDF REGRESSION CHECK** (critical — frozen surface):
   - Generate a PDF of the OT (using whatever button the PWA exposes for the technician to preview/generate the report PDF).
   - Open the PDF. Confirm:
     - Hoja 1 looks identical to pre-Phase-14 baseline (no visual differences).
     - Protocolos render correctly.
     - Fotos section unchanged.
     - Firma del protocolo unchanged.
   - If you have a known-good baseline PDF from before this plan, do a visual diff (eyeball or tool). They should be indistinguishable.
8. **Code regression check**: `git diff apps/reportes-ot/components/InstrumentoSelectorPanel.tsx` should show ONLY:
   - 1 new import line
   - ~10-15 lines of changes inside the patrones-tab map block
   - NO changes elsewhere in the file
   - NO new files in apps/reportes-ot/ except this single one
  </how-to-verify>
  <resume-signal>Type "approved" + paste the PDF regression confirmation OR describe issues.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm type-check` GREEN
- `pnpm build:reportes` GREEN (no errors in the reportes-ot app)
- `pnpm --filter @ags/sistema-modular test:patron-bom` still 14/14 GREEN (this plan does NOT regress sistema-modular)
- Diff of `apps/reportes-ot/components/InstrumentoSelectorPanel.tsx` shows ≤ ~20 line changes total
- No other file under `apps/reportes-ot/` was touched
- Visual UAT confirms: badge visible, selection disabled, PDF pipeline unchanged
</verification>

<success_criteria>
The technician in the field cannot start a protocol with a bloqueado kit — the UX makes it impossible (badge + disabled checkbox). The PDF pipeline is verifiably unregressed (visual diff). The frozen-surface rule was respected (single file, single env-var-gated edit, no PDF code touched, no refactor of the 619 LOC component).
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-07-SUMMARY.md` documenting:
- Exact diff of InstrumentoSelectorPanel.tsx (paste git diff output)
- Confirmation that `CLAUDE_ALLOW_REPORTES_OT=1` was set during edits and the hook did not block
- PDF regression result (pass/fail; reference baseline if available)
- LOC delta of InstrumentoSelectorPanel.tsx (before → after; expect +~15)
- Heads-up for 14-08 release prep: this file IS visible to end-users on tablets; the release must validate that the reportes-ot bundle deploys (Vercel) and the badge appears in prod.
</output>
