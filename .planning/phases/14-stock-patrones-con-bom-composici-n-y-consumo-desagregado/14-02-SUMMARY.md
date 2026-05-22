---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 02
subsystem: database
tags: [typescript, firestore, runTransaction, patron, bom, stock, DI-hook, atomic-write]

# Dependency graph
requires:
  - phase: 14
    provides: "14-00 Wave 0 (RED baseline + MockPatronBomState + 14 unit tests) + 14-01 (Patron.componentes/PatronLote.componentesConsumidos types + lazy-firebase patronesService refactor + __setTestFirestore/consumirComponentes stubs)"
  - phase: 13
    provides: "equivalenciasService.desagregarUnidades runTransaction blueprint (READ FIRST → recompute → WRITE) replicated 1:1 here, including DI hook split between _runInProd/_runInTest paths"
provides:
  - "patronesService.consumirComponentes(params) — atomic descuento de componentes vía runTransaction (1 MovimientoStock per componente consumido)"
  - "patronesService.__setTestFirestore(state) — DI hook that injects MockPatronBomState"
  - "patronesService re-exports ConsumirComponentesParams + ConsumirComponentesResult types"
  - "patronesConsumirHelpers.ts — single-purpose helper module containing the BOM-03 implementation (factory pattern with DI deps to avoid circular import + keep service file under 250 LOC)"
  - "Pre-tx idempotency check (BOM-08 first half) — throws 'Patrones ya descontados' when MovimientoStock already exists for (otNumber, entidadTipo='patron')"
  - "Atomic validation pass — all patrones validated before any state mutation (compute → validate → mutate phases)"
affects:
  - "14-03 (autoCrearRequerimientosPatron post-commit helper invoked best-effort AFTER consumirComponentes commits — must NOT be entangled with the tx)"
  - "14-06 (CierreAdminPaso UI consumes consumirComponentes; catches 'Patrones ya descontados' to render read-only banner)"
  - "14-07 (reportes-ot selector — no service dependency, but the same MovimientoStock granularity informs auditoría)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Factory-pattern DI for cross-module testability: buildConsumirComponentes({ getTestState, getFirebaseModules }) returns the bound function. Avoids circular imports while keeping the test state owner (patronesService) separate from the implementation file (patronesConsumirHelpers). Replicable for future cross-file BOM helpers."
    - "Compute-validate-mutate sequencing for multi-doc atomic writes in test mode: build all updates first, validate all, then commit. Mirrors the Firestore runTransaction snapshot-then-write contract so the test path can't accidentally leak partial mutations on validation failure."
    - "Two-phase tx body (READ first across all patrones, then validate all, then write all) for runTransaction with N target docs. Generalizes equivalenciasService's 1-doc pattern to N-doc atomic writes."

key-files:
  created:
    - "apps/sistema-modular/src/services/patronesConsumirHelpers.ts (286 LOC) — BOM-03 implementation: pure helpers (recomputeLotesConConsumos, validarSaldosNoNegativos), _consumirComponentesInTest, _consumirComponentesInProd, factory buildConsumirComponentes"
  modified:
    - "apps/sistema-modular/src/services/patronesService.ts (478 → 247 LOC) — replaced 14-01 stubs with real __setTestFirestore + thin consumirComponentes binding to the helper factory"

key-decisions:
  - "Extracted BOM-03 implementation to patronesConsumirHelpers.ts via factory-pattern DI: keeps patronesService.ts at 247 LOC (under 250 budget) without resorting to a singleton in the helper. The factory receives `getTestState` + `getFirebaseModules` as deps; patronesService.ts owns the actual `_testState` variable and re-exports the bound function. This eliminates circular import risk while preserving Phase 13's single-source-of-truth for DI state per service."
  - "Compute-validate-mutate in test path (not validate-as-you-go): build `updates[]` for ALL patrones first, run `validarSaldosNoNegativos` on each, THEN mutate `state.patrones`. Ensures the BOM-03 atomicity test (saldo<0 throws → state untouched) holds even for N-patron payloads where validation could fail on the second/third patron."
  - "Idempotency check lives in the service (THIS plan), not in UI: pre-tx query for (otNumber, entidadTipo='patron') movements; throws 'Patrones ya descontados para OT X' BEFORE entering the runTransaction. UI plan 14-06 catches the throw to render a read-only banner. Confirmed via test [BOM-08 idempotency]."
  - "MovimientoStock.lote persisted as the natural string code (NOT a synthetic loteId) — confirmed RESEARCH pitfall 3. The MovimientoStock write includes patronId + lote (string) + codigoComponente as the audit triple."
  - "validarSaldosNoNegativos uses computeSaldoComponente on a PROJECTED patron object (lotes overridden to nuevosLotes) rather than mutating the original. Pure-function discipline: the validator never side-effects, only computes."

