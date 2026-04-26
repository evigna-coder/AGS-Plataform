---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "04"
subsystem: billing
tags: [react, typescript, presupuestos, facturacion, cuotas, anticipos, MIXTA, BILL-03, BILL-04, BILL-05]

# Dependency graph
requires:
  - phase: 12-01
    provides: "MonedaCuota, PresupuestoCuotaFacturacion types + computeTotalsByCurrency I3 helper"
  - phase: 12-02
    provides: "EsquemaFacturacionSection editor (forms the context for the section to display)"
  - phase: 12-03
    provides: "generarAvisoFacturacion with cuotaId path — service contract for mini-modal"
provides:
  - "OtsSinAsociarSection: Tier-1 legacy UX preserved (BILL-05)"
  - "CuotasDelEsquemaSection: esquema-driven card list with state-driven action buttons (BILL-03)"
  - "GenerarSolicitudCuotaModal: N inputs per active moneda + override warning + OT reference selector (BILL-03, BILL-04)"
  - "GenerarSolicitudCuotaInputs: W5 pre-authorized split component for inputs block"
  - "PresupuestoFacturacionSection: refactored to pure orchestration (76 lines)"
  - "EditPresupuestoModal: updated prop shape + section visible for esquema-only presupuestos"
affects:
  - "12-05 (service sync wiring — reads cuota.estado from Firestore after plan 12-05 recompute fires)"
  - "12-06 (E2E tests validate BILL-03, BILL-04, BILL-05 paths end-to-end)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-section orchestration pattern: PresupuestoFacturacionSection delegates rendering to specialized child components"
    - "W5 split: GenerarSolicitudCuotaInputs.tsx extracted per 12-04 pre-authorization to keep modal under 250 lines"
    - "W6 (hidden currency): monedas with porcentajePorMoneda[m] === 0 or undefined are hidden entirely in mini-modal (Open Question 3 resolution)"
    - "computeTotalsByCurrency (I3) imported in both CuotasDelEsquemaSection and GenerarSolicitudCuotaModal — no duplication"
    - "cuotaId path: GenerarSolicitudCuotaModal calls service with cuotaId + montoPorMoneda, no legacy monto field"
    - "OT reference selector collapsed by default; OTs NOT removed from list (Pitfall 8 honored)"

key-files:
  created:
    - "apps/sistema-modular/src/components/presupuestos/OtsSinAsociarSection.tsx (177 lines)"
    - "apps/sistema-modular/src/components/presupuestos/CuotasDelEsquemaSection.tsx (184 lines)"
    - "apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaModal.tsx (219 lines)"
    - "apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaInputs.tsx (67 lines)"
  modified:
    - "apps/sistema-modular/src/components/presupuestos/PresupuestoFacturacionSection.tsx — refactored to 76-line orchestrator"
    - "apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx — updated prop shape + visibility guard"

key-decisions:
  - "W5 split executed from the start: GenerarSolicitudCuotaInputs.tsx extracted to keep GenerarSolicitudCuotaModal at 219 lines (under 250 budget)"
  - "W6 applied: zero-percentage monedas hidden entirely in mini-modal (not disabled placeholders) — research-recommended, revisitable"
  - "Sub-section B visibility: showB = otsListas.length > 0 AND (!hasEsquema OR allCuotasTerminal) — saldo path preserved for all-facturada/cobrada esquemas"
  - "EditPresupuestoModal section title is dynamic: shows cuota count when esquema present, OT count when legacy"
  - "actor derived inline in EditPresupuestoModal from firebaseUser.uid + usuario.displayName (same pattern as togglePreEmbarque in plan 12-02)"

patterns-established:
  - "Orchestration-only top-level section: delegates rendering to sub-sections (≤120 line budget easily met at 76 lines)"
  - "Pre-authorized W5 split: extract inputs block to sibling component when modal approaches 200 lines"
  - "Hidden-currency (W6) pattern: filter monedasInCuota to only those with pct > 0 before rendering inputs"

requirements-completed:
  - BILL-03
  - BILL-04
  - BILL-05

# Metrics
duration: ~12min
completed: 2026-04-26
---

# Phase 12 Plan 04: UI Refactor (PresupuestoFacturacionSection + Mini-Modal) Summary

