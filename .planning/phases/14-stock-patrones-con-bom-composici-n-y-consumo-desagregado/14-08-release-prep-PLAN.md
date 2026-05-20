---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 08
type: execute
wave: 6
depends_on:
  - 00
  - 01
  - 02
  - 03
  - 04
  - 05
  - 06
  - 07
files_modified: []
autonomous: false
requirements:
  - BOM-01
  - BOM-02
  - BOM-03
  - BOM-04
  - BOM-05
  - BOM-06
  - BOM-07
  - BOM-08
must_haves:
  truths:
    - "Full test:patron-bom suite (14/14) GREEN on the latest commit"
    - pnpm type-check GREEN from repo root
    - "pnpm build:modular and pnpm build:reportes both GREEN"
    - Smoke RELEASE-CHECKLIST.md executed successfully in dev (login, módulos críticos, PDFs, Excel)
    - "User receives a CLEAR instruction on how to cut the release (pnpm --filter @ags/sistema-modular release:minor + push tag) but the tag is NOT cut automatically — user does it"
    - Reportes-ot PDF pipeline regression confirmed unchanged (carry-over from 14-07 UAT)
  artifacts: []
  key_links: []
---

<objective>
Release-prep checkpoint: validate that all Phase 14 deliverables compose into a coherent, shippable build BEFORE the user cuts the actual release. Per `.claude/rules/release-flow.md`, sistema-modular is an installed `.exe` distributed via auto-update + GitHub Releases; runtime changes need a tag bump (`pnpm --filter @ags/sistema-modular release:minor` because Phase 14 ships user-visible features).

This plan does NOT cut the tag automatically. It runs the validation gate (RELEASE-CHECKLIST.md) and surfaces the exact bump command the user runs themselves. Rationale: the user is the only one who can validate the installed `.exe` on their actual machine before broadcasting an auto-update to all PCs.

Output:
- Confirmation that all automated checks (type-check, tests, builds) pass
- Manual smoke of RELEASE-CHECKLIST.md (login + 4-5 critical modules + 1 PDF + 1 Excel)
- Written instruction surfaced to the user with the exact release command + working-tree-clean precondition
- Note about reportes-ot deployment (separate path: Vercel auto-deploys from `main`; no tag bump needed for that app)
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.claude/rules/release-flow.md
@apps/sistema-modular/RELEASING.md
@apps/sistema-modular/RELEASE-CHECKLIST.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run all automated validations</name>
  <files></files>
  <action>
1. From repo root, run the full validation sequence:
   ```bash
   pnpm type-check
   pnpm --filter @ags/sistema-modular test:patron-bom
   pnpm --filter @ags/sistema-modular test:stock-amplio
   pnpm --filter @ags/sistema-modular test:cuotas-facturacion
   pnpm --filter @ags/sistema-modular test:equivalencias
   pnpm build:modular
   pnpm build:reportes
   ```
2. Each must exit 0. If any fails, STOP this plan and surface the failure — do NOT proceed to RELEASE-CHECKLIST or release instructions until green.
3. Document the duration and output summary in the SUMMARY file.
  </action>
  <verify>
    <automated>pnpm type-check &amp;&amp; pnpm --filter @ags/sistema-modular test:patron-bom &amp;&amp; pnpm build:modular &amp;&amp; pnpm build:reportes</automated>
  </verify>
  <done>All 7 commands exit 0; full v2.x stock test suite (patron-bom + stock-amplio + cuotas-facturacion + equivalencias) all GREEN; both builds succeed.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual smoke per apps/sistema-modular/RELEASE-CHECKLIST.md</name>
  <what-built>End-to-end validation that Phase 14 changes did not regress any critical sistema-modular module before the user cuts a real release tag that broadcasts to installed PCs.</what-built>
  <how-to-verify>
1. Read `apps/sistema-modular/RELEASE-CHECKLIST.md` in full.
2. Build the Electron binary locally for smoke:
   ```bash
   pnpm --filter @ags/sistema-modular build
   ```
   Verify the `.exe` (or platform equivalent) lands in `apps/sistema-modular/release/` or similar dist folder.
