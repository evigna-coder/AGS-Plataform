---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 03
type: execute
wave: 3
depends_on: [00, 01, 02]
files_modified:
  - apps/sistema-modular/src/services/patronesService.ts
  - apps/sistema-modular/src/services/adminConfigService.ts
  - apps/sistema-modular/src/services/patronesAutoRequerimiento.ts
autonomous: true
requirements: [BOM-08]
must_haves:
  truths:
    - "consumirComponentes invokes autoCrearRequerimientosPatron(patronIds) POST-commit (best-effort, no throw inside tx) — calcado del precedente FLOW-03 (presupuestosService.ts:939-985)"
    - autoCrearRequerimientosPatron skips silently if adminConfigService.usuarioRequerimientosPatronId is null (no responsable configurado)
    - "Idempotency: for each (patronId, loteId, codigoComponente) where saldo <= stockMinimo, query requerimientosService for existing OPEN req with origen='patron_minimo' + same triplet; skip if found (RESEARCH pitfall 8 — Phase 8 Regla G precedent)"
    - RequerimientoCompra created with origen='patron_minimo' + new fields (patronId, loteId, codigoComponente), numero correlativo via requerimientosService.getNextNumber() pre-generated OUTSIDE any tx
    - "adminConfigService extended: getWithDefaults() returns usuarioRequerimientosPatronId field (default null)"
    - "test:patron-bom shows test 14 (auto-req idempotency) GREEN — full suite 14/14 GREEN"
    - "Service split: autoCrearRequerimientosPatron lives in NEW file patronesAutoRequerimiento.ts (keeps patronesService under control); consumirComponentes imports and calls it"
  artifacts:
    - "path: "apps/sistema-modular/src/services/patronesAutoRequerimiento.ts"
    - "path: "apps/sistema-modular/src/services/adminConfigService.ts"
  key_links:
    - "from: "apps/sistema-modular/src/services/patronesService.ts"
    - "from: "apps/sistema-modular/src/services/patronesAutoRequerimiento.ts"
---

<objective>
Implement BOM-08: when `consumirComponentes` produces a saldo <= stockMinimo for any component, auto-create a `RequerimientoCompra` (origen `'patron_minimo'`) assigned to the configurable responsible user. Idempotent (RESEARCH pitfall 8 — Phase 8 Regla G precedent). Invoked POST-commit, best-effort (does not block the patron mutation).

Purpose: Reposición proactiva — the responsible user receives a REQ-XXXX before the technician encounters the bloqueado kit in the field. Decoupling from the tx (FLOW-07 / Phase 9 policy "Cloud Functions SOLO para denormalización" — no new CF, plain inline post-commit).

Output:
- New file `patronesAutoRequerimiento.ts` with the helper
- `adminConfigService.ts` extended with `usuarioRequerimientosPatronId` (default null in getWithDefaults)
- `consumirComponentes` (14-02 artifact) calls `autoCrearRequerimientosPatron(patronesUnicos)` POST-commit, wrapped in try/catch (best-effort)
- Wave 0 test 14 GREEN — full suite 14/14
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@apps/sistema-modular/src/services/patronesService.ts
@apps/sistema-modular/src/services/adminConfigService.ts
@apps/sistema-modular/src/services/importacionesService.ts
@apps/sistema-modular/src/services/presupuestosService.ts
@packages/shared/src/utils/patronBom.ts
@apps/sistema-modular/src/__tests__/patronBom.test.ts

<interfaces>
<!-- Phase 8 precedent: auto-creation of RequerimientoCompra (presupuestosService.ts:939-985) -->

From apps/sistema-modular/src/services/presupuestosService.ts:939-985 (FLOW-03 — auto-req from acceptance):
```typescript
// Pattern to mirror exactly:
const qReq = query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc'));
const snapReq = await getDocs(qReq);
let maxNum = 0;
snapReq.docs.forEach(d => { /* parse REQ-XXXX */ });

const reqRef = doc(collection(db, 'requerimientos_compra'));
const payload = deepCleanForFirestore({
  numero: `REQ-${String(maxNum + 1).padStart(4, '0')}`,
  // ... fields
});
batch.set(reqRef, payload);
batchAudit(batch, { action: 'create', collection: 'requerimientos_compra', documentId: reqRef.id, after: payload });
```

