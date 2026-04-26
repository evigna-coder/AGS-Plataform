---
phase: 12
slug: esquema-facturacion-porcentual-anticipos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | `tsx` + `node:assert/strict` (zero-install, mirrors `apps/sistema-modular/src/services/__tests__/stockAmplio.test.ts`) |
| **Unit config file** | none — `package.json` script `test:cuotas-facturacion` (Wave 0 adds it) |
| **Unit quick run** | `pnpm --filter sistema-modular exec tsx src/services/__tests__/cuotasFacturacion.test.ts` |
| **E2E framework** | `@playwright/test` 1.59.1 |
| **E2E config** | `apps/sistema-modular/playwright.config.ts` (chromium project already wired) |
| **E2E quick run** | `pnpm --filter sistema-modular e2e -- --grep "11.5"` (only Phase 12 sub-suites) |
| **Full suite command** | `pnpm --filter sistema-modular e2e` |
| **Type-check** | `pnpm type-check` (workspace) + `pnpm --filter sistema-modular exec tsc --noEmit` |
| **Estimated unit runtime** | ~5 seconds |
| **Estimated E2E sub-suite runtime** | ~90 seconds for 11.51 + 11.52 |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter sistema-modular test:cuotas-facturacion` (≤5 s — whole-file run; verify each `[BILL-XX label]` stdout tag printed by grepping `2>&1 | grep '\[BILL-' | sort -u`)
- **After every plan wave:** Run `pnpm --filter sistema-modular e2e --grep "11.5"` (≤90 s for 11.51 + 11.52)
- **Before `/gsd:verify-work`:** Full suite must be green (`pnpm --filter sistema-modular e2e` + `pnpm type-check`)
- **Max feedback latency:** 90 seconds (sub-suite) / 5 seconds (unit)
- **Note (B1 fix):** the unit test driver (`tsx` + `node:assert/strict`) runs the WHOLE file — there is no `--filter` flag. Per-assertion linkage is via `console.log('[BILL-XX label]')` tags printed before each assertion block (mirrors existing `stockAmplio.test.ts` pattern of `'  ✓ Test N passed: STKP-01'`).

---

## Per-Task Verification Map

Tasks below are placeholders to be aligned with the actual PLAN.md task IDs once the planner emits them. Plan IDs follow PRD Fase 1–6.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-00-01 | 00 | 0 | Wave 0 RED | unit | `pnpm --filter sistema-modular exec tsx src/services/__tests__/cuotasFacturacion.test.ts` | ❌ W0 | ⬜ pending |
| 12-00-02 | 00 | 0 | Wave 0 RED | E2E scaffold | `e2e -- --grep "11.5"` (with `test.fixme`) | ❌ W0 | ⬜ pending |
| 12-01-01 | 01 | 1 | BILL-01..02 (types + helper) | unit | `pnpm --filter sistema-modular test:cuotas-facturacion` (whole-file run; assert proven via stdout tag `[BILL-02 hito-aceptado]`) | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | BILL-02 | unit | full unit run; tag `[BILL-02 todas-ots-cerradas]` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | BILL-02 | unit | full unit run; tag `[BILL-02 pre-embarque]` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | BILL-02 (anulada→regen) | unit | full unit run; tag `[BILL-02 anulada-regen]` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | BILL-02 (cobrada mirror) | unit | full unit run; tag `[BILL-02 cobrada-mirror]` | ❌ W0 | ⬜ pending |
| 12-01-06 | 01 | 1 | BILL-04 (MIXTA combos) | unit | full unit run; tag `[BILL-04 MIXTA-combinada]` | ❌ W0 | ⬜ pending |
| 12-01-07 | 01 | 1 | BILL-01 (Σ%=100 validator) | unit | full unit run; tag `[BILL-01 validator-mono-ok]` | ❌ W0 | ⬜ pending |
| 12-01-08 | 01 | 1 | BILL-04 (Σ% per moneda independent) | unit | full unit run; tag `[BILL-04 validator-MIXTA-independent]` | ❌ W0 | ⬜ pending |
| 12-01-09 | 01 | 1 | BILL-05 (legacy empty array) | unit | full unit run; tag `[BILL-05 empty-legacy]` | ❌ W0 | ⬜ pending |
| 12-01-10 | 01 | 1 | BILL-06 (canFinalizeFromEsquema strict cobrada) | unit | full unit run; tag `[BILL-06 strict-cobrada]` | ❌ W0 | ⬜ pending |
| 12-01-11 | 01 | 1 | W2 (cuotasEqual key-order independent) | unit | full unit run; tag `[BILL-W2 cuotasEqual-shuffled]` | ❌ W0 | ⬜ pending |
| 12-01-12 | 01 | 1 | I3 (computeTotalsByCurrency MIXTA) | unit | full unit run; tag `[BILL-I3 computeTotals-MIXTA]` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | BILL-01 (editor save Σ%=100) | E2E | `e2e --grep "11.51.*editor-suma-100"` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | BILL-01 (read-only on aceptado) | E2E | `e2e --grep "11.51.*esquema-locked-on-aceptado"` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 2 | B2 (preEmbarque calls togglePreEmbarque service direct) | E2E | `e2e --grep "11.52.*pre-embarque-audit-posta"` (B2 fix verify — checks linked ticket has new posta) | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | BILL-03 (cuotaId path) | E2E | `e2e --grep "11.51.*generar-anticipo-sin-ot"` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 3 | BILL-03 (server guard cuota.estado) | unit/integration | full unit run; tag `[BILL-03 generarAviso-guard-no-habilitada]` (B1: no `--filter` flag exists for the tsx + node:assert driver) | ❌ W0 | ⬜ pending |
| 12-03-03 | 03 | 3 | BILL-04 (MIXTA mini-modal N inputs) | E2E | `e2e --grep "11.51.*MIXTA-mini-modal"` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 4 | BILL-02 (auto recompute on hito) | E2E | `e2e --grep "11.51.*hito-aceptado-recompute"` | ❌ W0 | ⬜ pending |
| 12-04-02 | 04 | 4 | BILL-07 (preEmbarque toggle flips estado) | E2E | `e2e --grep "11.52.*pre-embarque-toggle"` | ❌ W0 | ⬜ pending |
| 12-04-03 | 04 | 4 | BILL-07 (toggle visibility) | E2E | `e2e --grep "11.52.*toggle-visibility"` | ❌ W0 | ⬜ pending |
| 12-04-04 | 04 | 4 | BILL-06 (finaliza tras última cuota) | E2E | `e2e --grep "11.51.*finaliza-tras-ultima-cuota"` | ❌ W0 | ⬜ pending |
| 12-05-01 | 05 | 5 | BILL-05 (legacy 11.13b still passes) | E2E | `e2e --grep "11.13b"` | ✅ exists | ⬜ pending |
| 12-05-02 | 05 | 5 | BILL-06 (legacy 11.15/11.16 still pass) | E2E | `e2e --grep "11.1[56]"` | ✅ exists | ⬜ pending |
| 12-06-01 | 06 | 6 | BILL-08 (30/70 happy path) | E2E | `e2e --grep "11.51"` | ❌ W0 | ⬜ pending |
| 12-06-02 | 06 | 6 | BILL-08 (70/30 pre-embarque happy path) | E2E | `e2e --grep "11.52"` | ❌ W0 | ⬜ pending |
| 12-06-03 | 06 | 6 | BILL-08 (no console warnings, no orphan solicitudes) | E2E asserts | embedded in 11.51/11.52 (`page.on('console')` + `getSolicitudesFacturacionByPresupuesto`) | ❌ W0 | ⬜ pending |
| 12-06-04 | 06 | 6 | BILL-08 (100% al cierre equivalence — optional) | E2E | `e2e --grep "11.50.*100-al-cierre"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts` — stubs covering BILL-01 (validator), BILL-02 (all hito branches + anulada-regen + cobrada mirror), BILL-04 (MIXTA combos), BILL-05 (legacy empty array), BILL-06 (canFinalizeFromEsquema strict mode), W2 (cuotasEqual key-order independence), I3 (computeTotalsByCurrency MIXTA)
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/cuotasFacturacion.ts` — fixture data (mirrors `stockAmplio.ts` pattern); ≥10 recompute fixtures + ≥4 validator fixtures + 3 cuotasEqual fixtures (W2) + 2 computeTotalsByCurrency fixtures (I3) (I1 fix)
- [ ] `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — add `getPresupuestoEsquema(presId: string)` helper returning `Presupuesto.esquemaFacturacion`
- [ ] `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — add tests `11.50` (100% al cierre, optional), `11.51` (30/70 anticipo + cierre), `11.52` (70/30 pre-embarque). Use `test.fixme(true, 'Wave N — lands esquemaFacturacion')` until corresponding wave passes.
- [ ] `apps/sistema-modular/package.json` — add script `"test:cuotas-facturacion": "tsx src/services/__tests__/cuotasFacturacion.test.ts"` (mirrors `test:stock-amplio`)
- [ ] B1 stdout tag protocol: each assertion block in the test file is preceded by `console.log('[BILL-XX label]')` (W1 fix); verifier runs `pnpm --filter sistema-modular test:cuotas-facturacion 2>&1 | grep '\[BILL-' | sort -u` to enumerate proven assertions.

