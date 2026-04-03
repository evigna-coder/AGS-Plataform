---
phase: 01-stock-requerimientos-oc
verified: 2026-04-03T00:00:00Z
status: gaps_found
score: 16/18 must-haves verified
gaps:
  - truth: "PresupuestoDetail has a 'Reservar stock' button and 'Generar requerimiento de compra' button"
    status: partial
    reason: "PLAN-04 target was PresupuestoDetail.tsx but that file is a redirect shim (opens floating modal). Buttons are correctly placed in EditPresupuestoModal.tsx — the actual presupuesto UI. Functionally correct but plan's artifact target is wrong; no regression."
    artifacts:
      - path: "apps/sistema-modular/src/pages/presupuestos/PresupuestoDetail.tsx"
        issue: "Is a 4-line redirect shim. Buttons do NOT exist here; they are in EditPresupuestoModal.tsx."
    missing:
      - "No functional gap — buttons exist in EditPresupuestoModal.tsx and are wired correctly. Plan artifact path was stale."
  - truth: "Auto-reserva passes correct clienteNombre to reservasService.reservar()"
    status: failed
    reason: "presupuestosService.ts line 294 has a copy-paste bug: clienteNombre is set to pres!.clienteId instead of pres!.clienteNombre. The MovimientoStock motivo and reservation record will store the clienteId string where the client name is expected."
    artifacts:
      - path: "apps/sistema-modular/src/services/presupuestosService.ts"
        issue: "Line 294: `clienteNombre: pres!.clienteId ?? ''` — should be `pres!.clienteNombre ?? ''`"
    missing:
      - "Fix line 294: change `pres!.clienteId` to `pres!.clienteNombre`"
human_verification:
  - test: "Open a presupuesto with multiple stock items and click 'Reservar stock'"
    expected: "Modal shows item selector list; clicking an item loads available units; clicking a unit reserves it and closes modal"
    why_human: "Multi-step modal flow with real-time Firestore queries — cannot verify user interaction programmatically"
  - test: "Change a presupuesto estado to 'aceptado' where items have stockArticuloId and stock falls below minimum"
    expected: "RequerimientoCompra documents appear in Firestore for those items; units with estado='disponible' transition to 'reservado' with reservation fields set"
    why_human: "Side-effect of service call requires live Firestore; cannot verify without running app"
  - test: "In RequerimientosList, select multiple pending reqs with different providers and click 'Generar OC (N)'"
    expected: "One OC per provider created as borrador; selected reqs transition to 'en_compra' with ordenCompraId set"
    why_human: "Requires live Firestore writes and real provider data"
  - test: "In InventarioIngenieroPage, click 'Reponer' on a minikit item; verify 'Confirmar' is disabled until depot position selected"
    expected: "Position selector (SearchableSelect) loads real depot positions; confirming creates a MovimientoStock of tipo 'transferencia' with real origenId"
    why_human: "Requires live posicionesStockService data and Firestore write verification"
---

# Phase 01: Stock Requerimientos OC — Verification Report