From apps/sistema-modular/src/services/importacionesService.ts (requerimientosService):
```typescript
export const requerimientosService = {
  getAll(filters?): Promise<RequerimientoCompra[]>,
  getById(id): Promise<RequerimientoCompra | null>,
  create(data: Omit<RequerimientoCompra, 'id'>): Promise<string>,  // returns new doc id
  getNextNumber(): Promise<string>,                                // returns 'REQ-XXXX' next available
  // ... etc
};
```

From apps/sistema-modular/src/services/adminConfigService.ts (current shape):
```typescript
export const adminConfigService = {
  async getWithDefaults(): Promise<AdminConfigFlujos> {
    const doc = await getDoc(doc(db, 'adminConfig', 'flujos'));
    return {
      usuarioSeguimientoId: null,
      usuarioCoordinadorOTId: null,
      mailFacturacion: 'mbarrios@agsanalitica.com',
      // ... existing defaults
      ...(doc.exists() ? doc.data() : {}),
    };
  },
  async update(patch: Partial<AdminConfigFlujos>): Promise<void> { ... }
};
```

From Phase 8 STATE.md: `_cancelarRequerimientosCondicionales` (presupuestosService.ts:1700-1755) is the precedent for "Regla G" — idempotent skip if matching open record exists.

From packages/shared/src/utils/patronBom.ts (14-01):
```typescript
export function computeSaldoComponente(patron, lote, codigoComponente): number;
```