*No framework install needed — `tsx`, `node:assert/strict`, and `@playwright/test` are already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Σ%=100 validation badge color (green/red) renders correctly | BILL-01 | UI visual feedback; Playwright can assert presence/text but color rendering is not deterministic in headless | Open editor; add 2 cuotas at 30% + 70% → green badge; change to 30% + 60% → red badge with copy "Cuotas en {moneda} suman 90%, deben sumar 100%" |
| Quick-template buttons place sensible defaults for MIXTA | BILL-01 | Template UX is judgmental — assert numbers programmatically, but verify "feels right" once | Open MIXTA ppto editor → click "30/70 anticipo+entrega" → confirm 2 cuotas added with `{ARS:30, USD:30}` and `{ARS:70, USD:70}` |
| Mini-modal layout when MIXTA has 3 monedas (ARS+USD+EUR) | BILL-04 | Edge case visually — three input columns must not overflow | Create test ppto MIXTA with all 3 currencies, esquema with one cuota covering all 3, click "Generar solicitud" → verify modal renders 3 input columns |
| Audit trace `PostaPresupuesto` (or linked ticket posta) reflects `preEmbarque` toggle | BILL-07 | Open question 2 from research — exact target is planner decision; manually inspect after wired | Toggle `preEmbarque` → query Firestore for the linked entity's `postas[]` → confirm entry with action `pre_embarque_toggled` |

*Manual verifications run during `/gsd:verify-work` and at end of Wave 5 (E2E manual sweep per PRD Fase 5).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`cuotasFacturacion.test.ts`, fixtures, `getPresupuestoEsquema` helper, Playwright fixmes, `test:cuotas-facturacion` script)
- [ ] No watch-mode flags in CI commands
- [ ] Feedback latency < 90s (sub-suite) / 5s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands

**Approval:** pending