**PresupuestoFacturacionSection refactored into two sub-sections (Tier-1 preserved + esquema-driven cards) with GenerarSolicitudCuotaModal providing N inputs per active moneda for the cuotaId anticipo path**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-26T15:27:29Z
- **Completed:** 2026-04-26T15:39:00Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Created `OtsSinAsociarSection.tsx` (177 lines): lifts the legacy Tier-1 UX verbatim — OT checkboxes table, single monto field, observaciones, "Generar aviso" button calling service WITHOUT cuotaId (BILL-05 preservation)
- Created `CuotasDelEsquemaSection.tsx` (184 lines): card-per-cuota with state-driven action buttons (pendiente=disabled grey, habilitada=teal "Generar solicitud", terminal states=link to solicitud), sigma header per active moneda, monto facturado display when set
- Created `GenerarSolicitudCuotaModal.tsx` (219 lines): mini-modal with N inputs per active moneda (hidden when pct=0, W6), default = pct/100 * total via I3 helper, override warning banner (amber), optional OT reference selector (collapsed, with Pitfall 8 note), confirms via cuotaId path, error stays inline
- Created `GenerarSolicitudCuotaInputs.tsx` (67 lines): W5 pre-authorized split — inputs block extracted to keep modal under 250 lines
- Refactored `PresupuestoFacturacionSection.tsx` to 76-line pure orchestrator with correct sub-section visibility logic
- Updated `EditPresupuestoModal.tsx`: new prop shape, section visible for esquema-only pptos (not just otsListas.length > 0), dynamic title, actor wired from firebaseUser

## Task Commits

1. **Task 1: OtsSinAsociarSection + CuotasDelEsquemaSection** — `eb7fd3f` (feat)
2. **Task 2: GenerarSolicitudCuotaModal + GenerarSolicitudCuotaInputs** — `b4049ca` (feat)
3. **Task 3: Refactor PresupuestoFacturacionSection + wire EditPresupuestoModal** — `6e25728` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/components/presupuestos/OtsSinAsociarSection.tsx` — Legacy Tier-1 UX in dedicated sub-section (177 lines)
- `apps/sistema-modular/src/components/presupuestos/CuotasDelEsquemaSection.tsx` — Esquema-driven card list (184 lines)
- `apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaModal.tsx` — Mini-modal for cuota solicitud generation (219 lines)
- `apps/sistema-modular/src/components/presupuestos/GenerarSolicitudCuotaInputs.tsx` — W5 extracted inputs block (67 lines)
- `apps/sistema-modular/src/components/presupuestos/PresupuestoFacturacionSection.tsx` — Refactored to 76-line orchestrator
- `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` — Updated prop shape + visibility guard

## Decisions Made

- **W5 executed from start**: The modal carries 5 responsibilities. Rather than extracting after hitting the limit, split pre-emptively per plan's W5 pre-authorization. Modal at 219 lines, inputs at 67 lines — both well under budget
- **W6 applied — hidden-currency UX**: Monedas with zero/missing percentage are hidden entirely (no disabled placeholder). Research-recommended, revisitable if user wants disabled-placeholder UX
- **actor wired inline**: `{ uid: firebaseUser.uid, name: usuario?.displayName }` derived directly in EditPresupuestoModal at the call site (same pattern as preEmbarque toggle in plan 12-02)
- **showB saldo path**: Sub-section B (OtsSinAsociarSection) is visible after all cuotas reach facturada/cobrada AND otsListas.length > 0 — handles the saldo case for leftover OTs

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Check

- [x] BILL-03 UI: state-driven buttons on cuota cards; "Generar solicitud" opens mini-modal with cuotaId path
- [x] BILL-04 UI: MIXTA mini-modal renders N inputs (one per moneda with porcentaje > 0); zero monedas hidden (W6)
- [x] BILL-05 Tier-1 preservation: OtsSinAsociarSection identical UX to legacy when esquema is null/[]
- [x] All new components ≤250 lines (177, 184, 219, 67, 76 lines respectively)
- [x] Editorial Teal palette + JetBrains Mono labels honored throughout
- [x] No new dependencies
- [x] apps/reportes-ot/ not touched
- [x] No edits inside services/ (12-05's lane)
- [x] Vite build green
- [x] tsc --noEmit clean for all Plan 12-04 files (pre-existing errors in unrelated files unchanged)

## Self-Check: PASSED

All created files present on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| OtsSinAsociarSection.tsx | FOUND |
| CuotasDelEsquemaSection.tsx | FOUND |
| GenerarSolicitudCuotaModal.tsx | FOUND |
| GenerarSolicitudCuotaInputs.tsx | FOUND |
| Commit eb7fd3f (Task 1) | FOUND |
| Commit b4049ca (Task 2) | FOUND |
| Commit 6e25728 (Task 3) | FOUND |

---

*Phase: 12-esquema-facturacion-porcentual-anticipos*
*Completed: 2026-04-26*
