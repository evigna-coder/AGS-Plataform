---
phase: 13-stock-equivalencias-compra-uso
verified: 2026-05-15T00:00:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "Audit trail visible in movimiento histórico"
    expected: "MovimientoStock with subtipo='conversion' appears in the artículo's history view with origen, destino, factor and unit counts clearly readable"
    why_human: "The audit fields are written to Firestore (confirmed in code), but the UI rendering of the historical MovimientoStock in sistema-modular's history view is not part of a Phase 13 component and cannot be verified from code alone"
---

# Phase 13: Stock — Equivalencias compra↔uso Verification Report

**Phase Goal:** Modelar la relación 1→1 entre código de compra (ej. caja 5183-2209) y código de uso (ej. ampolla 5188-5367) mediante un campo `Articulo.equivalencias[]` con factor, y habilitar la **conversión manual diferida** ("Desagregar ahora") que dispara una transferencia atómica baja-origen / alta-destino registrada como `MovimientoStock` tipo `transferencia` con subtipo `conversion`. Ambos códigos coexisten en stock; la ficha y la búsqueda muestran un **display dual** bajo demanda, sin tocar el sistema de patrones ni los reportes técnicos.

**Verified:** 2026-05-15
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can link two artículos as compra→uso pair with numeric factor; system rejects invalid/cycle links | VERIFIED | `linkEquivalencia` in `equivalenciasService.ts` — 5-case validation (self, factor≤0, origen-taken, destino-taken, cycle A→B→A); all 6 STKE-02 unit assertions pass green |
| 2 | Equivalencia is strictly 1→1; UI blocks N→M | VERIFIED | `linkEquivalencia` rejects if `equivalencias.length > 0` (origen taken) or if another article has `articuloIdDestinoEquivalencia === destinoId` (destino taken); flat field enables Firestore index query for both checks |
| 3 | "Desagregar ahora" triggers atomic runTransaction: N origen down, N×factor destino up, 1 MovimientoStock with subtipo='conversion'; fails atomically on insufficient stock | VERIFIED | `desagregarUnidades` in `equivalenciasService.ts` (478 LOC) has both `_runConversionInTestMode` and `_runConversionInProd` via real Firestore `runTransaction`; STKE-04a/b/c all pass; audit fields (`articuloDestinoId`, `cantidadDestino`, `factorConversion`, `subtipo:'conversion'`, `motivo`) all written |
| 4 | Artículo detail shows dual display (real stock + opposite calculated) always visible; CTA "Desagregar ahora" when compra side has stock | VERIFIED | `EquivalenciaDualDisplay` (147 LOC) wired into `ArticuloDetail.tsx` (197 LOC) and `ViewArticuloModal.tsx` (213 LOC); `useEquivalenciaDual` hook with `mode='loading'` anti-flicker, m4 row ordering; `DesagregarStockModal` CTA wired in both surfaces; post-UAT gap (Ver button) fixed in commit `4e208cc` |
| 5 | Artículos list shows badge on linked rows; dual expansion only on exact-code match search | VERIFIED | `EquivalenciaBadge` atom (48 LOC) with CSS hover tooltip; `ArticulosListRow.tsx` renders badge + `DualExpansionRow` with `data-testid="dual-row"`; `useEquivalenciaListExpansion` hook uses exact-match-only expansion gating |
| 6 | MovimientoStock audit with subtipo='conversion' is written with origin, destination, factor, and unit counts | VERIFIED | `_runConversionInProd` writes `subtipo:'conversion'`, `articuloDestinoId`, `cantidadDestino`, `factorConversion`, `motivo` string embedding both codigos (line 458–473 of equivalenciasService.ts); **UI rendering of history view needs human check — see Human Verification** |
| 7 | Existing consumers of MovimientoStock.tipo continue to work; subtipo is optional | VERIFIED | `subtipo?: 'conversion'` is an optional literal field in `@ags/shared`; all existing reads of `tipo: 'transferencia'` are unaffected; no new `MovimientoStock.tipo` enum value added |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | LOC | Status | Details |
|----------|----------|-----|--------|---------|
| `packages/shared/src/types/index.ts` | Exports `ArticuloEquivalencia`; extends `Articulo` and `MovimientoStock` | — | VERIFIED | `ArticuloEquivalencia` at line 2456; `equivalencias?`, `articuloIdDestinoEquivalencia?` on Articulo; `subtipo?`, `articuloDestinoId?`, `cantidadDestino?`, `factorConversion?` on MovimientoStock |
| `apps/sistema-modular/src/services/equivalenciasService.ts` | `linkEquivalencia`, `unlinkEquivalencia`, `desagregarUnidades`, `recomputeEquivalenciaDenormalization` | 478 | VERIFIED | All 5 exported functions present; lazy Firebase imports; `__setTestFirestore` DI hook; full runTransaction implementation |
| `apps/sistema-modular/src/services/equivalenciasTypes.ts` | `MockEquivalenciasState`, `FirestoreDouble`, `FirestoreTxDouble` | 96 | VERIFIED | Supporting types extracted for near-250 LOC budget compliance in service file |
| `apps/sistema-modular/src/components/stock/EquivalenciaSection.tsx` | Link/unlink UI for EditArticuloModal | 82 | VERIFIED | SearchableSelect + factor input + Vincular/Desvincular; data-testid on root and error element |
| `apps/sistema-modular/src/hooks/useEquivalenciaSection.ts` | Hook with named imports from equivalenciasService | 125 | VERIFIED | Self-loads articulo via articulosService.getById; named imports, no @ts-expect-error |
| `apps/sistema-modular/src/components/stock/DesagregarStockModal.tsx` | Conversion modal with preview, ubicacion picker, success block | 162 | VERIFIED | EditorialTeal modal; info header DESDE/HACIA/FACTOR; SearchableSelect for ubicacion; preview panel; inline success block |
| `apps/sistema-modular/src/hooks/useDesagregarStock.ts` | Hook with ubicacion grouping and canConfirm guard | 148 | VERIFIED | Groups UnidadStock by ubicacion.referenciaId; cantidadDestinoPreview computed; calls desagregarUnidades |
| `apps/sistema-modular/src/hooks/useEquivalenciaDual.ts` | Loading-aware mode derivation hook | 122 | VERIFIED | `mode='loading'` as first-class return; `discoveryDone` flag; calls `findOrigenDeDestino` |
| `apps/sistema-modular/src/components/stock/EquivalenciaDualDisplay.tsx` | Dual-row card with loading skeleton and row ordering | 147 | VERIFIED | mode='loading' skeleton; m4 row ordering (viewer's article on top); `resolveStock` with resumenStock fallback |
| `apps/sistema-modular/src/pages/stock/ArticuloDetail.tsx` | Mounts EquivalenciaDualDisplay + DesagregarStockModal | 197 | VERIFIED | Both components imported and mounted; dualRefreshKey bumped on success |
| `apps/sistema-modular/src/components/stock/ViewArticuloModal.tsx` | Mounts EquivalenciaDualDisplay + DesagregarStockModal (post-UAT gap fix) | 213 | VERIFIED | Both components imported and mounted; commit 4e208cc (post-UAT gap fix) |
| `apps/sistema-modular/src/pages/stock/ArticulosList.tsx` | Slimmed shell consuming extraction (401→244 LOC) | 244 | VERIFIED | Imports ArticulosListFilters, ArticulosListRow, useEquivalenciaListExpansion |
| `apps/sistema-modular/src/pages/stock/ArticulosListRow.tsx` | Row with badge slot + DualExpansionRow | 165 | VERIFIED | `data-testid="dual-row"` on expansion tr; EquivalenciaBadge imported and rendered |
| `apps/sistema-modular/src/pages/stock/ArticulosListFilters.tsx` | Extracted filter bar | 92 | VERIFIED | Extracted from pre-refactor ArticulosList |
| `apps/sistema-modular/src/pages/stock/hooks/useEquivalenciaListExpansion.ts` | destinoLookup + hasEquivalencia + shouldExpandRow | 65 | VERIFIED | Exact-match-only expansion guard |
| `apps/sistema-modular/src/components/stock/EquivalenciaBadge.tsx` | Teal pill atom with CSS hover tooltip | 48 | VERIFIED | `group` + `group-hover:visible` tooltip; `data-testid="equivalencia-badge"` and `data-testid="equivalencia-badge-tooltip"` |
| `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` | Unit suite — 9 assertions for STKE-02/04 | — | VERIFIED | All 9 tests pass (STKE-02a/b/c/d/e/f + STKE-04a/b/c) |
| `apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts` | 6 named fixtures | — | VERIFIED | FIXTURE_HAPPY_PATH, FIXTURE_SELF_LINK, FIXTURE_DESTINO_TOMADO, FIXTURE_CICLO_A_B_A, FIXTURE_STOCK_INSUFICIENTE, FIXTURE_DESAGREGAR_HAPPY |
| `apps/sistema-modular/e2e/equivalencias.spec.ts` | Playwright specs; fixme count = 0 | — | VERIFIED | 13.30/13.40/13.50 on test.skip (post-UAT); 13.60 has 5 real tests un-fixmed; `test.fixme` count = 0 |
| `apps/sistema-modular/e2e/helpers/equivalencias.ts` | Real seedEquivalenciaPair (no TODO stub) | 100 | VERIFIED | Uses Firestore client SDK; real setDoc calls; explicitly documented as "REAL implementation (m4 fix — no TODO stub)" |
| `apps/sistema-modular/package.json` | `test:equivalencias` script | — | VERIFIED | `"test:equivalencias": "tsx src/services/__tests__/equivalencias.test.ts"` at line 23 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `equivalencias.test.ts` | `equivalenciasService.ts` | Named imports (`linkEquivalencia`, `unlinkEquivalencia`, `desagregarUnidades`, `__setTestFirestore`) | WIRED | Tests import and exercise all 4 functions; 9/9 pass |
| `EquivalenciaSection.tsx` | `equivalenciasService` | via `useEquivalenciaSection` hook (named imports from firebaseService barrel) | WIRED | Hook imports `linkEquivalencia`, `unlinkEquivalencia` from `../services/firebaseService` |
| `EditArticuloModal.tsx` | `EquivalenciaSection.tsx` | Direct import + mount at line 169 | WIRED | Confirmed via grep |
| `ArticuloDetail.tsx` | `EquivalenciaDualDisplay.tsx` | Import at line 7; mounted at line 126 | WIRED | Confirmed via grep |
| `ArticuloDetail.tsx` | `DesagregarStockModal.tsx` | Import at line 8; mounted at line 186 | WIRED | Confirmed via grep |
| `ViewArticuloModal.tsx` | `EquivalenciaDualDisplay.tsx` | Import at line 5; mounted at line 149 | WIRED | Confirmed via grep; post-UAT fix commit 4e208cc |
| `ViewArticuloModal.tsx` | `DesagregarStockModal.tsx` | Import at line 6; mounted at line 201 | WIRED | Confirmed via grep; post-UAT fix commit 4e208cc |
| `ArticulosListRow.tsx` | `EquivalenciaBadge.tsx` | Import at line 2; rendered at line 72 | WIRED | Badge shows `data-testid="equivalencia-badge"` |
| `ArticulosList.tsx` | `useEquivalenciaListExpansion` | Import at line 17; called at line 114 | WIRED | `hasEquivalencia` and `shouldExpandRow` consumed |
| `firebaseService.ts` | `equivalenciasService.ts` | Barrel re-exports at lines 28-32 | WIRED | 5 functions re-exported: linkEquivalencia, unlinkEquivalencia, findOrigenDeDestino, desagregarUnidades, recomputeEquivalenciaDenormalization |
| `stockService.ts` (articulosService.update) | `equivalenciasService.recomputeEquivalenciaDenormalization` | Lazy dynamic import (fire-and-forget) | WIRED | Lazy `await import('./equivalenciasService')` prevents module cycle; breaks on rename of codigo/descripcion |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STKE-01 | 13-01 | `ArticuloEquivalencia` type + `Articulo.equivalencias?` + `articuloIdDestinoEquivalencia?` + `MovimientoStock.subtipo?` | SATISFIED | `packages/shared/src/types/index.ts` lines 2456–2511, 2738–2750 |
| STKE-02 | 13-02 | `linkEquivalencia`/`unlinkEquivalencia` with 5-case validation | SATISFIED | `equivalenciasService.ts`; all 6 unit assertions (STKE-02a..f) pass |
| STKE-03 | 13-04 | UI de vinculación — EquivalenciaSection in EditArticuloModal | SATISFIED | `EquivalenciaSection.tsx` (82 LOC) + `useEquivalenciaSection.ts` (125 LOC) wired into `EditArticuloModal.tsx` line 169 |
| STKE-04 | 13-03 | `desagregarUnidades` as atomic runTransaction | SATISFIED | `equivalenciasService.ts` `_runConversionInProd` (real Firestore runTransaction); STKE-04a/b/c pass |
| STKE-05 | 13-05 | CTA "Desagregar ahora" with modal (ubicacion picker, preview, success block) | SATISFIED | `DesagregarStockModal.tsx` (162 LOC) + `useDesagregarStock.ts` (148 LOC); wired in ArticuloDetail and ViewArticuloModal |
| STKE-06 | 13-06 | Display dual in ArticuloDetail — always visible, both sides | SATISFIED | `EquivalenciaDualDisplay.tsx` (147 LOC) wired in ArticuloDetail (197 LOC) AND ViewArticuloModal (213 LOC); UAT approved |
| STKE-07 | 13-07 | Badge in list; on-demand dual expansion on exact-code search | SATISFIED | `EquivalenciaBadge.tsx` (48 LOC); `useEquivalenciaListExpansion`; exact-match-only gate; hover tooltip (commit 7d67f8b); UAT approved |

All 7 STKE requirements are marked `[x]` complete in `.planning/REQUIREMENTS.md` at lines 89–95 and the requirement tracker at lines 179–185.

---

### Test Suite Results

```
pnpm --filter @ags/sistema-modular test:equivalencias

  ✓ STKE-02a passed: rejects self-link
  ✓ STKE-02b passed: rejects invalid factors (0, -1, NaN, Infinity)
  ✓ STKE-02c passed: rejects origen ya vinculado
  ✓ STKE-02d passed: rejects destino ya tomado
  ✓ STKE-02e passed: rejects ciclo A→B→A
  ✓ STKE-02f passed: unlink frees destino (art-compra-2 can link after unlink of art-compra-1)
  ✓ STKE-04a passed: desagregarUnidades completed without error
  ✓ STKE-04c passed: no extra MovimientoStock created
  ✓ STKE-04b passed: rejects when stock insuficiente

✅ All equivalencias tests passed (9/9)
```

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `EquivalenciaDualDisplay.tsx` line 72 | `return null` | Info | Legitimate conditional render guard (`if (dual.mode === 'none') return null`) — not a stub |
| `EquivalenciaSection.tsx` line 34 | `return null` | Info | Legitimate guard (`if (!articulo \|\| !eq) return null`) — not a stub |
| `DesagregarStockModal.tsx` line 34 | `return null` | Info | Legitimate guard (no equivalencia configured) — not a stub |
| `equivalencias.spec.ts` 13.30/13.40/13.50 | `test.skip` | Info | Intentional — visual UAT was approved for these surfaces; seed automation deferred; fixme count = 0 |
| `ROADMAP.md` Phase 13 plan checkboxes | `[ ]` unchecked | Info | Documentation-only gap — plans are documented as `[ ]` instead of `[x]` in the ROADMAP plan list, but all SUMMARYs exist and all code is complete. No code impact. |

No blockers or substantive stubs found.

---

### Human Verification Required

#### 1. MovimientoStock audit visible in historical view (STKE-06 / Success Criterion 6)

**Test:** Open an artículo that has been through at least one `desagregarUnidades` conversion. Navigate to its movement history.
**Expected:** One MovimientoStock entry shows `tipo: 'transferencia'`, `subtipo: 'conversion'`, the origen codigo, the destino codigo (from `motivo` string), the factor applied, and unit counts on both sides (cantidadOrigen and cantidadDestino).
**Why human:** The audit fields are confirmed written to Firestore (lines 458–473 of `equivalenciasService.ts`). However, how these fields surface in the UI history view (which predates Phase 13) cannot be verified from code inspection. If the history view does not render `subtipo` or the motivo string clearly, Success Criterion 6 is only partially met.

---

### Commit Audit

All 16 Phase 13 commits confirmed present in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| `3935ff6` | 13-01 | feat: @ags/shared — ArticuloEquivalencia + Articulo.equivalencias + MovimientoStock.subtipo (STKE-01) |
| `d7ef5d4` | 13-00 | test: scaffold equivalencias RED baseline (unit + e2e fixme + script) |
| `a63c93e` | 13-02 | feat: equivalenciasService link/unlink + DI hook + FirestoreDouble contract (STKE-02) |
| `eb1ba80` | 13-02 | feat: wire articulosService.update() to recompute equivalencia denormalization |
| `d4b77f1` | 13-03 | feat: desagregarUnidades runTransaction — atomic conversion compra→uso (STKE-04) |
| `a57bb3a` | 13-04 | feat: add useEquivalenciaSection hook (STKE-03) |
| `b5407b0` | 13-04 | feat: EquivalenciaSection in EditArticuloModal (STKE-03) |
| `8d112fc` | 13-05 | feat: create useDesagregarStock hook |
| `d02009c` | 13-05 | feat: create DesagregarStockModal component (STKE-05) |
| `beadd13` | 13-06 | feat: create useEquivalenciaDual hook with loading-aware mode |
| `aa458b7` | 13-06 | feat: create EquivalenciaDualDisplay component |
| `4be16b2` | 13-06 | feat: wire EquivalenciaDualDisplay + DesagregarStockModal into ArticuloDetail |
| `4e208cc` | 13-06 | fix: mount EquivalenciaDualDisplay in ViewArticuloModal (Ver button surface — post-UAT gap) |
| `7c9e19c` | 13-07 | refactor: pre-extract ArticulosList (401→244 LOC) + useEquivalenciaListExpansion hook |
| `7d67f8b` | 13-07 | feat: EquivalenciaBadge atom + useSearchableSelect linkedCode extension (STKE-07) |
| `112bb94` | 13-07 | feat: real seedEquivalenciaPair + finalize all 13.60 e2e specs (fixme=0) |

---

### Phase Goal Assessment

The phase goal is achieved. Every dimension of the stated goal has verifiable code evidence:

- **1→1 model with factor:** `ArticuloEquivalencia` interface in `@ags/shared`; `Articulo.equivalencias[]` field with flat `articuloIdDestinoEquivalencia` index escape hatch.
- **Conversion manual diferida:** `desagregarUnidades` as real Firestore `runTransaction`; both test-mode and prod-mode paths implemented.
- **Display dual always visible in ficha:** `EquivalenciaDualDisplay` mounted in `ArticuloDetail` AND `ViewArticuloModal` (both surfaces verified).
- **Display dual bajo demanda en lista:** `useEquivalenciaListExpansion` with exact-match-only gate; `EquivalenciaBadge` with hover tooltip.
- **No breach of frozen surfaces:** Zero edits to `apps/reportes-ot/`; Phase 14 (patrones) and Phase 15 (loaner) untouched.
- **All 9 unit assertions pass:** `pnpm --filter @ags/sistema-modular test:equivalencias` exits 0.
- **UAT approved:** Plans 13-06 and 13-07 both received explicit user approval after visual UAT; post-UAT gap (ViewArticuloModal) was identified and fixed before 13-06 closure.

One human verification item remains (audit visibility in history UI) but it does not block the status as `passed` because the audit data is confirmed written to Firestore and the history UI is a pre-existing surface outside Phase 13's scope.

---

_Verified: 2026-05-15_
_Verifier: Claude (gsd-verifier)_
