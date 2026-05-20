---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 01
type: execute
wave: 1
depends_on: [00]
files_modified:
  - packages/shared/src/types/index.ts
  - packages/shared/src/utils/patronBom.ts
  - packages/shared/src/index.ts
autonomous: true
requirements: [BOM-01, BOM-02]
must_haves:
  truths:
    - "Type extensions to Patron / PatronLote / MovimientoStock / OrigenRequerimiento / RequerimientoCompra / AdminConfigFlujos are present in packages/shared/src/types/index.ts; all are optional fields so existing consumers compile unchanged"
    - "packages/shared/src/utils/patronBom.ts exports computeSaldoComponente, computeLoteStatus, computePatronStatus, findLoteFifoDisponible, buildPatronesConsumidosSugerencia — all pure (no Firestore, no async, no imports beyond shared types)"
    - "Legacy patrón (componentes = [] or undefined) continues to behave exactly as before: computeSaldoComponente returns Infinity, computeLoteStatus returns 'active'"
    - "pnpm type-check (root) passes"
    - "pnpm --filter @ags/sistema-modular test:patron-bom now passes the BOM-02 tests (tests 1-9 from Wave 0 suite GREEN); BOM-03 and BOM-08 tests stay RED until 14-02/14-03"
  artifacts:
    - path: "packages/shared/src/utils/patronBom.ts"
      provides: "5 pure helper functions for BOM saldo/status/FIFO/sugerencia"
      min_lines: 70
    - path: "packages/shared/src/types/index.ts"
      provides: "ComponentePatron + PatronComponenteConsumido interfaces; extends Patron, PatronLote, MovimientoStock, OrigenRequerimiento, RequerimientoCompra, AdminConfigFlujos"
      contains: "ComponentePatron"
  key_links:
    - from: "apps/sistema-modular/src/__tests__/patronBom.test.ts"
      to: "packages/shared/src/utils/patronBom.ts"
      via: "import from '@ags/shared/utils/patronBom'"
      pattern: "from '@ags/shared"
---

<objective>
Land the foundation: backwards-compatible type extensions (BOM-01) + pure helper functions (BOM-02). Both apps (sistema-modular and reportes-ot) will consume the helpers, so they live in `packages/shared`. After this plan, BOM-02 unit tests from Wave 0 turn GREEN.

Purpose: Lock the data model and computation primitives BEFORE any service or UI code is written. Pure helpers are fully testable without Firestore, giving fastest feedback loop.

Output:
- `packages/shared/src/types/index.ts` extended with 6 optional additions (1 new interface `ComponentePatron`, 1 new interface `PatronComponenteConsumido`, extensions to 5 existing interfaces)
- `packages/shared/src/utils/patronBom.ts` (new file) with 5 pure functions
- `packages/shared/src/index.ts` re-exports the new utils module
- `test:patron-bom` shows tests 1-9 GREEN
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@packages/shared/src/types/index.ts
@packages/shared/src/index.ts
@apps/sistema-modular/src/__tests__/patronBom.test.ts
@apps/sistema-modular/src/__tests__/fixtures/patronBom.ts

<interfaces>
<!-- Current shapes (read from packages/shared/src/types/index.ts:2204-2255, 2700-2751, 3185-3252, 1001-1019) -->

```typescript
// CURRENT — PatronLote (around lines 2208-2228) and Patron (around 2236-2255):
export interface PatronLote {
  lote: string;
  fechaVencimiento?: string | null;
  cantidad?: number | null;
  certificadoEmisor?: string | null;
  certificadoUrl?: string | null;
  // ... other existing fields, leave intact
}

export interface Patron {
  id: string;
  codigoArticulo: string;
  descripcion: string;
  marca?: string | null;
  categorias?: string[];
  lotes: PatronLote[];
  activo?: boolean;
  // ... other existing fields, leave intact
}

// CURRENT — MovimientoStock (around 2712-2751) — Phase 13 already extended this with subtipo + articuloDestinoId etc; ADD onto end of existing extensions:
export interface MovimientoStock {
  // ... existing fields (tipo, subtipo from Phase 13, articuloId, etc.)
}

// CURRENT — OrigenRequerimiento (around 3210):
export type OrigenRequerimiento = 'manual' | 'presupuesto' | 'stock_minimo' | 'ingeniero';

// CURRENT — RequerimientoCompra (around 3215-3252):
export interface RequerimientoCompra {
  id: string; numero: string; articuloId: string | null; articuloCodigo: string;
  // ... existing
}

// CURRENT — AdminConfigFlujos (around 1001-1019):
export interface AdminConfigFlujos {
  usuarioSeguimientoId?: string | null;
  usuarioCoordinadorOTId?: string | null;
  // ... existing
}
```