3. Install/run the local binary and walk through the RELEASE-CHECKLIST items. Confirm each:
   - Login works (Firebase auth).
   - At least 4 critical modules open without console errors (Clientes, OTs, Presupuestos, Stock).
   - Generate 1 PDF (any module — contrato, presupuesto, OT report) — opens without errors.
   - Export 1 Excel (Presupuestos or Stock) — file downloads and opens.
4. **Phase-14-specific smoke** (in addition to standard checklist):
   - Open `/patrones`. Verify BOM/BLOQUEADO badges and the new filter work.
   - Open a patron editor. Add a componente. Save. Verify persistence.
   - Open an OT in cierre administrativo state. Verify the "Patrones consumidos" section renders (with or without BOM rows depending on the OT).
   - Open `/admin/config-flujos`. Verify the new "Requerimientos de patrón" SearchableSelect is present.
5. If ANY smoke item fails, write up the issue in the SUMMARY and BLOCK the release. User decides next step.
  </how-to-verify>
  <resume-signal>Type "approved — ready to release" + paste the smoke result summary OR describe regressions.</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: User cuts the release manually</name>
  <what-built>User runs the release command on their own machine, confirms tag pushes, monitors the GH Action, and validates the auto-update reaches at least one installed PC.</what-built>
  <how-to-verify>
This is a USER-ONLY action — Claude does NOT execute it. Surface this instruction clearly to the user:

```
Phase 14 está listo para release. Para distribuirlo a las PCs instaladas:

1. Asegurate de tener working tree limpio en main:
   git status   # debe ser "nothing to commit, working tree clean"
   git checkout main && git pull

2. Cortá el release MINOR (Phase 14 ships user-visible features):
   pnpm --filter @ags/sistema-modular release:minor

   Esto bumpea package.json, commitea, y crea el tag `sistema-modular-v<x.y.z>` localmente.

3. Pusheá main y el tag:
   git push origin main
   git push origin sistema-modular-v<x.y.z>

4. La GH Action `release-sistema-modular.yml` se dispara con el tag, builda en windows-latest,
   y publica el release. Las PCs instaladas recibirán el popup "Reiniciar ahora" en minutos.

5. Validá auto-update en al menos UNA PC instalada antes de considerar Phase 14 cerrada:
   - Esperá el popup en una PC con la versión previa instalada
   - Reiniciá
   - Confirmá que la nueva versión aparece en Ayuda > Acerca de
   - Probá 1 smoke: abrir un patron, ver el badge BOM, abrir un OT, etc.

6. Aparte: `reportes-ot` se despliega solo (Vercel sigue main). Después del merge,
   confirmá en la PWA mobile que el badge AGOTADO aparece en el selector de patrones.
```

Resume signal: user confirms tag pushed + first installed PC received update + smoke OK.
  </how-to-verify>
  <resume-signal>Type "released — vX.Y.Z deployed and validated" + version number OR "release blocked" + reason.</resume-signal>
</task>

</tasks>

<verification>
- All 7 automated commands (Task 1) returned 0
- RELEASE-CHECKLIST smoke (Task 2) approved
- User cut release (Task 3) and confirmed at least 1 PC received the auto-update successfully
</verification>

<success_criteria>
Phase 14 ships to production: tag cut, GH Action published the release, at least one installed PC received the update, and the Phase-14-specific UI (BOM badges, cierre admin step, reportes-ot AGOTADO badge) is verifiable in prod.
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-08-SUMMARY.md` documenting:
- Pre-release validation results (durations of each command, GREEN/RED status)
- RELEASE-CHECKLIST smoke result (per-item pass/fail)
- Released version number (e.g., `sistema-modular-v1.2.0`)
- Timestamp of first installed PC receiving the update
- Any post-release follow-ups identified by the user during smoke
- Final note: Phase 14 status → close (8/8 plans complete, 8/8 BOM-NN requirements done in REQUIREMENTS.md, ready for `/gsd:verify-work`).
</output>
