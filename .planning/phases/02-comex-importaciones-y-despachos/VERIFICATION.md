---
phase: 02-comex-importaciones-y-despachos
verified: 2026-04-03T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "OC tipo importacion — botón visible solo para ese tipo"
    expected: "El botón '+ Crear Importacion' aparece en el header de OCDetail únicamente cuando oc.tipo === 'importacion'"
    why_human: "Conditional render verified in code; visual confirmation requires dev server"
  - test: "Transición a embarcado bloqueada sin fecha + booking"
    expected: "El botón 'Confirmar' en ImportacionStatusTransition queda deshabilitado y muestra mensaje de error hasta completar ambos campos en ImportacionEmbarqueSection"
    why_human: "Validation logic verified in code; UI interaction flow requires manual test"
  - test: "Badge ETA vencida visible en lista"
    expected: "Fila con fechaEstimadaArribo < hoy y estado != recibido/cancelado muestra badge rojo 'ETA vencida' junto al badge de estado"
    why_human: "isEtaVencida() function verified; real rendering requires dev server with fixture data"
  - test: "Ingresar al stock — flujo completo con seriales"
    expected: "Al confirmar, se crean UnidadStock y MovimientoStock en Firestore con costoUnitario prorrateado; requerimientos vinculados pasan a completado"
    why_human: "Batch write logic verified; real Firestore writes require integration test environment"
---

# Phase 2: Comex — Importaciones y Despachos — Verification Report

**Phase Goal:** Gestión de comercio exterior: DUAs, despachos de importación, tracking de embarques con validación de campos obligatorios por estado, vinculación OC→Importación, prorrateo de gastos, y alta de stock al recibir con cierre automático de requerimientos.

**Verified:** 2026-04-03
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OC tipo `importacion` muestra botón "Crear Importación" | VERIFIED | `OCDetail.tsx:75-93` — conditional `oc.tipo === 'importacion'` wraps Button that navigates to `/stock/importaciones/nuevo` with `state.fromOC` |
| 2 | ImportacionEditor precompleta desde `location.state.fromOC` | VERIFIED | `ImportacionEditor.tsx:30,37-47` — `fromOC` read from location.state; form initialized with `ordenCompraId`, `ordenCompraNumero`, `proveedorId`, `proveedorNombre`, `moneda` |
| 3 | Transición a `embarcado` bloquea sin `fechaEmbarque` + `booking` | VERIFIED | `ImportacionStatusTransition.tsx:26-29` — REQUIRED_FIELDS_FOR_STATE.embarcado checks both fields; button disabled when `validationError !== null` (line 90) |
| 4 | Badge ETA vencida en ImportacionesList | VERIFIED | `ImportacionesList.tsx:21-25,122-126` — `isEtaVencida()` function correct; red badge rendered inline with estado badge |
| 5 | Prorrateo distribuye gastos proporcional al valor | VERIFIED | `calcularProrrateo.ts:8-20` — pure function; `ImportacionGastosSection.tsx:23-44` uses it for ProrrateoPreview; `useIngresarStock.ts:48-53` uses it for actual cost write |
| 6 | "Ingresar al stock" crea UnidadStock + MovimientoStock por unidad | VERIFIED | `useIngresarStock.ts:61-120` — loop per serial/unit, `batch.set(docRef('unidades', …))` + `batch.set(docRef('movimientosStock', …))` per unit |
| 7 | Requerimiento `en_compra` → `completado` al recibir cantidad suficiente | VERIFIED | `useIngresarStock.ts:124-133` — `if (rec.item.requerimientoId && rec.cantidadReal >= rec.item.cantidadPedida)` → batch.update estado to 'completado' |
| 8 | Filtros de ImportacionesList persisten en URL | VERIFIED | `ImportacionesList.tsx:32` — `useUrlFilters(FILTER_SCHEMA)` with `estado`, `sortField`, `sortDir` — hard rule satisfied |

