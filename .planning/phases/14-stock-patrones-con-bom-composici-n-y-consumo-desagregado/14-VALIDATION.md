---
phase: 14
slug: stock-patrones-con-bom-composici-n-y-consumo-desagregado
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
updated_by_planner: 2026-05-20
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx + node:test + node:assert/strict (Phase 12/13 precedent) |
| **Config file** | none — runs via per-domain `test:*` script in `apps/sistema-modular/package.json` |
| **Quick run command** | `pnpm --filter @ags/sistema-modular test:patron-bom` |
| **Full suite command** | `pnpm --filter @ags/sistema-modular test:patron-bom && pnpm type-check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ags/sistema-modular test:patron-bom`
- **After every plan wave:** Run `pnpm --filter @ags/sistema-modular test:patron-bom && pnpm type-check` (7 waves total: 0-6)
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT items below all checked off
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner. One row per task in plans 14-00 through 14-08; maps task → automated verify command OR manual UAT row. `File Exists` column indicates whether the test target file exists at the moment the task runs.

| Task ID    | Plan | Wave | Requirement   | Test Type     | Automated Command                                                     | File Exists | Status     |
|------------|------|------|---------------|---------------|-----------------------------------------------------------------------|-------------|------------|
| 14-00-01   | 00   | 0    | BOM-01..08    | infra         | `node -e "..."` on package.json scripts field                         | ❌ creates  | ⬜ pending |
| 14-00-02   | 00   | 0    | BOM-01..08    | tdd (RED)     | `pnpm --filter @ags/sistema-modular test:patron-bom` (must FAIL loud) | ❌ creates  | ⬜ pending |
| 14-01-01   | 01   | 1    | BOM-01        | typecheck     | `pnpm type-check`                                                     | ✅ exists   | ⬜ pending |
| 14-01-02   | 01   | 1    | BOM-02        | unit (helpers)| `pnpm type-check && pnpm --filter @ags/sistema-modular test:patron-bom` (tests 1-9 GREEN) | ❌ creates patronBom.ts | ⬜ pending |
| 14-02-01   | 02   | 2    | BOM-03        | unit (tx)     | `pnpm --filter @ags/sistema-modular test:patron-bom` (tests 10-13 GREEN) | ✅ exists (fixtures at src/__tests__/fixtures/patronBom.ts per 14-00) | ⬜ pending |
| 14-03-01   | 03   | 3    | BOM-08        | typecheck + grep | `pnpm type-check && grep usuarioRequerimientosPatronId in adminConfigService.ts` | ✅ exists | ⬜ pending |
| 14-03-02   | 03   | 3    | BOM-08        | unit (auto-req)| `pnpm --filter @ags/sistema-modular test:patron-bom` (test 14 GREEN — full 14/14) | ❌ creates patronesAutoRequerimiento.ts | ⬜ pending |
| 14-04-01   | 04   | 4    | BOM-04        | typecheck + LOC | `pnpm type-check && node -e "LOC check ≤ 220"`                       | ❌ creates PatronComponentesEditor.tsx | ⬜ pending |
| 14-04-02   | 04   | 4    | BOM-04        | typecheck + LOC | `pnpm type-check`                                                     | ✅ exists   | ⬜ pending |
| 14-04-03   | 04   | 4    | BOM-04        | unit (service guard) | `pnpm --filter @ags/sistema-modular test:patron-bom` (tests 15-18 GREEN — defense-in-depth rename guard) | ✅ exists (extends patronBom.test.ts + patronesService.update) | ⬜ pending |
| 14-04-04   | 04   | 4    | BOM-04        | manual UAT    | n/a — visual smoke in `pnpm dev:modular` `/patrones/{id}/editar` (incl. step 9 service-bypass test) | n/a         | ⬜ pending |
| 14-05-01   | 05   | 5    | BOM-06        | typecheck     | `pnpm type-check`                                                     | ❌ creates PatronRow.tsx | ⬜ pending |
| 14-05-02   | 05   | 5    | BOM-06        | typecheck     | `pnpm type-check`                                                     | ✅ exists   | ⬜ pending |
| 14-05-03   | 05   | 5    | BOM-06        | typecheck     | `pnpm type-check`                                                     | ❌ creates PatronComponentesAlertBanner.tsx; touches PatronEditorPage AFTER 14-04 (depends_on:[01,04] enforces serialization on shared file) | ⬜ pending |
| 14-05-04   | 05   | 5    | BOM-06        | manual UAT    | n/a — visual smoke on `/patrones` (badges + filter URL + alert)       | n/a         | ⬜ pending |
| 14-06-01   | 06   | 4    | BOM-05        | typecheck + LOC | `pnpm type-check`                                                     | ❌ creates useCierrePatronesConsumidos.ts + extends otService.ts with getPatronesSeleccionados | ⬜ pending |
| 14-06-02   | 06   | 4    | BOM-05        | typecheck + LOC | `pnpm type-check`                                                     | ❌ creates CierrePatronesConsumidosSection.tsx | ⬜ pending |
| 14-06-03   | 06   | 4    | BOM-05        | typecheck     | `pnpm type-check`                                                     | ✅ exists (uses ordenesTrabajoService.getPatronesSeleccionados — no raw Firestore in hook) | ⬜ pending |
| 14-06-04   | 06   | 4    | BOM-08        | typecheck     | `pnpm type-check`                                                     | ✅ exists   | ⬜ pending |
| 14-06-05   | 06   | 4    | BOM-05+BOM-08 | manual UAT    | n/a — 9-step UAT (prefill, edit, confirm, idempotency, auto-req, legacy bypass) | n/a | ⬜ pending |
| 14-07-01   | 07   | 5    | BOM-07        | typecheck + build | `pnpm type-check && pnpm build:reportes`                          | ✅ exists (frozen-exception, env-var-gated edit) | ⬜ pending |
| 14-07-02   | 07   | 5    | BOM-07        | manual UAT    | n/a — visual smoke in `pnpm dev:reportes` + PDF regression diff       | n/a         | ⬜ pending |
| 14-08-01   | 08   | 6    | BOM-01..08    | full validation | `pnpm type-check && pnpm --filter @ags/sistema-modular test:patron-bom && pnpm build:modular && pnpm build:reportes` | n/a | ⬜ pending |
| 14-08-02   | 08   | 6    | BOM-01..08    | manual UAT    | n/a — apps/sistema-modular/RELEASE-CHECKLIST.md smoke                 | n/a         | ⬜ pending |
| 14-08-03   | 08   | 6    | BOM-01..08    | user-only action | n/a — user runs `pnpm --filter @ags/sistema-modular release:minor` + push tag + validates 1 installed PC | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** No 3 consecutive tasks lack automated verify. Every code-producing task has `pnpm type-check` or `test:patron-bom` automation. Manual UAT tasks (14-04-04, 14-05-04, 14-06-05, 14-07-02, 14-08-02, 14-08-03) are explicitly flagged as `manual UAT` or `user-only action`, NOT silent gaps.

