---
phase: 12-esquema-facturacion-porcentual-anticipos
plan: "07"
subsystem: billing
tags: [react, typescript, presupuestos, facturacion, cuotas, create-flow, pdf, gap-closure, BILL-01, BILL-08]

# Dependency graph
requires:
  - phase: 12-06
    provides: "E2E sub-suites 11.50/11.51/11.52 on disk; EsquemaFacturacionSection wired in EditPresupuestoModal only"
provides:
  - "EsquemaFacturacionSection wired in CreatePresupuestoModal for tipo != 'contrato'"
  - "BILL-01 validation in create flow (findEmptyCuotas + validateEsquemaSum before Firestore write)"
  - "EditPresupuestoModal guards PresupuestoCuotasSection to contrato only (no parallel render)"
  - "PresupuestoPDFEstandar reads esquemaFacturacion for non-contrato pptos (Phase 12 section)"
  - "PdfEsquemaFacturacionSection.tsx: pure PDF sub-component for porcentual schema rendering"
  - "Legacy cuotas[] fallback preserved in PDF for contrato + legacy pptos"
affects:
  - "E2E sub-suites 11.50/11.51/11.52 — createPptoBorradorWithTemplate should now find esquema-quick-* testids in create flow"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Create hook mirrors edit hook BILL-01 pattern: deriveMonedasActivas + findEmptyCuotas + validateEsquemaSum before handleSave"
    - "Spread-conditional payload pattern: ...(tipo !== 'contrato' && esquema.length > 0 ? { esquemaFacturacion } : {}) — no undefined in Firestore write (firestore.md rule honored)"
    - "PDF sub-component extraction: PdfEsquemaFacturacionSection.tsx colocated in pdf/ — pure rendering, no hooks, safe for @react-pdf/renderer tree"
    - "MonedaCuota[] cast pattern: Object.keys(totalsByCurrency) as MonedaCuota[] — correct because computeTotalsByCurrency only emits MonedaCuota keys"

key-files:
  created:
    - "apps/sistema-modular/src/components/presupuestos/pdf/PdfEsquemaFacturacionSection.tsx (93 lines)"
  modified:
    - "apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts — added esquemaFacturacion state + BILL-01 validation + payload inclusion"
    - "apps/sistema-modular/src/components/presupuestos/CreatePresupuestoModal.tsx — conditional EsquemaFacturacionSection/PresupuestoCuotasSection by tipo"
    - "apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx — guard PresupuestoCuotasSection with tipo === 'contrato'"
    - "apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx — branch for esquemaFacturacion vs legacy cuotas[]"
    - ".planning/phases/12-esquema-facturacion-porcentual-anticipos/12-07-PLAN.md"

key-decisions:
  - "usePresupuestoEdit.save() does NOT write cuotas[] for any type — no action needed for Task 5 consistency check. The field is absent from the update payload; contrato cuotas are managed by special paths (not the edit form's save)."
  - "PdfEsquemaFacturacionSection extracted as colocated sub-component (PresupuestoPDFEstandar is already 598 lines; extraction keeps the change clean and within plan budget constraints)"
  - "computeTotalsByCurrency imported directly in PDF sub-component — it is a pure function with no React dependency, safe for @react-pdf/renderer rendering tree"
  - "TS7053 fix: Object.keys(Partial<Record<MonedaCuota,number>>) cast to MonedaCuota[] — correct because computeTotalsByCurrency only writes MonedaCuota keys"

# Metrics
duration: ~20min
completed: 2026-04-26
---

# Phase 12 Plan 07: Gap Closure — EsquemaFacturacion in Create Flow Summary

**EsquemaFacturacionSection wired into CreatePresupuestoModal, EditPresupuestoModal PresupuestoCuotasSection guarded to contrato only, PresupuestoPDFEstandar reads esquemaFacturacion for non-contrato pptos — gap closure complete**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-26T16:55:02Z
- **Completed:** 2026-04-26T17:15:00Z
- **Tasks:** 6 (5 code tasks + 1 no-op consistency check)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Extended `useCreatePresupuestoForm.ts`: new `esquemaFacturacion: PresupuestoCuotaFacturacion[]` state, reset on close, BILL-01 validation (findEmptyCuotas + validateEsquemaSum) before save for non-contrato, spread-conditional payload inclusion, exported from hook
- Updated `CreatePresupuestoModal.tsx`: conditional render — `tipo === 'contrato'` keeps `PresupuestoCuotasSection` (monto-based), all other tipos render `EsquemaFacturacionSection` (Phase 12 porcentual editor, always `readOnly=false` at create time since always borrador)
- Updated `EditPresupuestoModal.tsx`: wrapped `PresupuestoCuotasSection` with `{form.tipo === 'contrato' && (...)}` — non-contrato pptos no longer render the redundant legacy contrato installment planner alongside `EsquemaFacturacionSection`
- Created `PdfEsquemaFacturacionSection.tsx` (93 lines): pure rendering sub-component for react-pdf, uses `computeTotalsByCurrency` (I3 pure fn), shows numero + descripcion + hito (Spanish label) + % per moneda + monto preview per cuota
- Updated `PresupuestoPDFEstandar.tsx`: branch on `esquemaFacturacion?.length > 0 && tipo !== 'contrato'` → renders `PdfEsquemaFacturacionSection`; else falls back to legacy `cuotas[]` rendering (contrato + legacy pptos preserved)
- Task 5 consistency check: `usePresupuestoEdit.save()` does NOT write `cuotas[]` for any type — no action needed
- Task 6: type-check clean for all modified files; `pnpm --filter sistema-modular build:web` green in 25.24s

