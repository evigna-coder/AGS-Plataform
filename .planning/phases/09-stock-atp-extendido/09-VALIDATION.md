---
phase: 9
slug: stock-atp-extendido
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0 if not present) |
| **Config file** | `apps/sistema-modular/vitest.config.ts` (Wave 0 creates if missing) |
| **Quick run command** | `pnpm --filter sistema-modular test -- --run` |
| **Full suite command** | `pnpm --filter sistema-modular test -- --run && pnpm type-check` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command on changed service
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT on planning view
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | STKP-01 | unit | `pnpm --filter sistema-modular test computeStockAmplio` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | STKP-02 | unit | `pnpm --filter sistema-modular test computeStockAmplio` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | STKP-03 | unit | `pnpm --filter sistema-modular test reservasService` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | STKP-04 | integration | Firebase Functions emulator test | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | STKP-01, STKP-05 | manual | UAT script: planning view + simulate concurrent reservation | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/sistema-modular/vitest.config.ts` — install vitest if no test framework present
- [ ] `apps/sistema-modular/src/services/__tests__/computeStockAmplio.test.ts` — stubs for STKP-01, STKP-02
- [ ] `apps/sistema-modular/src/services/__tests__/reservasService.test.ts` — stubs for STKP-03 (transaction concurrency)
- [ ] `functions/src/__tests__/updateResumenStock.test.ts` — stubs for STKP-04 (CF trigger)
- [ ] Shared fixture for mock Firestore data (artículo, unidades, reservas, OC) — `apps/sistema-modular/src/services/__tests__/fixtures/stock.ts`

*If vitest already configured in monorepo, Wave 0 only creates stubs; otherwise full framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Planning view shows fresh ATP data (no 2-min cache) | STKP-01 | Requires browser + Firebase interaction | Open planning view → modify unidad in another tab → verify view refreshes without 2-min delay |
| StockAmplioIndicator visual layout | STKP-05 | Visual/UX assertion | Manual visual QA: disponible/tránsito/reservado/comprometido displayed correctly with colors |
| Concurrent reservation impossibility | STKP-03 | Real concurrency hard to script in unit tests | Use Firebase emulator + 2 browser tabs → attempt simultaneous reservation of same unit → verify one fails with transaction retry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