Pattern: Phase 13 STKE-01 extended these same types with optional fields (subtipo, articuloDestinoId, equivalencias). Follow the exact same pattern — add new optional fields at the END of each interface with a JSDoc comment `/** Phase 14 BOM-01 — ... */`.

From packages/shared/src/index.ts (current barrel):
```typescript
export * from './types';
// (no utils re-export yet — this plan adds it)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend @ags/shared types — BOM-01 foundation</name>
  <files>packages/shared/src/types/index.ts</files>
  <behavior>
- pnpm type-check (root) passes after the changes.
- Every new field is optional (`?:`) and has `| null` where the runtime may persist null (precedent: Phase 13 STKE-01 fields).
- Existing Phase 13 + Phase 12 + Phase 10 consumers do NOT need updates (no breaking renames, no required additions).
  </behavior>
  <action>
1. Read packages/shared/src/types/index.ts around the lines documented in RESEARCH Sources section: 2204-2255 (Patron/PatronLote), 2700-2751 (MovimientoStock), 3185-3252 (Requerimiento*), 1001-1019 (AdminConfigFlujos). Confirm the exact line numbers in the current file (may shift slightly due to Phase 13 extensions).

2. Add the two new interfaces at the END of the Patron section (immediately after the `Patron` interface definition, before the next unrelated interface):
   ```typescript
   /** Phase 14 BOM-01 — un componente declarativo del BOM de un patrón.
    *  `codigoComponente` es texto libre interno del patrón (NO FK a Articulo). */
   export interface ComponentePatron {
     codigoComponente: string;
     descripcion: string;
     cantidadPorKit: number;
     unidadMedida: string;
     stockMinimo?: number | null;
   }

   /** Phase 14 BOM-01 — acumulado de consumo histórico por componente, vivo dentro de un PatronLote. */
   export interface PatronComponenteConsumido {
     codigoComponente: string;
     cantidadConsumida: number;
   }
   ```

3. Extend `PatronLote` (add the new field at the END of the existing interface, BEFORE the closing brace):
   ```typescript
   /** Phase 14 BOM-01 — acumulado de consumo por componente. Si el patrón no tiene BOM (componentes=[]), este array queda vacío/omitido. */
   componentesConsumidos?: PatronComponenteConsumido[];
   ```

4. Extend `Patron` (add at the END):
   ```typescript
   /** Phase 14 BOM-01 — BOM declarativo del patrón. Vacío/omitido = legacy sin desagregación. */
   componentes?: ComponentePatron[];
   ```

5. Extend `MovimientoStock` (add at the END, AFTER any existing Phase 13 STKE-01 extensions):
   ```typescript
   /** Phase 14 BOM-01 — tipo de entidad del movimiento. Default 'articulo' si ausente (backwards-compat). */
   entidadTipo?: 'articulo' | 'patron';
   /** Phase 14 BOM-01 — id del patrón cuando entidadTipo='patron'. Null para entidadTipo='articulo'. */
   patronId?: string | null;
   /** Phase 14 BOM-01 — código del lote (string natural, NO id; ver RESEARCH pitfall 3). */
   lote?: string | null;
   /** Phase 14 BOM-01 — código del componente consumido (match exacto con Patron.componentes[].codigoComponente). */
   codigoComponente?: string | null;
   ```

6. Extend `OrigenRequerimiento` type (it is a string union; add a new literal):
   ```typescript
   // BEFORE: export type OrigenRequerimiento = 'manual' | 'presupuesto' | 'stock_minimo' | 'ingeniero';
   // AFTER:
   export type OrigenRequerimiento = 'manual' | 'presupuesto' | 'stock_minimo' | 'ingeniero' | 'patron_minimo';
   ```

7. Extend `RequerimientoCompra` interface (add at the END, BEFORE the closing brace):
   ```typescript
   /** Phase 14 BOM-08 — sólo cuando origen='patron_minimo'. */
   patronId?: string | null;
   /** Phase 14 BOM-08 — código de lote (string natural, NO id). */
   loteId?: string | null;
   /** Phase 14 BOM-08 — código del componente que cayó bajo stockMinimo. */
   codigoComponente?: string | null;
   ```

8. Extend `AdminConfigFlujos` interface (add at the END):
   ```typescript
   /** Phase 14 BOM-08 — usuario asignado a Requerimientos auto-generados de patrón (componente bajo stockMinimo). */
   usuarioRequerimientosPatronId?: string | null;
   ```

9. Run `pnpm type-check` from repo root. If any error appears, it is because an existing consumer was over-strict about the shape — fix it inline (the changes are purely additive optional fields, so failures are unexpected).
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>All 6 extensions present in packages/shared/src/types/index.ts; `pnpm type-check` passes; running `pnpm --filter @ags/sistema-modular test:patron-bom` still RED but the failure mode shifted from "Cannot find module" to "Cannot find module '@ags/shared/utils/patronBom'" (only — types are now resolvable).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create packages/shared/src/utils/patronBom.ts with 5 pure helpers + barrel re-export</name>
  <files>packages/shared/src/utils/patronBom.ts, packages/shared/src/index.ts</files>
  <behavior>
- BOM-02 tests 1-9 from Wave 0 suite turn GREEN (tests 10-14 stay RED — they need 14-02/14-03).
- All 5 functions are pure: no async, no Firestore, no side effects, no imports beyond `@ags/shared/types`.
- `computeSaldoComponente` returns `Infinity` when `patron.componentes` is empty/undefined (legacy mode) — test 1.
- `computeSaldoComponente` uses `(lote.cantidad ?? 0)` defaulting (pitfall 5) — test 3.
- `computeLoteStatus` returns `'active'` for legacy (componentes=[]) — test 4.
- `computeLoteStatus` returns `'bloqueado'` when any saldo <= stockMinimo and others positive — test 6.
- `computeLoteStatus` returns `'agotado'` when all saldos <= stockMinimo — test 7.
- `findLoteFifoDisponible` skips lotes with no stock and bloqueado/agotado lotes; returns earliest fechaVencimiento — test 8.
- `buildPatronesConsumidosSugerencia` dedupes by `${patronId}::${lote}` (pitfall 4) and emits 1 entry per componente — test 9.
  </behavior>
  <action>
1. Verify the directory exists: `ls packages/shared/src/utils/` (if missing — create it). Phase 13 may have left `equivalencias.ts` or similar there; if so, follow that file's style.

2. Create packages/shared/src/utils/patronBom.ts with the exact 5 functions documented in RESEARCH "Pattern 2: Pure helpers de saldo":
   ```typescript
   // Phase 14 — BOM-02 pure helpers for Patron BOM (composition + saldo + status + FIFO + sugerencia)
   // No Firestore, no async, no side effects. Shared between sistema-modular and reportes-ot.
   import type { Patron, PatronLote, ComponentePatron } from '../types';

   /** Saldo de un componente en un lote. Returns Infinity when patron has no BOM (legacy). */
   export function computeSaldoComponente(
     patron: Patron,
     lote: PatronLote,
     codigoComponente: string,
   ): number {
     const comp = (patron.componentes ?? []).find(c => c.codigoComponente === codigoComponente);
     if (!comp) return Infinity;
     const stockTotal = (lote.cantidad ?? 0) * comp.cantidadPorKit;
     const consumido = (lote.componentesConsumidos ?? []).find(c => c.codigoComponente === codigoComponente)?.cantidadConsumida ?? 0;
     return stockTotal - consumido;
   }

   /** Estado de un lote calculado desde el BOM. */
   export function computeLoteStatus(patron: Patron, lote: PatronLote): 'active' | 'bloqueado' | 'agotado' {
     const componentes = patron.componentes ?? [];
     if (componentes.length === 0) return 'active'; // legacy
     let allAgotado = true;
     let algunoBloqueado = false;
     for (const comp of componentes) {
       const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
       const minimo = comp.stockMinimo ?? 0;
       if (saldo > minimo) allAgotado = false;
       else algunoBloqueado = true;
     }
     if (allAgotado) return 'agotado';
     if (algunoBloqueado) return 'bloqueado';
     return 'active';
   }

   /** Estado del patrón = peor estado de sus lotes. */
   export function computePatronStatus(patron: Patron): 'active' | 'bloqueado' | 'agotado' {
     const statuses = (patron.lotes ?? []).map(l => computeLoteStatus(patron, l));
     if (statuses.length === 0) return 'active';
     if (statuses.every(s => s === 'agotado')) return 'agotado';
     if (statuses.some(s => s === 'bloqueado' || s === 'agotado')) return 'bloqueado';
     return 'active';
   }

   /** FIFO por vencimiento ascendente. Filtra lotes sin saldo y lotes bloqueado/agotado. */
   export function findLoteFifoDisponible(
     patron: Patron,
     fechaActualIso?: string,
   ): PatronLote | null {
     const candidatos = (patron.lotes ?? []).filter(l => {
       const status = computeLoteStatus(patron, l);
       if (status === 'agotado' || status === 'bloqueado') return false;
       if ((l.cantidad ?? 0) <= 0) return false;
       return true;
     });
     candidatos.sort((a, b) => {
       const da = a.fechaVencimiento ?? '9999-12-31';
       const db = b.fechaVencimiento ?? '9999-12-31';
       return da.localeCompare(db);
     });
     return candidatos[0] ?? null;
   }

   /** Sugerencia inicial para el paso admin "Patrones consumidos":
    *  Dedupe por (patronId, lote) — pitfall 4 — y emite 1 unidad por componente del kit. */
   export function buildPatronesConsumidosSugerencia(
     patronesSeleccionados: Array<{ patronId: string; lote: string }>,
     patrones: Patron[],
   ): Array<{ patronId: string; lote: string; codigoComponente: string; cantidadSugerida: number }> {
     const dedup = new Map<string, { patronId: string; lote: string }>();
     for (const ps of patronesSeleccionados) dedup.set(`${ps.patronId}::${ps.lote}`, ps);
     const out: Array<{ patronId: string; lote: string; codigoComponente: string; cantidadSugerida: number }> = [];
     for (const { patronId, lote } of dedup.values()) {
       const patron = patrones.find(p => p.id === patronId);
       if (!patron) continue;
       for (const comp of patron.componentes ?? []) {
         out.push({ patronId, lote, codigoComponente: comp.codigoComponente, cantidadSugerida: 1 });
       }
     }
     return out;
   }
   ```

3. Update packages/shared/src/index.ts barrel to re-export the new module:
   ```typescript
   export * from './types';
   export * as patronBom from './utils/patronBom';     // namespaced export
   export * from './utils/patronBom';                  // also flat re-export (parity with how shared utils are used elsewhere)
   ```
   If a `./utils` barrel file already exists from prior fases, prefer to add the re-export there and import that barrel from `./index.ts`. Verify by inspecting `packages/shared/src/index.ts` and adapt to the file's current style.

4. Verify the import path used by Wave 0 fixtures (`from '@ags/shared/utils/patronBom'`) resolves. If the package.json `exports` field needs updating, add `"./utils/patronBom"` to it. Pattern: mirror however Phase 13 exposed `@ags/shared/...` deep imports.

5. Run `pnpm --filter @ags/sistema-modular test:patron-bom`. Expected: tests 1-9 PASS, tests 10-14 still FAIL (missing service exports — those land in 14-02).
  </action>
  <verify>
    <automated>pnpm type-check &amp;&amp; pnpm --filter @ags/sistema-modular test:patron-bom 2>&amp;1 | tee /tmp/bom-out.log; grep -E "(passed|✓|pass)" /tmp/bom-out.log | head -5</automated>
  </verify>
  <done>5 functions exported from packages/shared/src/utils/patronBom.ts; barrel re-exports both flat and namespaced; tests 1-9 from Wave 0 suite GREEN; tests 10-14 still RED (missing patronesService.consumirComponentes); type-check passes.</done>
</task>

</tasks>

<verification>
- `pnpm type-check` passes from repo root (all consumers of Patron/PatronLote/MovimientoStock/RequerimientoCompra/AdminConfigFlujos continue to compile, because all additions are optional).
- `pnpm --filter @ags/sistema-modular test:patron-bom` shows 9/14 tests PASSING (BOM-02 helpers GREEN; BOM-03 + BOM-08 tx tests still RED — landed in 14-02/14-03).
- Manual UAT: not required for this plan (pure types + pure functions; UI lands in 14-04/14-05/14-06).
</verification>

<success_criteria>
Type extensions backwards-compatible (Phase 13 precedent followed 1:1). Pure helpers fully tested. The PHRASE "patrón legacy continues to work unchanged" is verifiable: `computeSaldoComponente(legacyPatron, ...)` returns `Infinity` (no BOM constraint), `computeLoteStatus` returns `'active'`, no mutations to Firestore writes for patrones que no migraron.
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-01-SUMMARY.md` documenting:
- Exact line numbers of each type extension (so 14-02 onwards can grep them quickly)
- Confirmation that pnpm type-check is GREEN
- Test count: 9/14 GREEN, 5 still RED (which downstream plans turn each one GREEN)
- Backwards-compat verification: ran `pnpm build` for sistema-modular and reportes-ot quickly — both compile without changes.
</output>
