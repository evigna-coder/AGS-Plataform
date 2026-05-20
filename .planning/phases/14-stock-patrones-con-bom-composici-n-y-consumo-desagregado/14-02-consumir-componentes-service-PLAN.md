---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 02
type: execute
wave: 2
depends_on: [00, 01]
files_modified:
  - apps/sistema-modular/src/services/patronesService.ts
  - apps/sistema-modular/src/__tests__/fixtures/patronBom.ts
autonomous: true
requirements: [BOM-03]
must_haves:
  truths:
    - "patronesService.consumirComponentes({otNumber, consumos, creadoPor}) executes as a runTransaction: pre-fetch outside tx, READ-FIRST (tx.get patron), recompute lotes[], validate non-negative saldos, tx.update patron + N tx.set MovimientoStock"
    - "Granularidad fina: 2 patrones × 3 componentes = 6 MovimientoStock writes (1 per componente) all under the same transaction"
    - "Idempotency on re-cierre admin: if movimientosService.getAll({otNumber, entidadTipo:'patron'}) returns >0 docs, consumirComponentes THROWS 'Patrones ya descontados para esta OT' BEFORE entering the transaction — prevents double-discount when admin reopens cierre (RESEARCH pitfall 2)"
    - "Atomic failure: if any componente.cantidad would push saldo < 0, the entire transaction throws and NO state change persists"
    - "DI hook __setTestFirestore exported (mirrors Phase 13 equivalenciasService.__setTestFirestore) — Wave 0 test suite uses it"
    - "Backwards-compat: calling consumirComponentes on a patron with componentes=[] (legacy) throws loud 'Patrón sin BOM' (does not silently no-op; the admin should not invoke it on legacy patrones)"
    - "All MovimientoStock writes use deepCleanForFirestore (no undefined leaks to Firestore — rule .claude/rules/firestore.md)"
    - "MovimientoStock.lote: string (natural key, NOT loteId; RESEARCH pitfall 3)"
    - "test:patron-bom shows BOM-03 tests 10-12 GREEN (test 13 idempotency too); test 14 (auto-req idempotency) still RED until 14-03"
  artifacts:
    - path: "apps/sistema-modular/src/services/patronesService.ts"
      provides: "consumirComponentes(params) + __setTestFirestore(state) + internal helpers _runInProd/_runInTest"
      contains: "consumirComponentes"
  key_links:
    - from: "apps/sistema-modular/src/services/patronesService.ts"
      to: "packages/shared/src/utils/patronBom.ts"
      via: "import { computeSaldoComponente, computeLoteStatus } from '@ags/shared/utils/patronBom'"
      pattern: "@ags/shared/utils/patronBom"
    - from: "apps/sistema-modular/src/services/patronesService.ts"
      to: "firebase/firestore runTransaction"
      via: "transactional write of patron + N MovimientoStock"
      pattern: "runTransaction"
---

<objective>
Implement BOM-03: the atomic `consumirComponentes` service method that descends `Patron.lotes[i].componentesConsumidos[]` and writes N `MovimientoStock` docs (1 per componente consumido) in a single `runTransaction`. Mirrors Phase 13 `equivalenciasService.desagregarUnidades` 1:1 — same DI hook pattern, same READ-FIRST → recompute → WRITE structure.

Idempotency on re-cierre admin (RESEARCH pitfall 2) is part of THIS plan, NOT the UI plan: the service throws before entering the tx if movements already exist for the OT. The UI in 14-06 catches that throw and renders read-only banner.

Purpose: Atomic discount of patron components with no race conditions, fully unit-testable via DI hook, granular audit trail (1 mov per componente).

Output:
- `patronesService.consumirComponentes(...)` with runTransaction
- `__setTestFirestore(state)` DI shim
- Internal `_runInTest` and `_runInProd` split (Phase 13 pattern)
- Wave 0 tests 10-13 GREEN
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@.planning/STATE.md
@apps/sistema-modular/src/services/patronesService.ts
@apps/sistema-modular/src/services/equivalenciasService.ts
@apps/sistema-modular/src/services/stockService.ts
@apps/sistema-modular/src/services/firebase.ts
@packages/shared/src/utils/patronBom.ts
@apps/sistema-modular/src/__tests__/patronBom.test.ts
@apps/sistema-modular/src/__tests__/fixtures/patronBom.ts

<interfaces>
<!-- Phase 13 precedent: __setTestFirestore + _runInProd/_runInTest split — read this in detail before writing code -->

From apps/sistema-modular/src/services/equivalenciasService.ts (lines 38-78, 245-478):
```typescript
// DI shim
let testState: MockEquivalenciasState | null = null;
export function __setTestFirestore(state: MockEquivalenciasState | null): void {
  testState = state;
}

// Service method splits prod/test paths
export async function desagregarUnidades(params) {
  if (testState) return _runInTest(params, testState);
  return _runInProd(params);
}
```

