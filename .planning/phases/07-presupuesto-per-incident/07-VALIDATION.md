---
phase: 07
slug: presupuesto-per-incident
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-20
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `07-RESEARCH.md` Validation Architecture section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.x (E2E only; no unit test framework in the repo) |
| **Config file** | `apps/sistema-modular/playwright.config.ts` |
| **Quick run command** | `pnpm --filter sistema-modular type-check` |
| **Full suite command** | `pnpm --filter sistema-modular test:e2e -- 03-presupuestos` |
| **Estimated runtime** | ~5s type-check · ~60-90s E2E presupuestos spec · ~15-20 min full E2E |

Existing E2E at `apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts` already smoke-covers PTYP-01 happy path (creates a `'servicio'` presupuesto from ticket, line 22 uses `selectOption('servicio')`).

---

## Sampling Rate

- **After every task commit:** `pnpm --filter sistema-modular type-check` (~5s) — catches interface drift on `PresupuestoItem`, `EnviarPresupuestoModalProps`, `markEnviado` signature changes.
- **After every plan wave:** `pnpm --filter sistema-modular test:e2e -- 03-presupuestos` (~60-90s) — catches regressions in the `'servicio'` E2E path.
- **Before `/gsd:verify-work`:** Full E2E (`pnpm test:e2e`) + `build:web` must be green.
- **Max feedback latency:** type-check <10s, E2E presupuestos <2min.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PTYP-01 | type + manual | `pnpm type-check` + manual smoke of `AddItemModal` for `tipo: 'servicio'` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | FMT-01 | type + visual | `pnpm type-check` + visual diff of `PresupuestoPDFEstandar` | ✅ | ⬜ pending |
| 07-01-03 | 01 | 1 | PTYP-01 | type | `pnpm type-check` | ✅ | ⬜ pending |
| 07-01-04 | 01 | 1 | PTYP-01 | checkpoint:human | manual UAT script in plan | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | FMT-02 | type | `pnpm type-check` (verifies `markEnviado` signature) | ✅ | ⬜ pending |
| 07-02-02 | 02 | 1 | FMT-02, PTYP-01 | type + E2E | `pnpm type-check` + `03-presupuestos.spec.ts` | ✅ | ⬜ pending |
| 07-02-03 | 02 | 1 | FMT-02 | type | `pnpm type-check` | ✅ | ⬜ pending |
| 07-02-04 | 02 | 1 | FMT-02, PTYP-01 | checkpoint:human | manual UAT — 7 scenarios inc. token-cancel + Firestore-fail | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing E2E infrastructure covers PTYP-01 happy path. No mandatory Wave 0 work required before execution begins.

**Optional (deferred):**
- [ ] Add E2E test for FMT-02 token-cancel path — would require OAuth mock via `page.addInitScript` stubbing `window.google.accounts.oauth2`. Recipe in `07-RESEARCH.md` §Reusable helpers. Effort: ~1h. Value: medium. Not blocker for v2.0.
- [ ] Add E2E test for `markEnviado` atomic update — requires Firestore emulator (Phase 11 / TEST-01 territory). Effort: high. Defer.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth popup blocker hangs `requestToken` | FMT-02 | Browser popup-blocker UX can't be reliably mocked in Playwright | Block popups in browser settings → click Enviar → verify timeout + friendly error within 10s (risk #4 from RESEARCH) |
| PDF visual output (Editorial Teal fidelity) | FMT-01 | Requires visual inspection; diff tooling not installed | Generate PDF in browser → verify fonts (Newsreader H1, Inter body), teal-700 primary, monospace labels, no overflow, all fields populated |
| Concurrent-tab double send | FMT-02 | Race condition across tabs | Open same presupuesto in 2 browser tabs → click Send in both quickly → verify only 1 email sent OR 2 but no state inconsistency (risk #2) |
| Dirty-form send (subscribeById dirty-guard) | FMT-02 | Depends on user's local edit state at send time | Edit the presupuesto (without saving) → click Send → verify UI shows `enviado` badge after send, not stale `borrador` (risk #5) |
| Lead sync failure path | PTYP-01 | Requires simulating `leadsService.syncFromPresupuesto` throw | Only verifiable via code review + integration — confirm `TODO(FLOW-06)` comment + console.error + no re-throw (W-5 from plan revision) |

---

## Risk Acknowledgements (from RESEARCH)

Risks #2–#9 from `07-RESEARCH.md` are NOT blockers for Phase 7. They're documented so the executor knows which scenarios to cover in checkpoint UAT (risk #1–#5) vs which are out-of-scope (risks #6–#9 — font pre-warm, blob-to-base64 memory, fechaEnvio/updatedAt divergence, sendGmail return type nit). The 2 correctness nits (hint extension with `numero`, sendGmail return type comment) should be absorbed in a minor plan revision before execution.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or explicit manual checkpoint
- [x] Sampling continuity: type-check after every task (no 3 consecutive tasks without feedback)
- [x] Wave 0 covers all MISSING references (no missing refs)
- [x] No watch-mode flags
- [x] Feedback latency < 10s (type-check) / <2min (E2E spec)
- [ ] `nyquist_compliant: true` — pending resolution of the 2 correctness nits from RESEARCH §§3 (hint extension + sendGmail return type comment)

**Approval:** pending — blocked on minor plan revision to absorb the 2 correctness nits.