**Phase Goal:** Completar el ciclo operativo de stock — reservas físicas para presupuestos, movimientos completos (consumos/ajustes/transferencias/reposición), requerimientos automáticos desde presupuestos aprobados con lógica de stock mínimo, grilla de requerimientos con edición inline y generación de OC agrupada por proveedor.
**Verified:** 2026-04-03
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UnidadStock has 4 reservation reference fields | VERIFIED | `packages/shared/src/types/index.ts` lines 1709-1712 |
| 2 | requerimientosService importable from firebaseService.ts barrel | VERIFIED | `firebaseService.ts` line 18: `export * from './importacionesService'` |
| 3 | getOrCreateReservasPosition exported from stockService.ts | VERIFIED | `stockService.ts` line 132 |
| 4 | reservasService.reservar() uses createBatch() atomically | VERIFIED | `stockService.ts` lines 964-968 — batch.update + batch.set + batch.commit() |
| 5 | reservasService.liberar() clears reservation fields and creates MovimientoStock | VERIFIED | `stockService.ts` lines 1015-1019 — null fields + batch commit |
| 6 | useReservaStock exposes reservar/liberar with loading/error | VERIFIED | `useReservaStock.ts` line 23 — returns { reservar, liberar, loading, error } |
| 7 | Auto-req trigger fires when presupuesto estado === 'aceptado' | VERIFIED | `presupuestosService.ts` line 242 — `if (data.estado === 'aceptado')` with per-item try/catch |
| 8 | Auto-reserva calls reservasService.reservar per available unit | VERIFIED | `presupuestosService.ts` line 288 |
| 9 | Auto-req is duplicate-safe (checks existingReqs.length === 0) | VERIFIED | `presupuestosService.ts` lines 253-258 |
| 10 | Auto-reserva passes correct clienteNombre | FAILED | `presupuestosService.ts` line 294: `clienteNombre: pres!.clienteId ?? ''` — should be `pres!.clienteNombre` |
| 11 | useGenerarRequerimientos enables manual triggering | VERIFIED | `useGenerarRequerimientos.ts` — exports hook with generarParaPresupuesto, loading, error, generados |
| 12 | UnidadesList shows Disponible/Reservado/Total columns via toggle | VERIFIED | `UnidadesList.tsx` lines 63, 95-103, 161-164 — groupByArticulo toggle + useMemo aggregation |
| 13 | PresupuestoDetail UI has 'Reservar stock' + 'Generar req. de compra' buttons | PARTIAL | Buttons exist in `EditPresupuestoModal.tsx` lines 220/224/270 (correct actual UI) — not in `PresupuestoDetail.tsx` which is a redirect shim |
| 14 | ReservarStockModal accepts items array + item selector for multi-item presupuestos | VERIFIED | `ReservarStockModal.tsx` — Props.items: StockItem[], step 1 selector at line 60, auto-select when items.length===1 at line 23-24 |
| 15 | RequerimientosList uses useUrlFilters (no useState for filters) | VERIFIED | `RequerimientosList.tsx` line 24 — `useUrlFilters(FILTER_SCHEMA)`, no useState for filters |
| 16 | RequerimientosList has multi-select checkboxes + Generar OC button | VERIFIED | `RequerimientosList.tsx` lines 28, 52, 86, 111-113, 155 |
| 17 | Inline editing for proveedor/urgencia/cantidad cells | VERIFIED | `RequerimientoRow.tsx` lines 42-91 — click-to-edit with blur/Enter save |
| 18 | useGenerarOC creates OCs grouped by provider and transitions reqs to 'en_compra' | VERIFIED | `useGenerarOC.ts` lines 47, 65-68 — ordenesCompraService.create + estado: 'en_compra' |
| 19 | OCEditor reads location.state.prefill on mount for pre-populated items | VERIFIED | `OCEditor.tsx` lines 2, 15, 57-65 — useLocation import, prefill read in else branch |
| 20 | handleReponer creates MovimientoStock tipo 'transferencia' with real depot posicion ID | VERIFIED | `useInventarioIngeniero.ts` lines 145-176 — movimientosService.create with depotPosicionId param |
| 21 | InventarioIngenieroPage shows position selector before allowing Reponer confirmation | VERIFIED | `InventarioIngenieroPage.tsx` lines 6, 11, 25, 126, 165 — SearchableSelect from posicionesStockService |
| 22 | AjusteStockModal validates mandatory justificacion before saving | VERIFIED | `AjusteStockModal.tsx` line 20 — `if (!justificacion.trim())` blocks submit |
| 23 | AjusteStockModal creates MovimientoStock tipo 'ajuste' | VERIFIED | `AjusteStockModal.tsx` lines 24-41 — movimientosService.create({ tipo: 'ajuste', ... }) |
| 24 | UnidadesList Ajustar button wired to AjusteStockModal | VERIFIED | `UnidadesList.tsx` lines 8, 67, 223, 233-235 |

