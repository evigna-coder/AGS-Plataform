---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 02
subsystem: stock
tags: [firestore, runtransaction, atomic, loaner, stock, tdd, dependency-injection]

# Dependency graph
requires:
  - phase: 15-stock-venta-de-loaner-espejo-a-stock
    provides: "RED test baseline (5 tests) en ventaLoaner.test.ts + fixtures (plan 15-00)"
  - phase: 15-stock-venta-de-loaner-espejo-a-stock
    provides: "MovimientoStock.subtipo widened a 'venta_loaner' + referenciaLoanerId/Codigo opcionales; VentaLoaner.costoUnitario/monedaCosto opcionales nullable (plan 15-01)"
  - phase: 14-stock-bom-y-cierre
    provides: "Patrón runTransaction READ-FIRST + dispatch test/prod + __setTestFirestore DI hook (patronesConsumirHelpers en producción desde 2026-05-24)"
provides:
  - "registrarVenta(params): {unidadId, movimientoId} — venta atómica con espejo en stock"
  - "loanersService.registrarVenta(id, venta, articuloRecienVinculado?) — wrapper imperativo"
  - "__setTestFirestore(state) — DI hook para tests sin emulator"
  - "loanersVentaHelpers.ts — implementación pura factorizada (mirror patronesConsumirHelpers)"