patterns-established:
  - "Atomic multi-doc runTransaction with READ-FIRST: load all target docs via tx.get inside the tx, validate all, then write all. Pattern is now used by both 13-03 (single-doc bulk write) and 14-02 (multi-doc bulk write); future stock services with multi-doc tx should follow."
  - "Factory-pattern DI hook for cross-file helpers: helper module exports `buildXxx({ getTestState, getFirebaseModules })` instead of importing module-level state. Caller (the service) owns the state and re-exports the bound function. Use for any helper module that needs both test-mode access AND lazy firebase."

requirements-completed: [BOM-03]

# Metrics
duration: 7min
completed: 2026-05-22
---

# Phase 14 Plan 02: Consumir Componentes Service Summary

**Atomic `consumirComponentes` runTransaction (BOM-03) que descuenta componentes BOM y graba 1 MovimientoStock por componente, con idempotency pre-tx contra re-cierre admin y DI hook factory-pattern para tests unitarios.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-22T15:11:35Z
- **Completed:** 2026-05-22T15:18:48Z
- **Tasks:** 1 (TDD: tests ya estaban RED desde Wave 0 — implementación directa a GREEN)
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `consumirComponentes` implementado con runTransaction multi-doc (READ FIRST → validate → WRITE patrones + N MovimientoStock).
- DI hook `__setTestFirestore(state: MockPatronBomState | null)` reemplaza el stub de 14-01; mirror exacto de `equivalenciasService.__setTestFirestore`.
- Pre-tx idempotency check (RESEARCH pitfall 2): throws `"Patrones ya descontados para OT X"` BEFORE entering the transaction if any `MovimientoStock` already exists for `(otNumber, entidadTipo='patron')`. UI en 14-06 catchea para render read-only banner.
- Granularidad fina: 1 MovimientoStock por componente consumido (test BOM-03 granularidad: 2 patrones × 3 componentes = 6 writes en una sola tx).
- Atomicidad: si cualquier proyección de saldo<0, throws `"Saldo negativo prohibido..."` y rollback completo (sin state change). Validado por test BOM-03 atomicity.
- Backwards-compat: invocar sobre patron con `componentes=[]` o undefined throws `"Patrón ... sin BOM declarado — no aplica desagregación de componentes"` (no silent no-op; el admin no debe invocar sobre patrones legacy).
- Wave 0 test signal: **13/14 GREEN** — los 4 targets de este plan (BOM-03 happy + atomicity + granularidad + BOM-08 idempotency) viraron a GREEN. El único RED restante es `[BOM-08 auto-req idempotency]`, intencional para 14-03.

## Task Commits

1. **Task 1: Implement consumirComponentes runTransaction + __setTestFirestore DI hook** — `23b5cd9` (feat)

## Files Created/Modified

### Created

- `apps/sistema-modular/src/services/patronesConsumirHelpers.ts` (286 LOC) — BOM-03 implementation extraída del service file para no exceder budget:
  - `buildConsumirComponentes(deps)` — factory pattern con DI deps (`getTestState`, `getFirebaseModules`)
  - `recomputeLotesConConsumos(patron, consumosDelPatron)` — pure helper, retorna nuevos lotes con `componentesConsumidos` agregado
  - `validarSaldosNoNegativos(patron, nuevosLotes)` — pure validator, throws si saldo<0 proyectado
  - `_consumirComponentesInTest(params, state)` — mutación in-memory de `MockPatronBomState` con compute-validate-mutate sequencing
  - `_consumirComponentesInProd(params, getFirebaseModules)` — runTransaction real con tx.get patrones + tx.update patron + N tx.set MovimientoStock

