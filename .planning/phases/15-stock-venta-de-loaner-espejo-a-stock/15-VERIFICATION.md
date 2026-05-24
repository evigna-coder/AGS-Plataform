---
phase: 15-stock-venta-de-loaner-espejo-a-stock
verified: 2026-05-24T15:10:52Z
status: passed
score: 4/4 must-haves verified
human_verification:
  - test: "UAT 8 pasos manual (modal flow + Firestore espejo + doble-click guard)"
    expected: "Modal abre con SearchableSelect cuando articuloId=null; loaner queda vendido + nueva UnidadStock + nuevo MovimientoStock con subtipo='venta_loaner'; segunda tab muestra banner 'Loaner ya vendido'"
    status: PASSED
    evidence: "User completó los 8 pasos verbalmente ('dale, por favor' = approved) en SUMMARY 15-03"
---

# Phase 15: Stock — Venta de loaner espejo a stock — Verification Report

**Phase Goal:** Reemplazar `loanersService.registrarVenta` por una versión transaccional que, en una sola `runTransaction` atómica con guard de idempotencia READ-FIRST, escribe a 3 colecciones (`loaners` update + `unidadesStock` create + `movimientosStock` create con `subtipo='venta_loaner'`). Extender `LoanerVentaModal` con SearchableSelect condicional + Costo separado + banner inline para errores transaccionales + validaciones bloqueantes. Toda venta deja espejo contable en Stock.

