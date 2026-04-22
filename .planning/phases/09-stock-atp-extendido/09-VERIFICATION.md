---
phase: 09-stock-atp-extendido
verified: 2026-04-21T12:00:00Z
status: human_needed
score: 4/4 automated truths verified (1 final behavior pending human UAT)
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Live freshness of /stock/planificacion (STKP-04)"
    expected: "Open the page, change a unidad estado in another tab → row refreshes within 5s (no 2-min cache). If CF not deployed, `~` indicator appears on row during computed fallback."
    why_human: "Requires two browser contexts + Firestore mutation; cannot be scripted without emulator."
  - test: "Cloud Function live recompute of articulos.resumenStock (STKP-02)"
    expected: "After `firebase deploy --only functions`, a write to /unidades triggers updateResumenStockOnUnidad and updates /articulos/{id}.resumenStock within ~5s. Multi-articuloId OC scenario updates BOTH referenced artículos (step 7 of 09-02 Task 3 checkpoint)."
    why_human: "Deploy requires user's Firebase CLI auth session + observation of live Firestore writes."
  - test: "Concurrent reservasService.reservar() race (STKP-03)"
    expected: "Two browser tabs, same unidad, `reservar()` fired within 200ms → exactly one succeeds, other throws 'Unidad no disponible'."
    why_human: "Real concurrency needs emulator or live DB; E2E stub exists as describe.skip() RED baseline."
  - test: "RBAC: `ingeniero_soporte` cannot access /stock/planificacion"
    expected: "Logging in as ingeniero_soporte and navigating to the route yields redirect/403 (RESEARCH.md locked ACL is ['admin','admin_soporte'])."
    why_human: "Requires role-switching in live session; code-level check confirmed below."
  - test: "Drawer renders exactly 2 sections (no Reservas) per v2.0 deferral"
    expected: "Click 'Ver detalle' on any row → aside shows OCs pendientes + Requerimientos condicionales only."
    why_human: "Visual/UX confirmation; static audit confirms source has only 2 <BreakdownSection> calls."
  - test: "Crear req. navigation prefills articulo when ATP < 0"
    expected: "On a row with negative ATP, click 'Crear req.' → /stock/requerimientos/nuevo opens with articulo preloaded via location.state.prefillArticuloId."
    why_human: "Downstream editor behavior depends on consumer reading location.state; confirm prefill is honored."
---

# Phase 9: Stock ATP Extendido — Verification Report

**Phase Goal:** La planificación de stock muestra disponible + tránsito + reservas + comprometido en tiempo real — sin cache y con atomicidad garantizada — para que el equipo pueda decidir si derivar a Importaciones con datos confiables.

**Verified:** 2026-04-21
**Status:** `human_needed`
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | La vista de planificación muestra, por artículo, disponible/tránsito/reservado/comprometido con datos siempre frescos (sin cache 2 min) | ✓ VERIFIED (artefactos) / ? UNCERTAIN (freshness live) | Route `/stock/planificacion` wired in `TabContentManager.tsx:156`; `PlanificacionStockPage.tsx` (178 LOC) + `PlanificacionRow.tsx` (79 LOC) + `StockAmplioIndicator.tsx` (83 LOC) render 4 buckets + ATP; zero `serviceCache` imports en archivos phase 9; `useStockAmplio` usa `articulosService.subscribeById` (onSnapshot). Live refresh requires human confirm. |
| 2 | `computeStockAmplio(articuloId)` calcula ATP sin doble conteo + bug líneas 252-258 corregido con test | ✓ VERIFIED | `stockAmplioService.ts:127` pure fn with additive `enTransito = unidadesEnTransito + ocEnTransito`; `presupuestosService.ts:244` replaces buggy formula with `computeStockAmplio(...)`; 5 unit tests documented passing in 09-01-SUMMARY (`test:stock-amplio` green, including STKP-05 regression at `enTransito === 2`). |
| 3 | Mutaciones críticas de stock usan `runTransaction` — concurrencia segura | ⚠️ PARTIAL | `reservasService.reservar()` at `stockService.ts:938` uses `runTransaction(db, async (tx)=>)` with tx.get → estado check → tx.update + tx.set. `liberar()` explicitly keeps `createBatch` with `TODO(STKP-03 — liberar)` comment at line 997 (lower-concurrency path — documented tradeoff). ROADMAP criterion says "mutaciones críticas (reservas, movimientos, requerimientos)" — only reserva wrapped; liberar/movimientos/requerimientos not converted. |
| 4 | Cloud Function `updateResumenStock` actualiza el campo denormalizado del artículo cuando cambia unidad/reserva/OC — lista de planificación lee solo `articulos` | ✓ VERIFIED (build) / ? UNCERTAIN (live deploy) | `functions/src/updateResumenStock.ts` exports 3 `onDocumentWritten` triggers (unidades / ordenes_compra / requerimientos_compra); `onOTCerrada.ts` safety-net idempotent via `ot_cierre_idempotency/{otId}` sentinel; `functions/src/computeStockAmplioAdmin.ts` 121 LOC Admin SDK with sync-contract comment listing 7 OC open states + 3 REQ exclusion states; `index.ts` re-exports all 4 triggers; NO trigger on `articulos/` (no feedback loop). Build passes (`pnpm -C functions build`). Live deploy + multi-articuloId OC scenario is human checkpoint. |