**Score: 8/8 truths verified**

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `apps/sistema-modular/src/pages/stock/OCDetail.tsx` | COMEX-01 button + list | VERIFIED | 130 lines, substantive, wired to OCImportacionesSection |
| `apps/sistema-modular/src/components/stock/OCImportacionesSection.tsx` | Linked importaciones display | VERIFIED | 43 lines, renders list with estado badges and Ver links |
| `apps/sistema-modular/src/pages/stock/ImportacionEditor.tsx` | COMEX-02 pre-fill + item selector | VERIFIED | 208 lines, reads fromOC state, ItemEmbarqueSelector wired |
| `apps/sistema-modular/src/components/stock/ItemEmbarqueSelector.tsx` | Item subset selection from OC | VERIFIED | 103 lines, maps ItemOC → ItemImportacion including requerimientoId |
| `apps/sistema-modular/src/components/stock/ImportacionStatusTransition.tsx` | COMEX-03 state validation | VERIFIED | 140 lines, REQUIRED_FIELDS_FOR_STATE guards for embarcado/en_aduana/despachado/recibido |
| `apps/sistema-modular/src/pages/stock/ImportacionesList.tsx` | COMEX-04 ETA badge + COMEX-08 URL filters | VERIFIED | 149 lines, useUrlFilters + isEtaVencida fully implemented |
| `apps/sistema-modular/src/utils/calcularProrrateo.ts` | COMEX-05 prorrateo function | VERIFIED | 20 lines, pure function, correct proportional formula |
| `apps/sistema-modular/src/components/stock/ImportacionGastosSection.tsx` | COMEX-05 prorrateo UI preview | VERIFIED | 243 lines, ProrrateoPreview subcomponent wired to calcularCostoConGastos |
| `apps/sistema-modular/src/hooks/useIngresarStock.ts` | COMEX-06 + COMEX-07 batch write | VERIFIED | 164 lines, atomic batch: UnidadStock + MovimientoStock per unit + requerimiento close |
| `apps/sistema-modular/src/components/stock/ImportacionIngresarStockModal.tsx` | COMEX-06 UI for stock entry | VERIFIED | 174 lines, per-item quantity/posicion/seriales, wired to useIngresarStock |
| `apps/sistema-modular/src/pages/stock/ImportacionDetail.tsx` | Main wiring hub | VERIFIED | 107 lines, imports all subsections + modal, puedeIngresarStock gate correct |
| `packages/shared/src/types/index.ts` | Wave 0 type extensions | VERIFIED | ItemImportacion (line 2322), numeroGuia/items/fechaRecepcion/stockIngresado added to Importacion (lines 2371-2374) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OCDetail.tsx` | `/stock/importaciones/nuevo` | navigate with `state.fromOC` | WIRED | Lines 76-89; passes ordenCompraId, numero, proveedorId, proveedorNombre, moneda, items |
| `OCDetail.tsx` | `OCImportacionesSection` | JSX render on `oc.tipo === 'importacion'` | WIRED | Lines 113-115 |
| `ImportacionEditor.tsx` | `location.state.fromOC` | `useLocation()` + optional chaining | WIRED | Line 30; form initialized at lines 37-47 |
| `ImportacionEditor.tsx` | `ItemEmbarqueSelector` | JSX conditional `{fromOC && …}` | WIRED | Lines 160-163; onChange=setEmbarqueItems |
| `ImportacionDetail.tsx` | `ImportacionStatusTransition` | Via `ImportacionInfoSidebar` | WIRED | `ImportacionInfoSidebar.tsx:5,100-106` |
| `ImportacionStatusTransition.tsx` | `REQUIRED_FIELDS_FOR_STATE` | Validation in render + button disabled | WIRED | Lines 57-58, 90 — validationError blocks confirm |
| `ImportacionDetail.tsx` | `ImportacionIngresarStockModal` | `puedeIngresarStock` guard | WIRED | Lines 57, 94-103 — gate: estado=recibido AND !stockIngresado |
| `ImportacionIngresarStockModal.tsx` | `useIngresarStock` | Direct import + call | WIRED | Lines 7, 40, 83 |
| `useIngresarStock.ts` | `calcularCostoConGastos` | Direct import, used per RecepcionItem | WIRED | Lines 13, 48-53 |
| `useIngresarStock.ts` | `requerimientos_compra` Firestore | batch.update on requerimientoId | WIRED | Lines 124-133 |
| `ImportacionesList.tsx` | `useUrlFilters` | Direct import, FILTER_SCHEMA | WIRED | Lines 4, 32 |
| `ItemEmbarqueSelector.tsx` | `requerimientoId` propagation | ItemOC.requerimientoId → ItemImportacion | WIRED | Line 53 in notify() |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| COMEX-01 | OC tipo importacion muestra botón "Crear Importación" en OCDetail | SATISFIED | OCDetail.tsx:75-93 |
| COMEX-02 | ImportacionEditor precompleta desde `location.state.fromOC` | SATISFIED | ImportacionEditor.tsx:30,37-47 |
| COMEX-03 | Transición a `embarcado` bloquea sin `fechaEmbarque` + `booking` | SATISFIED | ImportacionStatusTransition.tsx:26-29, also covers en_aduana/despachado/recibido |
| COMEX-04 | Badge ETA vencida en ImportacionesList | SATISFIED | ImportacionesList.tsx:21-25,122-126 |
| COMEX-05 | Prorrateo distribuye gastos proporcional al valor (calcularCostoConGastos) | SATISFIED | calcularProrrateo.ts:8-20; wired in GastosSection preview and useIngresarStock actual write |
| COMEX-06 | "Ingresar al stock" crea UnidadStock + MovimientoStock por unidad | SATISFIED | useIngresarStock.ts:61-120 — atomic batch per unit |
| COMEX-07 | Requerimiento `en_compra` → `completado` al recibir cantidad suficiente | SATISFIED | useIngresarStock.ts:124-133; requerimientoId flows from ItemOC via ItemEmbarqueSelector |
| COMEX-08 | Filtros de ImportacionesList persisten en URL | SATISFIED | ImportacionesList.tsx:32 — useUrlFilters with estado + sortField + sortDir |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ImportacionEditor.tsx:100` | 100 | `createImportacion(payload as any)` | Info | TypeScript cast; functional but bypasses type safety on payload |
| `ImportacionGastosSection.tsx:203` | 203 | `setNewGasto(p => ({ ...p, moneda: e.target.value as any }))` | Info | Loose cast; bounded by MONEDAS select options, acceptable |
| `ImportacionStatusTransition.tsx:64` | 64 | Eagerly persists `fechaRecepcion` on every keystroke via `importacionesService.update()` | Warning | Creates excess Firestore writes per keystroke; no debounce. Not a blocker — data is eventually consistent and correct — but could generate billing noise on slow connections |