affects: ["15-03 (UI/UAT: modal LoanerVentaModal extendido con costoUnitario+monedaCosto+articulo SearchableSelect)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy firebase import (mirror Phase 14 patronesService) — tsx/Node test runner sin import.meta.env"
    - "Factory buildRegistrarVenta(deps) con getTestState + getFirebaseModules (mirror patronesConsumirHelpers.buildConsumirComponentes)"
    - "Validate-first / mutate-last en test path para rollback semantics in-memory"
    - "Hook _throwOnUnidadCreate en mock state para simular fallo mid-tx"
    - "Audit post-commit best-effort (logBusinessEvent) sin bloquear la tx"

key-files:
  created:
    - "apps/sistema-modular/src/services/loanersVentaHelpers.ts (364 LOC — implementación de registrarVenta)"
    - ".planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-02-service-transaccional-SUMMARY.md"
  modified:
    - "apps/sistema-modular/src/services/loanersService.ts (178 → 306 LOC — refactor lazy firebase + bind helper)"
    - "apps/sistema-modular/src/services/firebaseService.ts (barrel: export específico para evitar colisión __setTestFirestore)"
    - "apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts (rollback test RED → GREEN)"
    - "apps/sistema-modular/src/hooks/useLoaners.ts (signature widened: costoUnitario + monedaCosto + articuloRecienVinculado)"
    - "apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx (cast WIP hasta Wave 3 — modal nuevo)"

key-decisions:
  - "Extraer a loanersVentaHelpers.ts en lugar de inline en loanersService.ts: siguió precedente Phase 14 (patronesConsumirHelpers.ts extraído de patronesService.ts por LOC). loanersService.ts queda en 306 LOC, helper en 364 LOC."
  - "Lazy firebase import (await import('./firebase')) en TODOS los métodos de loanersService — no solo en registrarVenta — porque mantener algunos eager + otros lazy genera el mismo trip de import.meta.env al cargar el módulo."
  - "Excluir __setTestFirestore del barrel firebaseService.ts: era colisión con patronesService.__setTestFirestore. Reemplazado `export * from './loanersService'` por `export { loanersService } + export type { RegistrarVentaParams, RegistrarVentaResult }`. El hook DI sólo se accede vía import directo (`from '../loanersService'`)."
  - "Validate-first/mutate-last en _registrarVentaInTest: el hook _throwOnUnidadCreate se chequea DESPUÉS de construir todos los payloads y ANTES de cualquier mutación a state.collections. Eso garantiza rollback semantics in-memory equivalentes a la atomicidad real de runTransaction."
  - "creadoPor en MovimientoStock: getCreateTrace().createdByName ?? createdBy ?? 'desconocido' (fallback chain explícito para que nunca sea undefined — Firestore lo rechazaría)."
  - "LoanerDetail.tsx mantiene el call site viejo pero con cast WIP a `null as any` para costoUnitario/monedaCosto. El service throw 'Costo requerido' en runtime, así que el flujo se rompe limpio sin escribir nada (atomic guard) hasta que Wave 3 reemplace el modal."

patterns-established:
  - "Service transaccional con 3 writes atómicos (update existing + 2 creates) calcando 1:1 patronesConsumirHelpers"
  - "Bind factory pattern para que test-state viva en el service principal y el helper sea puro (sin module-level state)"
  - "Test path con mutación atómica simulada (construir-validar-commit) para emular runTransaction rollback semantics"

requirements-completed: [VLN-02]

# Metrics
duration: 30min
completed: 2026-05-24
---

# Phase 15 Plan 02: Service transaccional Summary

**registrarVenta transaccional con espejo en stock (3 writes atómicos: loaner update + UnidadStock create + MovimientoStock create) calcando 1:1 el patrón Phase 14 BOM-03; 5/5 tests RED→GREEN; loanersService refactorizado a lazy firebase import.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-05-24T07:03:00Z (approx, post-init)
- **Completed:** 2026-05-24T07:33:35Z
- **Tasks:** 2
- **Files modified:** 5 (1 nuevo + 4 modificados)

## Accomplishments
- `registrarVenta(params)` named export que ejecuta UNA `runTransaction` atómica con 3 writes (loaner UPDATE + unidades CREATE + movimientosStock CREATE). READ-FIRST guard contra doble venta. Pre-tx validation de costoUnitario/monedaCosto. Audit post-commit best-effort.
- `__setTestFirestore(state)` DI hook para que los 5 tests del Wave 0 corran sin emulator de Firestore.
- Extracción a `loanersVentaHelpers.ts` (precedente `patronesConsumirHelpers.ts` Phase 14) — service principal queda en 306 LOC, helper en 364 LOC.
- Refactor de `loanersService.ts` completo a lazy firebase import: todos los métodos (`getAll`, `subscribe`, `create`, `update`, etc.) ahora hacen `await getFirebaseModules()` para evitar trippear `import.meta.env` en el test runner tsx/Node.
- 5/5 tests `pnpm test:venta-loaner` GREEN. Suite adyacente sin regresión (`test:patron-bom 18/18`, `test:equivalencias 9/9`, `test:stock-amplio 5/5`, `test:cuotas-facturacion 9/9`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Implementar registrarVenta transaccional + DI hook** — `bce3205` (feat) — landed nuevo `loanersVentaHelpers.ts` + refactor `loanersService.ts` + ajuste `firebaseService.ts` barrel + widening `useLoaners.ts` + WIP cast en `LoanerDetail.tsx`. Resultado: 4/5 tests GREEN (rollback test sigue como RED placeholder esperando Task 2).
2. **Task 2: Convertir rollback test de RED placeholder a aserción real** — `86ccc3c` (test) — VLN-02d ahora usa `state._throwOnUnidadCreate = true` para forzar throw mid-tx y verifica las 5 condiciones de rollback (loaner.estado, .activo, .venta + unidades.length, movimientosStock.length). Resultado: **5/5 tests GREEN**.

**Plan metadata commit:** (será creado al final de execute, incluye SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

### Created
- `apps/sistema-modular/src/services/loanersVentaHelpers.ts` (364 LOC) — Implementación de `registrarVenta` (factory `buildRegistrarVenta` + `_registrarVentaInTest` + `_registrarVentaInProd`). Mirror 1:1 de `patronesConsumirHelpers.ts` Phase 14.

### Modified
- `apps/sistema-modular/src/services/loanersService.ts` (178 → 306 LOC) — Refactor completo a lazy firebase import + bind del factory + `__setTestFirestore` namespaced + `loanersService.registrarVenta` wrapper que delega al export top-level.
- `apps/sistema-modular/src/services/firebaseService.ts` — Barrel: reemplazó `export * from './loanersService'` por re-exports explícitos (`loanersService` value + `RegistrarVentaParams`/`RegistrarVentaResult` types) para excluir `__setTestFirestore` del namespace común (colisión con patronesService).
- `apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts` — Test "rollback atómico" pasó de `assert.fail('RED: ...')` a aserción real con `_throwOnUnidadCreate` hook + 5 verificaciones de estado intacto.
- `apps/sistema-modular/src/hooks/useLoaners.ts` — `registrarVenta` callback con nueva signature (`venta` widened + tercer arg `articuloRecienVinculado` opcional + retorna `RegistrarVentaResult`).
- `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx` — `handleVenta` aceptó campos opcionales `costoUnitario`/`monedaCosto` con cast `(null as any)`; comentario WIP indica que Wave 3 (`15-03`) reemplaza este modal por `LoanerVentaModal` nuevo con los campos requeridos.

## Decisions Made

Las decisiones clave están listadas en el frontmatter `key-decisions` arriba. Resumen:

1. **Extracción a `loanersVentaHelpers.ts`**: el plan ya anticipaba este corte si LOC > 250; el resultado quedó en 306 LOC para el service y 364 LOC para el helper. Mantener todo inline hubiera dejado el service en 607 LOC (más del doble del budget de Phase 14 patronesService).

2. **Lazy firebase import en toda la superficie**: no solo en `registrarVenta`. La razón es que `tsx scripts/test-venta-loaner.ts` → `ventaLoaner.test.ts` → `import from '../loanersService'` carga el módulo completo, y cualquier eager `import { db } from './firebase'` dispara `import.meta.env.VITE_FIREBASE_API_KEY` (Vite-only). Esta refactor convirtió 8 métodos a `await getFirebaseModules()`. Precedente directo: `patronesService.ts` Phase 14.

3. **Barrel exclusion del DI hook**: `__setTestFirestore` ya estaba exportado por `patronesService` vía `export * from './patronesService'` en `firebaseService.ts`. Agregar `export * from './loanersService'` con el mismo nombre causó `TS2308: Module './patronesService' has already exported a member named '__setTestFirestore'`. Solución: re-exports explícitos sólo del `loanersService` object + tipos públicos, excluyendo el hook DI (que sólo se accede vía import directo desde tests).

4. **WIP cast en `LoanerDetail.tsx`**: el modal viejo no propaga `costoUnitario`/`monedaCosto`. Wave 3 lo reemplaza. Cast `(null as any)` mantiene type-check GREEN; runtime, el service throw `'Costo requerido'` antes de tocar Firestore — atomic guard funciona como diseñado.

5. **Validate-first / mutate-last**: el test path construye los 3 payloads completos sin mutar nada, luego chequea `_throwOnUnidadCreate`, luego commitea. Esto garantiza rollback semantics in-memory equivalentes a `runTransaction`'s atomicity en prod (la falla mid-flight deja `state` intacto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy firebase import en TODOS los métodos de loanersService (no solo en registrarVenta)**
- **Found during:** Task 1 (primer run de `pnpm test:venta-loaner` después de agregar las nuevas exports)
- **Issue:** El test runner tsx falló con `TypeError: Cannot read properties of undefined (reading 'VITE_FIREBASE_API_KEY')` porque `loanersService.ts` mantenía el eager `import { db, createBatch, ... } from './firebase'` en línea 3, y ese módulo dispara `import.meta.env` al cargarse en Node.
- **Fix:** Refactor completo de los 8 métodos del objeto `loanersService` (`getNextLoanerCodigo`, `getAll`, `subscribe`, `getById`, `subscribeById`, `create`, `update`, `delete`) a `await getFirebaseModules()` lazy. Pattern calcado de `patronesService.ts` Phase 14. Los métodos sync (`subscribe`, `subscribeById`) usan fire-and-forget del lazy load con flag `cancelled` para no engancharse si el caller unsubscribió antes.
- **Files modified:** `apps/sistema-modular/src/services/loanersService.ts` (178 → 306 LOC)
- **Verification:** `pnpm test:venta-loaner` ahora pasa la fase de module load; los 5 tests corren.
- **Committed in:** `bce3205` (Task 1)

**2. [Rule 3 - Blocking] Colisión de `__setTestFirestore` entre patronesService y loanersService en el barrel**
- **Found during:** Task 1 (primer `npx tsc --noEmit` después de agregar el export `__setTestFirestore` a loanersService)
- **Issue:** `firebaseService.ts` barrel hace `export * from './patronesService'` (línea 14) y `export * from './loanersService'` (línea 19). Ambos exportan `__setTestFirestore` → `error TS2308: Module './patronesService' has already exported a member named '__setTestFirestore'. Consider explicitly re-exporting to resolve the ambiguity`.
- **Fix:** Reemplacé `export * from './loanersService'` por re-exports explícitos: `export { loanersService } from './loanersService'` + `export type { RegistrarVentaParams, RegistrarVentaResult } from './loanersService'`. El hook DI (`__setTestFirestore`) y la función `registrarVenta` named export quedan fuera del barrel — sólo accesibles vía `import { __setTestFirestore } from './loanersService'` directo, que es exactamente lo que el test hace.
- **Files modified:** `apps/sistema-modular/src/services/firebaseService.ts`
- **Verification:** `npx tsc --noEmit | grep -c "error TS"` baja de 30 (baseline) a 28 (incluso 2 menos, porque la ambigüedad anterior contaba como múltiples errores).
- **Committed in:** `bce3205` (Task 1)

**3. [Rule 3 - Blocking] Signature widening en `LoanerDetail.tsx` / `useLoaners.ts` para que type-check pase**
- **Found during:** Task 1 (post-implementation, antes del primer test run)
- **Issue:** El nuevo `loanersService.registrarVenta(id, venta, articuloRecienVinculado?)` tiene `venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' }`. El call site existente en `LoanerDetail.tsx` (línea 87) y el wrapper en `useLoaners.ts` (línea 101) no pasaban esos campos → type-check fail.
- **Fix:**
  - `useLoaners.ts`: widening del callback `registrarVenta` para aceptar la nueva signature completa (3 args, retorna `RegistrarVentaResult`).
  - `LoanerDetail.tsx`: `handleVenta` aceptó campos opcionales `costoUnitario?`/`monedaCosto?` con cast `(null as any)` al pasar al service. Comentario WIP indica que Wave 3 (plan 15-03) reemplaza este modal viejo por `LoanerVentaModal` con los campos requeridos. Runtime: el service throw `'Costo requerido'` antes de tocar Firestore — atomic guard funciona como diseñado, no se escribe nada a la DB.
- **Files modified:** `apps/sistema-modular/src/hooks/useLoaners.ts`, `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx`
- **Verification:** type-check loaner-related queries → 0 errores. Pre-existing 28 errores no relacionados a Phase 15 quedan deferred (CLAUDE.md scope boundary).
- **Committed in:** `bce3205` (Task 1)

---

**Total deviations:** 3 auto-fixed (3 blocking — todas necesarias para que el plan se complete)
**Impact on plan:** Las 3 son consecuencia directa del cambio del task (lazy load para que tsx funcione, barrel exclusion para evitar colisión TS, widening de callers para que type-check pase). No hay scope creep. El plan anticipaba "callers de `loanersService.registrarVenta` cambian en Wave 3" — el cast WIP en LoanerDetail es exactamente eso pero implementado de forma type-safe para no bloquear type-check de Wave 2.

## Issues Encountered

- **Análisis paralysis evitado:** primera lectura del plan + helpers + tests + fixtures + patronesConsumirHelpers en una sola ronda de Reads paralelos. Implementación directa sin re-leer.
- **`git stash` accidental durante diagnostic baseline:** corrí `git stash && tsc` para contar errores baseline, lo cual revertió mis cambios. `git stash pop` los restauró sin pérdida. Lección: para contar baseline de un branch nuevo, mejor usar un worktree o hacer el conteo antes de empezar la implementación.

## Pitfall Verification

Los 6 pitfalls del 15-RESEARCH se verificaron manualmente con grep:

| # | Pitfall | Mitigación | Verificación |
|---|---------|------------|--------------|
| 1 | `getCreateTrace` vs `getUpdateTrace` en cada write | 1 `...getUpdateTrace()` (write 1, loaner UPDATE) + 2 `...getCreateTrace()` (writes 2 & 3, CREATEs) | `grep -nE "getCreateTrace\|getUpdateTrace" loanersVentaHelpers.ts` → líneas 262, 276, 281, 305, 311, 336 ✓ |
| 2 | `creadoPor` explícito en MovimientoStock | `creadoPor: creadoPorNombre` en write 3 (`getCreateTrace().createdByName ?? createdBy ?? 'desconocido'` resuelto fuera de la tx) | `grep -nE "creadoPor:" loanersVentaHelpers.ts` → líneas 193 (test path), 335 (prod path) ✓ |
| 3 | Sólo 1 `tx.get` (loaner) — pre-fetch cliente/artículo fuera de la tx | El cliente viene en `venta.clienteId/clienteNombre` (modal lo pasó); el artículo viene en `articuloRecienVinculado` o en el loaner mismo. NINGÚN read de Firestore extra. | `grep -nE "tx\.get" loanersVentaHelpers.ts` → línea 242 (única) ✓ |
| 4 | Coerce `undefined → null` en `nroSerie` (Firestore rechaza undefined) | `nroSerie: loaner.serie ?? null` con `deepCleanForFirestore` aplicado al payload completo | `grep -nE "nroSerie:" loanersVentaHelpers.ts` → líneas 150 (test), 288 (prod) ✓ |
| 5 | `deepCleanForFirestore` aplicado a los 3 payloads | Wraps tx.update + 2 tx.set | Visible en `loanersVentaHelpers.ts` líneas 263, 282, 313 (3 invocaciones) ✓ |
| 6 | DI hook `__setTestFirestore` mirrors Phase 14 patronesService | `let _testState: MockVentaLoanerState \| null = null; export function __setTestFirestore(state) {_testState = state}` en `loanersService.ts` líneas 49-65 + bind via factory `buildRegistrarVenta({getTestState: () => _testState, ...})` | Cumplido — los 5 tests pasan usando el hook ✓ |

## Verification Output

### `pnpm test:venta-loaner`

```
▶ registrarVenta — Phase 15 venta loaner espejo a stock
  ✔ happy path pre-vinculado: crea unidad+movimiento y marca loaner vendido (6.565ms)
  ✔ happy path sin vinculo: denormaliza articuloId/Codigo/Descripcion en loaner (0.2492ms)
  ✔ guard ya vendido: throw "Loaner ya vendido" y no crea docs nuevos (1.0541ms)
  ✔ rollback atómico: si write falla mid-tx, ningún doc se crea ni modifica (0.3411ms)
  ✔ costo requerido: throw "Costo requerido" antes de la tx si falta costoUnitario o monedaCosto (0.3225ms)
✔ registrarVenta — Phase 15 venta loaner espejo a stock (9.4192ms)
ℹ tests 5
ℹ pass 5
ℹ fail 0
ℹ duration_ms 15.1571
```

### Adjacent unit suites (no regression)

- `pnpm test:patron-bom` → 18/18 GREEN (Phase 14 BOM, sin regresión)
- `pnpm test:equivalencias` → 9/9 GREEN (Phase 13 STKE)
- `pnpm test:stock-amplio` → 5/5 GREEN (Phase 12 STKP)
- `pnpm test:cuotas-facturacion` → 9/9 GREEN (Phase 11 BILL)

**Total: 41/41 + 5/5 nuevos = 46/46 unit tests GREEN.**

### type-check (`npx tsc --noEmit` en sistema-modular)

- Baseline pre-Phase-15-02: **30 errores** (todos pre-existentes en archivos no relacionados — agenda, presupuestos, services, etc.)
- Post-Phase-15-02: **28 errores** (2 menos — re-exports explícitos del barrel limpiaron colisiones previas)
- **Phase-15-related errors: 0** ✓

Los 28 errores remanentes son pre-existentes y fuera de scope (CLAUDE.md deferred items): `noUnusedLocals`/`noUnusedParameters` triggers en agenda/, presupuestos/, leads/, ui/, stockAmplioService.ts implicit any, etc.

## Next Phase Readiness

**Wave 3 (plan 15-03 — UI extension + UAT) puede ejecutar inmediatamente.**

Hooks provistos:
- `loanersService.registrarVenta(id, venta, articuloRecienVinculado?)` con la nueva signature.
- `useLoaners().registrarVenta(...)` wrapper actualizado.
- Tipos públicos `RegistrarVentaParams`/`RegistrarVentaResult` disponibles desde `loanersService` o `firebaseService` barrel.
- `__setTestFirestore` para integration tests si Wave 3 los necesita.

Pending para Wave 3:
- `LoanerVentaModal.tsx` extendido con campos `costoUnitario` + `monedaCosto` (NumberInput + SearchableSelect) — required en UI.
- Si el loaner no tenía `articuloId`, agregar SearchableSelect "Vincular artículo" que setea `articuloRecienVinculado` y se denormaliza en el loaner DENTRO de la tx atómica.
- Reemplazar el `handleVenta` provisorio en `LoanerDetail.tsx` (eliminar el cast WIP `(null as any)`).
- UAT manual: vender 1 loaner en dev → verificar 3 docs en Firestore console (loaner.estado=vendido + nuevo unidades/{id} con estado=vendido + nuevo movimientosStock/{id} con subtipo=venta_loaner).

No blockers para Wave 3.

## Self-Check: PASSED

Verified on 2026-05-24:
- `apps/sistema-modular/src/services/loanersVentaHelpers.ts` exists (created)
- `apps/sistema-modular/src/services/loanersService.ts` exists (modified)
- `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-02-service-transaccional-SUMMARY.md` exists (this file)
- Commit `bce3205` (Task 1) found in git log
- Commit `86ccc3c` (Task 2) found in git log

---
*Phase: 15-stock-venta-de-loaner-espejo-a-stock*
*Completed: 2026-05-24*
