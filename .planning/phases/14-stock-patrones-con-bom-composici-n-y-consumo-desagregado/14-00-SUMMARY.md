---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 00
subsystem: testing

tags: [tsx, node-test, fixtures, red-baseline, patron-bom, stock, DI-hook]

# Dependency graph
requires:
  - phase: 13-stock-equivalencias-compra-uso
    provides: "Phase 13 plan 13-00 establishes the equivalencias.test.ts + scripts/test-equivalencias.ts precedent (node:test + node:assert/strict + __setTestFirestore DI hook). 14-00 mirrors that shape for patrones."
provides:
  - "RED baseline test runner para Phase 14 (test:patron-bom npm script + tsx entry point)"
  - "Unit test suite (14 tests) cubriendo BOM-02 helpers puros + BOM-03 consumirComponentes tx + BOM-08 idempotency"
  - "Patron BOM fixtures (4 formas canónicas: legacy / simple cantidadPorKit=3 / complex 8 ampollas / FIFO 3 lotes + bloqueado/agotado + duplicados OT)"
  - "MockPatronBomState shape (in-memory: patrones Map + movimientos Map + requerimientos Map + adminConfigFlujos)"
affects: [14-01, 14-02, 14-03, 14-04, 14-05, 14-06, 14-07, 14-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scripts/test-XXX.ts as 1-line re-exporter of src/__tests__/XXX.test.ts (mirror of Phase 13 test:equivalencias shape)"
    - "Phase 14 test colocation: src/__tests__/ (not src/services/__tests__/) — service-agnostic suites for shared+service helpers"
    - "MockPatronBomState con Map<id, doc> en lugar de array (lookup O(1) para fixtures con N patrones)"

key-files:
  created:
    - "apps/sistema-modular/scripts/test-patron-bom.ts — tsx entry (5 líneas, re-exporta el suite)"
    - "apps/sistema-modular/src/__tests__/fixtures/patronBom.ts — 4 Patron shapes + MockPatronBomState (206 líneas)"
    - "apps/sistema-modular/src/__tests__/patronBom.test.ts — 14 tests RED baseline (315 líneas)"
  modified:
    - "apps/sistema-modular/package.json — npm script test:patron-bom"

key-decisions:
  - "Fixtures usan `as any` para los campos futuros (Patron.componentes, PatronLote.componentesConsumidos) hasta que 14-01 los landea — type-check pasa, tests fallan en value-imports (RED esperado)"
  - "MockPatronBomState con Map<id, doc> en lugar de array (lookup O(1) para fixtures con N patrones); ligero apartamiento del shape MockEquivalenciasState que usa array, justificado por el patrón de acceso (id-based en patrones, query-based en equivalencias)"
  - "Wave 0 NO toca @ags/shared ni patronesService — esos imports fallan a propósito; downstream plans (14-01, 14-02) los implementan y la suite vira a GREEN incrementalmente"

patterns-established:
  - "RED baseline check via grep regex: `pnpm test:patron-bom 2>&1 | grep -E '(Cannot find|is not a function|patronBom)'` — confirma que la suite carga y falla por imports faltantes, no por defectos del test mismo"
  - "Test runner mirror de Phase 13: scripts/test-XXX.ts (~5 líneas) re-exporta el suite real para que pnpm scripts queden simétricos"
  - "Fixture-driven testing: cada test referencia una constante exportada (legacyPatron / simplePatron / patronWithThreeLotes / etc.) — facilita reuse en downstream tests y documenta los escenarios"

requirements-completed: [BOM-01, BOM-02, BOM-03, BOM-08]

# Metrics
duration: 13min
completed: 2026-05-22
---

# Phase 14 Plan 00: Test Infra Baseline Summary

**RED-baseline test scaffolding (14 tests + fixtures + tsx runner) que toda la Phase 14 usa como signal — falla por diseño hasta que 14-01 landea los helpers puros en @ags/shared/utils/patronBom y 14-02 landea consumirComponentes + __setTestFirestore en patronesService.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-22T14:46:57Z
- **Completed:** 2026-05-22T14:59:31Z
- **Tasks:** 2
- **Files modified:** 4 (1 package.json + 1 tsx runner + 2 nuevos archivos en src/__tests__/)

## Accomplishments

- npm script `test:patron-bom` wireado en `apps/sistema-modular/package.json` con runner `tsx scripts/test-patron-bom.ts` (mismo pattern que Phase 13 `test:equivalencias`).
- Suite de 14 tests cubriendo:
  - **BOM-02 helpers puros** (9 tests): `computeSaldoComponente` (legacy=Infinity / simple=cantidad×cantidadPorKit-consumido / null-guard), `computeLoteStatus` (legacy=active / healthy / bloqueado / agotado), `findLoteFifoDisponible` (skip cantidad=0 + earliest fechaVencimiento), `buildPatronesConsumidosSugerencia` (dedupe por patronId+lote, 1 sugerencia por componente).
  - **BOM-03 consumirComponentes** (3 tests): happy path (1 mov por componente), atomicity (saldo negativo → throw + state untouched), granularidad (2 patrones × 3 componentes = 6 MovimientoStock).
  - **BOM-08 idempotency** (2 tests): re-cierre admin sobre misma OT THROWS "ya descontados"; auto-req idempotente (2 OTs depletan el mismo componente → 1 sola RequerimientoCompra).
- Fixtures con las 4 formas canónicas del RESEARCH: `legacyPatron` (sin BOM), `simplePatron` (1 componente cantidadPorKit=3), `complexPatron` (8 componentes cantidadPorKit=1), `patronWithThreeLotes` (FIFO con cantidad=0 skip). Más `loteHealthy`, `loteWithOneComponentAtZero`, `loteAllZero`, `otPatronesSeleccionadosDuplicados` y `patronWith2Componentes`.
- `MockPatronBomState` interface + helper `buildState()` listo para usarse en plan 14-02 (consumirComponentes con `__setTestFirestore` DI hook).
- RED baseline confirmado: `pnpm --filter @ags/sistema-modular test:patron-bom` falla con `ERR_MODULE_NOT_FOUND: Cannot find package '@ags/shared'` — matchea el grep `(Cannot find|is not a function|patronBom)` del verify.

## Task Commits

1. **Task 1: Wire test:patron-bom npm script + tsx entry point** — `abdde11` (chore)
2. **Task 2: Create fixtures and RED unit test suite (BOM-02 + BOM-03 + BOM-08)** — `eae3fd4` (test)

Hay un commit `513fbe3 feat(14-01): extend @ags/shared types for Patron BOM (BOM-01)` interleaved entre mis dos commits — corresponde a trabajo de plan 14-01 (no de este plan), ver "Deviations" abajo.

## Files Created/Modified

- `apps/sistema-modular/package.json` — agregado script `test:patron-bom`.
- `apps/sistema-modular/scripts/test-patron-bom.ts` (creado) — 5 líneas, re-exporta el suite.
- `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` (creado) — 206 líneas, 4 Patron shapes + lotes + MockPatronBomState.
- `apps/sistema-modular/src/__tests__/patronBom.test.ts` (creado) — 315 líneas, 14 tests.

## Decisions Made

- **Fixtures con `as any` para campos futuros:** Patron.componentes y PatronLote.componentesConsumidos no existen aún (landean en 14-01). Las fixtures los declaran usando `as any` para que el archivo type-check pase. Los value-imports del test (`computeSaldoComponente`, `consumirComponentes`, `__setTestFirestore`) fallan a propósito — esa es la señal RED.
- **MockPatronBomState con Map<id, doc>:** Phase 13 MockEquivalenciasState usa arrays; aquí elegimos Map<string, any> porque las consultas son id-based (patronesService.getById, runTransaction reads). Lookup O(1), serializable a Firestore docs sin transformación extra.
- **Test colocation src/__tests__/ (no src/services/__tests__/):** El suite cubre helpers de @ags/shared (BOM-02 puros) además del service. Colocarlo bajo src/__tests__/ lo separa del agrupamiento "tests-de-services" y permite que futuros tests de @ags/shared (si los hubiera) sumen al mismo directorio.

## Deviations from Plan

### Discovered work in flight (no auto-fix; deferred to downstream plans)

**1. [Rule 4 — Out of scope] Plan 14-01 partial execution found in working tree**

- **Found during:** Task 2 (before commit, on `git status`).
- **Issue:** Working tree contained uncommitted bridges para plan 14-01/14-02:
  - `packages/shared/src/utils/patronBom.ts` (BOM-02 helpers completos, 129 líneas)
  - `packages/shared/src/utils.ts → utils/index.ts` (rename para hacer utils/ un directorio)
  - `packages/shared/package.json` (exports map: `./utils/patronBom`)
  - `packages/shared/src/index.ts` (re-export flat de `./utils/patronBom`)
  - `apps/sistema-modular/tsconfig.json` (path mapping `@ags/shared/*`)
  - `apps/sistema-modular/src/services/patronesService.ts` (stubs de `consumirComponentes` + `__setTestFirestore` que THROW "NOT_IMPLEMENTED")
  - 1 commit ya en main: `513fbe3 feat(14-01): extend @ags/shared types for Patron BOM (BOM-01)` (types extensions de plan 14-01).
- **Decision:** Estos cambios pertenecen a plan 14-01 (y un toque de 14-02), no a 14-00. Para mantener la atomicidad por plan:
  1. Stash de los bridges no comiteados antes de mi Task 2 commit.
  2. Verificación RED aislada con solo mis archivos → pasa el grep.
  3. Commit limpio Task 2 (`eae3fd4`) tocando exclusivamente `src/__tests__/` + tweak menor a `scripts/test-patron-bom.ts`.
  4. `git stash pop` para restaurar los bridges en working tree al estado pre-commit del usuario.
- **Files modified:** Solo mis archivos (test + fixtures + runner). Los bridges quedan en working tree intactos para que 14-01/14-02 los commitee como parte de su scope.
- **Verification:** `git log --oneline -5` muestra los 3 commits intercalados (mine + user's 14-01 commit). `git status --short` muestra los bridges restaurados como modified/untracked, listos para 14-01.
- **Nota técnica:** Cuando los bridges están en working tree, `pnpm test:patron-bom` falla con `TypeError: Cannot read properties of undefined (reading 'VITE_FIREBASE_API_KEY')` en lugar del esperado `Cannot find package '@ags/shared'` — porque el stub de `consumirComponentes` en `patronesService.ts` está al final del archivo eager-firebase. Cuando 14-02 refactor patronesService para usar lazy firebase imports (mismo patrón que `equivalenciasService.ts`), ese error desaparece y los 14 tests corren con failures granulares por test, GREEN-eando incrementalmente a medida que landean helpers + service + auto-req.

---

**Total deviations:** 1 documentada (out-of-scope discovery; 0 auto-fixes a mis archivos).
**Impact on plan:** Ninguno — mi diff es exactamente el spec del plan. Los bridges en flight son scope de 14-01/14-02.

## Issues Encountered

- **`@ags/shared` resolución bajo tsx:** El package solo tiene `main: "./src/index.ts"` sin `exports` map; tsx falla con `ERR_MODULE_NOT_FOUND` para el package entero (no llega a evaluar el subpath `/utils/patronBom`). Esto es el RED baseline esperado (el grep del verify command matchea "Cannot find"). 14-01 deberá agregar el `exports` map en `packages/shared/package.json` para que la suite avance hacia GREEN.
- **`patronesService.ts` eager-firebase:** El servicio tiene `import { db, ... } from './firebase'` estático en top-level. Cuando 14-02 agregue `consumirComponentes` y `__setTestFirestore`, debe seguir el patrón de `equivalenciasService.ts` (lazy dynamic imports de Firebase) para que la suite corra sin `import.meta.env.VITE_FIREBASE_API_KEY undefined`. Pre-condición conocida documentada acá para que el siguiente ejecutor no se pierda en debugging.

## User Setup Required

None — Wave 0 baseline es 100% local (no toca Firestore, no requiere credentials, no requiere CLAUDE_ALLOW_REPORTES_OT — `apps/reportes-ot/` no se toca).

## Next Phase Readiness

- **14-01 (tipos y helpers puros):** READY. Va a:
  - Commitear el rename `utils.ts → utils/index.ts` + el archivo `packages/shared/src/utils/patronBom.ts` (ya escrito en working tree por el usuario).
  - Commitear el exports map en `packages/shared/package.json` + el re-export en `packages/shared/src/index.ts`.
  - Commitear el `@ags/shared/*` path en `apps/sistema-modular/tsconfig.json`.
  - Verificar que los 9 tests de BOM-02 viran a GREEN; los 5 tests de BOM-03/BOM-08 siguen RED por NOT_IMPLEMENTED.
- **14-02 (consumirComponentes service):** Va a reemplazar los 2 stubs en `patronesService.ts` con la implementación real + lazy-firebase refactor + MockPatronBomState reader/writer. Después de 14-02, 12 de los 14 tests deberían ser GREEN (los 2 de BOM-08 auto-req siguen RED hasta 14-03).
- **14-03 (auto-requerimiento patrón):** Cierra el ciclo: cubre los 2 tests `[BOM-08 auto-req idempotency]` cuando landea `autoCrearRequerimientosPatron` y la lectura de `adminConfigFlujos.usuarioRequerimientosPatronId`.

## Self-Check: PASSED

Verificado:
- `apps/sistema-modular/scripts/test-patron-bom.ts` — FOUND (5 líneas)
- `apps/sistema-modular/src/__tests__/patronBom.test.ts` — FOUND (315 líneas)
- `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` — FOUND (206 líneas)
- `apps/sistema-modular/package.json` — contiene `"test:patron-bom"` script
- Commit `abdde11` (Task 1) — encontrado en `git log`
- Commit `eae3fd4` (Task 2) — encontrado en `git log`
- Verify automated: `pnpm test:patron-bom 2>&1 | grep -E "(Cannot find|is not a function|patronBom)"` → match en "Cannot find package '@ags/shared'" → RED baseline confirmado en aislación (sin los bridges 14-01/14-02 stashed)

---
*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Completed: 2026-05-22*