### Modified

- `apps/sistema-modular/src/services/patronesService.ts` (478 → 247 LOC):
  - Removidos los stubs `__setTestFirestore` y `consumirComponentes` de 14-01
  - Agregado `_testState: MockPatronBomState | null` como single source of truth para el DI hook
  - `__setTestFirestore(state)` ahora setea el state real (sin throw)
  - `consumirComponentes` exportado como binding a `buildConsumirComponentes({ getTestState, getFirebaseModules })` — el patrón factory mantiene el service file pequeño sin imports cruzados desde el helper hacia el service
  - Re-export `type { ConsumirComponentesParams, ConsumirComponentesResult }` para que callers consuman desde `patronesService` (no necesitan saber del archivo helper)

## Decisions Made

- **Factory-pattern DI vs singleton:** El helper module recibe `getTestState` y `getFirebaseModules` como dependencies via factory. Alternativa rechazada: hacer que `patronesConsumirHelpers.ts` importe `_testState` desde `patronesService.ts` — eso crearía import circular (service → helper → service). El factory pattern mantiene el helper desacoplado y el service como único owner del estado DI.
- **Compute-validate-mutate sequencing (test path):** Build `updates[]` para ALL patrones primero, validate cada uno, THEN mutar `state.patrones`. La alternativa (validate-as-you-go) habría dejado partial mutations si el segundo patron de un payload de N patrones falla la validación — violando el contrato atómico que el test BOM-03 atomicity verifica.
- **Idempotency pre-tx (no inside-tx):** El query `where('otNumber'==X, 'entidadTipo'=='patron')` se hace ANTES de entrar a `runTransaction`. Razón: Firestore `runTransaction` no permite queries con `where` clauses (solo `tx.get(doc)` por id puntual). Si se descubre concurrencia en el futuro (dos admins cerrando la misma OT a la vez), agregar un sentinel doc determinístico `patronesConsumidos_idempotency/{otNumber}` adentro de la tx via `tx.get/tx.set` — patrón de Phase 9 `ot_cierre_idempotency` ya establecido.
- **LOC extraction:** Plan 14-02 verification dijo "if approaching 400 LOC, extract `consumirComponentes` logic to a new file `patronesConsumirHelpers.ts`". A 478 LOC ya superaba el umbral; extracción ejecutada ANTES del commit (no como deviation posterior). patronesService.ts ahora 247 LOC, patronesConsumirHelpers.ts 286 LOC.
- **MovimientoStock.lote = string natural (NOT loteId):** Confirmado RESEARCH pitfall 3. El audit triple es `patronId + lote (string código) + codigoComponente`. No hay `PatronLote.id` sintético.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracción del BOM-03 a archivo helper separado para mantener LOC budget**

- **Found during:** Task 1 (post-implementation LOC check)
- **Issue:** Implementación inline en `patronesService.ts` llevó el archivo a 478 LOC. El plan verification specifica: "if approaching 400 LOC, extract `consumirComponentes` logic to a new file `patronesConsumirHelpers.ts` per components.md spirit".
- **Fix:** Extraído todo el bloque BOM-03 (interfaces + helpers + `_consumirComponentesInTest` + `_consumirComponentesInProd`) a `patronesConsumirHelpers.ts`. Para evitar circular import (helper necesitaría `_testState` del service, service necesitaría `consumirComponentes` del helper), implementé un **factory pattern**: `buildConsumirComponentes({ getTestState, getFirebaseModules })` retorna la función bound. `patronesService.ts` exporta `const consumirComponentes = buildConsumirComponentes({...})` con los getters apuntando a su `_testState` y `getFirebaseModules` locales. Re-export de los types también desde el service file para que los callers no cambien sus imports.
- **Files modified:** Created `patronesConsumirHelpers.ts` (286 LOC); rewrote `patronesService.ts` bottom block (247 LOC final).
- **Verification:** `wc -l` confirma 247 < 250 budget. `pnpm test:patron-bom` sigue mostrando 13/14 GREEN tras la extracción (mismo signal que antes). `pnpm type-check` GREEN. `pnpm test:equivalencias` GREEN (sanity: la lazy-firebase pattern del Phase 13 no se rompió).
- **Committed in:** `23b5cd9` (Task 1 commit; el extract y la impl viajan juntos porque el archivo no commiteado nunca alcanzó los 478 LOC).

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking budget violation).
**Impact on plan:** Cero scope-creep — la extracción es exactamente lo que el plan verification recomendaba si el archivo se acercaba a 400 LOC. El factory pattern es una mejora arquitectónica (single source of truth para DI state en el service, lógica separada en helper) que generaliza nicely para futuros helpers BOM-04..BOM-06.

