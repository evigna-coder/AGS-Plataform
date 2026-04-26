---
phase: 12-esquema-facturacion-porcentual-anticipos
verified: 2026-04-26T18:00:00Z
status: gaps_found
score: 6/8 success-criteria verified
gaps:
  - truth: "Un admin puede definir un esquema de N cuotas con % y hito en el ppto borrador — la UI valida que la suma sea 100% por moneda antes de guardar (BILL-01 / SC-1)"
    status: partial
    reason: "EsquemaFacturacionSection is wired only in EditPresupuestoModal. CreatePresupuestoModal still renders PresupuestoCuotasSection (legacy monto-based contrato cuotas) and has no EsquemaFacturacionSection. Users cannot define a % schema at creation time — they must create first, then re-open to edit. This contradicts the stated user flow 'crear con todo y mandar'."
    artifacts:
      - path: "apps/sistema-modular/src/components/presupuestos/CreatePresupuestoModal.tsx"
        issue: "Imports and renders PresupuestoCuotasSection (line 7, 76). No import or render of EsquemaFacturacionSection."
      - path: "apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx"
        issue: "EsquemaFacturacionSection present and correct at line 313 — create-flow is the missing surface."
    missing:
      - "Add EsquemaFacturacionSection (Phase 12 % editor) to CreatePresupuestoModal, guarded by tipo !== 'contrato' (mirrors EditPresupuestoModal line 312)"
      - "Wire esquemaFacturacion field into useCreatePresupuestoForm state + save payload"
      - "Remove or visually suppress PresupuestoCuotasSection from create flow for non-contrato types (it renders the contrato installment planner which is irrelevant at create time for per_incident/ventas types)"
  - truth: "Tests Playwright cubren los 3 flujos típicos (30/70, 70/30 pre-embarque, 100% al cierre) sin warnings ni huérfanos — BILL-08 / SC-8"
    status: failed
    reason: "E2E sub-suites 11.50/11.51/11.52 were un-fixmed in plan 12-06 and their test bodies are implemented, BUT plan 12-06 SUMMARY explicitly defers Task 4 (running the e2e suite + manual visual checks) because the create-flow gap (gap #1 above) means the tests would fail or not represent the full production happy path. The specs exist on disk but are untested against a real browser. Per user instruction, e2e tests are not run in this verification (static analysis only) — but the gap is structural: tests exercise a create-then-edit flow that is blocked for users unless they use the two-step workaround."
    artifacts:
      - path: "apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts"
        issue: "Sub-suites 11.50/11.51/11.52 implemented (no test.fixme) but untested. Their createPptoBorradorWithTemplate helper navigates through the create flow where EsquemaFacturacionSection does NOT render — the template buttons (esquema-quick-30-70 etc.) will not be found."
    missing:
      - "After gap #1 (create-flow) is closed: run pnpm --filter sistema-modular e2e -- --grep '11.5' and confirm green"
      - "Run 4 manual visual checks from 12-VALIDATION.md (badge color, MIXTA template defaults, MIXTA 3-moneda mini-modal, preEmbarque audit posta)"
human_verification:
  - test: "Sigma-percent badge color rendering"
    expected: "Green badge at Sigma=100%, red badge with copy 'Cuotas en ARS suman 90%, deben sumar 100%' at 30%+60%"
    why_human: "Badge color (Tailwind bg-green-*/bg-red-*) is not deterministic in headless Playwright; presence can be asserted but color rendering requires visual inspection"
  - test: "MIXTA quick-template defaults"
    expected: "ARS+USD ppto -> click '30/70 anticipo+entrega' -> 2 cuotas added: cuota 1 {ARS:30, USD:30} hito=ppto_aceptado, cuota 2 {ARS:70, USD:70} hito=todas_ots_cerradas"
    why_human: "Template correctness is judgmental — values can be asserted programmatically but 'feels right' UX requires manual check after create-flow gap is closed"
  - test: "MIXTA mini-modal with 3 monedas (ARS+USD+EUR)"
    expected: "3 input columns render without overflow; all 3 generar-cuota-input-{moneda} data-testids visible"
    why_human: "CSS overflow edge case; three-currency layout must be visually inspected as headless can miss overflow"
  - test: "preEmbarque audit posta target in Firestore"
    expected: "Toggle preEmbarque -> query leads/{leadId}.postas[] -> entry with accion='pre_embarque_marcada' or equivalent"
    why_human: "Best-effort posta write (try/catch in togglePreEmbarque) may silently fail; requires manual Firestore inspection post-toggle"
