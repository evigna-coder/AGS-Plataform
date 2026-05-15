---
phase: 13-stock-equivalencias-compra-uso
plan: "00"
subsystem: stock
tags: [test-scaffolding, red-baseline, equivalencias, wave-0]
dependency_graph:
  requires: []
  provides:
    - test:equivalencias RED baseline
    - e2e equivalencias fixme specs
    - unit test fixture set (6 named)
  affects:
    - apps/sistema-modular/package.json (new script)
    - All downstream plans (13-01..07) reference these test commands as automated verify
tech_stack:
  added: []
  patterns:
    - Wave 0 RED baseline pattern (mirrors Phase 9 stockAmplio, Phase 12)
    - test.fixme(true, '...') for Playwright un-fixme-by-plan pattern
    - node:assert/strict — no framework install
key_files:
  created:
    - apps/sistema-modular/e2e/equivalencias.spec.ts
    - apps/sistema-modular/src/services/__tests__/equivalencias.test.ts (committed in 13-01)
    - apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts (committed in 13-01)
    - apps/sistema-modular/e2e/helpers/equivalencias.ts (committed in 13-01)
  modified:
    - apps/sistema-modular/package.json (added test:equivalencias script)
decisions:
  - "Wave 0 scaffolding was partially committed by plan 13-01 (fixtures, test file, helpers) — this plan committed the remaining pieces (spec file + package.json script)"
  - "RED baseline: test exits with firebase.ts import.meta.env error (not ERR_MODULE_NOT_FOUND as originally planned, because 13-01 created the service first)"
  - "E2E spec uses test.fixme(true, 'reason') — all 7 specs are currently skipped"
metrics:
  duration: 268s
  completed_date: "2026-05-15"
  tasks: 3
  files: 2
---

# Phase 13 Plan 00: Stock Equivalencias compra↔uso — Wave 0 RED Baseline Summary

**One-liner:** Wave 0 RED test scaffold — unit suite (9 assertions) + Playwright fixme baseline (7 specs / 4 describes) + test:equivalencias npm script.

## What Was Built

### Task 1: Unit test fixtures (`fixtures/equivalencias.ts`)

Six named exports covering all test scenarios for STKE-02 and STKE-04:

| Fixture | Purpose |
|---------|---------|
| `FIXTURE_HAPPY_PATH` | Two unlinked artículos (5183-2209, 5188-5367) — base for link tests |
| `FIXTURE_SELF_LINK` | Single artículo — validates origenId === destinoId rejection |
| `FIXTURE_DESTINO_TOMADO` | Three artículos — art-compra-1 already claims art-uso; art-compra-2 attempts same |
| `FIXTURE_CICLO_A_B_A` | art-B→art-A exists; art-A→art-B must be rejected as cycle |
| `FIXTURE_STOCK_INSUFICIENTE` | Linked pair with only 2 units; request 5 → stock insuficiente |
| `FIXTURE_DESAGREGAR_HAPPY` | Linked pair (factor 10), 5 units origen; request 3 → 30 destino units |

### Task 2: Unit test suite (`equivalencias.test.ts`) + npm script

9 test assertions covering STKE-02 (6 link/unlink validations) and STKE-04 (3 desagregar behaviors):

- STKE-02a: rejects self-link
- STKE-02b: rejects invalid factors (0, -1, NaN, Infinity)
- STKE-02c: rejects origen ya vinculado (/ya tiene/)
- STKE-02d: rejects destino ya tomado (/ya vinculado/)
- STKE-02e: rejects ciclo A→B→A (/ciclo|cycle/)
- STKE-02f: unlink frees destino (subsequent link succeeds)
- STKE-04a: desagregarUnidades completes (stub — will be real in 13-03)
- STKE-04b: rejects when stock insuficiente (/stock insuficiente/)
- STKE-04c: MovimientoStock count assertion (placeholder — 13-03 adds full assertion)

Script added to `apps/sistema-modular/package.json`:
```json
"test:equivalencias": "tsx src/services/__tests__/equivalencias.test.ts"
```

### Task 3: Playwright fixme spec + E2E helper

4 fixme describes (7 total specs), all currently `test.fixme(true, 'reason')`:

| Suite | STKE | Un-fixmed by |
|-------|------|-------------|
| `13.30 — equivalencia.edit` | STKE-03 | Plan 13-04 |
| `13.40 — desagregar` | STKE-05 | Plan 13-05 |
| `13.50 — detail.equivalencia` | STKE-06 | Plan 13-06 |
| `13.60 — lista.equivalencia` | STKE-07 | Plan 13-07 |

## Verification Results

1. `pnpm --filter @ags/sistema-modular test:equivalencias` → **exits non-zero** (RED as expected). Current error: `firebase.ts import.meta.env` — service module exists (committed by 13-01) but pulls real Firebase config which isn't available in tsx. This is acceptable RED state.

2. `npx playwright test --project=chromium --list -g equivalencias` → **lists 7 specs across 4 describes** (13.30, 13.40, 13.50, 13.60), all fixme.

3. `test:equivalencias` script registered in `apps/sistema-modular/package.json` ✓

## Deviations from Plan

### Context: Plan 13-01 Executed Before 13-00

The Phase 13 planning committed plan 13-01 early (commit `3935ff6`), which included the Wave 0 scaffolding files as part of STKE-01 type foundation work. Specifically:
- `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` (committed by 13-01)
- `apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts` (committed by 13-01)
- `apps/sistema-modular/e2e/helpers/equivalencias.ts` (committed by 13-01)

This plan's commit (`d7ef5d4`) added the remaining pieces:
- `apps/sistema-modular/e2e/equivalencias.spec.ts` (new file)
- `apps/sistema-modular/package.json` (added `test:equivalencias` script)

**Impact:** None — all plan requirements are satisfied. The scaffolding files are in place and match the plan specification exactly.

### RED State Type Changed (Auto-observed, not a deviation)

Original expected RED: `ERR_MODULE_NOT_FOUND — equivalenciasService.js`  
Actual RED: `firebase.ts import.meta.env TypeError`

The service module was created by 13-01, so the module-not-found error no longer appears. The test still exits non-zero as required. The firebase.ts error is expected when running tsx outside a Vite bundle (no `import.meta.env` polyfill). Plan 13-02+ will add proper lazy-import separation so the DI hook tests can run without Firestore config.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `apps/sistema-modular/e2e/equivalencias.spec.ts` | FOUND |
| `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` | FOUND |
| `apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts` | FOUND |
| `apps/sistema-modular/e2e/helpers/equivalencias.ts` | FOUND |
| Commit d7ef5d4 | FOUND |
| test:equivalencias in package.json | FOUND |
| Playwright lists 7 fixme specs | PASSED |
| test:equivalencias exits non-zero | PASSED (exit code 1) |