From apps/sistema-modular/src/services/firebase.ts (helpers to reuse):
```typescript
export const db: Firestore; // initialized Firestore singleton
export function deepCleanForFirestore<T>(obj: T): T;       // recursive undefined strip
export function cleanFirestoreData<T>(obj: T): T;          // flat undefined strip
export function getCreateTrace(): { createdAt, createdBy };
export function getUpdateTrace(): { updatedAt, updatedBy };
```

From firebase/firestore (used patterns):
```typescript
import { runTransaction, doc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
```

From apps/sistema-modular/src/services/stockService.ts (movimientosService current write signature):
```typescript
movimientosService.create({
  tipo: 'consumo',
  articuloId, articuloCodigo, articuloDescripcion,
  cantidad, origenTipo, origenId, origenNombre, destinoTipo, destinoId, destinoNombre,
  otNumber?, creadoPor, motivo?, ...
});
```
Note: we do NOT call movimientosService.create from inside the tx — we write directly via tx.set to the same `movimientosStock` collection with the same shape, extended with `entidadTipo: 'patron' + patronId + lote + codigoComponente`. The runTransaction requires inline writes.

From packages/shared/src/utils/patronBom.ts (landed in 14-01):
```typescript
export function computeSaldoComponente(patron, lote, codigoComponente): number;
export function computeLoteStatus(patron, lote): 'active' | 'bloqueado' | 'agotado';
```

