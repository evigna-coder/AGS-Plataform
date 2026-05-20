---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/sistema-modular/scripts/test-patron-bom.ts
  - apps/sistema-modular/src/__tests__/patronBom.test.ts
  - apps/sistema-modular/src/__tests__/fixtures/patronBom.ts
  - apps/sistema-modular/package.json
autonomous: true
requirements: [BOM-01, BOM-02, BOM-03, BOM-08]
must_haves:
  truths:
    - "pnpm --filter @ags/sistema-modular test:patron-bom runs and produces RED output referencing missing exports (patronBom helpers, patronesService.consumirComponentes, __setTestFirestore DI hook)"
    - "test:patron-bom npm script exists in apps/sistema-modular/package.json and resolves via tsx"
    - "Fixtures cover the 4 canonical Patron shapes from RESEARCH: legacy (componentes=[]), simple (1 componente cantidadPorKit=3), complex (8 componentes cantidadPorKit=1), bloqueado (1 componente saldo<=stockMinimo)"
  artifacts:
    - path: "apps/sistema-modular/scripts/test-patron-bom.ts"
      provides: "tsx entry point that re-exports the test suite from src/__tests__/patronBom.test.ts"
      min_lines: 5
    - path: "apps/sistema-modular/src/__tests__/patronBom.test.ts"
      provides: "Unit suite covering BOM-02 (pure helpers) + BOM-03 (consumirComponentes tx with DI mock) + BOM-08 (auto-req idempotency)"
      min_lines: 120
    - path: "apps/sistema-modular/src/__tests__/fixtures/patronBom.ts"
      provides: "Patron + PatronLote fixtures (legacy, simple, complex, bloqueado, agotado) + OT.patronesSeleccionados fixture (with duplicates) + MockFirestoreState shape"
      min_lines: 80
    - path: "apps/sistema-modular/package.json"
      provides: "test:patron-bom npm script"
      contains: "test:patron-bom"
  key_links:
    - from: "apps/sistema-modular/src/__tests__/patronBom.test.ts"
      to: "packages/shared/src/utils/patronBom.ts"
      via: "import statement (RED until 14-01 lands)"
      pattern: "from '@ags/shared/utils/patronBom'"
    - from: "apps/sistema-modular/src/__tests__/patronBom.test.ts"
      to: "apps/sistema-modular/src/services/patronesService.ts"
      via: "import + __setTestFirestore (RED until 14-02 lands the DI hook)"
      pattern: "__setTestFirestore"
---

<objective>
Establish the RED-baseline test scaffolding required by the Phase 14 validation contract (14-VALIDATION.md). This is a Wave 0 plan: it creates a failing unit test suite + fixtures + test runner script that all downstream plans (14-01 through 14-07) turn GREEN. Pattern mirrors Phase 13 plan 13-00 (equivalencias.test.ts) and Phase 12 plan 12-00 (cuotasFacturacion.test.ts).

Purpose: Lock the feedback signal before any production code lands. Every subsequent task in this phase has an `<automated>` verify command rooted in this scaffolding (`pnpm --filter @ags/sistema-modular test:patron-bom`). Max feedback latency: ~10 seconds (tsx + node:assert/strict, no emulator).

Output:
- `scripts/test-patron-bom.ts` (tsx entry — re-exports suite)
- `src/__tests__/patronBom.test.ts` (unit suite — RED until 14-01/14-02 land)
- `src/__tests__/fixtures/patronBom.ts` (Patron + PatronLote + OT fixtures + MockFirestoreState shape)
- `package.json` script `test:patron-bom`

The test file imports from `@ags/shared/utils/patronBom` (BOM-02 — landed in 14-01) AND from `patronesService.__setTestFirestore` (BOM-03 — landed in 14-02). Both imports throw at module-load until those plans land — that IS the RED baseline.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-VALIDATION.md
@apps/sistema-modular/src/services/__tests__/equivalencias.test.ts
@apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts
@apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts
@apps/sistema-modular/package.json

<interfaces>
<!-- Pattern reference: Phase 13 test scaffolding precedent (lines from real source) -->

From apps/sistema-modular/package.json (scripts section, current state — Phase 13 precedent):
```json
"test:stock-amplio": "tsx src/services/__tests__/stockAmplio.test.ts",
"test:cuotas-facturacion": "tsx src/services/__tests__/cuotasFacturacion.test.ts",
"test:equivalencias": "tsx scripts/test-equivalencias.ts"
```