## Issues Encountered

- **TS6133 pre-existente:** `apps/sistema-modular/tsc` reportó `error TS6133: 'otPatronesSeleccionadosDuplicados' is declared but its value is never read` en `src/__tests__/patronBom.test.ts:54`. Es un unused-import que landó con la fixture en 14-00 y no es scope de este plan. Documentado como deferred-item implícito (mismo trato que los unused-vars warnings en agenda/presupuestos/etc. señalados en 14-01).

## User Setup Required

None — implementación 100% local, no toca Firestore ni Storage en runtime hasta que el cierre admin de 14-06 dispare el flujo. Sin credenciales nuevas, sin variables de entorno nuevas, sin cambios de rules.

## Heads-up for Plan 14-03

- `autoCrearRequerimientosPatron(...)` es un helper **separado** invocado **POST-commit** (best-effort, fire-and-forget). NO entanglarlo con la tx — si la creación del requerimiento falla, el consumo del patrón ya está commiteado correctamente y el admin puede recrear manualmente.
- La idempotency del auto-req es complementaria a la idempotency del consumo: aquí en 14-02 garantizamos que NO se descuente el componente dos veces; en 14-03 hay que garantizar que NO se cree un REQ duplicado cuando dos OTs cruzan stockMinimo del mismo componente (`patronId + loteId + codigoComponente` ya tienen un REQ abierto).
- El test `[BOM-08 auto-req idempotency]` (línea 276 de `patronBom.test.ts`) ya pre-seedea `state.adminConfigFlujos.usuarioRequerimientosPatronId = 'admin-stock'` — usar ese campo para asignar el REQ.
- `consumirComponentes` retorna `{ movimientoIds: string[] }`. 14-03 puede hookearse al post-commit pasando esos IDs si necesita auditoría link.

## Next Phase Readiness

- **14-03 (auto-req helper):** READY — el contract de `consumirComponentes` no cambia más. El helper debe ejecutarse después del commit, leer `adminConfigFlujos.usuarioRequerimientosPatronId` para asignar, y dedupar por `(patronId, loteId, codigoComponente)` open REQs.
- **14-04..14-05 (UI patrón editor + lista):** READY — los helpers de @ags/shared/utils/patronBom (de 14-01) están consumibles.
- **14-06 (cierre admin UI):** READY — la UI debe llamar `consumirComponentes(params)` y catch específicamente el error con mensaje match `/ya descontados/` para render read-only banner.

## Self-Check: PASSED

**Files created:**
- FOUND: `apps/sistema-modular/src/services/patronesConsumirHelpers.ts` (286 LOC, contiene `buildConsumirComponentes`, `recomputeLotesConConsumos`, `validarSaldosNoNegativos`, `_consumirComponentesInTest`, `_consumirComponentesInProd`)

**Files modified:**
- FOUND: `apps/sistema-modular/src/services/patronesService.ts` (247 LOC, exports `__setTestFirestore`, `consumirComponentes`, `ConsumirComponentesParams`, `ConsumirComponentesResult`)

**Commits exist:**
- FOUND: `23b5cd9` (feat(14-02): consumirComponentes runTransaction + DI hook (BOM-03))

**Test signal:**
- `pnpm test:patron-bom`: **13/14 GREEN** (4 target tests GREEN: BOM-03 happy + atomicity + granularidad + BOM-08 idempotency; 1 RED reservado para 14-03: `[BOM-08 auto-req idempotency]`)
- `pnpm type-check`: GREEN (root + packages/shared)
- `pnpm test:equivalencias`: GREEN (sanity check — Phase 13 service no se rompió)

---
*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Completed: 2026-05-22*
