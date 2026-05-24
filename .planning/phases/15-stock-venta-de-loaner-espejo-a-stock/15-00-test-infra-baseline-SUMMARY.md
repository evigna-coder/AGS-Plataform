---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 00
subsystem: testing
tags: [node-test, tsx, di-hook, red-baseline, loaners, stock, venta-loaner]

requires:
  - phase: 14-stock-patrones-bom
    provides: "Patrón node:test + tsx runner + __setTestFirestore DI hook (scripts/test-patron-bom.ts → src/__tests__/patronBom.test.ts)"
  - phase: 13-stock-equivalencias
    provides: "Patrón fixtures factory + MockState shape (fixtures/equivalencias.ts)"
provides:
  - "Wave 0 RED baseline para Phase 15 — comando pnpm --filter @ags/sistema-modular test:venta-loaner registrado"
  - "5 RED tests bajo describe('registrarVenta — Phase 15 venta loaner espejo a stock') matcheables vía --test-name-pattern (VLN-02a..e)"
  - "MockLoaner + MockVentaLoanerState shapes + 3 fixtures factory (PRE_VINCULADO, SIN_ARTICULO, YA_VENDIDO)"
  - "Runner intermedio scripts/test-venta-loaner.ts (mirror estricto Phase 14)"
affects: [15-02-service-transaccional, 15-03-modal-ui-y-uat]

tech-stack:
  added: []
  patterns:
    - "RED baseline test infra mirror Phase 13/14: node:test + node:assert/strict + tsx runner intermedio + __setTestFirestore DI hook in-memory"
    - "Factory fixtures (functions, no JSON.parse cloning) — fresh state per call evita cross-test mutation"

key-files:
  created:
    - "apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts (140 LOC) — MockVentaLoanerState + 3 fixtures + buildState helper"
    - "apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts (246 LOC) — 5 RED tests con node:test + assert/strict"
    - "apps/sistema-modular/scripts/test-venta-loaner.ts (6 LOC) — tsx runner side-effect import"
  modified:
    - "apps/sistema-modular/package.json — agregado script 'test:venta-loaner': 'tsx scripts/test-venta-loaner.ts' (línea 25, tras test:patron-bom)"

key-decisions:
  - "Runner intermedio scripts/test-venta-loaner.ts vs invocación directa tsx src/services/__tests__/ventaLoaner.test.ts — elegido el intermedio para mirror estricto Phase 14 (precedente más reciente, consistencia visual del bloque test:* en package.json)"
  - "Factory functions sobre constantes para fixtures (precedente Phase 13/14) — garantiza fresh state, evita pitfalls de JSON.parse cloning"
  - "VLN-02d (rollback atómico) ships con assert.fail('RED: requires Wave 2 mock support for _throwOnUnidadCreate') intencional — el hook _throwOnUnidadCreate lo agrega Wave 2 al implementar el DI tx simulator; el test queda red-by-design hasta entonces"
  - "MockLoaner como interface local del fixture (no import de @ags/shared.Loaner) — evita acoplar el RED baseline a tipos que Wave 1 (15-01) va a extender; cuando Wave 1 land los tipos extendidos, los fixtures pueden adoptar el tipo real opcionalmente"

patterns-established:
  - "Phase 15 test surface: cualquier nuevo test del servicio loaner sigue describe('registrarVenta — ...') + beforeEach reset DI hook (precedente Phase 13/14)"
  - "Test names empiezan con prefix matcheable por --test-name-pattern del VALIDATION.md ('happy path pre-vinculado', 'happy path sin vinculo', 'guard ya vendido', 'rollback', 'costo requerido')"

requirements-completed: [VLN-04]

duration: 6 min
completed: 2026-05-24
---

# Phase 15 Plan 00: Test Infra Baseline Summary

**Wave 0 RED baseline para venta loaner espejo a stock — 5 tests node:test con DI hook in-memory + tsx runner + script package.json registrado; mirror estricto Phase 14 (scripts/test-patron-bom.ts) pero sobre loanersService.registrarVenta.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-24T06:56:19Z
- **Completed:** 2026-05-24T07:02:24Z
- **Tasks:** 2 (atomic commits)
- **Files modified:** 4 (3 nuevos + 1 modificado)

## Accomplishments