**Score:** 22/24 truths verified (16/18 must-have truths; 2 issues found)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/index.ts` | Extended UnidadStock with 4 reservation fields | VERIFIED | Lines 1709-1712 |
| `apps/sistema-modular/src/services/stockService.ts` | reservasService + getOrCreateReservasPosition | VERIFIED | Lines 132, 914-1021 |
| `apps/sistema-modular/src/hooks/useReservaStock.ts` | Hook wrapping reservasService | VERIFIED | Exports useReservaStock, 57 lines |
| `apps/sistema-modular/src/services/presupuestosService.ts` | Auto-req + auto-reserva on 'aceptado' | VERIFIED with bug | aceptado block exists; clienteNombre bug on line 294 |
| `apps/sistema-modular/src/hooks/useGenerarRequerimientos.ts` | Hook for manual req generation | VERIFIED | Exports useGenerarRequerimientos |
| `apps/sistema-modular/src/pages/stock/UnidadesList.tsx` | Aggregated columns + Ajustar button | VERIFIED | 242 lines (under 250 limit) |
| `apps/sistema-modular/src/components/stock/ReservarStockModal.tsx` | Multi-item modal with item selector | VERIFIED | 123 lines |
| `apps/sistema-modular/src/pages/presupuestos/PresupuestoDetail.tsx` | Action buttons for reserva + req | PARTIAL | This is a redirect shim; buttons live in EditPresupuestoModal.tsx |
| `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` | Action buttons (actual UI) | VERIFIED | Lines 34-35, 59-68, 220-224, 270-278 |
| `apps/sistema-modular/src/pages/stock/RequerimientosList.tsx` | useUrlFilters + checkboxes + inline edit + Generar OC | VERIFIED | 199 lines |
| `apps/sistema-modular/src/hooks/useRequerimientoInlineEdit.ts` | Inline cell editing hook | VERIFIED | Exports useRequerimientoInlineEdit |
| `apps/sistema-modular/src/hooks/useGenerarOC.ts` | OC creation hook grouped by provider | VERIFIED | Exports useGenerarOC |
| `apps/sistema-modular/src/pages/stock/OCEditor.tsx` | Reads location.state.prefill | VERIFIED | 248 lines (under 250 limit) |
| `apps/sistema-modular/src/hooks/useInventarioIngeniero.ts` | handleReponer method | VERIFIED | Lines 145-176, included in return |
| `apps/sistema-modular/src/components/stock/AjusteStockModal.tsx` | Mandatory justificacion + ajuste movimiento | VERIFIED | 78 lines |
| `apps/sistema-modular/src/pages/stock/RequerimientoRow.tsx` | Extracted row subcomponent with inline edit | VERIFIED | Inline edit wired at lines 42-91 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| UnidadStock.reservadoParaPresupuestoId | stockService.ts (reservasService.reservar) | TypeScript interface extension | WIRED | stockService.ts uses all 4 reservation fields |
| firebaseService.ts barrel | importacionesService.ts (requerimientosService) | `export * from './importacionesService'` | WIRED | Line 18 wildcard covers requerimientosService |
| reservasService.reservar() | getOrCreateReservasPosition + batch commit | createBatch() atomic write | WIRED | Lines 930, 964-968 confirm batch pattern |
| presupuestosService.update() → 'aceptado' | requerimientosService.create() per item | side-effect block after lead sync | WIRED | Line 260 |
| presupuestosService.update() → 'aceptado' | reservasService.reservar() per unit | same aceptado block | WIRED (with bug) | Line 288 — clienteNombre passes clienteId value |
| EditPresupuestoModal → Generar Req button | useGenerarRequerimientos.generarParaPresupuesto() | onClick handler | WIRED | Lines 63-68 |
| EditPresupuestoModal → Reservar Stock button | ReservarStockModal | showReservar state | WIRED | Lines 34, 270-278 |
| ReservarStockModal → item selector | unidadesService.getAll({ articuloId, estado: 'disponible' }) | selectedItem state driving useEffect | WIRED | Lines 30-38 |
| RequerimientosList → checkbox | selectedIds Set state | onChange toggle | WIRED | Lines 28, 52 |
| useGenerarOC.generarOCs() | ordenesCompraService.create() per provider group | groupBy proveedorSugeridoId + loop | WIRED | Lines 47 |
| OC created → requerimientos update | requerimientosService.update({estado: 'en_compra', ordenCompraId}) | for loop after each OC | WIRED | Lines 65-70 |
| OCEditor useEffect | location.state.prefill | useLocation() else branch | WIRED | Lines 57-65 |
| InventarioIngenieroPage → Reponer button | useInventarioIngeniero.handleReponer(item, qty, depotId, depotNombre) | SearchableSelect position selector | WIRED | Lines 126, 165 |
| handleReponer | movimientosService.create({ tipo: 'transferencia', origenId: depotPosicionId }) | direct service call | WIRED | Lines 145-176 in hook |
| AjusteStockModal onConfirm | movimientosService.create({ tipo: 'ajuste', motivo: justificacion }) | mandatory validation gate | WIRED | Lines 18-41 |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|-------------|--------|---------|
| RES-01 (Auto-req from presupuesto aceptado) | 01-03 | SATISFIED (with minor bug) | presupuestosService.ts aceptado block; clienteNombre bug is cosmetic for req creation path |
| RES-02 (Stock reservation for presupuesto) | 01-01, 01-02, 01-04 | SATISFIED | reservasService + ReservarStockModal + EditPresupuestoModal buttons |
| RES-03 (Reservation UI in presupuesto detail) | 01-02, 01-04 | SATISFIED | Buttons wired in EditPresupuestoModal.tsx |
| RES-04 (Requerimientos list with filters) | 01-05 | SATISFIED | useUrlFilters in RequerimientosList |
| RES-05 (Generar OC from requerimientos) | 01-05, 01-06 | SATISFIED | useGenerarOC + OCEditor prefill |
| RES-06 (Inline editing of requerimientos) | 01-05 | SATISFIED | useRequerimientoInlineEdit + RequerimientoRow |
| RES-07 (Minikit replenishment from depot) | 01-07 | SATISFIED | handleReponer + InventarioIngenieroPage position selector |
| RES-08 (Stock adjustments with justification) | 01-07 | SATISFIED | AjusteStockModal mandatory justificacion validation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/sistema-modular/src/services/presupuestosService.ts` | 294 | `clienteNombre: pres!.clienteId ?? ''` — copy-paste bug assigns ID where name is expected | WARNING | Auto-reserva MovimientoStock motivo and reservedForClienteNombre field will contain clienteId string instead of client name. Data integrity issue in Firestore; not a crash. |