No blockers found. All implementations are substantive.

---

## Human Verification Required

### 1. Crear Importacion button visibility

**Test:** Open an OC with `tipo: 'importacion'` at `/stock/ordenes-compra/:id`. Also open an OC with `tipo: 'nacional'`.
**Expected:** Button "+ Crear Importacion" appears only for the importacion-type OC; absent for nacional.
**Why human:** Conditional render verified in code; visual/layout confirmation requires dev server.

### 2. State transition blocking — embarcado

**Test:** On an importacion in estado `preparacion`, open "Cambiar estado", select "Embarcado" without filling `fechaEmbarque` or `booking` in the Embarque section first.
**Expected:** An error message appears ("Ingresá la fecha de embarque...") and the Confirmar button stays disabled.
**Why human:** Validation reads `imp` object from parent; requires full render cycle with live Firestore data to confirm field-check works end-to-end.

### 3. ETA vencida badge rendering

**Test:** In ImportacionesList, have at least one importacion with `fechaEstimadaArribo` set to a past date and estado not `recibido`/`cancelado`.
**Expected:** A red "ETA vencida" badge appears inline next to the estado badge in that row.
**Why human:** `isEtaVencida()` logic verified; real date comparison uses `new Date()` so needs live data.

### 4. Ingresar al stock — full flow with requirement close

**Test:** Complete an importacion to estado `recibido`. Click "Ingresar al stock". Select posiciones, enter cantidades, confirm. Then check `/stock/requerimientos` for any linked requerimiento.
**Expected:** UnidadStock entries appear in `/stock/unidades`. MovimientoStock entries appear. Linked requerimiento (if one had `requerimientoId`) shows estado `completado`.
**Why human:** Atomic Firestore batch requires live Firebase; Firestore emulator not configured in this project.

---

## Summary

All 8 COMEX requirements are fully implemented with substantive, wired code. The complete feature chain from OC-to-Importacion creation through state tracking, DUA/gastos entry with prorrateo preview, to the stock ingestion batch (UnidadStock + MovimientoStock + requerimiento close) is present and correctly connected.

The Wave 0 type extensions (`ItemImportacion`, `numeroGuia`, `stockIngresado`, `fechaRecepcion`) are present in the shared package. The `requerimientoId` field propagates correctly from `ItemOC` → `ItemImportacion` (via `ItemEmbarqueSelector.ts:53`) → `useIngresarStock` → Firestore batch update.

The only notable non-blocker issue is that `fechaRecepcion` is persisted on every keystroke in the transition modal (no debounce), which creates excess Firestore writes but does not break correctness.

All automated checks pass. Four items flagged for human verification via dev server due to their nature as visual/runtime behaviors.

---

_Verified: 2026-04-03_
_Verifier: Claude (gsd-verifier)_
