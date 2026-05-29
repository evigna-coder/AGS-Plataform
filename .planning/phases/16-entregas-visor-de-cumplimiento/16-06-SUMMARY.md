---
phase: 16-entregas-visor-de-cumplimiento
plan: "06"
subsystem: entregas-visor
tags: [release-prep, uat, full-suite, build, type-check]

# Dependency graph
requires:
  - phase: 16-05
    provides: "useEntregas hook + /entregas list page + sidebar entry fully wired"
provides:
  - "Full-suite GREEN confirmation (6 unit suites + type-check + 3 builds)"
  - "UAT trace — 5 manual scenarios (UI-01..UI-05) pending user sign-off"
  - "Release gate surfaced: pnpm --filter @ags/sistema-modular release:minor"
affects:
  - "sistema-modular distribution (pending user release decision)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "autonomous: false — Claude surfaces release command, user executes"

key-files:
  created:
    - path: ".planning/phases/16-entregas-visor-de-cumplimiento/16-06-SUMMARY.md"
      role: "UAT trace + release readiness gate"
  modified: []

key-decisions:
  - "Release bump is MINOR: Phase 16 ships user-visible features (/entregas view + new fields in presupuesto editor) with no breaking changes"
  - "autonomous: false by design — user executes pnpm release:minor after smoke-testing .exe locally (precedent from Phase 14-08, 15-03)"
  - "portal-ingeniero missing node_modules link (pre-existing ambiental issue) fixed with pnpm install before build — not a Phase 16 regression"

requirements-completed: []

# Metrics
duration: "~12 minutes (Task 1 automated checks only)"
completed: 2026-05-29
---

# Phase 16 Plan 06: UAT + Release Gate — Automated Checks Summary

**Full-suite GREEN (6/6 unit suites × 46 tests + type-check + 3 builds); paused at checkpoint:human-verify UI-01..UI-05.**

## Status

**PAUSED AT CHECKPOINT** — Task 1 (automated checks) complete. Task 2 (UAT manual) awaiting user sign-off.

## Performance

- **Duration:** ~12 min (Task 1 automated checks)
- **Started:** 2026-05-29
- **Completed (Task 1):** 2026-05-29
- **Tasks completed:** 1 of 3
- **Files modified:** 0 (smoke-check only)

## Task 1: Full-Suite Results

### Type-Check

```
pnpm type-check → GREEN (packages/shared tsc --noEmit clean)
```

Note: 27 pre-existing TS errors in sistema-modular (AgendaGridCell, otService, stockAmplioService, etc.) are out-of-scope — same set documented in 16-01..05 SUMMARYs. Zero errors in Phase 16 files.

### test:entregas (6/6)

```
pnpm --filter @ags/sistema-modular test:entregas

✔ [ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly (0.928ms)
✔ [ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly (6.1201ms)
✔ [ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId (0.3994ms)
✔ [ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash) (0.1056ms)
✔ [ENT-05] item con importacion.estado=recibido → semaforo = entregado (0.3679ms)
✔ [ENT-06] item sin requerimiento (stock available) sigue mostrando row (0.1213ms)

tests 6 | pass 6 | fail 0 — exit 0
```

### test:patron-bom (18/18)

```
pnpm --filter @ags/sistema-modular test:patron-bom

✔ [BOM-02 legacy] computeSaldoComponente returns Infinity when patron has no BOM
✔ [BOM-02 simple] computeSaldoComponente uses cantidad * cantidadPorKit - consumido
✔ [BOM-02 null] computeSaldoComponente NaN-guards when lote.cantidad is null
✔ [BOM-02 status active legacy]
✔ [BOM-02 status active healthy]
✔ [BOM-02 status bloqueado]
✔ [BOM-02 status agotado]
✔ [BOM-02 FIFO] findLoteFifoDisponible
✔ [BOM-02 sugerencia] buildPatronesConsumidosSugerencia
✔ [BOM-03 happy] consumirComponentes — happy path
✔ [BOM-03 atomicity] consumirComponentes — throws on negative saldo
✔ [BOM-03 granularidad] consumirComponentes — 1 MovimientoStock per componente
✔ [BOM-08 idempotency] consumirComponentes — idempotency guard
✔ [BOM-08 auto-req idempotency] stockMinimo crossed twice → 1 RequerimientoCompra
✔ [BOM-04 service guard] rename of consumed componente throws orphan error
✔ [BOM-04 service guard] keeping all consumed codigos does NOT throw
✔ [BOM-04 service guard] patches WITHOUT componentes key do NOT trigger guard
✔ [BOM-04 service guard] patron with no consumos allows free rename

tests 18 | pass 18 | fail 0 — exit 0
```