---

# Phase 12: Esquema Facturación Porcentual + Anticipos — Verification Report

**Phase Goal:** Permitir que un presupuesto se facture en N cuotas porcentuales con hitos disparadores configurables. Soporte MIXTA con % per-moneda independientes. Opt-in, no rompe Tier-1 legacy.
**Verified:** 2026-04-26
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Admin puede definir esquema N cuotas con % y hito en borrador; UI valida Sigma=100 por moneda | PARTIAL | EsquemaFacturacionSection exists and works in EditPresupuestoModal only. CreatePresupuestoModal has zero esquema support — PresupuestoCuotasSection (legacy) rendered instead. |
| SC-2 | Al cumplirse un hito las cuotas pasan a 'habilitada' automaticamente y aparece boton Generar solicitud | VERIFIED | _recomputeAndPersistEsquema wired in 4 sync points (presupuestosService.update, generarAvisoFacturacion post-tx, otService.cerrarAdministrativamente + _syncPresupuestoOnFinalize, facturacionService.update). CuotasDelEsquemaSection renders state-driven buttons. |
| SC-3 | Generar solicitud para cuota crea solicitudFacturacion 1:1 con cuotaId back-ref, sin mutar otsListasParaFacturar | VERIFIED | generarAvisoFacturacion extended with cuotaId path (presupuestosService.ts). Pitfall 8 honored — otsListasParaFacturar NOT mutated in anticipo path. cuotaId persisted in solicitud, solicitudFacturacionId patched on cuota atomically in runTransaction. |
| SC-4 | MIXTA: cuotas con % independientes por moneda; validacion por moneda separada | VERIFIED | porcentajePorMoneda: Partial<Record<MonedaCuota, number>> on PresupuestoCuotaFacturacion. validateEsquemaSum validates per-moneda independently. Mini-modal renders N inputs (one per active moneda with pct > 0). computeTotalsByCurrency (I3 helper) used throughout. |
| SC-5 | Pptos sin esquema siguen flujo Tier-1 actual sin breaking changes | VERIFIED | hasEsquema() guard everywhere. OtsSinAsociarSection preserves Tier-1 verbatim. trySyncFinalizacion legacy path preserved literally. Unit tests: BILL-05 empty-legacy assertion GREEN. |
| SC-6 | trySyncFinalizacion finaliza ppto solo cuando todas las cuotas estan facturadas/cobradas Y todas las OTs estan FINALIZADO | VERIFIED | canFinalizeFromEsquema gate added to trySyncFinalizacion when esquemaFacturacion.length > 0. finalizarConSoloFacturado setting respected. Legacy path (no esquema) unchanged. |
| SC-7 | Toggle manual preEmbarque en header del ppto habilita cuota con hito pre_embarque | VERIFIED | preEmbarque checkbox in EditPresupuestoModal guarded by esquema having pre_embarque cuota. togglePreEmbarque full implementation with best-effort audit posta on linked ticket via presupuestosIds query. B2 direct-service bypass documented. |
| SC-8 | Tests Playwright cubren 3 flujos tipicos sin warnings ni huerfanos | FAILED | Sub-suites 11.50/11.51/11.52 implemented on disk (11 tests, no test.fixme). Task 4 (running the suite + visual checks) user-approved deferred per 12-06-SUMMARY because create-flow gap means tests would fail at createPptoBorradorWithTemplate (esquema-quick-* buttons not found in CreatePresupuestoModal). |