- Suite RED baseline operativa: `pnpm --filter @ags/sistema-modular test:venta-loaner` ejecutable, falla con `SyntaxError: ... does not provide an export named '__setTestFirestore'` (RED esperado por diseño Wave 2)
- 5 tests bajo `describe('registrarVenta — Phase 15 venta loaner espejo a stock')` cubriendo VLN-02a..e end-to-end:
  - happy path pre-vinculado (loaner con articuloId)
  - happy path sin vínculo (denormalización de articuloRecienVinculado)
  - guard idempotencia ("Loaner ya vendido")
  - rollback atómico (placeholder Wave 2 hook)
  - validación pre-tx de costoUnitario + monedaCosto
- Fixtures factory pattern adoptado (3 escenarios), garantiza fresh state por test sin cloning hack
- `--test-name-pattern` filters del VALIDATION.md verificados como matcheables 1:1 contra los `test('...')` names creados (sólo falla por el import error global hasta Wave 2)

## Task Commits

Cada task committed atómicamente:

1. **Task 1: Fixtures mock + tipo MockVentaLoanerState** — `6651dce` (test)
2. **Task 2: 5 RED tests + script runner + package.json script** — `587bf56` (test)

_Nota: ambos commits son tipo `test` (no `feat`) — este plan NO implementa código de producción; sólo establece el suelo de tests RED._

## Files Created/Modified

- `apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts` — 140 LOC. Exports: `MockLoaner` interface, `MockVentaLoanerState` interface, `buildState(overrides)` helper, `buildFixturePreVinculado()`, `buildFixtureSinArticulo()`, `buildFixtureYaVendido()` factories.
- `apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts` — 246 LOC. 5 tests bajo `describe('registrarVenta — Phase 15 venta loaner espejo a stock')`, `beforeEach(() => __setTestFirestore(null))` reset, imports `registrarVenta` + `__setTestFirestore` desde `'../loanersService'` (NO EXISTEN aún — Wave 2 los aporta = RED esperado).
- `apps/sistema-modular/scripts/test-venta-loaner.ts` — 6 LOC. Side-effect import del test file (mirror `scripts/test-patron-bom.ts`).
- `apps/sistema-modular/package.json` — agregado `"test:venta-loaner": "tsx scripts/test-venta-loaner.ts"` en la línea 25, tras `test:patron-bom`. Json validado (no coma colgante, sigue siendo parseable).

## Decisions Made

- **Runner intermedio** (`scripts/test-venta-loaner.ts`) sobre invocación directa de tsx contra el test file — mirror estricto del precedente más reciente (Phase 14 `test:patron-bom`). Consistencia visual del bloque `test:*` en `package.json` y un único patrón que el lector reconoce.
- **Factory functions para fixtures** — `buildFixturePreVinculado()`, etc. devuelven fresh state por call. Evita el pitfall conocido (`JSON.parse(JSON.stringify(constant))`) que pierde tipos en el flow y degrada perf. Patrón calcado de `fixtures/equivalencias.ts` (Phase 13) y `fixtures/patronBom.ts` (Phase 14).
- **VLN-02d ships como `assert.fail` placeholder** — el rollback atómico requiere un hook `_throwOnUnidadCreate` en el DI simulator que Wave 2 (plan 15-02) va a agregar al implementar `__setTestFirestore`. El test queda RED-by-design con mensaje explícito `'RED: requires Wave 2 mock support for _throwOnUnidadCreate'`. Documentado en comentario inline qué assertions hace cuando Wave 2 le habilite el hook.
- **`MockLoaner` como interface local** del fixture (no import de `@ags/shared.Loaner`) — Wave 1 (15-01) va a extender `VentaLoaner` con `costoUnitario`/`monedaCosto` y `MovimientoStock` con `subtipo: 'venta_loaner'` + `referenciaLoanerId`. No acoplar la RED baseline a tipos que están a punto de cambiar. Cuando Wave 1 land, los fixtures pueden adoptar el tipo real si conviene (optional refactor).

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** N/A.

## Issues Encountered

- **Release commit `a0b4ea4` (v1.3.5) durante la ejecución del plan:** entre Task 1 commit y Task 2 commit, un proceso externo (release script) bumpeó `version: "1.3.4"` → `"1.3.5"` en `package.json` y agregó dos commits (`53328d0 fix(presupuestos): AddItemModal...` + `a0b4ea4 release(sistema-modular): v1.3.5`). El primer `git commit` de Task 2 falló con "nothing to commit, working tree clean" porque mi staged state apuntaba al package.json viejo. **Resolución:** unstage → re-add con el package.json actual (v1.3.5 + mi línea `test:venta-loaner`) → commit limpio `587bf56`. Las dos transiciones de package.json convivieron sin conflictos porque mi edit (línea 25) está separada del bloque que el release script toca (versión en línea 4).