### Human Verification Required

#### 1. Multi-item ReservarStockModal flow

**Test:** Open a presupuesto with 2+ items that have `stockArticuloId` set. Click "Reservar stock" button.
**Expected:** Modal shows a list of item descriptions to choose from. Clicking an item shows available units. Clicking a unit calls reservasService, transitions the unit to 'reservado', and closes the modal.
**Why human:** Multi-step stateful modal — cannot verify user interaction or real-time unit fetch without running app.

#### 2. Auto-req + auto-reserva on presupuesto aceptado

**Test:** Change a presupuesto with stock-linked items to estado 'aceptado'. Check Firestore.
**Expected:** RequerimientoCompra documents appear for items where `qtyDisponible - item.cantidad < stockMinimo`. Available units transition to estado='reservado' with reservation fields set (note: clienteNombre field will contain clienteId — see gap).
**Why human:** Requires live Firestore writes and real data to validate side-effects.

#### 3. Generar OC flow with multi-provider selection

**Test:** In `/stock/requerimientos`, select 3 pending requirements with 2 different providers and click "Generar OC (3)".
**Expected:** 2 OCs created (one per provider) as borradores. All 3 reqs transition to 'en_compra' with their respective ordenCompraId.
**Why human:** Requires live Firestore and real provider data.

#### 4. InventarioIngenieroPage replenishment flow

**Test:** On `/stock/inventario-ingeniero`, click "Reponer" on a minikit item. Verify "Confirmar" button is disabled. Select a depot position from the SearchableSelect. Verify "Confirmar" becomes enabled. Click it.
**Expected:** A MovimientoStock of tipo='transferencia' is created with origenId matching the selected real Firestore position document ID.
**Why human:** Requires live posicionesStockService data and Firestore ID verification.

### Gaps Summary

Two gaps found, one functional and one cosmetic:

**Gap 1 — Copy-paste bug in auto-reserva (BLOCKER for data integrity):**
`presupuestosService.ts` line 294 reads `pres!.clienteId` where it should read `pres!.clienteNombre`. Every auto-reservation created when a presupuesto is accepted will have the wrong value in the `clienteNombre` field of both the reserved `UnidadStock` document and the `MovimientoStock` record. This is a data integrity bug — the reservation functionally works (unit moves to RESERVAS state) but the client name audit trail is corrupted.

**Gap 2 — Artifact target mismatch (informational, no functional gap):**
PLAN-04 specified adding action buttons to `PresupuestoDetail.tsx`. That file is actually a 4-line redirect shim that opens a floating modal. The implementer correctly placed the buttons in `EditPresupuestoModal.tsx` (the actual presupuesto UI). There is no functional gap — the buttons exist and work — but the plan's artifact target is technically incorrect.

---

_Verified: 2026-04-03_
_Verifier: Claude (gsd-verifier)_