## Task Commits

1. **Task 1: Wire esquemaFacturacion to useCreatePresupuestoForm** — `79d4737` (feat)
2. **Task 2: Render EsquemaFacturacionSection in CreatePresupuestoModal** — `9023b64` (feat)
3. **Task 3: Guard PresupuestoCuotasSection in EditPresupuestoModal** — `12d5458` (fix)
4. **Task 4: PDF esquemaFacturacion section + PdfEsquemaFacturacionSection** — `18f57c8` (feat)
5. **Task 5 + PLAN.md**: `f99177a` (chore — no-op consistency check + plan artifact)
6. **Task 6: Type fix for PdfEsquemaFacturacionSection** — `2dc63b6` (fix)

## Files Created/Modified

- `apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts` — Phase 12 esquema state + BILL-01 validation + payload
- `apps/sistema-modular/src/components/presupuestos/CreatePresupuestoModal.tsx` — conditional schema/cuotas section by tipo
- `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` — PresupuestoCuotasSection guarded to contrato
- `apps/sistema-modular/src/components/presupuestos/pdf/PdfEsquemaFacturacionSection.tsx` — new pure PDF sub-component (93 lines)
- `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` — branch for esquemaFacturacion vs legacy cuotas[]
- `.planning/phases/12-esquema-facturacion-porcentual-anticipos/12-07-PLAN.md` — gap closure plan

## Decisions Made

- **Task 5 no-op**: `usePresupuestoEdit.save()` payload does not include `cuotas` or `cantidadCuotas` for any type. The contrato's installment data is managed through special paths (not the edit form's generic save). Source of truth for non-contrato pptos is `esquemaFacturacion`. No code change needed.
- **PdfEsquemaFacturacionSection extracted**: PresupuestoPDFEstandar is already 598 lines — extracting keeps the change clean and consistent with plan intent. The sub-component is 93 lines, well under budget.
- **pure-fn import in PDF tree**: `computeTotalsByCurrency` has no React dependencies and is safe to call in react-pdf context. No hooks, no side effects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS7053 implicit any on MonedaCuota record indexing in PdfEsquemaFacturacionSection**
- **Found during:** Task 6 (typecheck)
- **Issue:** `Object.keys(totalsByCurrency)` returns `string[]`; `Partial<Record<MonedaCuota, number>>` requires `MonedaCuota` as index key — tsc correctly rejected the implicit any
- **Fix:** Cast `Object.keys(totalsByCurrency) as MonedaCuota[]` (correct because `computeTotalsByCurrency` only emits `MonedaCuota` keys); same cast approach used in EsquemaFacturacionSection and other files in the codebase
- **Files modified:** `PdfEsquemaFacturacionSection.tsx`
- **Commit:** `2dc63b6`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor type narrowing fix; no behavior change. No scope creep.

## Success Criteria Check

- [x] CreatePresupuestoModal renders EsquemaFacturacionSection for non-contrato; PresupuestoCuotasSection only for contrato
- [x] EditPresupuestoModal renders PresupuestoCuotasSection only for contrato (no longer parallel to esquema for non-contrato)
- [x] PresupuestoPDFEstandar reads esquemaFacturacion when present (non-contrato), legacy cuotas[] fallback preserved
- [x] BILL-01 validation enforced in create flow (no save with Σ%≠100 when esquema non-empty)
- [x] type-check clean for modified files; build green (25.24s)
- [x] No edits inside apps/reportes-ot/ (frozen surface)
- [x] PresupuestoCuotasSection.tsx NOT deleted (still used by contrato)

## Gap Closure Result

**Primary gap (BLOCKER) from 12-VERIFICATION.md:** RESOLVED
- `EsquemaFacturacionSection` now wired in `CreatePresupuestoModal` for `tipo !== 'contrato'`
- `useCreatePresupuestoForm` has BILL-01 validation and includes `esquemaFacturacion` in Firestore payload

**Secondary gap (WARNING) from 12-VERIFICATION.md:** RESOLVED
- `PresupuestoPDFEstandar` now reads from `esquemaFacturacion` for non-contrato pptos
- Legacy `cuotas[]` preserved as fallback for contrato + legacy pptos

**Anti-pattern (INFO) from 12-VERIFICATION.md:** RESOLVED
- `EditPresupuestoModal` `PresupuestoCuotasSection` now guarded to `tipo === 'contrato'` only

**E2E sub-suites 11.50/11.51/11.52:** Unblocked — `createPptoBorradorWithTemplate` should now find `esquema-quick-*` testid buttons in the create flow. E2E run + manual visual verification can proceed.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| useCreatePresupuestoForm.ts | FOUND |
| CreatePresupuestoModal.tsx | FOUND |
| EditPresupuestoModal.tsx | FOUND |
| PdfEsquemaFacturacionSection.tsx | FOUND |
| PresupuestoPDFEstandar.tsx | FOUND |
| Commit 79d4737 (Task 1) | FOUND |
| Commit 9023b64 (Task 2) | FOUND |
| Commit 12d5458 (Task 3) | FOUND |
| Commit 18f57c8 (Task 4) | FOUND |
| Commit f99177a (Task 5 + PLAN.md) | FOUND |
| Commit 2dc63b6 (Task 6 type fix) | FOUND |
| Build green (25.24s) | VERIFIED |