From apps/sistema-modular/src/__tests__/fixtures/patronBom.ts (Wave 0 fixtures — fixtures live under src/__tests__/, NOT src/services/__tests__/):
```typescript
export interface MockPatronBomState {
  patrones: Map<string, any>;
  movimientos: Map<string, any>;
  requerimientos: Map<string, any>;
  adminConfigFlujos: { usuarioRequerimientosPatronId?: string | null };
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement consumirComponentes runTransaction + __setTestFirestore DI hook in patronesService</name>
  <files>apps/sistema-modular/src/services/patronesService.ts, apps/sistema-modular/src/__tests__/fixtures/patronBom.ts</files>
  <behavior>
- Wave 0 tests 10 (happy path), 11 (atomicity throw), 12 (granularidad 6 movs), 13 (idempotency on re-cierre) GREEN.
- Test 14 (auto-req idempotency) stays RED — that lands in 14-03 (autoCrearRequerimientosPatron is a separate helper invoked POST-commit, best-effort).
- DI hook `__setTestFirestore(state)` mirrors `equivalenciasService.__setTestFirestore` shape exactly.
- Calling consumirComponentes on a patron with componentes=[] throws "Patrón sin BOM declarado — no aplica desagregación de componentes".
  </behavior>
  <action>
1. Read apps/sistema-modular/src/services/patronesService.ts in full. Note the current exports (probably CRUD + storage helpers). Note the import style (firebase helpers, types).

2. Read apps/sistema-modular/src/services/equivalenciasService.ts lines 38-78 and 245-478 (the precedent). Mirror its structure exactly: DI shim at top of file, public method dispatches to _runInProd / _runInTest based on `testState`.

3. At the top of patronesService.ts (after existing imports), add:
   ```typescript
   import { runTransaction, doc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
   import { db, deepCleanForFirestore, cleanFirestoreData, getUpdateTrace } from './firebase';
   import { computeSaldoComponente } from '@ags/shared/utils/patronBom';
   import type { Patron, PatronLote, MovimientoStock } from '@ags/shared';
   import type { MockPatronBomState } from '../__tests__/fixtures/patronBom';
   ```
   Note path: fixtures live at `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` (created by plan 14-00). From `src/services/patronesService.ts`, the relative import resolves to `'../__tests__/fixtures/patronBom'`.

4. Add the DI shim immediately after imports:
   ```typescript
   // --- Test injection (Phase 14 BOM-03) — mirrors equivalenciasService.__setTestFirestore ---
   let testState: MockPatronBomState | null = null;
   export function __setTestFirestore(state: MockPatronBomState | null): void {
     testState = state;
   }
   ```

5. Implement the public method (place it as a top-level export at the BOTTOM of the file, after existing CRUD):
   ```typescript
   export interface ConsumirComponentesParams {
     otNumber: string;
     consumos: Array<{
       patronId: string;
       lote: string;             // código natural — pitfall 3
       componentes: Array<{ codigoComponente: string; cantidad: number; motivo?: string }>;
     }>;
     creadoPor: string;
   }

   export interface ConsumirComponentesResult {
     movimientoIds: string[];
   }

   export async function consumirComponentes(params: ConsumirComponentesParams): Promise<ConsumirComponentesResult> {
     if (testState) return _consumirComponentesInTest(params, testState);
     return _consumirComponentesInProd(params);
   }
   ```

6. Implement `_consumirComponentesInProd` — calcado de `equivalenciasService.desagregarUnidades`:
   ```typescript
   async function _consumirComponentesInProd(params: ConsumirComponentesParams): Promise<ConsumirComponentesResult> {
     // STEP A — Idempotency check (RESEARCH pitfall 2 — re-cierre admin)
     const movsExistentesQ = query(
       collection(db, 'movimientosStock'),
       where('otNumber', '==', params.otNumber),
       where('entidadTipo', '==', 'patron'),
     );
     const movsExistentesSnap = await getDocs(movsExistentesQ);
     if (!movsExistentesSnap.empty) {
       throw new Error(`Patrones ya descontados para OT ${params.otNumber} (${movsExistentesSnap.size} movimientos previos)`);
     }

     // STEP B — Pre-gen IDs (N por componente consumido)
     const totalMovs = params.consumos.reduce((acc, c) => acc + c.componentes.length, 0);
     const movIds = Array.from({ length: totalMovs }, () => crypto.randomUUID());

     const patronesUnicos = [...new Set(params.consumos.map(c => c.patronId))];

     // STEP C — runTransaction (READ FIRST then WRITES)
     await runTransaction(db, async (tx) => {
       const patronesActuales = new Map<string, Patron>();
       for (const patronId of patronesUnicos) {
         const snap = await tx.get(doc(db, 'patrones', patronId));
         if (!snap.exists()) throw new Error(`Patrón ${patronId} no encontrado (race?)`);
         patronesActuales.set(patronId, { id: snap.id, ...(snap.data() as any) } as Patron);
       }

       for (const patronId of patronesUnicos) {
         const patron = patronesActuales.get(patronId)!;
         if (!patron.componentes || patron.componentes.length === 0) {
           throw new Error(`Patrón ${patronId} sin BOM declarado — no aplica desagregación de componentes`);
         }
         const consumosDelPatron = params.consumos.filter(c => c.patronId === patronId);
         const nuevosLotes = recomputeLotesConConsumos(patron, consumosDelPatron);
         validarSaldosNoNegativos(patron, nuevosLotes);
         const update = deepCleanForFirestore({
           lotes: nuevosLotes,
           ...getUpdateTrace(),
           updatedAt: Timestamp.now(),
         });
         tx.update(doc(db, 'patrones', patronId), update);
       }

       // N MovimientoStock — 1 por componente consumido
       let movIdx = 0;
       const nowTs = Timestamp.now();
       for (const c of params.consumos) {
         for (const comp of c.componentes) {
           const movRef = doc(db, 'movimientosStock', movIds[movIdx++]);
           tx.set(movRef, cleanFirestoreData({
             tipo: 'consumo',
             entidadTipo: 'patron',
             patronId: c.patronId,
             lote: c.lote,
             codigoComponente: comp.codigoComponente,
             cantidad: comp.cantidad,
             articuloId: null,
             articuloCodigo: null,
             articuloDescripcion: null,
             origenTipo: 'patron',
             origenId: c.patronId,
             origenNombre: `Patrón ${c.patronId} · lote ${c.lote}`,
             destinoTipo: 'consumo_ot',
             destinoId: params.otNumber,
             destinoNombre: `OT ${params.otNumber}`,
             otNumber: params.otNumber,
             motivo: comp.motivo ?? null,
             creadoPor: params.creadoPor,
             createdAt: nowTs,
             ...getUpdateTrace(),
           }));
         }
       }
     });

     return { movimientoIds: movIds };
   }
   ```

7. Implement helpers (place as file-private functions above _consumirComponentesInProd):
   ```typescript
   function recomputeLotesConConsumos(
     patron: Patron,
     consumosDelPatron: ConsumirComponentesParams['consumos'],
   ): PatronLote[] {
     return patron.lotes.map(lote => {
       const consumosDeEsteLote = consumosDelPatron.filter(c => c.lote === lote.lote);
       if (consumosDeEsteLote.length === 0) return lote;
       const consumidoMap = new Map<string, number>();
       for (const cc of lote.componentesConsumidos ?? []) {
         consumidoMap.set(cc.codigoComponente, cc.cantidadConsumida);
       }
       for (const c of consumosDeEsteLote) {
         for (const comp of c.componentes) {
           consumidoMap.set(comp.codigoComponente, (consumidoMap.get(comp.codigoComponente) ?? 0) + comp.cantidad);
         }
       }
       return {
         ...lote,
         componentesConsumidos: Array.from(consumidoMap.entries()).map(([codigoComponente, cantidadConsumida]) => ({
           codigoComponente, cantidadConsumida,
         })),
       };
     });
   }

   function validarSaldosNoNegativos(patron: Patron, nuevosLotes: PatronLote[]): void {
     for (const lote of nuevosLotes) {
       for (const comp of patron.componentes ?? []) {
         const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
         if (saldo < 0) {
           throw new Error(
             `Saldo negativo prohibido: patrón ${patron.codigoArticulo} lote ${lote.lote} componente ${comp.codigoComponente} = ${saldo}`,
           );
         }
       }
     }
   }
   ```

8. Implement `_consumirComponentesInTest` mirroring the prod path but operating on the in-memory MockPatronBomState (Phase 13 mirror):
   ```typescript
   async function _consumirComponentesInTest(
     params: ConsumirComponentesParams,
     state: MockPatronBomState,
   ): Promise<ConsumirComponentesResult> {
     // Idempotency check
     const movsExistentes = [...state.movimientos.values()].filter(
       (m: any) => m.otNumber === params.otNumber && m.entidadTipo === 'patron',
     );
     if (movsExistentes.length > 0) {
       throw new Error(`Patrones ya descontados para OT ${params.otNumber} (${movsExistentes.length} movimientos previos)`);
     }

     const patronesUnicos = [...new Set(params.consumos.map(c => c.patronId))];
     // Validate + recompute (same helpers)
     for (const patronId of patronesUnicos) {
       const patron = state.patrones.get(patronId);
       if (!patron) throw new Error(`Patrón ${patronId} no encontrado en mock state`);
       if (!patron.componentes || patron.componentes.length === 0) {
         throw new Error(`Patrón ${patronId} sin BOM declarado`);
       }
       const consumosDelPatron = params.consumos.filter(c => c.patronId === patronId);
       const nuevosLotes = recomputeLotesConConsumos(patron, consumosDelPatron);
       validarSaldosNoNegativos(patron, nuevosLotes);
       state.patrones.set(patronId, { ...patron, lotes: nuevosLotes });
     }

     const movIds: string[] = [];
     for (const c of params.consumos) {
       for (const comp of c.componentes) {
         const id = crypto.randomUUID();
         movIds.push(id);
         state.movimientos.set(id, {
           id, tipo: 'consumo', entidadTipo: 'patron',
           patronId: c.patronId, lote: c.lote, codigoComponente: comp.codigoComponente,
           cantidad: comp.cantidad, otNumber: params.otNumber,
           motivo: comp.motivo ?? null, creadoPor: params.creadoPor,
         });
       }
     }

     return { movimientoIds: movIds };
   }
   ```

9. Update fixtures to expose the MockPatronBomState shape via TS export (already done in 14-00 at `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` — under `src/__tests__/`, NOT `src/services/__tests__/`). Confirm imports work. Add small fixture helpers if tests need them (e.g., `seedPatron(state, patron)` convenience).

10. Run `pnpm --filter @ags/sistema-modular test:patron-bom`. Expected: tests 1-13 GREEN; test 14 still RED (auto-req lands in 14-03).
  </action>
  <verify>
    <automated>cd apps/sistema-modular &amp;&amp; pnpm test:patron-bom 2>&amp;1 | tail -30</automated>
  </verify>
  <done>consumirComponentes + __setTestFirestore exported from patronesService.ts; runTransaction structure mirrors equivalenciasService.desagregarUnidades exactly; tests 10-13 GREEN; test 14 RED (intended — auto-req in 14-03); deepCleanForFirestore used on all writes; MovimientoStock.lote (string, NOT loteId).</done>
</task>

</tasks>

<verification>
- `pnpm --filter @ags/sistema-modular test:patron-bom` shows 13/14 tests GREEN.
- `pnpm type-check` passes.
- File patronesService.ts does NOT exceed budget (250 LOC for components, services have looser de-facto budget; if approaching 400 LOC, extract `consumirComponentes` logic to a new file `patronesConsumirHelpers.ts` per components.md spirit).
- No `: undefined` cluster near setDoc/updateDoc/addDoc (regla firestore.md — hook `check-firestore-undefined` confirms).
</verification>

<success_criteria>
Idempotency on re-cierre admin is verifiable in test 13: invoking consumirComponentes twice for the same OT throws on the second call. Granularidad: a single call with 2 patrones × 3 componentes produces exactly 6 entries in `state.movimientos` (test 12). Atomic failure: a consumo that would push saldo<0 throws and leaves `state.patrones` and `state.movimientos` untouched (test 11).
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-02-SUMMARY.md` documenting:
- New exports from patronesService.ts (consumirComponentes, __setTestFirestore, types)
- LOC count of patronesService.ts after changes (raise warning if over 400)
- Decision recorded: idempotency lives in the service (not in UI); UI catches the throw to render read-only banner
- Confirmation: MovimientoStock.lote is `string` (natural key), not `loteId` (pitfall 3)
- Heads-up for 14-03: autoCrearRequerimientosPatron(...) is a separate helper invoked POST-commit, best-effort; do NOT entangle with the tx.
</output>