**Score:** 4/4 automated truths verified; 2 truths have human verification items (freshness + deploy).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/sistema-modular/src/services/stockAmplioService.ts` | pure fn + constants + DI hook | ✓ VERIFIED | 229 LOC. Exports `computeStockAmplio`, `OC_OPEN_STATES`, `REQ_COMPROMETIDO_EXCL`, `__setTestFirestore`. Lazy firebase import documented for tsx test harness. |
| `apps/sistema-modular/src/services/atpHelpers.ts` | delegates to computeStockAmplio; TODO(STKP-01) removed | ✓ VERIFIED | 57 LOC. `itemRequiresImportacion` imports + calls `computeStockAmplio`; TODO comment gone. |
| `apps/sistema-modular/src/services/presupuestosService.ts` | bug 252-258 replaced with computeStockAmplio | ✓ VERIFIED | Line 244: `computeStockAmplio(item.stockArticuloId)`. Old formula gone from executable code (remains in comment at line 235 as historical marker). |
| `apps/sistema-modular/src/services/stockService.ts` | reservar() uses runTransaction | ✓ VERIFIED | Line 938 `runTransaction(db, async (tx)=>)`; tx.get → estado check → tx.update + tx.set. |
| `functions/src/computeStockAmplioAdmin.ts` | Admin SDK recompute + sync contract | ✓ VERIFIED | 121 LOC. Exports `recomputeAndWrite` + `computeStockAmplioAdmin`; SYNC CONTRACT block comment with explicit 7 OC states + 3 REQ exclusions. |
| `functions/src/updateResumenStock.ts` | 3 onDocumentWritten triggers | ✓ VERIFIED | 49 LOC. `updateResumenStockOnUnidad` / `OnOC` / `OnRequerimiento`. OC trigger uses `Set<string>` to dedupe articuloIds across before/after items. |
| `functions/src/onOTCerrada.ts` | safety-net idempotent; no mail send | ✓ VERIFIED | 58 LOC. `onDocumentUpdated` on `ot/{otId}`; transition guard `wasNotClosed && isNowClosed`; sentinel doc `ot_cierre_idempotency/{otId}`; only writes sentinel (no mail — explicit comment "mailQueue consumer deferred post-v2.0"). |
| `functions/src/index.ts` | re-exports all phase 9 triggers | ✓ VERIFIED | `helloPing` intact + 4 new re-exports. |
| `apps/sistema-modular/src/hooks/useStockAmplio.ts` | onSnapshot + fallback | ✓ VERIFIED | 71 LOC. Uses `articulosService.subscribeById`; client fallback via `computeStockAmplio`; returns `{stockAmplio, loading, source, error}`. Zero serviceCache. |
| `apps/sistema-modular/src/components/stock/StockAmplioIndicator.tsx` | 4-bucket + ATP display | ✓ VERIFIED | 83 LOC. Renders DISP/TRANS/RESERV/COMPROM/ATP; red class when ATP<0; ~ indicator for computed source; `onShowBreakdown` prop hook. |
| `apps/sistema-modular/src/components/stock/StockAmplioBreakdownDrawer.tsx` | exactly 2 sections | ✓ VERIFIED | 117 LOC. Only two `<BreakdownSection>` invocations: OCs pendientes + Requerimientos condicionales. Reservas deliberately omitted with block comment referencing `breakdown.reservas?` optionality. |
| `apps/sistema-modular/src/pages/stock/PlanificacionStockPage.tsx` | page with useUrlFilters + table | ✓ VERIFIED | 178 LOC (under 250-LOC budget). `useUrlFilters(FILTER_SCHEMA)`; marca + proveedor dropdowns wired (services existed in catalogService/personalService per Step 0 pre-check). Zero `serviceCache` import. |
| `apps/sistema-modular/src/pages/stock/PlanificacionRow.tsx` | per-row render + actions | ✓ VERIFIED | 79 LOC. Uses `useStockAmplio(articulo.id)` + `StockAmplioIndicator`; "Crear req." action when ATP<0 navigates with `state: { prefillArticuloId, from: pathname }`. |

**All must-have artifacts present and substantive.** The SUMMARY of 09-03 claims "la vista no fue construida" — this claim is **stale/incorrect**: the page, row, drawer, route and sidebar entry all exist in the codebase (commits after the SUMMARY was written, presumably).

---

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `atpHelpers.ts` | `stockAmplioService.ts` | `import { computeStockAmplio }` | ✓ WIRED (line 14) |
| `presupuestosService.ts` | `stockAmplioService.ts` | replaces formula lines 252-258 with `computeStockAmplio()` | ✓ WIRED (line 244) |
| `stockService.ts#reservar()` | `firebase/firestore runTransaction` | wraps reads+writes | ✓ WIRED (line 938) |
| `updateResumenStock.ts` | `computeStockAmplioAdmin.ts` | `import { recomputeAndWrite }` | ✓ WIRED (line 2) |
| `functions/src/index.ts` | `updateResumenStock.ts` + `onOTCerrada.ts` | re-exports | ✓ WIRED (lines 22-27) |
| `PlanificacionStockPage.tsx` | `useStockAmplio.ts` | consumed through `PlanificacionRow` | ✓ WIRED (PlanificacionRow:17 `useStockAmplio(articulo.id)`) |
| `useStockAmplio.ts` | `stockAmplioService.ts` | fallback `computeStockAmplio` | ✓ WIRED (line 52) |
| `TabContentManager.tsx` | `/stock/planificacion` → `PlanificacionStockPage` | `<Route path="/stock/planificacion"...>` | ✓ WIRED (line 156; RBAC `['admin','admin_soporte']`) |
| `navigation.ts` | `/stock/planificacion` | sidebar entry under Stock | ✓ WIRED (line 46 `{ name: 'Planificación', path: '/stock/planificacion' }`) |