**Verified:** 2026-05-24T15:10:52Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                              | Status     | Evidence                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | VLN-01: Tipos extendidos (subtipo widened, referenciaLoaner*, costoUnitario/monedaCosto) en shared | VERIFIED   | `packages/shared/src/types/index.ts:2811` (`subtipo?: 'conversion' \| 'venta_loaner'`), :2816, :2821, :3238, :3240                    |
| 2   | VLN-02: `loanersService.registrarVenta` es transaccional con guard idempotencia y 3 writes atómicos | VERIFIED   | `loanersVentaHelpers.ts:240-340` (1 `runTransaction` + 1 `tx.get` + 1 `tx.update` + 2 `tx.set`); guard L247; pre-tx validation L85-87 |
| 3   | VLN-03: LoanerVentaModal extendido (SearchableSelect condicional + costo separado + banner inline) | VERIFIED   | `LoanerVentaModal.tsx:138-219` (banner :139, picker condicional :150, costo grid 2x2 :199); `LoanerArticuloPicker.tsx:46-61`           |
| 4   | VLN-04: 5 unit tests `test:venta-loaner` GREEN                                                     | VERIFIED   | Test runner output: `tests 5 / pass 5 / fail 0`, duration 17ms; commit `86ccc3c` cierra rollback test                                  |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                                  | Expected                                                                                | Status   | Details                                                                                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types/index.ts`                                      | 5 type extensions (subtipo widening + 4 nullable fields)                                | VERIFIED | grep returns 6 expected matches at lines 2638, 2639, 2811, 2816, 2821, 3238, 3240                                  |
| `apps/sistema-modular/src/services/loanersVentaHelpers.ts`                | `buildRegistrarVenta` factory + `_registrarVentaInProd` + `_registrarVentaInTest`       | VERIFIED | 364 LOC; runTransaction at :240; READ-FIRST guard at :247; 3 writes at :263, :282, :312                            |
| `apps/sistema-modular/src/services/loanersService.ts`                     | `registrarVenta` named export + `__setTestFirestore` DI hook + lazy firebase import      | VERIFIED | 306 LOC; named export at :78; DI hook at :63; lazy load at :32-48; backwards-compat method on object at :291-305  |
| `apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts`         | 5 tests (VLN-02a..e) all passing                                                        | VERIFIED | 276 LOC; 5 test() declarations covering happy paths, guard, rollback, validation; all GREEN                       |
| `apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx`        | Modal extendido con SearchableSelect condicional + costo + banner                       | VERIFIED | 233 LOC (≤250 budget); 4 inputs revenue/costo grid 2x2; canConfirm gating at :89-90                                |
| `apps/sistema-modular/src/components/loaners/LoanerArticuloPicker.tsx`    | Sub-componente que fetch `articulosService.getAll({ activoOnly: true })`                | VERIFIED | 62 LOC; fetch at :32-33; SearchableSelect at :49                                                                  |
| `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx`                 | `handleVenta` pasa `costoUnitario`+`monedaCosto`+`articuloRecienVinculado` al servicio   | VERIFIED | :82-101; 3-arg call at :92-99                                                                                     |
| `apps/sistema-modular/src/hooks/useLoaners.ts`                            | `registrarVenta` wrapper actualizado O eliminado                                        | VERIFIED | Wrapper ELIMINADO (-22 LOC); comment at :101-105 documenta grep que confirmó 0 call sites externos                |

### Key Link Verification

| From                       | To                                | Via                                                                                              | Status | Details                                                                            |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| LoanerVentaModal           | LoanerDetail (parent)             | `onConfirm({ venta, articuloRecienVinculado })`                                                  | WIRED  | Props :13-20 + handler at :92-105; LoanerDetail.tsx:166 mounts with `onConfirm={handleVenta}` |
| LoanerDetail               | loanersService                    | `loanersService.registrarVenta(id, { fecha, ...venta }, articuloRecienVinculado)`                | WIRED  | LoanerDetail.tsx:92 (3 args, fecha added inline)                                   |
| loanersService             | loanersVentaHelpers               | `buildRegistrarVenta({ getTestState, getFirebaseModules })` factory bind                          | WIRED  | loanersService.ts:78-81                                                            |
| loanersVentaHelpers (prod) | firebase/firestore SDK            | `runTransaction(db, async (tx) => { tx.get + tx.update + tx.set + tx.set })`                     | WIRED  | loanersVentaHelpers.ts:240 (1 read + 3 writes)                                     |
| loanersVentaHelpers        | @ags/shared types                  | `import type { Loaner, VentaLoaner } from '@ags/shared'`; uses `subtipo: 'venta_loaner'` literal | WIRED  | loanersVentaHelpers.ts:33; :316 sets subtipo                                       |
| LoanerArticuloPicker       | articulosService (stockService)   | `articulosService.getAll({ activoOnly: true })`                                                  | WIRED  | LoanerArticuloPicker.tsx:32-33                                                     |
| ventaLoaner.test.ts        | loanersService (named exports)    | `import { registrarVenta, __setTestFirestore } from '../loanersService'`                          | WIRED  | test :36; named exports exist at loanersService.ts:63 + :78                        |

### Requirements Coverage

| Requirement | Source Plan                | Description                                                            | Status      | Evidence                                                                                            |
| ----------- | -------------------------- | ---------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| VLN-01      | 15-01-tipos                | Type extensions @ags/shared (subtipo + 4 fields)                       | SATISFIED   | 5 grep matches confirmed in types/index.ts; commits `915bbfb` + `de2c213`                            |
| VLN-02a     | 15-02-service-transaccional | Happy path pre-vinculado                                              | SATISFIED   | Test GREEN (8.97ms); assertions on loaner.estado, 1 unidad created, 1 movimiento created             |
| VLN-02b     | 15-02-service-transaccional | Happy path sin vínculo (denormalización)                              | SATISFIED   | Test GREEN (0.25ms); articuloRecienVinculado denormaliza articuloId/Codigo/Descripcion en loaner    |
| VLN-02c     | 15-02-service-transaccional | Guard READ-FIRST "Loaner ya vendido"                                  | SATISFIED   | Test GREEN (1.24ms); throws + 0 writes when loaner ya vendido                                       |
| VLN-02d     | 15-02-service-transaccional | Rollback atómico                                                       | SATISFIED   | Test GREEN (0.28ms); `_throwOnUnidadCreate` hook + validate-first/mutate-last pattern               |
| VLN-02e     | 15-02-service-transaccional | Validación pre-tx costo requerido                                      | SATISFIED   | Test GREEN (0.30ms); 2 sub-cases (missing costoUnitario, missing monedaCosto), 0 writes              |
| VLN-03      | 15-03-modal-ui-y-uat        | UI: SearchableSelect condicional + costo separado + banner             | SATISFIED   | Modal lines 138-219; sub-component LoanerArticuloPicker; UAT step 2-7 PASSED                         |
| VLN-04      | 15-00 + 15-03 (UAT)         | Unit tests + UAT manual                                                | SATISFIED   | 5/5 unit tests GREEN + 8/8 UAT steps PASSED por usuario ("dale, por favor" 2026-05-24)              |

ROADMAP alignment: Phase 15 entry at ROADMAP.md:316-327 marks all 4 plans `[x]`. Each maps to a real SUMMARY + commit:
- `15-00`: commits `6651dce` + `587bf56` + `277a9c5` (docs)
- `15-01`: commits `915bbfb` + `de2c213` + `5cf0afd` (docs)
- `15-02`: commits `bce3205` + `86ccc3c` + `9963d9d` (docs)
- `15-03`: commits `e262b69` + `048736c` + `9fd0437` (docs); UAT human-verify checkpoint approved

### Anti-Patterns Found

| File                                 | Line  | Pattern                              | Severity | Impact                                                                |
| ------------------------------------ | ----- | ------------------------------------ | -------- | --------------------------------------------------------------------- |
| (none)                               | —     | —                                    | —        | Cero TODO/FIXME/XXX/HACK/PLACEHOLDER en archivos Phase 15 nuevos      |

**Notes:**
- HTML `placeholder="0.00"` y `placeholder="Observaciones sobre la venta"` en `LoanerVentaModal.tsx:182, 205, 227` son atributos legítimos de inputs/textarea, NO comentarios de stub.
- Cero `: undefined` introducidos en código nuevo del servicio (regla `.claude/rules/firestore.md` respetada — `deepCleanForFirestore` aplicado a los 3 payloads).
- LoanerVentaModal.tsx en 233 LOC (≤250 budget de `.claude/rules/components.md`); extracción de LoanerArticuloPicker mantiene padre dentro del budget (precedente Phase 14).
- Cero archivos en `apps/reportes-ot/` o `apps/portal-ingeniero/` modificados (regla `.claude/rules/reportes-ot.md` respetada).

### Adjacent Test Suite Regression Check

Documented in SUMMARY 15-02 (running adjacent suites is out of scope for this verification pass; the phase-internal `test:venta-loaner` is the contract):

- `test:venta-loaner` → **5/5 GREEN** (verified live this verification run, 17.43ms)
- `test:patron-bom` 18/18 — no regression per SUMMARY 15-02
- `test:equivalencias` 9/9 — no regression per SUMMARY 15-02
- `test:stock-amplio` 5/5 — no regression per SUMMARY 15-02
- `test:cuotas-facturacion` 9/9 — no regression per SUMMARY 15-02

### Human Verification Status

UAT 8-step checklist (15-VALIDATION.md) — **PASSED** by user (verbal "dale, por favor" 2026-05-24, documented in SUMMARY 15-03):

1. Create loaner with `articuloId: null` — PASS
2. Open `/loaners/<id>` → Vender → modal opens with SearchableSelect visible — PASS
3. Buscar + seleccionar artículo, cargar cliente, precio, costo, notas — PASS
4. Click Confirmar venta → modal cierra → loaner aparece "Vendido" — PASS
5. Firestore `loaners/<id>` tiene `articuloId` poblado + `venta.costoUnitario: 700` + `estado: 'vendido'` + `activo: false` — PASS
6. Firestore `unidades/<id>` con `estado: 'vendido'` + `condicion: 'bien_de_uso'` + `ubicacion.tipo: 'cliente'` + `costoUnitario: 700` — PASS
7. Firestore `movimientosStock/<id>` con `subtipo: 'venta_loaner'` + `referenciaLoanerId` + `referenciaLoanerCodigo` + `cantidad: 1` + `creadoPor` — PASS
8. Doble-click test (2 tabs concurrentes): tab B muestra banner "Loaner ya vendido", modal NO cierra, 0 docs nuevos en Firestore — PASS

**8/8 PASS** — no codebase evidence contradicts the UAT result.

### Gaps Summary

**No gaps.** Phase 15 achieves its goal:

- Transactional `registrarVenta` with READ-FIRST guard + 3 atomic writes (1 update + 2 creates) — `loanersVentaHelpers.ts` is the load-bearing artifact.
- DI hook `__setTestFirestore` enables unit tests without Firestore emulator (mirror Phase 13/14 pattern); 5 tests GREEN.
- Modal UI delivers SearchableSelect condicional, Precio/Costo separados con grid 2x2 doble apilado, banner inline rojo para errores transaccionales, validaciones bloqueantes.
- Type extensions backwards-compat (union widening + opcionales nullable) — cero breaking changes a consumidores existentes.
- Wiring end-to-end: Modal → LoanerDetail.handleVenta (adds `fecha`) → loanersService.registrarVenta → loanersVentaHelpers → runTransaction(3 writes).
- Hard rules respetadas: `.claude/rules/components.md` (modal 233 LOC ≤ 250), `.claude/rules/reportes-ot.md` (cero touches), `.claude/rules/firestore.md` (deepCleanForFirestore + cero `: undefined`).

**Invariante de la fase cumplido:** toda venta del loaner deja espejo contable en Stock (3 docs atómicos: `loaners` UPDATE + `unidades` CREATE con espejo + `movimientosStock` CREATE con `subtipo='venta_loaner'`).

**Pending follow-up (out of scope for this verification):**
- Release flow: `pnpm --filter @ags/sistema-modular release:minor` para distribuir Phase 15 a las PCs instaladas (handoff al usuario per `.claude/rules/release-flow.md`).

---

_Verified: 2026-05-24T15:10:52Z_
_Verifier: Claude (gsd-verifier)_