**Test count progression:**
- After 14-00: 14 tests RED (baseline)
- After 14-01: 9/14 GREEN (BOM-02 helpers)
- After 14-02: 13/14 GREEN (BOM-03 tx + idempotency)
- After 14-03: 14/14 GREEN (BOM-08 auto-req idempotency)
- After 14-04: 18/18 GREEN (+ 4 service-layer rename guard tests)

---

## Wave 0 Requirements

- [x] `apps/sistema-modular/scripts/test-patron-bom.ts` — runner entry point (tsx) → created by 14-00 Task 1
- [x] `apps/sistema-modular/src/__tests__/patronBom.test.ts` — unit tests for saldo + bloqueo + consumo + auto-req → created by 14-00 Task 2
- [x] `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` — fixtures: legacy, simple, complex, FIFO, bloqueado, agotado, duplicados → created by 14-00 Task 2 (path: under `src/__tests__/`, NOT `src/services/__tests__/`)
- [x] `apps/sistema-modular/package.json` — `"test:patron-bom": "tsx scripts/test-patron-bom.ts"` → added by 14-00 Task 1
- [x] DI hook on `patronesService.consumirComponentes` — `__setTestFirestore(state)` shim mirroring Phase 13 equivalenciasService → added by 14-02 Task 1
- [x] DI hook on auto-req flow — `autoCrearRequerimientosPatron(..., { __testState })` mock path → added by 14-03 Task 2
- [x] `packages/shared/src/utils/patronBom.ts` — pure saldo/bloqueo helpers → added by 14-01 Task 2

---

## Manual-Only Verifications