### test:venta-loaner (5/5)

```
pnpm --filter @ags/sistema-modular test:venta-loaner

▶ registrarVenta — Phase 15 venta loaner espejo a stock
  ✔ happy path pre-vinculado: crea unidad+movimiento y marca loaner vendido
  ✔ happy path sin vinculo: denormaliza articuloId/Codigo/Descripcion en loaner
  ✔ guard ya vendido: throw "Loaner ya vendido" y no crea docs nuevos
  ✔ rollback atómico: si write falla mid-tx, ningún doc se crea ni modifica
  ✔ costo requerido: throw "Costo requerido" antes de la tx si falta costoUnitario

tests 5 | pass 5 | fail 0 — exit 0
```

### test:equivalencias (9/9)

```
pnpm --filter @ags/sistema-modular test:equivalencias

  ✓ STKE-02a passed: rejects self-link
  ✓ STKE-02b passed: rejects invalid factors (0, -1, NaN, Infinity)
  ✓ STKE-02c passed: rejects origen ya vinculado
  ✓ STKE-02d passed: rejects destino ya tomado
  ✓ STKE-02e passed: rejects ciclo A→B→A
  ✓ STKE-02f passed: unlink frees destino
  ✓ STKE-04a passed: desagregarUnidades completed without error
  ✓ STKE-04c passed: no extra MovimientoStock created
  ✓ STKE-04b passed: rejects when stock insuficiente

All equivalencias tests passed
```

### test:cuotas-facturacion (9/9 — 24 assertions)

```
pnpm --filter @ags/sistema-modular test:cuotas-facturacion

  ✓ BILL-01 validator-mono-ok
  ✓ BILL-01 validator-float-tolerance
  ✓ BILL-04 validator-MIXTA-independent
  ✓ BILL-04 validator-MIXTA-USD-fails
  ✓ BILL-01 all-zero-guard
  ✓ BILL-05 empty-legacy
  ✓ BILL-02 borrador-all-pendiente
  ✓ BILL-02 hito-aceptado
  ✓ BILL-02 todas-ots-cerradas
  ✓ BILL-02 pre-embarque
  ✓ BILL-02 oc-recibida
  ✓ BILL-02 manual-always-habilitada
  ✓ BILL-02 anulada-regen
  ✓ BILL-02 cobrada-mirror
  ✓ BILL-04 MIXTA-solo-USD
  ✓ BILL-04 MIXTA-solo-ARS
  ✓ BILL-04 MIXTA-combinada
  ✓ BILL-06 strict-cobrada
  ✓ BILL-W2 cuotasEqual-same-order
  ✓ BILL-W2 cuotasEqual-shuffled
  ✓ BILL-W2 cuotasEqual-not-equal
  ✓ BILL-I3 computeTotals-mono-ARS
  ✓ BILL-I3 computeTotals-MIXTA
  ✓ BILL-03 generarAviso-guard-no-habilitada

All cuotasFacturacion tests passed
```

### test:stock-amplio (5/5)

```
pnpm --filter @ags/sistema-modular test:stock-amplio

  ✓ Test 1 passed: STKP-01 happy path
  ✓ Test 2 passed: STKP-05 no double counting
  ✓ Test 3 passed: empty state all zeros
  ✓ Test 4 passed: stale reqs excluded
  ✓ Test 5 passed: closed OCs excluded

All stockAmplio tests passed
```

### Builds