Plan 14-00 adds:
```json
"test:patron-bom": "tsx scripts/test-patron-bom.ts"
```

From apps/sistema-modular/src/services/__tests__/equivalencias.test.ts (Phase 13 — DI hook usage pattern):
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __setTestFirestore } from '../equivalenciasService';
import type { MockEquivalenciasState } from './fixtures/equivalencias';
// ... fixtures import
// __setTestFirestore(stateMock) before each test
```

From packages/shared/src/types/index.ts (Patron / PatronLote / Componente shapes that Wave 0 fixtures must mock — extension lands in 14-01):
```typescript
// CURRENT (without BOM):
export interface PatronLote {
  lote: string;
  fechaVencimiento?: string | null;
  cantidad?: number | null;
  certificadoEmisor?: string | null;
  certificadoUrl?: string | null;
}

export interface Patron {
  id: string;
  codigoArticulo: string;
  descripcion: string;
  marca?: string | null;
  categorias?: string[];
  lotes: PatronLote[];
  activo?: boolean;
}

// WILL BE EXTENDED IN 14-01 — fixtures should declare locally for now via `as any`:
// + componentes?: ComponentePatron[];
// + (PatronLote) componentesConsumidos?: PatronComponenteConsumido[];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add test:patron-bom npm script + create scripts/test-patron-bom.ts entry point</name>
  <files>apps/sistema-modular/package.json, apps/sistema-modular/scripts/test-patron-bom.ts</files>
  <action>
1. Read apps/sistema-modular/package.json. Locate the "scripts" object. Add (alphabetically near other test:* scripts):
   ```json
   "test:patron-bom": "tsx scripts/test-patron-bom.ts"
   ```
   Preserve all other scripts and the surrounding JSON structure (commas, formatting). Do NOT touch other fields (dependencies, devDependencies).

2. Create apps/sistema-modular/scripts/test-patron-bom.ts as a 1-line re-exporter so the test suite is colocated in src/__tests__/:
   ```ts
   // Entry point for pnpm --filter @ags/sistema-modular test:patron-bom
   // Pattern: mirror scripts/test-equivalencias.ts (Phase 13)
   import '../src/__tests__/patronBom.test.ts';
   ```
   (If scripts/ does not exist yet, ls the apps/sistema-modular directory first; in our repo it exists because Phase 13 already populated it with test-equivalencias.ts. Confirm and place alongside.)
  </action>
  <verify>
    <automated>cd apps/sistema-modular &amp;&amp; node -e "const p=require('./package.json'); if(!p.scripts['test:patron-bom']) process.exit(1); console.log('ok:', p.scripts['test:patron-bom']);"</automated>
  </verify>
  <done>package.json has the `test:patron-bom` script wired to tsx; scripts/test-patron-bom.ts exists and is a 1-line re-export of the test file.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create fixtures and RED unit test suite (BOM-02 helpers + BOM-03 tx + BOM-08 idempotency)</name>
  <files>apps/sistema-modular/src/__tests__/fixtures/patronBom.ts, apps/sistema-modular/src/__tests__/patronBom.test.ts</files>
  <behavior>