| Behavior | Plan | Requirement | Why Manual | Test Instructions |
|----------|------|-------------|------------|-------------------|
| Sección "Componentes (BOM)" en `PatronEditorPage` permite alta/edición/baja de componentes + service guard test | 14-04 | BOM-04 | UX inline form + service bypass test, mejor cubierto visualmente | Plan 14-04 Task 4 — 10-step UAT script (incl. step 9: service-bypass via DevTools) |
| Badge "BOM" / "BLOQUEADO" / "AGOTADO" + filtro "Bloqueados" + alert banner | 14-05 | BOM-06 | Visual + URL persistence test | Plan 14-05 Task 4 — 7-step UAT script |
| Paso "Patrones consumidos" auto-prefill + edición admin + idempotency + auto-Requerimiento | 14-06 | BOM-05 + BOM-08 | End-to-end integración Firestore + UI multi-sección | Plan 14-06 Task 5 — 9-step UAT script |
| Badge "lote bloqueado" visible en selector técnico de `apps/reportes-ot` y selección deshabilitada | 14-07 | BOM-07 | Tab UI en app frozen, sólo verificable en runtime + PDF regression | Plan 14-07 Task 2 — 7-step UAT script with PDF diff |
| PDF pipeline de `apps/reportes-ot` intacto (regresión) | 14-07 | — | App frozen, regresión visual no automatizable | Compared visual to baseline; covered by 14-07 Task 2 step 7 |
| `sistema-modular` instalado vía auto-update sigue funcionando tras release Phase 14 | 14-08 | — | Auto-update Electron + tag GH | Plan 14-08 Tasks 2-3 — RELEASE-CHECKLIST smoke + user-cuts-tag |

---

## Wave / Dependency Graph (consistency check)

| Plan | Wave | depends_on | Shared-file note |
|------|------|------------|------------------|
| 14-00 | 0 | [] | — |
| 14-01 | 1 | [00] | — |
| 14-02 | 2 | [00, 01] | extends patronesService.ts (CRUD already there); fixture path = src/__tests__/fixtures/patronBom.ts |
| 14-03 | 3 | [00, 01, 02] | extends patronesService.ts (post-commit hook in consumirComponentes); creates patronesAutoRequerimiento.ts; extends adminConfigService.ts |
| 14-04 | 4 | [01, 02, **03**] | touches PatronEditorPage.tsx + patronesService.ts (service guard); serialized AFTER 14-03 on shared patronesService.ts |
| 14-05 | 5 | [01, **04**] | touches PatronEditorPage.tsx → serializes AFTER 14-04 on shared file (bumped from wave 4 because 14-04 is now wave 4) |
| 14-06 | 4 | [01, 02, 03] | touches OTCierreAdminSection + useEditOTForm + otService.ts (NEW: getPatronesSeleccionados method) — parallel-safe with 14-04 (different files) |
| 14-07 | 5 | [01, 02, 03, 06] | reportes-ot (frozen-exception, env-var gated) — parallel-safe with 14-05 (different apps) |
| 14-08 | 6 | [00, 01, 02, 03, 04, 05, 06, 07] | release prep |

**Wave parallel safety:**
- Wave 3 (14-03 only) — trivially safe.
- Wave 4 (14-04, 14-06) — parallel-safe; 14-04 touches PatronEditorPage/PatronComponentesEditor/patronesService; 14-06 touches OTCierreAdminSection/CierrePatronesConsumidosSection/useCierrePatronesConsumidos/ConfigFlujosPage/useEditOTForm/otService. NO file overlap.
- Wave 5 (14-05, 14-07) — parallel-safe; 14-05 touches `apps/sistema-modular/src/pages/patrones/*`; 14-07 touches `apps/reportes-ot/components/InstrumentoSelectorPanel.tsx`. Different apps entirely.
- Wave 6 (14-08 only) — trivially safe.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly flagged manual UAT / user-only action
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (see map above)
- [x] Wave 0 covers all MISSING references (test runner, fixtures, DI hooks, shared helper) — all populated by 14-00 + 14-01 + 14-02 + 14-03
- [x] No watch-mode flags (all `test:*` commands run once and exit)
- [x] Feedback latency < 30s (~10s observed in Phase 13 precedent for similar tsx suite)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Defense-in-depth rename guard test rows added (14-04-03) and counted in progression (18/18 final)
- [x] Wave 3 file-conflict on PatronEditorPage.tsx resolved via 14-05.depends_on:[01,04]
- [x] Wave re-grading applied end-to-end after BLOCKER fix: 14-03 wave 3 (was incorrectly 2 with same-wave dep on 14-02); 14-04 wave 4 with added dep on 14-03 to serialize on shared patronesService.ts; cascade through 14-05 (wave 5), 14-06 (wave 4), 14-07 (wave 5), 14-08 (wave 6). Total 7 waves (0-6).

**Approval:** populated by planner 2026-05-20; revised by planner 2026-05-20 after checker feedback (path consistency fix, wave-3 serialization, service-layer guard, service-only Firestore in hooks); re-revised by planner 2026-05-20 after BLOCKER on 14-03 wave inconsistency — end-to-end wave re-grade applied per strict `plan.wave = max(deps[i].wave) + 1` rule.