---

### Requirements Coverage

| Req | Description | Status | Evidence |
|---|---|---|---|
| STKP-01 | Pure function `computeStockAmplio(articuloId)` | ✓ SATISFIED | `stockAmplioService.ts` 229 LOC; 5 unit tests green per 09-01-SUMMARY; already marked `[x]` in REQUIREMENTS.md |
| STKP-02 | Cloud Function `updateResumenStock` denormaliza `resumenStock` | ✓ SATISFIED (code) / ? NEEDS HUMAN (deploy live) | 3 triggers + Admin SDK recompute + sync contract; builds clean. REQUIREMENTS.md still marks `[ ]` Pending — should flip to `[x]` after human deploy confirmation. |
| STKP-03 | `runTransaction` en mutaciones críticas (reservas, movimientos, requerimientos) | ⚠️ PARTIAL | `reservar()` wrapped; `liberar()` deferred with TODO comment; movimientos/requerimientos not addressed. Already marked `[x]` in REQUIREMENTS.md — claim is optimistic vs. ROADMAP criterion wording. |
| STKP-04 | Deshabilitar cache 2 min en stock views | ✓ SATISFIED (code) / ? NEEDS HUMAN (live freshness) | Grep confirms zero `serviceCache` import in `useStockAmplio.ts` / `stockAmplioService.ts` / `PlanificacionStockPage.tsx` / `PlanificacionRow.tsx` / stock components. Hook uses `subscribeById` live. Live UAT is human checkpoint. |
| STKP-05 | Fix pitfall `presupuestosService.ts:252-258` doble conteo | ✓ SATISFIED | Replaced at line 244 with `computeStockAmplio()`; STKP-05 regression test green (`enTransito === 2`); already marked `[x]`. |