- Test 1 (BOM-02 legacy): `computeSaldoComponente(legacyPatron, lote, 'any-code')` returns `Infinity` (no BOM declared = unbounded).
- Test 2 (BOM-02 simple): `computeSaldoComponente(simplePatron, loteCantidad5, 'amp-A')` where simplePatron has 1 component cantidadPorKit=3 and lote.cantidad=5 and consumido=2 returns `5*3-2 = 13`.
- Test 3 (BOM-02 null cantidad): `computeSaldoComponente(simplePatron, {...lote, cantidad: null}, 'amp-A')` returns `0 - 0 = 0` (NaN-guard via `?? 0`).
- Test 4 (BOM-02 status): `computeLoteStatus(legacyPatron, lote)` returns `'active'` (no BOM).
- Test 5 (BOM-02 status): `computeLoteStatus(complexPatron, loteHealthy)` returns `'active'` (all components above stockMinimo).
- Test 6 (BOM-02 status): `computeLoteStatus(complexPatron, loteWithOneComponentAtZero)` returns `'bloqueado'` (one saldo <= stockMinimo but others positive).
- Test 7 (BOM-02 status): `computeLoteStatus(complexPatron, loteAllZero)` returns `'agotado'`.
- Test 8 (BOM-02 FIFO): `findLoteFifoDisponible(patronWithThreeLotes, '2026-06-01')` returns the lote with earliest fechaVencimiento that has saldo > 0 and is not bloqueado/agotado.
- Test 9 (BOM-02 sugerencia): `buildPatronesConsumidosSugerencia([{patronId:'P1',lote:'L1'}, {patronId:'P1',lote:'L1'}], [patronWith2Componentes])` returns 2 entries (1 per componente of the kit), NOT 4 (dedupe pitfall 4).
- Test 10 (BOM-03 happy path): `__setTestFirestore({...})` then `consumirComponentes({otNumber:'OT-1', consumos:[{patronId:'P1', lote:'L1', componentes:[{codigoComponente:'amp-A', cantidad:1}]}], creadoPor:'u1'})` returns `{movimientoIds:[...1...]}` and mutates the mock state's patron lote `componentesConsumidos[amp-A] = 1`.
- Test 11 (BOM-03 atomicity): consumirComponentes with cantidad that would push saldo negative THROWS and leaves mock state unchanged.
- Test 12 (BOM-03 granularidad): 2 patrones × 3 componentes each = 6 MovimientoStock writes (1 per componente).
- Test 13 (BOM-08 idempotency): `consumirComponentes` called with otNumber where mock already has `MovimientoStock` with `entidadTipo:'patron' && otNumber===X` THROWS "ya descontados".
- Test 14 (BOM-08 auto-req idempotency): When `consumirComponentes` triggers a saldo<=stockMinimo, calling it twice (across two distinct OTs that both deplete the same component below min) produces 1 RequerimientoCompra (skip silent if open REQ exists with same patronId/loteId/codigoComponente).
  </behavior>
  <action>
1. Create apps/sistema-modular/src/__tests__/fixtures/patronBom.ts. Pattern: mirror src/services/__tests__/fixtures/equivalencias.ts. Define:
   ```ts
   import type { Patron, PatronLote } from '@ags/shared';

   // Local type stand-ins (extension lands in 14-01; use loose typing here)
   export type ComponentePatronLite = {
     codigoComponente: string; descripcion: string; cantidadPorKit: number; unidadMedida: string; stockMinimo?: number | null;
   };

   export const legacyPatron: Patron = { id:'P-LEG', codigoArticulo:'LEG-001', descripcion:'Patrón legacy', lotes:[{lote:'L1', cantidad:5, fechaVencimiento:'2027-01-01'}], activo:true };
   export const simplePatron = { ...legacyPatron, id:'P-SIMPLE', codigoArticulo:'5182-6917', descripcion:'Patrón 3 ampollas iguales', componentes:[{codigoComponente:'amp-A', descripcion:'ampolla A', cantidadPorKit:3, unidadMedida:'ampolla', stockMinimo:1}] } as any;
   export const complexPatron = { ...legacyPatron, id:'P-COMPLEX', codigoArticulo:'5062-6503', descripcion:'UV KIT', componentes: Array.from({length:8}, (_,i)=>({codigoComponente:`amp-${i}`, descripcion:`ampolla ${i}`, cantidadPorKit:1, unidadMedida:'ampolla', stockMinimo:0})) } as any;
   export const patronWithThreeLotes = { ...simplePatron, id:'P-FIFO', lotes:[
     {lote:'L-OLD', cantidad:0, fechaVencimiento:'2026-05-01'},   // sin saldo → skip
     {lote:'L-MID', cantidad:5, fechaVencimiento:'2026-07-01'},   // earliest with stock
     {lote:'L-NEW', cantidad:10, fechaVencimiento:'2027-01-01'},
   ] } as any;
   export const loteWithOneComponentAtZero = {
     lote:'L1', cantidad:3, fechaVencimiento:'2027-01-01',
     componentesConsumidos:[{codigoComponente:'amp-0', cantidadConsumida:3}], // saldo = 3*1-3 = 0 (<=stockMinimo=0)
   } as any;
   export const loteAllZero = {
     lote:'L1', cantidad:1, fechaVencimiento:'2027-01-01',
     componentesConsumidos: Array.from({length:8},(_,i)=>({codigoComponente:`amp-${i}`, cantidadConsumida:1})),
   } as any;

   // MockFirestoreState for BOM-03 tx tests — shape mirrors Phase 13 MockEquivalenciasState
   export interface MockPatronBomState {
     patrones: Map<string, any>;          // id → Patron doc
     movimientos: Map<string, any>;       // movId → MovimientoStock doc
     requerimientos: Map<string, any>;    // reqId → RequerimientoCompra doc
     adminConfigFlujos: { usuarioRequerimientosPatronId?: string | null };
   }

   export const buildState = (overrides?: Partial<MockPatronBomState>): MockPatronBomState => ({
     patrones: new Map(),
     movimientos: new Map(),
     requerimientos: new Map(),
     adminConfigFlujos: {},
     ...overrides,
   });

   export const otPatronesSeleccionadosDuplicados = [
     { patronId:'P-SIMPLE', lote:'L1' },
     { patronId:'P-SIMPLE', lote:'L1' },  // duplicate — must dedupe in BOM-02 test 9
   ];
   ```