## Next Phase Readiness

- **Wave 1 (plan 15-01 — tipos):** ready. La RED baseline ya espera los tipos extendidos (`VentaLoaner.costoUnitario`/`monedaCosto`, `MovimientoStock.subtipo: 'venta_loaner'` + `referenciaLoanerId`/`referenciaLoanerCodigo`). El test file usa `as any` strategically donde necesita ese contrato — Wave 1 puede landear los tipos sin tocar este suite.
- **Wave 2 (plan 15-02 — service transaccional):** ready. El servicio debe exportar `registrarVenta` y `__setTestFirestore` como named exports (no como métodos de un objeto) para que el `import { registrarVenta, __setTestFirestore } from '../loanersService'` de este test deje de tirar SyntaxError. Wave 2 también debe agregar soporte para `_throwOnUnidadCreate` en el DI simulator para que VLN-02d salga del `assert.fail` placeholder.
- **Wave 3 (plan 15-03 — modal UI + UAT):** sin dependencia directa con este Wave 0.
- **VLN-04 (este plan):** marcado completo en REQUIREMENTS.md.

### Próximo plan

`15-01-tipos-PLAN.md` (extensión de tipos backwards-compat en `packages/shared/src/types/index.ts`).

---

## Test Run Output (HEAD + TAIL)

**Command:** `pnpm --filter @ags/sistema-modular test:venta-loaner`

**Head:**

```
> @ags/sistema-modular@1.3.5 test:venta-loaner C:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular
> tsx scripts/test-venta-loaner.ts

C:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\services\__tests__\ventaLoaner.test.ts:36
import { registrarVenta, __setTestFirestore } from '../loanersService';
                         ^
```

**Tail:**

```
SyntaxError: The requested module '../loanersService' does not provide an export named '__setTestFirestore'
    at #asyncInstantiate (node:internal/modules/esm/module_job:302:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:405:5)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:660:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.13.0
 ELIFECYCLE  Command failed with exit code 1.
```

**Exit code:** 1 (RED, as expected — Wave 2 lands the missing exports)

## VALIDATION.md Per-Task Verification Map confirmation

The 5 test names land exactly as required by `15-VALIDATION.md`:

| VLN ID | Required pattern (VALIDATION.md) | Actual `test('...')` name (this plan) | Match |
|--------|---------------------------------|----------------------------------------|-------|
| VLN-02a | `--test-name-pattern='happy path pre-vinculado'` | `happy path pre-vinculado: crea unidad+movimiento y marca loaner vendido` | ✅ prefix matches |
| VLN-02b | `--test-name-pattern='happy path sin vinculo'` | `happy path sin vinculo: denormaliza articuloId/Codigo/Descripcion en loaner` | ✅ prefix matches |
| VLN-02c | `--test-name-pattern='guard ya vendido'` | `guard ya vendido: throw "Loaner ya vendido" y no crea docs nuevos` | ✅ prefix matches |
| VLN-02d | `--test-name-pattern='rollback'` | `rollback atómico: si write falla mid-tx, ningún doc se crea ni modifica` | ✅ substring matches |
| VLN-02e | `--test-name-pattern='costo requerido'` | `costo requerido: throw "Costo requerido" antes de la tx si falta costoUnitario o monedaCosto` | ✅ prefix matches |

Las 5 patterns matchean. Una vez Wave 2 land los exports, `pnpm test:venta-loaner -- --test-name-pattern='happy path pre-vinculado'` corre exclusivamente VLN-02a.

---

## Self-Check: PASSED

- FOUND: `apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts`
- FOUND: `apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts`
- FOUND: `apps/sistema-modular/scripts/test-venta-loaner.ts`
- FOUND: `apps/sistema-modular/package.json` (con script `test:venta-loaner`)
- FOUND: `.planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-00-test-infra-baseline-SUMMARY.md`
- FOUND commit `6651dce` (Task 1: fixtures)
- FOUND commit `587bf56` (Task 2: 5 tests + runner + package.json script)

---

*Phase: 15-stock-venta-de-loaner-espejo-a-stock*
*Completed: 2026-05-24*