From Wave 0 fixtures (14-00):
```typescript
// state.requerimientos: Map<string, any>
// Each entry: { id, numero, origen, patronId, loteId, codigoComponente, estado, ... }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend adminConfigService with usuarioRequerimientosPatronId</name>
  <files>apps/sistema-modular/src/services/adminConfigService.ts</files>
  <action>
1. Read apps/sistema-modular/src/services/adminConfigService.ts.

2. Locate the `getWithDefaults()` defaults object. Add the new field with default `null`:
   ```typescript
   return {
     usuarioSeguimientoId: null,
     usuarioCoordinadorOTId: null,
     mailFacturacion: 'mbarrios@agsanalitica.com',
     usuarioRequerimientosPatronId: null,   // Phase 14 BOM-08
     // ... rest of existing defaults
     ...(snap.exists() ? snap.data() : {}),
   };
   ```
   Place in alphabetical or thematic order consistent with the existing list.

3. If the file has any input validation in `update()` (e.g., schema-based), add the new key to the allowed-set. Otherwise the spread `...patch` already handles it — confirm by reading the update path.

4. Add a JSDoc comment above the field:
   ```typescript
   /** Phase 14 BOM-08 — usuario asignado a Requerimientos auto-generados de patrón. */
   ```
  </action>
  <verify>
    <automated>pnpm type-check &amp;&amp; cd apps/sistema-modular &amp;&amp; node -e "const fs = require('fs'); const c = fs.readFileSync('src/services/adminConfigService.ts','utf8'); if(!c.includes('usuarioRequerimientosPatronId')) process.exit(1); console.log('ok');"</automated>
  </verify>
  <done>adminConfigService.ts has usuarioRequerimientosPatronId in defaults; type-check passes (BOM-01 in 14-01 already extended AdminConfigFlujos interface).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create patronesAutoRequerimiento.ts helper + wire into consumirComponentes post-commit</name>
  <files>apps/sistema-modular/src/services/patronesAutoRequerimiento.ts, apps/sistema-modular/src/services/patronesService.ts</files>
  <behavior>
- Test 14 (BOM-08 auto-req idempotency) from Wave 0 turns GREEN.
- When `state.adminConfigFlujos.usuarioRequerimientosPatronId` is null/undefined, autoCrearRequerimientosPatron returns `[]` without writing anything.
- When called with a patron whose lote crossed `stockMinimo`, creates exactly 1 RequerimientoCompra per (patronId, lote, codigoComponente) below min.
- When called twice in a row (idempotency), the second call writes 0 new requerimientos because the first batch is now "open".
  </behavior>
  <action>
1. Create apps/sistema-modular/src/services/patronesAutoRequerimiento.ts:
   ```typescript
   // Phase 14 BOM-08 — auto-creación de RequerimientoCompra cuando un componente cae bajo stockMinimo.
   // Best-effort, post-commit, idempotent. Precedente: FLOW-03 (presupuestosService.ts:939-985) + Regla G (Phase 8).
   import type { Patron, RequerimientoCompra } from '@ags/shared';
   import { computeSaldoComponente } from '@ags/shared/utils/patronBom';

   // Lazy imports to avoid load-order cycles (Phase 13 precedent: lazy import for circular deps)
   // — patronesService.ts depends on this file but this file uses requerimientosService which may also import patronesService.

   export interface AutoCrearReqOptions {
     // For tests: inject mock state (matches MockPatronBomState)
     __testState?: {
       patrones: Map<string, any>;
       requerimientos: Map<string, any>;
       adminConfigFlujos: { usuarioRequerimientosPatronId?: string | null };
     };
   }

   export async function autoCrearRequerimientosPatron(
     patronIds: string[],
     options?: AutoCrearReqOptions,
   ): Promise<string[]> {
     if (options?.__testState) return _autoCrearInTest(patronIds, options.__testState);
     return _autoCrearInProd(patronIds);
   }

   async function _autoCrearInProd(patronIds: string[]): Promise<string[]> {
     const { adminConfigService } = await import('./adminConfigService');
     const { patronesService } = await import('./patronesService');
     const { requerimientosService } = await import('./importacionesService');

     const config = await adminConfigService.getWithDefaults();
     const asignadoA = config.usuarioRequerimientosPatronId;
     if (!asignadoA) {
       console.warn('[autoCrearRequerimientosPatron] no responsable configurado — skip silencioso');
       return [];
     }

     // Pre-cargar requerimientos abiertos con origen 'patron_minimo' (1 query)
     const reqsAbiertos = (await requerimientosService.getAll({ origen: 'patron_minimo' } as any))
       .filter((r: any) => r.estado !== 'comprado' && r.estado !== 'cancelado');

     const creados: string[] = [];
     for (const patronId of patronIds) {
       const patron = await patronesService.getById(patronId);
       if (!patron || !patron.componentes || patron.componentes.length === 0) continue;
       for (const lote of patron.lotes) {
         for (const comp of patron.componentes) {
           const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
           const minimo = comp.stockMinimo ?? 0;
           if (saldo > minimo) continue;
           // Idempotency: skip if open REQ already exists for this triplet
           const yaHay = reqsAbiertos.some((r: any) =>
             r.patronId === patronId && r.loteId === lote.lote && r.codigoComponente === comp.codigoComponente,
           );
           if (yaHay) continue;
           const reqId = await requerimientosService.create({
             articuloId: null,
             articuloCodigo: patron.codigoArticulo,
             articuloDescripcion: `${comp.descripcion} (componente de ${patron.descripcion}) — lote ${lote.lote}`,
             cantidad: 1,
             unidadMedida: comp.unidadMedida,
             motivo: `Componente ${comp.codigoComponente} bajo mínimo (saldo=${saldo}, mínimo=${minimo}) — lote ${lote.lote}`,
             origen: 'patron_minimo',
             origenRef: patronId,
             estado: 'pendiente',
             solicitadoPor: asignadoA,
             fechaSolicitud: new Date().toISOString(),
             urgencia: 'media',
             patronId,
             loteId: lote.lote,
             codigoComponente: comp.codigoComponente,
           } as any);
           creados.push(reqId);
         }
       }
     }
     return creados;
   }

   async function _autoCrearInTest(
     patronIds: string[],
     state: NonNullable<AutoCrearReqOptions['__testState']>,
   ): Promise<string[]> {
     const asignadoA = state.adminConfigFlujos.usuarioRequerimientosPatronId;
     if (!asignadoA) return [];

     const reqsAbiertos = [...state.requerimientos.values()].filter(
       (r: any) => r.origen === 'patron_minimo' && r.estado !== 'comprado' && r.estado !== 'cancelado',
     );

     const creados: string[] = [];
     for (const patronId of patronIds) {
       const patron: Patron | undefined = state.patrones.get(patronId);
       if (!patron || !patron.componentes || patron.componentes.length === 0) continue;
       for (const lote of patron.lotes) {
         for (const comp of patron.componentes) {
           const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
           const minimo = comp.stockMinimo ?? 0;
           if (saldo > minimo) continue;
           const yaHay = reqsAbiertos.some((r: any) =>
             r.patronId === patronId && r.loteId === lote.lote && r.codigoComponente === comp.codigoComponente,
           );
           if (yaHay) continue;
           const id = crypto.randomUUID();
           state.requerimientos.set(id, {
             id, numero: `REQ-MOCK-${state.requerimientos.size + 1}`,
             origen: 'patron_minimo', patronId, loteId: lote.lote, codigoComponente: comp.codigoComponente,
             estado: 'pendiente', solicitadoPor: asignadoA, urgencia: 'media',
             motivo: `Componente ${comp.codigoComponente} bajo mínimo (saldo=${saldo}, mínimo=${minimo})`,
           });
           reqsAbiertos.push(state.requerimientos.get(id)); // include in same-batch idempotency
           creados.push(id);
         }
       }
     }
     return creados;
   }
   ```

2. Edit apps/sistema-modular/src/services/patronesService.ts. In `_consumirComponentesInProd`, AFTER the `await runTransaction(...)` block, add post-commit best-effort:
   ```typescript
   // STEP D — POST-commit: auto-Requerimiento de patrón (BOM-08). Best-effort, no throw bloquea.
   const requerimientosCreados: string[] = [];
   try {
     const { autoCrearRequerimientosPatron } = await import('./patronesAutoRequerimiento');
     const creados = await autoCrearRequerimientosPatron(patronesUnicos);
     requerimientosCreados.push(...creados);
   } catch (err) {
     console.error('[consumirComponentes] autoCrearRequerimientosPatron falló (best-effort):', err);
   }

   return { movimientoIds: movIds, requerimientosCreados };
   ```
   Update the `ConsumirComponentesResult` interface to include `requerimientosCreados: string[]`.

3. Edit `_consumirComponentesInTest` similarly: AFTER the mutation loop, call:
   ```typescript
   const { autoCrearRequerimientosPatron } = await import('./patronesAutoRequerimiento');
   const reqsCreados = await autoCrearRequerimientosPatron(
     patronesUnicos,
     { __testState: { patrones: state.patrones, requerimientos: state.requerimientos, adminConfigFlujos: state.adminConfigFlujos } },
   );
   return { movimientoIds: movIds, requerimientosCreados: reqsCreados };
   ```

4. Run `pnpm --filter @ags/sistema-modular test:patron-bom`. Expected: 14/14 GREEN.
  </action>
  <verify>
    <automated>cd apps/sistema-modular &amp;&amp; pnpm test:patron-bom 2>&amp;1 | tail -10</automated>
  </verify>
  <done>autoCrearRequerimientosPatron created with prod and test paths; consumirComponentes invokes it POST-commit (best-effort try/catch); test 14 GREEN; full Wave 0 suite 14/14 GREEN.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @ags/sistema-modular test:patron-bom` returns 14/14 GREEN.
- `pnpm type-check` passes.
- Lazy imports used in patronesAutoRequerimiento.ts to avoid circular dep (Phase 13 precedent — STATE.md line 404).
- No `pnpm lint:ast` warnings about no-firestore-undefined for the new code.
</verification>

<success_criteria>
BOM-08 fully functional at the service layer: any consumirComponentes that drops a saldo<=stockMinimo produces a REQ-XXXX assigned to the configured user, with idempotency that prevents spam on re-cierre. The UI plan 14-06 will expose `usuarioRequerimientosPatronId` in `/admin/config-flujos`.
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-03-SUMMARY.md` documenting:
- New file patronesAutoRequerimiento.ts (LOC count)
- adminConfigService change (one line)
- patronesService change (one POST-commit block + interface update)
- Confirmation: 14/14 Wave 0 tests GREEN
- Heads-up for 14-04/05/06: services layer COMPLETE; UI plans can consume `consumirComponentes` and trust its idempotency contract.
- Heads-up for 14-06: also need to add UI in `/admin/config-flujos` for the new setting `usuarioRequerimientosPatronId`.
</output>