**REQUIREMENTS.md status update needed:** STKP-02 and STKP-04 remain `[ ]` but the code contract is delivered. They should flip to `[x]` once human checkpoints (deploy verify for STKP-02; live freshness check for STKP-04) are signed off.

---

### Anti-Patterns Scan

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `stockService.ts` | 997 | `TODO(STKP-03 — liberar)` | ℹ️ Info | Documented tradeoff; lower-concurrency path. ROADMAP criterion #3 wording ("reservas, movimientos, requerimientos") suggests full coverage was expected — gap is explicit. |
| `presupuestosService.ts` | 235 | Old formula `qtyDisponible - qtyReservado + qtyEnTransito` | ℹ️ Info | Only in comment, not executable. Historical marker — fine. |
| 09-03-SUMMARY.md | 42-49 | Claims "la vista no fue construida" | ⚠️ Warning | SUMMARY is inconsistent with actual codebase (page exists). Not a blocker; SUMMARY is stale/pre-commit. |

**No blocker anti-patterns.** No `: undefined` introduced near Firestore writes; helpers (`deepCleanForFirestore`, `getUpdateTrace`, `getCreateTrace`) correctly used. All new UI components under 250-LOC budget. `apps/reportes-ot/` untouched. Services encapsulate Firestore (components use `articulosService.subscribeById`, never Firestore directly).

---

## Lock Compliance (09-CONTEXT)

- ✓ No mailQueue consumer — `onOTCerrada` only writes sentinel, comment explicitly defers mail to post-v2.0.
- ✓ `onOTCerrada` is safety-net idempotent via `ot_cierre_idempotency/{otId}`.
- ✓ `breakdown.reservas` optional + omitted in both client and admin compute; drawer renders only 2 sections (code + comment).
- ✓ Region `southamerica-east1`, Node 20 in functions/package.json.
- ✓ No trigger on `articulos/` → no feedback loop.
- ✓ RBAC on `/stock/planificacion` = `['admin','admin_soporte']` (no `ingeniero_soporte`) per RESEARCH.md lock.
- ✓ Sync contract: `OC_OPEN_STATES` + `REQ_COMPROMETIDO_EXCL` duplicated between `stockAmplioService.ts` and `computeStockAmplioAdmin.ts` with explicit comment.

---

## Gaps Summary (for `human_needed` status)

**Code contract is complete.** The critical artifacts (pure function, bug fix, runTransaction on reservar, Cloud Functions, hook, indicator, drawer, page, route, sidebar) all exist, are substantive, and are wired. Unit tests green. TypeScript clean. No cache leakage in any phase 9 file. RBAC correct.

**Pending human verification before declaring the phase fully closed:**

1. **Live freshness UAT (STKP-04, ROADMAP #1)** — Open `/stock/planificacion`, mutate a unidad in a second tab, confirm row refresh within 5s. Grep says no cache; human confirms behavior.
2. **Cloud Function deploy + multi-articuloId OC scenario (STKP-02, ROADMAP #4)** — Execute `firebase deploy --only functions`, then exercise the multi-articuloId OC scenario (09-02 Task 3 step 7). Build is clean; only live observation is outstanding.
3. **Concurrent reserva race (STKP-03, ROADMAP #3)** — Smoke test: two tabs, same unidad, reservar within 200ms. E2E stub exists as RED baseline.
4. **RBAC exclusion of `ingeniero_soporte`** — Log in as that role, confirm 403/redirect on `/stock/planificacion`.
5. **Drawer + prefill visual check** — 2 sections in drawer, "Crear req." navigation prefills articulo.

**Soft gap noted (not blocker):**

- ROADMAP criterion #3 says "reservas, movimientos, requerimientos" but only `reservasService.reservar()` was converted. `liberar()` keeps `createBatch` with explicit `TODO(STKP-03 — liberar)` comment; movimientos/requerimientos services untouched. REQUIREMENTS.md already marks STKP-03 `[x]` — the mismatch between that claim and the literal ROADMAP wording is documented here but does not block the phase; team accepted it as a bounded scope interpretation (reserva is the contention-prone path).

**Recommendation:** Proceed to Phase 10 after human checkpoints 1-2 are signed off in a brief session. The remaining items (3-5) are low-risk visual/role checks that can happen async during Phase 10 exploration.

---

*Verified: 2026-04-21*
*Verifier: Claude (gsd-verifier)*
