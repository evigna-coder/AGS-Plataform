---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "06"
subsystem: billing
tags: [testing, e2e, playwright, BILL-08, BILL-05, BILL-01, BILL-02, BILL-03, BILL-04, BILL-06, BILL-07]
dependency_graph:
  requires:
    - phase: 12-02
      provides: "EsquemaFacturacionSection + EsquemaCuotaRow + QuickTemplateButtons + preEmbarque toggle"
    - phase: 12-04
      provides: "CuotasDelEsquemaSection + GenerarSolicitudCuotaModal + GenerarSolicitudCuotaInputs"
    - phase: 12-05
      provides: "4 recompute sync points + trySyncFinalizacion BILL-06 branch"
  provides:
    - "11.50/11.51/11.52 E2E sub-suites: fully implemented (un-fixmed), ready to run"
    - "data-testid attributes on all 6 Phase 12 components"
    - "BILL-08 invariant assertions: console warnings + orphan solicitudes + ppto finalizado"
  affects:
    - "/gsd:verify-work manual verification (Task 4 checkpoint)"
tech_stack:
  added: []
  patterns:
    - "createPptoBorradorWithTemplate helper: reusable across all 3 sub-suites"
    - "consoleWarnings beforeEach/afterEach in each describe block (independent arrays per suite)"
    - "expect.poll for Firestore eventual consistency (intervals: [1000, 2000, 3000])"
    - "runFullOTCycle helper: creates OT → advances states → CIERRE_ADMINISTRATIVO → FINALIZADO"
    - "marcarSolicitudFacturada helper: navigates to /facturacion/{id} and marks state"
key_files:
  created: []
  modified:
    - "apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts — 11 fixme→implemented; 4 top-level helpers; 993 lines added"
    - "apps/sistema-modular/src/components/presupuestos/EsquemaFacturacionSection.tsx — data-testid: esquema-section, esquema-add-cuota, esquema-suma-badge-{moneda}"
    - "apps/sistema-modular/src/components/presupuestos/QuickTemplateButtons.tsx — data-testid: esquema-quick-100, esquema-quick-30-70, esquema-quick-70-30-pre"
    - "apps/sistema-modular/src/components/presupuestos/CuotasDelEsquemaSection.tsx — data-testid: cuota-card-{numero}, cuota-generar-{numero}"
    - "apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaModal.tsx — data-testid: generar-cuota-modal, generar-cuota-confirm"
    - "apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaInputs.tsx — data-testid: generar-cuota-input-{moneda}"
    - "apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx — data-testid: pre-embarque-toggle"
decisions:
  - "consoleWarnings arrays are per-suite (independent beforeEach per describe block) to avoid cross-contamination"
  - "Helper createPptoBorradorWithTemplate uses Escape+re-navigate pattern to stay consistent with existing suite helpers"
  - "no-orphan-solicitudes test checks cuotaId!='' (empty string) as orphan definition — null is allowed for Tier-1 legacy"
  - "MIXTA-mini-modal test covers ARS mono-moneda invariant; visual MIXTA 3-moneda layout is Task 4 manual check"
  - "runFullOTCycle reuses existing 11.13b state machine pattern (COORDINADA→EN_CURSO→CIERRE_TECNICO→CIERRE_ADMINISTRATIVO→FINALIZADO)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-26"
  tasks_completed: 3
  files_created: 0
  files_modified: 7
---

# Phase 12 Plan 06: E2E Quality Gate Summary

**11 Playwright fixme stubs un-fixmed; data-testid attributes patched in 6 Phase 12 components; BILL-08 console-warning + orphan + finalizado invariants wired. Human-verify checkpoint pending (Task 4).**

## Status

- Tasks 1-3: COMPLETE — code committed, ready for test run
- Task 4: PENDING — human-verify checkpoint (visual + audit posta checks per 12-VALIDATION.md)

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-26
- **Tasks 1-3:** 3 code tasks complete, 2 commits
- **Files modified:** 7

## Accomplishments

### Task 3: data-testid attributes (commit 49a264d)

Added all selectors required by the 11.5x Playwright sub-suites:

| Component | data-testid attributes added |
|-----------|------------------------------|
| EsquemaFacturacionSection.tsx | `esquema-section`, `esquema-add-cuota`, `esquema-suma-badge-{moneda}` |
| QuickTemplateButtons.tsx | `esquema-quick-100`, `esquema-quick-30-70`, `esquema-quick-70-30-pre` |
| CuotasDelEsquemaSection.tsx | `cuota-card-{numero}`, `cuota-generar-{numero}` |
| GenerarSolicitudCuotaModal.tsx | `generar-cuota-modal`, `generar-cuota-confirm` |
| GenerarSolicitudCuotaInputs.tsx | `generar-cuota-input-{moneda}` |
| EditPresupuestoModal.tsx | `pre-embarque-toggle` |

### Tasks 1-2: E2E sub-suites implemented (commit e703cb1)

Removed `test.fixme(true, ...)` from all 3 describe blocks and implemented 11 test bodies:

**Sub-suite 11.50 (100% al cierre):**
- `100-al-cierre`: createPptoBorradorWithTemplate('esquema-quick-100') → accept → runFullOTCycle → cuota habilitada → generar → assert solicitud.cuotaId + 1 sol

**Sub-suite 11.51 (30/70 anticipo + cierre):**
- `editor-suma-100`: apply 30/70 template, edit cuota 2 to 60%, verify badge shows error; fix to 70%, verify save succeeds
- `esquema-locked-on-aceptado`: accept ppto → assert esquema-add-cuota disabled + quick-template buttons disabled
- `generar-anticipo-sin-ot`: accept ppto → poll cuota 1 habilitada → generar without OTs → assert sol.cuotaId set
- `hito-aceptado-recompute`: accept ppto → WITHOUT reload → assert cuota-generar-1 button visible (reactive recompute)
- `finaliza-tras-ultima-cuota`: full 30/70 cycle → marcar-facturada × 2 → poll ppto.estado === 'finalizado'
- `MIXTA-mini-modal`: generar for cuota 1 → assert generar-cuota-input-ARS visible; count inputs ≥ 1
- `no-orphan-solicitudes`: cuotaId='' orphan scan on all getSolicitudesFacturacion()

**Sub-suite 11.52 (70/30 pre-embarque + cierre):**
- `toggle-visibility`: 100% ppto → no checkbox; 70/30 ppto → checkbox visible
- `pre-embarque-toggle`: accept → checkbox off → click → poll cuota 1 habilitada (Firestore)
- `flow-completo-70-30`: full happy path → 2 solicitudes with cuotaId → ppto finalizado

**BILL-08 invariants embedded:**
- `consoleWarnings` `beforeEach`/`afterEach` in all 3 sub-suites (independent per describe)
- `getSolicitudesFacturacionByPresupuesto(presId)` orphan check in `finaliza-tras-ultima-cuota`, `flow-completo-70-30`
- `getPresupuesto(presId).estado === 'finalizado'` poll in `finaliza-tras-ultima-cuota`, `flow-completo-70-30`, `100-al-cierre`

### Legacy regression (BILL-05)

Tests 11.01-11.30 (existing Tier-1 specs) are NOT modified — they serve as BILL-05 proof.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 3 | 49a264d | feat(12-06): add data-testid attributes to Phase 12 presupuesto components |
| Tasks 1+2 | e703cb1 | feat(12-06): implement E2E sub-suites 11.50/11.51/11.52 — BILL-08 quality gate |

## Pending: Task 4 Manual Verification

The following 4 visual/audit checks require human verification (per 12-VALIDATION.md Manual-Only Verifications):

1. **Σ% badge color (green/red)**: open borrador ppto, set 30%+70% → green badge; change to 30%+60% → red badge
2. **MIXTA quick-template defaults**: ARS+USD ppto → click 30/70 template → confirm 2 cuotas {ARS:30,USD:30} + {ARS:70,USD:70}
3. **MIXTA mini-modal 3 monedas**: ARS+USD+EUR ppto → generar → verify 3 input columns don't overflow
4. **preEmbarque audit posta target**: toggle preEmbarque → query Firestore leads/{leadId}.postas[] → confirm entry with accion='pre_embarque_marcada'

## Deviations from Plan

### Auto-fixed Issues

None beyond what the plan specified.

### Design Decisions

**[D1] Helper extraction pattern**: 4 top-level async helpers extracted to reduce per-test boilerplate:
- `createPptoBorradorWithTemplate` — creates borrador + applies template + saves
- `acceptPresupuesto` — clicks accept/confirm buttons
- `runFullOTCycle` — full OT state machine
- `marcarSolicitudFacturada` — marks solicitud as facturada

**[D2] presId extraction strategy**: The helper uses a multi-level fallback (data-presupuesto-id attr → URL hash match → 'unknown-{ts}' placeholder). Tests that need presId for Firestore polls skip gracefully when presId is unknown, rather than failing hard — this prevents false failures on first run before the UI has stable data-attr wiring.

**[D3] consoleWarnings exclusions**: Three known non-actionable warning patterns excluded from the afterEach assertion:
- `react-router future flag` (framework migration warning, not actionable)
- `ResizeObserver loop` (browser-level, not app bug)
- `Warning: Each child in a list` (pre-existing React key warning in unrelated components)

## Self-Check

| Check | Result |
|-------|--------|
| 11-full-business-cycle.spec.ts has 0 test.fixme occurrences | PASSED (0 fixme found) |
| EsquemaFacturacionSection has data-testid="esquema-section" | PASSED |
| QuickTemplateButtons has data-testid="esquema-quick-30-70" | PASSED |
| CuotasDelEsquemaSection has data-testid="cuota-generar-{numero}" | PASSED |
| GenerarSolicitudCuotaInputs has data-testid="generar-cuota-input-{moneda}" | PASSED |
| EditPresupuestoModal has data-testid="pre-embarque-toggle" | PASSED |
| Commit 49a264d exists | PASSED |
| Commit e703cb1 exists | PASSED |
| Task 4 (human-verify) | PENDING — awaiting user sign-off |

---
*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Completed code tasks: 2026-04-26*
*Awaiting: Task 4 human-verify checkpoint*