2. Create apps/sistema-modular/src/__tests__/patronBom.test.ts. Pattern: mirror src/services/__tests__/equivalencias.test.ts (node:test + node:assert/strict, no jest/vitest). Header:
   ```ts
   // Phase 14 — Patron BOM unit suite
   // RED baseline until: 14-01 (helpers) + 14-02 (consumirComponentes + __setTestFirestore DI) + 14-03 (auto-req)
   import { test } from 'node:test';
   import assert from 'node:assert/strict';
   import {
     computeSaldoComponente,
     computeLoteStatus,
     computePatronStatus,
     findLoteFifoDisponible,
     buildPatronesConsumidosSugerencia,
   } from '@ags/shared/utils/patronBom';
   import { __setTestFirestore, consumirComponentes } from '../services/patronesService';
   import {
     legacyPatron, simplePatron, complexPatron, patronWithThreeLotes,
     loteWithOneComponentAtZero, loteAllZero, otPatronesSeleccionadosDuplicados,
     buildState, type MockPatronBomState,
   } from './fixtures/patronBom';
   ```
   Then implement 14 tests as enumerated in `<behavior>` above. Use `test.beforeEach(() => __setTestFirestore(state))` to inject fresh mock state per BOM-03/BOM-08 test (lines 10–14).

   Suite is RED at this commit because:
   - `@ags/shared/utils/patronBom` does not exist yet → 14-01 creates it
   - `patronesService.consumirComponentes` and `__setTestFirestore` do not exist yet → 14-02 creates them
   - `requerimientosService` auto-req helper does not exist yet → 14-03 creates it

   This is the intended RED state. Document in a header comment.

3. Re-run: `pnpm --filter @ags/sistema-modular test:patron-bom` — expected output: module-not-found / undefined exports error. That is the green for "RED baseline is set".
  </action>
  <verify>
    <automated>cd apps/sistema-modular &amp;&amp; pnpm test:patron-bom 2>&amp;1 | grep -E "(Cannot find|is not a function|patronBom)" &amp;&amp; echo "RED baseline confirmed"</automated>
  </verify>
  <done>Test file exists with 14 tests; fixtures exist with all 4 Patron shapes + MockState helper; running `test:patron-bom` fails loudly (cannot find module @ags/shared/utils/patronBom) — the RED baseline is set and downstream plans turn it GREEN.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @ags/sistema-modular test:patron-bom` runs (no script-not-found) and exits non-zero with a module-not-found error referencing `@ags/shared/utils/patronBom` and/or `__setTestFirestore`.
- Fixtures file imports `Patron`/`PatronLote` from `@ags/shared` cleanly (those exist today).
- `pnpm type-check` should pass for the fixtures (uses `as any` for the future fields) but the test file itself MAY fail typecheck — that is acceptable in Wave 0 (it lands GREEN once 14-01 lands the types).
</verification>

<success_criteria>
Wave 0 baseline locked: the test runner, fixtures, and suite all exist with the canonical shapes from RESEARCH (legacy, simple, complex, FIFO, bloqueado, agotado, duplicados). Every downstream plan can rely on `pnpm --filter @ags/sistema-modular test:patron-bom` as its automated verify command.
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-00-SUMMARY.md` documenting:
- Files created (scripts + tests + fixtures + package.json update)
- Confirmed RED output of `test:patron-bom`
- Imports that will turn GREEN in 14-01 (helpers) and 14-02 (service + DI hook) and 14-03 (auto-req helper)
- Manual smoke note: this plan does NOT touch reportes-ot; CLAUDE_ALLOW_REPORTES_OT not required.
</output>