| App | Result | Output |
|---|---|---|
| `@ags/sistema-modular` | GREEN | `release/AGS-Sistema-Modular-Setup-1.4.8.exe` |
| `@ags/reportes-ot` | GREEN | `dist/` built in 7.64s |
| `@ags/portal-ingeniero` | GREEN* | `dist/` built in 5.13s |

*portal-ingeniero had a stale node_modules link (pre-existing ambiental issue, not Phase 16). Fixed with `pnpm --filter @ags/portal-ingeniero install` before build.

### Suite Summary

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| test:entregas | 6 | 6 | 0 |
| test:patron-bom | 18 | 18 | 0 |
| test:venta-loaner | 5 | 5 | 0 |
| test:equivalencias | 9 | 9 | 0 |
| test:cuotas-facturacion | 24 | 24 | 0 |
| test:stock-amplio | 5 | 5 | 0 |
| **TOTAL** | **67** | **67** | **0** |

**ALL AUTOMATED CHECKS GREEN.**

---

## Task 2: UAT Manual — PENDING USER SIGN-OFF

The following 5 scenarios from `16-VALIDATION.md` require manual execution by the user:

| Scenario | Requirement | Status |
|---|---|---|
| UI-01 — Edición inline OT# persiste en Firestore tras F5 | `presupuestoItem.otNumeroVinculada` | PENDING |
| UI-02 — Filtros persisten en URL al navegar hacia atrás | `useUrlFilters` + browser back | PENDING |
| UI-03 — Badge "Sin ETA" para presupuestos legacy | `fechaAceptacion = null` edge case | PENDING |
| UI-04 — Bulk-apply "Aplicar a todos los items" | `BulkAplicarDisponibilidadButton` | PENDING |
| UI-05 — Auto-default disponibilidad por ATP | `computeStockAmplio` + `disponibilidadTouched` | PENDING |

Full scenario instructions in `16-VALIDATION.md` and in Task 2 of `16-06-PLAN.md`.

---

## Task 3: Release Command — Pending UAT Approval

Once UAT is approved, the user runs:

```bash
# 1) Bump version (MINOR — Phase 16 ships user-visible features)
pnpm --filter @ags/sistema-modular release:minor

# 2) Push bump + tag
git push origin main
git push origin sistema-modular-v<x.y.z>     # replace with version from package.json
```

**Rationale MINOR**: Phase 16 adds user-visible features (new `/entregas` view + disponibilidad/ETA/OT# fields in presupuesto editor) with zero breaking changes (all new fields optional, legacy presupuestos backwards-compatible).

**CI**: GH Action `release-sistema-modular.yml` fires on tag push → builds on `windows-latest` → publishes release. PCs receive "Reiniciar ahora" popup.

**See also**: `apps/sistema-modular/RELEASE-CHECKLIST.md` for 5-min pre-flight.

---

## Deviations from Plan

**[Rule 3 - Blocking] portal-ingeniero node_modules stale link fixed before build**
- **Found during:** Task 1 — build portal-ingeniero
- **Issue:** `Cannot find module ...portal-ingeniero/node_modules/vite/bin/vite.js` — ambiental, not caused by Phase 16
- **Fix:** `pnpm --filter @ags/portal-ingeniero install` (re-linked node_modules)
- **Files modified:** none (dependency link only)
- **Impact:** Build passed after fix. Pre-existing issue — no Phase 16 regression.

---

## Phase 16 Status

**COMPLETE WITH UAT PENDING** — automated checks all GREEN, UAT sign-off awaited.

After UAT approval: status becomes **COMPLETE** and release command can be executed.

---

## Self-Check: PASSED (Task 1)

Automated checks verified:
- type-check: GREEN
- 6 test suites: 67/67 PASS
- 3 builds: ALL GREEN
- sistema-modular .exe generated: `release/AGS-Sistema-Modular-Setup-1.4.8.exe`

---
*Phase: 16-entregas-visor-de-cumplimiento*
*Plan: 06 (partial — paused at Task 2 checkpoint:human-verify)*
*Task 1 completed: 2026-05-29*