**Score: 6/8 success criteria verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/index.ts` | CuotaFacturacionHito, CuotaFacturacionEstado, MonedaCuota, PresupuestoCuotaFacturacion + Presupuesto/SolicitudFacturacion fields | VERIFIED | All 4 types present. Presupuesto: esquemaFacturacion, preEmbarque, finalizarConSoloFacturado. SolicitudFacturacion: cuotaId, porcentajeCoberturaPorMoneda. |
| `apps/sistema-modular/src/utils/cuotasFacturacion.ts` | Pure helpers: recomputeCuotaEstados, validateEsquemaSum, canFinalizeFromEsquema, cuotasEqual, computeTotalsByCurrency | VERIFIED | 255 lines. All 5 functions + 3 template builders (in cuotasFacturacionTemplates.ts, re-exported). |
| `apps/sistema-modular/src/utils/cuotasFacturacionTemplates.ts` | Template builders: buildTemplate100AlCierre, buildTemplate30_70, buildTemplate70_30PreEmbarque | VERIFIED | 109 lines. Split from main to respect 250-line budget. |
| `apps/sistema-modular/src/components/presupuestos/EsquemaFacturacionSection.tsx` | Editor section with Sigma validation, quick-templates, data-testid attributes | VERIFIED | 232 lines (under 250). data-testid: esquema-section, esquema-add-cuota, esquema-suma-badge-{moneda}. readOnly when ppto.estado !== 'borrador'. |
| `apps/sistema-modular/src/components/presupuestos/EsquemaCuotaRow.tsx` | Editable cuota row per moneda | VERIFIED | 143 lines. Descripcion + hito dropdown + % per active moneda + monto preview + delete locked for terminal states. |
| `apps/sistema-modular/src/components/presupuestos/QuickTemplateButtons.tsx` | 3 quick-template buttons | VERIFIED | 55 lines. data-testid: esquema-quick-100, esquema-quick-30-70, esquema-quick-70-30-pre. |
| `apps/sistema-modular/src/components/presupuestos/CuotasDelEsquemaSection.tsx` | Card-per-cuota with state-driven action buttons | VERIFIED | 186 lines. data-testid: cuota-card-{numero}, cuota-generar-{numero}. State-driven: pendiente=disabled, habilitada=teal button, terminal=link. |
| `apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaModal.tsx` | Mini-modal with N inputs per active moneda | VERIFIED | 219 lines. data-testid: generar-cuota-modal, generar-cuota-confirm. Override warning (amber), OT reference selector. |
| `apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaInputs.tsx` | W5 split inputs block | VERIFIED | 68 lines. data-testid: generar-cuota-input-{moneda}. |
| `apps/sistema-modular/src/components/presupuestos/OtsSinAsociarSection.tsx` | Legacy Tier-1 UX in dedicated sub-section | VERIFIED | 177 lines. Verbatim Tier-1 OT checkboxes table without cuotaId. |
| `apps/sistema-modular/src/components/presupuestos/PresupuestoFacturacionSection.tsx` | Refactored to pure 76-line orchestrator | VERIFIED | 76 lines per summary. Correct sub-section visibility logic. |
| `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` | EsquemaFacturacionSection wired for tipo !== 'contrato' + preEmbarque B2 toggle | VERIFIED | EsquemaFacturacionSection at line 313 guarded by tipo !== 'contrato'. preEmbarque checkbox with data-testid="pre-embarque-toggle". |
| `apps/sistema-modular/src/components/presupuestos/CreatePresupuestoModal.tsx` | EsquemaFacturacionSection wired for create flow | MISSING | Renders PresupuestoCuotasSection (legacy monto-based) at line 76. No EsquemaFacturacionSection import or render. This is the primary gap. |
| `apps/sistema-modular/src/services/presupuestosService.ts` | _recomputeAndPersistEsquema + 4 sync points + cuotaId path + togglePreEmbarque full | VERIFIED | All present. _recomputeAndPersistEsquema at line 1569. cuotaId path in generarAvisoFacturacion. togglePreEmbarque with best-effort posta. |
| `apps/sistema-modular/src/services/otService.ts` | queryByBudget + cerrarAdministrativamente recompute + _syncPresupuestoOnFinalize | VERIFIED | queryByBudget at line 177. Both OT cierre paths call _recomputeAndPersistEsquema. |
| `apps/sistema-modular/src/services/facturacionService.ts` | update() recompute+trySync hook on estado change | VERIFIED | Hook at line 100-118. Covers all callers including registrarCobro and anulada (Pitfall 5). |
| `apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts` | 24 unit test assertions with BILL-XX stdout tags | VERIFIED | 432 lines. 24 assertion blocks, each preceded by [BILL-XX label] console.log. Import from ../../utils/cuotasFacturacion.js (correct tsx pattern). |
| `apps/sistema-modular/src/services/__tests__/fixtures/cuotasFacturacion.ts` | 12+ recompute fixtures + 4+ validator + 3 cuotasEqual + 2 computeTotals | VERIFIED | 403 lines. All fixture families present per SUMMARY (12 recompute, 4 validator, 3 cuotasEqual, 2 totals). |
| `apps/sistema-modular/e2e/helpers/firestore-assert.ts` | getPresupuestoEsquema helper | VERIFIED | Export at line 199. Returns pres?.esquemaFacturacion ?? [] as PresupuestoCuotaFacturacion[]. |
| `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` | Sub-suites 11.50/11.51/11.52 with 11 tests, no test.fixme | VERIFIED (code) / UNRUN (e2e) | Describes found at lines 1055, 1161, 1560. No test.fixme occurrences per 12-06 self-check. Bodies implemented but deferred from actual run per user approval. |
| `apps/sistema-modular/package.json` | test:cuotas-facturacion script | VERIFIED | Line 22: "test:cuotas-facturacion": "tsx src/services/__tests__/cuotasFacturacion.test.ts" |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| cuotasFacturacion.test.ts | utils/cuotasFacturacion.ts | import at line 25 | VERIFIED | Import from '../../utils/cuotasFacturacion.js' (tsx .js convention). |
| utils/cuotasFacturacion.ts | @ags/shared | import type from '@ags/shared' | VERIFIED | All 4 Phase 12 types (CuotaFacturacionHito, Estado, MonedaCuota, PresupuestoCuotaFacturacion) present in shared types. |
| presupuestosService.ts | utils/cuotasFacturacion.ts | import at line 20 | VERIFIED | computeTotalsByCurrency, recomputeCuotaEstados, cuotasEqual imported. canFinalizeFromEsquema via dynamic import inside trySyncFinalizacion. |
| EditPresupuestoModal.tsx | EsquemaFacturacionSection.tsx | import at line 19 + render at line 313 | VERIFIED | Wired and guarded by tipo !== 'contrato'. |
| CreatePresupuestoModal.tsx | EsquemaFacturacionSection.tsx | import + render | NOT WIRED | No import, no render. PresupuestoCuotasSection (legacy) is the only cuotas UI at create time. |
| facturacionService.ts | presupuestosService._recomputeAndPersistEsquema | dynamic import at line 105 | VERIFIED | Lazy import pattern to avoid circular dep. |
| otService.ts | presupuestosService._recomputeAndPersistEsquema | (presupuestosService as any)._recomputeAndPersistEsquema | VERIFIED | Lines 487 and 693. Both cerrarAdministrativamente and _syncPresupuestoOnFinalize paths covered. |
| E2E spec | firestore-assert.ts getPresupuestoEsquema | import in spec helpers section | VERIFIED | Referenced by sub-suites for Firestore poll assertions. |

---

## Per-BILL-XX Requirements Coverage

BILL-XX requirements are defined within phase 12 plans and VALIDATION.md (not in .planning/REQUIREMENTS.md which covers v2.0 commercial cycle requirements only — BILL-XX are Phase 12-specific).

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|---------|
| BILL-01 | Sigma%=100 validator per moneda + read-only on aceptado | 12-01, 12-02 | PARTIAL | validateEsquemaSum implemented and tested. Save guard in usePresupuestoEdit. UI visible in EditPresupuestoModal only — invisible at create time (gap). |
| BILL-02 | recomputeCuotaEstados: hito -> estado transitions reactive at 4 sync points | 12-01, 12-05 | VERIFIED | _recomputeAndPersistEsquema wired in update(), generarAvisoFacturacion post-tx, otService, facturacionService. All BILL-02 unit assertions GREEN. |
| BILL-03 | cuotaId path: anticipo without OT cerrada; server guard validates habilitada inside tx | 12-03, 12-04 | VERIFIED | cuotaId path in generarAvisoFacturacion skips OT-listas guard. Atomic double-billing guard inside runTransaction. GenerarSolicitudCuotaModal calls with cuotaId. |
| BILL-04 | MIXTA: N inputs per active moneda in mini-modal; porcentajeCoberturaPorMoneda persisted | 12-01, 12-03, 12-04 | VERIFIED | GenerarSolicitudCuotaInputs renders generar-cuota-input-{moneda} per active moneda. porcentajeCoberturaPorMoneda computed and persisted. W6 applied: zero-% monedas hidden. |
| BILL-05 | Legacy Tier-1 (null/[] esquema) unchanged; existing tests still pass | 12-04, 12-05 | VERIFIED | OtsSinAsociarSection verbatim Tier-1. trySyncFinalizacion legacy path preserved. hasEsquema() guards everywhere. BILL-05 unit assertion GREEN. |
| BILL-06 | trySyncFinalizacion gates on canFinalizeFromEsquema when esquema present | 12-01, 12-05 | VERIFIED | canFinalizeFromEsquema added to trySyncFinalizacion (line 1305-1313). finalizarConSoloFacturado respected. 4 unit assertions GREEN. |
| BILL-07 | preEmbarque toggle visible when esquema has pre_embarque cuota; calls togglePreEmbarque; audit posta | 12-02, 12-03 | VERIFIED | Checkbox in EditPresupuestoModal guarded by cuota with hito=pre_embarque. togglePreEmbarque: full impl with best-effort posta (audit posta visual check deferred). |
| BILL-08 | E2E: 3 flow happy paths, no console warnings, no orphan solicitudes | 12-06 | FAILED | Sub-suites 11.50/11.51/11.52 implemented on disk (11 tests). Run deferred because createPptoBorradorWithTemplate hits create-flow gap (EsquemaFacturacionSection absent in CreatePresupuestoModal). |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `CreatePresupuestoModal.tsx` line 7, 76 | PresupuestoCuotasSection rendered without EsquemaFacturacionSection | BLOCKER | Users cannot define % billing schema at create time. Full feature gap — not a stub. |
| `PresupuestoPDFEstandar.tsx` lines 411-433 | Reads presupuesto.cuotas (legacy PresupuestoCuota[] monto-based) not esquemaFacturacion for PDF billing section | WARNING | PDF generated from EditPresupuestoModal will show legacy cuotas[] (empty for Phase 12 pptos), not the new % scheme. Phase 12 pptos with esquema will have no billing section in their PDF. |
| `EditPresupuestoModal.tsx` lines 369-379 | PresupuestoCuotasSection rendered unconditionally for all tipo including non-contrato | INFO | For non-contrato types, this renders the contrato monthly installment planner (cuotas: PresupuestoCuota[]) alongside EsquemaFacturacionSection. Both operate on different fields (cuotas[] vs esquemaFacturacion[]) so no functional conflict, but the UI has a redundant/confusing section for non-contrato types that would never have PresupuestoCuota data. |
| `12-VALIDATION.md` | All Wave statuses still show pending; nyquist_compliant: false | INFO | VALIDATION.md was not updated to reflect actual wave completion. Does not affect code correctness. |

---

## Human Verification Required

### 1. Sigma-percent badge color (BILL-01)

**Test:** Open EditPresupuestoModal on a borrador ppto. Add 2 cuotas at 30% + 70% ARS each. Verify badge reads "Sigma% (ARS): 100" in green. Change cuota 2 to 60%. Verify badge reads red with copy "Cuotas en ARS suman 90%, deben sumar 100%".
**Expected:** Green badge at 100%, red badge with error copy at 90%.
**Why human:** Tailwind bg-green-*/bg-red-* color rendering is not deterministic in headless; color requires visual inspection.

### 2. MIXTA quick-template defaults (BILL-01 / BILL-04)

**Test:** Create a MIXTA ppto (items with ARS + USD monedas). Open EditPresupuestoModal. Click "30/70 anticipo+entrega" quick-template. Inspect resulting cuotas.
**Expected:** 2 cuotas added: cuota 1 { ARS: 30, USD: 30 } hito=ppto_aceptado; cuota 2 { ARS: 70, USD: 70 } hito=todas_ots_cerradas.
**Why human:** Template content judgmental — values should be asserted but visual "feels right" check needed after create-flow gap is closed.

### 3. MIXTA mini-modal with 3 monedas (BILL-04)

**Test:** Create a ppto with ARS + USD + EUR items. Set a cuota with { ARS: 30, USD: 30, EUR: 30 }. Click "Generar solicitud". Inspect mini-modal layout.
**Expected:** 3 input columns visible, none overflowing. All 3 generar-cuota-input-ARS/USD/EUR data-testids present.
**Why human:** CSS overflow edge case for 3-column layout must be visually inspected.

### 4. preEmbarque audit posta in Firestore (BILL-07)

**Test:** Open a ppto with a 70/30 pre-embarque schema. Toggle the preEmbarque checkbox to ON. Query the linked lead's postas[] array in Firestore.
**Expected:** New posta entry with action indicating pre_embarque toggled (e.g., accion='pre_embarque_marcada' or similar).
**Why human:** Best-effort try/catch in togglePreEmbarque — posta may silently fail. Requires manual Firestore console inspection after toggle.

---

## E2E Specs Status

Sub-suites 11.50, 11.51, 11.52 are **NOT runnable against the current codebase** in their happy-path form because `createPptoBorradorWithTemplate` (the shared E2E helper) expects to:
1. Navigate to PresupuestosList or create flow
2. Click a quick-template button (data-testid="esquema-quick-30-70" etc.)
3. Verify cuotas are set in the editor

Step 2 is blocked because `EsquemaFacturacionSection` (and its QuickTemplateButtons) are absent from `CreatePresupuestoModal`. The template buttons will not be found in the DOM during create. These specs are effectively **deferred** until gap #1 (CreatePresupuestoModal wiring) is resolved.

**Recommendation:** Mark as "specs deferred pending create-flow gap closure" — do not un-fixme or report as failing until gap plan 12-07 lands.

---

## PDF Gap (Additional Finding)

`PresupuestoPDFEstandar.tsx` lines 411-433 render a "Plan de cuotas" section that reads from `presupuesto.cuotas` (the legacy `PresupuestoCuota[]` monto-based type used by contrato pptos), NOT from `presupuesto.esquemaFacturacion`. For a per_incident/ventas ppto with a Phase 12 % schema, `cuotas` will be `null` or `[]`, so the PDF will contain no billing section. This is a secondary gap — the PDF does not reflect the Phase 12 billing structure.

This was not in the BILL-01..08 requirements scope (PDF integration was not listed), so it is flagged as a warning rather than a blocker. However, it should be addressed before the feature is considered production-complete: the PDF that gets sent to the client should summarize the billing schema.

---

## Gaps Summary

**Primary gap (BLOCKER):** `EsquemaFacturacionSection` is wired only to `EditPresupuestoModal`. The user flow "crear con todo y mandar" requires full feature parity at create time. `CreatePresupuestoModal` must be extended to:

1. Import and render `EsquemaFacturacionSection` (guarded by `tipo !== 'contrato'`)
2. Add `esquemaFacturacion` to the `useCreatePresupuestoForm` state and save payload
3. Suppress or conditionally hide `PresupuestoCuotasSection` for non-contrato types at create time (it renders the monto-based contrato installment planner, which is irrelevant for per_incident/ventas schemas)

Until this gap is closed:
- E2E sub-suites 11.50/11.51/11.52 will fail (createPptoBorradorWithTemplate hits missing data-testid buttons)
- BILL-01 is only partial (define schema = edit-only, not create)
- BILL-08 is blocked (cannot run happy-path E2E tests without create-flow parity)

**Secondary gap (WARNING):** `PresupuestoPDFEstandar.tsx` reads from legacy `cuotas[]` not from `esquemaFacturacion`. Phase 12 pptos will generate PDFs with no billing section. Recommend adding an `esquemaFacturacion` section to the PDF template (or at minimum a summary line) as part of gap closure plan 12-07.

**Structured for `/gsd:plan-phase --gaps`:** See frontmatter `gaps:` section above.

---

_Verified: 2026-04-26_
_Verifier: Claude (gsd-verifier)_
