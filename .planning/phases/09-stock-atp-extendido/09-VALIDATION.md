---
phase: 9
slug: stock-atp-extendido
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
updated: 2026-04-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx + `node:assert/strict` (zero-install; tsx already in devDependencies). Playwright stubs (`describe.skip()`) scaffolded for future E2E. |
| **Config file** | None required — each test file is a runnable tsx script with inline `node:assert` assertions. Playwright config exists from Phase 8 for E2E regressions. |
| **Quick run command** | `pnpm --filter sistema-modular test:stock-amplio` (tsx script, <3s). |
| **Full suite command** | `pnpm --filter sistema-modular test:stock-amplio && pnpm type-check && pnpm -C functions typecheck` |
| **Estimated runtime** | ~15 seconds |

Rationale for tsx over vitest: 09-01 establishes `tsx src/services/__tests__/stockAmplio.test.ts` as the unit test runner. This aligns with the "no new dev deps" posture, matches `tsx`'s availability in devDependencies, and avoids the vitest install step originally listed in Wave 0. E2E Playwright specs for STKP-02/03/04 are scaffolded as `describe.skip()` RED baselines (Wave 0) — they exist as files but do not execute; they will be implemented against the Firebase emulator post-v2.0 when CI lands.

---

## Sampling Rate

- **After every task commit:** Run quick run command on changed service (`test:stock-amplio`).
- **After every plan wave:** Run full suite command (tsx unit + type-check + functions typecheck).
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT on planning view (Task 3 of 09-03 checkpoint) + Cloud Function live-update verification (Task 3 of 09-02 checkpoint).
- **Max feedback latency:** 60 seconds for unit; checkpoints are human-verified end-of-wave.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | STKP-01 + STKP-05 | unit (tsx) | `pnpm --filter sistema-modular test:stock-amplio` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | STKP-01, STKP-05 | unit (tsx) | `pnpm --filter sistema-modular test:stock-amplio` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | STKP-03 | static (grep `runTransaction` in stockService) | `pnpm type-check && grep -c "runTransaction" apps/sistema-modular/src/services/stockService.ts` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 2 | STKP-02 | type-check + build (runtime = manual emulator in Task 3) | `pnpm -C functions typecheck && pnpm -C functions build` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 2 | STKP-01, STKP-04 | type-check + human UAT | `pnpm type-check` + checkpoint | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 files are RED baselines (either failing unit tests or `describe.skip()` stubs). They exist BEFORE implementation to enforce the goal-backward contract.

- [x] `apps/sistema-modular/src/services/__tests__/stockAmplio.test.ts` — tsx-runnable unit tests for STKP-01 (happy path, empty state, stale reqs exclusion, closed OCs exclusion) + STKP-05 (double counting regression). Created by 09-01 Task 1.
- [x] `apps/sistema-modular/src/services/__tests__/fixtures/stockAmplio.ts` — shared fixture builders: `FIXTURE_HAPPY_PATH`, `FIXTURE_DOUBLE_COUNT_REGRESSION`, `FIXTURE_EMPTY`, `FIXTURE_STALE_REQS`, `FIXTURE_CLOSED_OCS`. Created by 09-01 Task 1.
- [x] `e2e/stock-reserva-concurrent.spec.ts` — Playwright `describe.skip()` stub for STKP-03 concurrent reservation. RED baseline — created as stub with scenario comments, not executed. Created by 09-01 Task 1.
- [x] `e2e/stock-cf-trigger.spec.ts` — Playwright `describe.skip()` stub for STKP-02 Cloud Function trigger end-to-end. RED baseline. Created by 09-01 Task 1.
- [x] `e2e/stock-planificacion.spec.ts` — Playwright `describe.skip()` stub for STKP-04 cache-bypass planning view. RED baseline. Created by 09-01 Task 1.
- [x] `functions/src/__tests__/updateResumenStock.test.ts` — documentation stub with emulator verify steps. Runtime coverage = manual in 09-02 Task 3 checkpoint. Created by 09-02 Task 1.

**Wave 0 status:** `wave_0_complete: true` (see frontmatter). All files exist as RED baselines; unit tests fail until 09-01 Task 2 lands; E2E stubs remain `describe.skip()` for the v2.0 ship.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Planning view shows fresh ATP data (no 2-min cache) | STKP-04 | Requires browser + Firebase interaction | Open planning view → modify unidad in another tab → verify view refreshes without 2-min delay (09-03 Task 3 step 5-6) |
| StockAmplioIndicator visual layout | STKP-01 | Visual/UX assertion | Manual visual QA: disponible/tránsito/reservado/comprometido displayed correctly with red ATP when negative (09-03 Task 3) |
| Concurrent reservation impossibility | STKP-03 | Real concurrency hard to script without emulator | Informal smoke test: 2 browser tabs, attempt `reservar()` on same unidad within 200ms → one succeeds, one throws. Full automated concurrent E2E deferred (stub exists) |
| Cloud Function `updateResumenStock` fires live | STKP-02 | Requires deploy or emulator with multi-service orchestration | 09-02 Task 3 checkpoint walks through deploy OR emulator path with 7-step verification |
| OC writes with multi-articuloId recompute all IDs | STKP-02 | Needs live Firestore to observe | 09-02 Task 3 checkpoint — write an OC with items for 2 distinct articuloIds, observe both `articulos/{id}.resumenStock` update |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** granted (post-revision 2026-04-21)
