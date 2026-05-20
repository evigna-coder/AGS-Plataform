---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 06
type: execute
wave: 4
depends_on: [01, 02, 03]
files_modified:
  - apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx
  - apps/sistema-modular/src/components/ordenes-trabajo/CierrePatronesConsumidosSection.tsx
  - apps/sistema-modular/src/hooks/useCierrePatronesConsumidos.ts
  - apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx
  - apps/sistema-modular/src/hooks/useEditOTForm.ts
  - apps/sistema-modular/src/services/otService.ts
autonomous: false
requirements: [BOM-05, BOM-08]
must_haves:
  truths:
    - OTCierreAdminSection renders a NEW step 'Patrones consumidos' inserted BEFORE CierreStockSelector (research suggested order)
    - Step is extracted to a NEW sub-component CierrePatronesConsumidosSection.tsx (NOT inline) because OTCierreAdminSection is at 244 LOC near budget
    - Auto-prefill from OT.patronesSeleccionados using buildPatronesConsumidosSugerencia helper (dedupe by (patronId, lote) per RESEARCH pitfall 4)
    - When a (patronId, lote) tuple is ambiguous in the report, FIFO by vencimiento (findLoteFifoDisponible helper) picks the suggested lote
    - Admin can edit cantidades, add/remove rows, change lote per row
    - On confirm, invokes patronesService.consumirComponentes(...) with motivo capturing divergencias vs the technician's report
    - "Idempotency: if movimientosService.getAll({otNumber, entidadTipo:'patron'}) returns >0, the section renders read-only with banner 'Ya descontado el dd/mm/yyyy por X' — the throw from the service is caught and surfaced visually"
    - "Reporte técnico INTOCABLE: zero writes to reportes/{otNumber}.patronesSeleccionados — confirmed by code review (only reads)"
    - ConfigFlujosPage extended with usuarioRequerimientosPatronId SearchableSelect (FLOW-07 style)
    - "Service-only Firestore access: hook calls ordenesTrabajoService.getPatronesSeleccionados(otNumber) — NO raw getDoc inside hooks (rule .claude/rules/firestore.md)"
  artifacts:
    - "path: "apps/sistema-modular/src/components/ordenes-trabajo/CierrePatronesConsumidosSection.tsx"
    - "path: "apps/sistema-modular/src/hooks/useCierrePatronesConsumidos.ts"
    - "path: "apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx"
    - "path: "apps/sistema-modular/src/services/otService.ts"
  key_links:
    - "from: "apps/sistema-modular/src/components/ordenes-trabajo/CierrePatronesConsumidosSection.tsx"
    - "from: "apps/sistema-modular/src/hooks/useCierrePatronesConsumidos.ts"
    - "from: "apps/sistema-modular/src/hooks/useEditOTForm.ts"
---

<objective>
Implement BOM-05 (cierre admin step) and the UI half of BOM-08 (`usuarioRequerimientosPatronId` setting in `/admin/config-flujos`). This is the integration plan — connects the runTransaction service from 14-02 / 14-03 to the actual closing flow of an OT.

Goal-backward truth: When admin closes an OT that used patrones with BOM, exactly N MovimientoStock entries are written (1 per componente), the patron lote's componentesConsumidos array reflects the new counts, the report stays untouched, divergencias quedan en motivo del movimiento, and re-opening the cierre does NOT double-discount (because consumirComponentes throws on existing movs and the UI catches it into read-only).

**Scope sanity note:** This plan has 5 tasks (1 hook + 1 sub-component + 1 wiring + 1 admin config + 1 UAT checkpoint). Tasks 1+2+3 are one cohesive feature (the cierre patrón step); Task 4 is the FLOW-07-style setting in /admin/config-flujos that only makes sense alongside the feature it controls; Task 5 is the end-to-end UAT covering all of them in one session. Splitting Task 4 into its own micro-plan would force two UAT checkpoints for one user-facing journey — kept together for usability.

Output:
- New `CierrePatronesConsumidosSection.tsx` (sub-component)
- New `useCierrePatronesConsumidos.ts` (hook with state machine)
- OTCierreAdminSection wires the new section
- ConfigFlujosPage gets the new `usuarioRequerimientosPatronId` SearchableSelect
- `ordenesTrabajoService.getPatronesSeleccionados(otNumber)` service method (replaces raw Firestore from hook)
- Manual UAT checkpoint covers BOM-05 + BOM-08 end-to-end (Validation table rows)
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-CONTEXT.md
@.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-RESEARCH.md
@.planning/STATE.md
@apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx
@apps/sistema-modular/src/components/ordenes-trabajo/CierreStockSelector.tsx
@apps/sistema-modular/src/hooks/useEditOTForm.ts
@apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx
@apps/sistema-modular/src/services/patronesService.ts
@apps/sistema-modular/src/services/stockService.ts
@apps/sistema-modular/src/services/adminConfigService.ts
@apps/sistema-modular/src/services/usuariosService.ts
@apps/sistema-modular/src/services/otService.ts
@apps/sistema-modular/src/components/ui/SearchableSelect.tsx
@packages/shared/src/utils/patronBom.ts

<interfaces>
From apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx (current — 244 LOC per RESEARCH):
Insertion point: between the "Notas de cierre" section and `<CierreStockSelector />`. The container passes `cierreAdmin` + `onChange(field, value)` props down. To get OT.patronesSeleccionados we need a new prop:
- `otNumber: string` (already available)
- `patronesSeleccionados: PatronSeleccionado[]` (NEW prop passed from EditOTModal — sourced from `reportes/{otNumber}.patronesSeleccionados`)
- `onPatronesConsumidosConfirmados?: () => void` (callback to trigger refresh)

From apps/sistema-modular/src/services/patronesService.ts (14-02 + 14-03):
- `consumirComponentes({otNumber, consumos, creadoPor}): Promise<{movimientoIds, requerimientosCreados}>`  THROWS on idempotency violation.

From apps/sistema-modular/src/services/stockService.ts (movimientosService):
- `movimientosService.getAll(filters?: { otNumber?, entidadTipo? })` returns MovimientoStock[]

From apps/sistema-modular/src/services/otService.ts (current — `ordenesTrabajoService` already exists and is the canonical service for the `reportes` collection per existing reads at otService.ts:56, 252, 270, 292, 555, 693):
```typescript
export const ordenesTrabajoService = {
  // ... existing CRUD methods (getById, getAll, update, etc.)
  // NEW in this plan:
  async getPatronesSeleccionados(otNumber: string): Promise<PatronSeleccionado[]>;
};
```
Rationale (per .claude/rules/firestore.md): the existing hook `useEditOTForm.ts` only imports from `'../services/firebaseService'` and `'../services/personalService'` — it has NO precedent of raw `getDoc` calls. Adding raw Firestore inside the hook would violate the rule. Better path: extend `ordenesTrabajoService` (which already owns the `reportes` collection).

From packages/shared/src/utils/patronBom.ts (14-01):
- `buildPatronesConsumidosSugerencia(patronesSeleccionados, patrones)` returns rows
- `findLoteFifoDisponible(patron, fechaActualIso)` returns PatronLote or null

From apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx (existing FLOW-07 SearchableSelect pattern):
```tsx
<SearchableSelect
  value={form.usuarioCoordinadorOTId || ''}
  onChange={v => setForm({ ...form, usuarioCoordinadorOTId: v })}
  options={buildUserOptions(true, '(Sin coordinador)')}
  placeholder="Seleccionar usuario..."
/>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ordenesTrabajoService.getPatronesSeleccionados service method + useCierrePatronesConsumidos hook</name>
  <files>apps/sistema-modular/src/services/otService.ts, apps/sistema-modular/src/hooks/useCierrePatronesConsumidos.ts</files>
  <action>
1. **Service method first.** Read apps/sistema-modular/src/services/otService.ts to locate the `ordenesTrabajoService` object (around line 42 per Grep). Append a new method to the object literal:
   ```typescript
   async getPatronesSeleccionados(otNumber: string): Promise<PatronSeleccionado[]> {
     const snap = await getDoc(doc(db, 'reportes', otNumber));
     if (!snap.exists()) return [];
     const data = snap.data() as any;
     return Array.isArray(data?.patronesSeleccionados) ? data.patronesSeleccionados as PatronSeleccionado[] : [];
   },
   ```
   (Confirm `getDoc`, `doc`, `db` are already imported at the top of the file — they are, per existing reads at otService.ts:555 etc. Add `PatronSeleccionado` to the type imports if missing.)

2. Create the hook file `apps/sistema-modular/src/hooks/useCierrePatronesConsumidos.ts`. Shape:
   ```typescript
   import { useState, useEffect, useMemo, useCallback } from 'react';
   import type { Patron, PatronSeleccionado } from '@ags/shared';
   import { buildPatronesConsumidosSugerencia, findLoteFifoDisponible } from '@ags/shared/utils/patronBom';
   import { patronesService } from '../services/patronesService';
   import { movimientosService } from '../services/stockService';
   import { useAuth } from '../contexts/AuthContext';

   export type RowMode = 'sugerido' | 'editado' | 'manual';

   export interface ConsumidoRow {
     patronId: string;
     patronCodigo: string;
     patronDescripcion: string;
     lote: string;
     codigoComponente: string;
     descripcionComponente: string;
     cantidadSugerida: number;
     cantidad: number;             // editable
     motivo?: string;
     mode: RowMode;
   }

   export interface UseCierrePatronesConsumidosResult {
     loading: boolean;
     readOnly: boolean;             // true when movimientos for OT already exist
     readOnlyInfo: { fecha: string; creadoPor: string; count: number } | null;
     rows: ConsumidoRow[];
     patronesCache: Map<string, Patron>;
     updateRow: (idx: number, patch: Partial<ConsumidoRow>) => void;
     addRow: (patronId: string, lote: string, codigoComponente: string) => void;
     removeRow: (idx: number) => void;
     submit: () => Promise<{ movimientoIds: string[]; requerimientosCreados: string[] }>;
     error: string | null;
     submitting: boolean;
   }

   export function useCierrePatronesConsumidos(
     otNumber: string,
     patronesSeleccionados: PatronSeleccionado[],
   ): UseCierrePatronesConsumidosResult {
     const { firebaseUser } = useAuth();
     const [loading, setLoading] = useState(true);
     const [readOnly, setReadOnly] = useState(false);
     const [readOnlyInfo, setReadOnlyInfo] = useState<UseCierrePatronesConsumidosResult['readOnlyInfo']>(null);
     const [patronesCache, setPatronesCache] = useState(new Map<string, Patron>());
     const [rows, setRows] = useState<ConsumidoRow[]>([]);
     const [error, setError] = useState<string | null>(null);
     const [submitting, setSubmitting] = useState(false);

     // Step 1: Load patrones + check existing movs (idempotency)
     useEffect(() => {
       (async () => {
         setLoading(true);
         try {
           const patronIds = [...new Set(patronesSeleccionados.map(ps => ps.patronId))];
           const patrones = await Promise.all(patronIds.map(id => patronesService.getById(id)));
           const cache = new Map<string, Patron>();
           for (const p of patrones) if (p) cache.set(p.id, p);
           setPatronesCache(cache);

           const movsExistentes = await movimientosService.getAll({ otNumber } as any);
           const movsPatron = movsExistentes.filter((m: any) => m.entidadTipo === 'patron');
           if (movsPatron.length > 0) {
             setReadOnly(true);
             const first = movsPatron[0];
             setReadOnlyInfo({
               fecha: first.createdAt?.toDate?.().toISOString() ?? String(first.createdAt ?? '-'),
               creadoPor: first.creadoPor ?? '(desconocido)',
               count: movsPatron.length,
             });
             setLoading(false);
             return;
           }

           // Step 2: Build sugerencia (BOM-aware patrones only; legacy patrones are skipped silently)
           const patronesBom = [...cache.values()].filter(p => (p.componentes ?? []).length > 0);
           if (patronesBom.length === 0) {
             setRows([]);
             setLoading(false);
             return;
           }
           const sugerencia = buildPatronesConsumidosSugerencia(
             patronesSeleccionados.map(ps => ({ patronId: ps.patronId, lote: ps.lote ?? '' })),
             patronesBom,
           );
           // Step 3: FIFO fallback when sugerencia row has empty lote (technician didn't pin one)
           const fechaHoy = new Date().toISOString();
           const enriched: ConsumidoRow[] = sugerencia.map(s => {
             const patron = cache.get(s.patronId)!;
             let lote = s.lote;
             if (!lote) {
               const fifo = findLoteFifoDisponible(patron, fechaHoy);
               lote = fifo?.lote ?? '';
             }
             const comp = (patron.componentes ?? []).find(c => c.codigoComponente === s.codigoComponente);
             return {
               patronId: s.patronId,
               patronCodigo: patron.codigoArticulo,
               patronDescripcion: patron.descripcion,
               lote,
               codigoComponente: s.codigoComponente,
               descripcionComponente: comp?.descripcion ?? s.codigoComponente,
               cantidadSugerida: s.cantidadSugerida,
               cantidad: s.cantidadSugerida,
               mode: 'sugerido',
             };
           });
           setRows(enriched);
         } catch (e: any) {
           setError(e?.message ?? String(e));
         } finally {
           setLoading(false);
         }
       })();
     }, [otNumber, JSON.stringify(patronesSeleccionados)]);

     const updateRow = useCallback((idx: number, patch: Partial<ConsumidoRow>) => {
       setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch, mode: 'editado' } : r));
     }, []);

     const addRow = useCallback((patronId: string, lote: string, codigoComponente: string) => {
       const patron = patronesCache.get(patronId);
       if (!patron) return;
       const comp = (patron.componentes ?? []).find(c => c.codigoComponente === codigoComponente);
       if (!comp) return;
       setRows(prev => [...prev, {
         patronId, patronCodigo: patron.codigoArticulo, patronDescripcion: patron.descripcion,
         lote, codigoComponente, descripcionComponente: comp.descripcion,
         cantidadSugerida: 0, cantidad: 1, mode: 'manual',
       }]);
     }, [patronesCache]);

     const removeRow = useCallback((idx: number) => {
       setRows(prev => prev.filter((_, i) => i !== idx));
     }, []);

     const submit = useCallback(async () => {
       if (readOnly) throw new Error('Patrones ya descontados — sección read-only');
       setSubmitting(true);
       setError(null);
       try {
         // Group rows by (patronId, lote)
         const grupos = new Map<string, ConsumidoRow[]>();
         for (const r of rows.filter(r => r.cantidad > 0)) {
           const key = `${r.patronId}::${r.lote}`;
           const arr = grupos.get(key) ?? [];
           arr.push(r);
           grupos.set(key, arr);
         }
         const consumos = [...grupos.values()].map(arr => ({
           patronId: arr[0].patronId,
           lote: arr[0].lote,
           componentes: arr.map(r => ({
             codigoComponente: r.codigoComponente,
             cantidad: r.cantidad,
             motivo: r.mode !== 'sugerido' && r.cantidad !== r.cantidadSugerida
               ? `Divergencia admin: sugerido=${r.cantidadSugerida}, real=${r.cantidad}${r.motivo ? ` — ${r.motivo}` : ''}`
               : r.motivo,
           })),
         }));
         const result = await patronesService.consumirComponentes({
           otNumber,
           consumos,
           creadoPor: firebaseUser?.uid ?? '(unknown)',
         });
         setReadOnly(true);
         setReadOnlyInfo({ fecha: new Date().toISOString(), creadoPor: firebaseUser?.uid ?? '(unknown)', count: result.movimientoIds.length });
         return result;
       } catch (e: any) {
         setError(e?.message ?? String(e));
         throw e;
       } finally {
         setSubmitting(false);
       }
     }, [otNumber, rows, readOnly, firebaseUser]);

     return { loading, readOnly, readOnlyInfo, rows, patronesCache, updateRow, addRow, removeRow, submit, error, submitting };
   }
   ```

3. Keep hook file under 220 LOC.
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>ordenesTrabajoService.getPatronesSeleccionados exported; hook exported and encapsulates pre-fill + idempotency check + submit + error state; ≤ 220 LOC; type-check passes; no raw Firestore in the hook.</done>
</task>

<task type="auto">
  <name>Task 2: Create CierrePatronesConsumidosSection.tsx UI</name>
  <files>apps/sistema-modular/src/components/ordenes-trabajo/CierrePatronesConsumidosSection.tsx</files>
  <action>
1. Create the sub-component file. Shape:
   ```tsx
   import type { PatronSeleccionado } from '@ags/shared';
   import { useCierrePatronesConsumidos } from '../../hooks/useCierrePatronesConsumidos';
   import { Button } from '../ui/Button';
   import { Input } from '../ui/Input';

   export interface CierrePatronesConsumidosSectionProps {
     otNumber: string;
     patronesSeleccionados: PatronSeleccionado[];
     onConfirmed?: () => void;
   }

   export function CierrePatronesConsumidosSection({ otNumber, patronesSeleccionados, onConfirmed }: CierrePatronesConsumidosSectionProps) {
     const ctx = useCierrePatronesConsumidos(otNumber, patronesSeleccionados);

     if (ctx.loading) return <section className="py-4 text-sm text-slate-500">Cargando patrones consumidos…</section>;

     // Skip entirely if no BOM-aware patrones in this OT
     if (!ctx.readOnly && ctx.rows.length === 0) {
       return (
         <section className="border-t border-slate-200 pt-6 mt-6">
           <h3 className="font-serif text-lg text-slate-900 mb-2">Patrones consumidos</h3>
           <p className="text-sm text-slate-500 italic">No hay patrones con BOM en esta OT. Sin descuento de componentes.</p>
         </section>
       );
     }

     return (
       <section className="border-t border-slate-200 pt-6 mt-6">
         <h3 className="font-serif text-lg text-slate-900 mb-3">Patrones consumidos</h3>

         {ctx.readOnly && ctx.readOnlyInfo && (
           <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
             <strong>Ya descontado</strong> el {ctx.readOnlyInfo.fecha} por {ctx.readOnlyInfo.creadoPor} ({ctx.readOnlyInfo.count} movimientos)
           </div>
         )}

         {ctx.error && (
           <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 mb-3">
             <strong>Error:</strong> {ctx.error}
           </div>
         )}

         {!ctx.readOnly && ctx.rows.length > 0 && (
           <>
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead>
                   <tr className="text-left text-[10px] font-mono uppercase tracking-wide text-slate-600 border-b border-slate-200">
                     <th className="py-2 pr-3">Patrón</th>
                     <th className="py-2 pr-3">Lote</th>
                     <th className="py-2 pr-3">Componente</th>
                     <th className="py-2 pr-3">Sugerido</th>
                     <th className="py-2 pr-3">Real</th>
                     <th className="py-2 pr-3">Motivo (si difiere)</th>
                     <th className="py-2 w-10"></th>
                   </tr>
                 </thead>
                 <tbody>
                   {ctx.rows.map((r, idx) => (
                     <tr key={`${r.patronId}-${r.lote}-${r.codigoComponente}-${idx}`} className="border-b border-slate-100 align-top">
                       <td className="py-2 pr-3 text-sm">{r.patronCodigo}<br /><span className="text-[10px] text-slate-500">{r.patronDescripcion}</span></td>
                       <td className="py-2 pr-3 text-sm">
                         <Input value={r.lote} onChange={e => ctx.updateRow(idx, { lote: e.target.value })} disabled={ctx.submitting} className="w-32" />
                       </td>
                       <td className="py-2 pr-3 text-sm">{r.codigoComponente}<br /><span className="text-[10px] text-slate-500">{r.descripcionComponente}</span></td>
                       <td className="py-2 pr-3 text-sm text-slate-500">{r.cantidadSugerida}</td>
                       <td className="py-2 pr-3">
                         <Input type="number" value={String(r.cantidad)} onChange={e => ctx.updateRow(idx, { cantidad: Number(e.target.value) || 0 })} disabled={ctx.submitting} className="w-20" />
                       </td>
                       <td className="py-2 pr-3">
                         {r.cantidad !== r.cantidadSugerida && (
                           <Input value={r.motivo ?? ''} onChange={e => ctx.updateRow(idx, { motivo: e.target.value })} placeholder="¿por qué difiere?" disabled={ctx.submitting} />
                         )}
                       </td>
                       <td className="py-2">
                         <button type="button" onClick={() => ctx.removeRow(idx)} disabled={ctx.submitting} className="text-rose-600 hover:text-rose-800 disabled:opacity-30" aria-label="Quitar fila">×</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             <div className="mt-4 flex items-center justify-between">
               <p className="text-[11px] text-slate-500 italic">
                 El reporte técnico queda intocable; divergencias se anotan en el motivo del movimiento.
               </p>
               <Button
                 variant="primary"
                 disabled={ctx.submitting || ctx.rows.length === 0}
                 onClick={async () => {
                   try {
                     await ctx.submit();
                     onConfirmed?.();
                   } catch { /* error already in ctx.error */ }
                 }}
               >
                 {ctx.submitting ? 'Descontando…' : 'Confirmar descuento de patrones'}
               </Button>
             </div>
           </>
         )}
       </section>
     );
   }
   ```

2. Keep file under 200 LOC.
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>Sub-component exported, renders 3 states (loading, read-only, editable), ≤ 200 LOC, type-check passes.</done>
</task>

<task type="auto">
  <name>Task 3: Wire section into OTCierreAdminSection + pass patronesSeleccionados from EditOTModal (via service, NOT raw Firestore)</name>
  <files>apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx, apps/sistema-modular/src/hooks/useEditOTForm.ts</files>
  <action>
1. Read apps/sistema-modular/src/components/ordenes-trabajo/OTCierreAdminSection.tsx in full. Identify the insertion point (after the "Notas de cierre" section, before `<CierreStockSelector />`). Add new props to the component:
   - `patronesSeleccionados?: PatronSeleccionado[]`
   - `otNumber: string` (already present per RESEARCH)
   - `onPatronesConsumidosConfirmados?: () => void`

2. Import and render the new sub-component at the insertion point:
   ```tsx
   import { CierrePatronesConsumidosSection } from './CierrePatronesConsumidosSection';
   ...
   {/* between Notas de cierre and CierreStockSelector */}
   <CierrePatronesConsumidosSection
     otNumber={otNumber}
     patronesSeleccionados={patronesSeleccionados ?? []}
     onConfirmed={onPatronesConsumidosConfirmados}
   />
   ```

3. Read apps/sistema-modular/src/hooks/useEditOTForm.ts. Existing imports are ONLY from `'../services/firebaseService'` and `'../services/personalService'` — there is NO precedent of raw `getDoc` in this hook (confirmed via grep). To stay consistent with `.claude/rules/firestore.md`, use the new service method added in Task 1:
   ```typescript
   import { ordenesTrabajoService } from '../services/firebaseService';
   // (it should already be in scope — confirm)
   ...
   // Inside the existing data-loading effect:
   const patronesSel = await ordenesTrabajoService.getPatronesSeleccionados(otNumber);
   // Add `patronesSeleccionados: PatronSeleccionado[]` to EditOTFormState
   ```
   Then surface `patronesSeleccionados` in the returned state and pass it through to `<OTCierreAdminSection patronesSeleccionados={formState.patronesSeleccionados} ... />` wherever the parent mounts the section.

4. If `ordenesTrabajoService` is NOT re-exported from `firebaseService.ts` (confirm by reading that barrel), import from `'../services/otService'` directly. Either is acceptable; align with the existing import style of the file.

5. Confirm LOC of OTCierreAdminSection: ≤ 280 (with extraction in place this should hold; if it pushes higher, extract a hook).
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>OTCierreAdminSection imports + renders CierrePatronesConsumidosSection; useEditOTForm surfaces patronesSeleccionados via ordenesTrabajoService.getPatronesSeleccionados (no raw Firestore); type-check passes.</done>
</task>

<task type="auto">
  <name>Task 4: Extend ConfigFlujosPage with usuarioRequerimientosPatronId</name>
  <files>apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx</files>
  <action>
1. Read apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx. Locate the form section that renders existing SearchableSelect for `usuarioCoordinadorOTId` (or similar). Copy that pattern.

2. Add a new field below the existing user selects:
   ```tsx
   <div>
     <label className={fieldLabel}>Requerimientos de patrón</label>
     <SearchableSelect
       value={form.usuarioRequerimientosPatronId || ''}
       onChange={v => setForm({ ...form, usuarioRequerimientosPatronId: v })}
       options={buildUserOptions(true, '(Sin responsable — los requerimientos quedan sin asignar)')}
       placeholder="Seleccionar usuario…"
       emptyMessage="No hay usuarios activos"
     />
     <p className="mt-1 text-[11px] text-slate-500">
       Recibe el Requerimiento auto-generado cuando un componente de un patrón cae bajo su stock mínimo.
     </p>
   </div>
   ```

3. Ensure the form's `setForm` setter handles the new key (it should via existing spread pattern).

4. Confirm LOC: ≤ 280 (was 257).
  </action>
  <verify>
    <automated>pnpm type-check</automated>
  </verify>
  <done>ConfigFlujosPage has the new SearchableSelect for usuarioRequerimientosPatronId; ≤ 280 LOC; type-check passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: End-to-end UAT — cierre admin descuenta patrones + idempotency + admin config</name>
  <what-built>BOM-05 end-to-end (auto-prefill, edit, confirm, idempotency on re-cierre) + BOM-08 admin config wired (usuarioRequerimientosPatronId).</what-built>
  <how-to-verify>
1. **Setup the config (BOM-08 admin)**:
   - `pnpm dev:modular`; open `/admin/config-flujos`.
   - In "Requerimientos de patrón" pick yourself (`evigna@agsanalitica.com`). Save.
2. **Prep a BOM-aware patron** (carry forward from 14-04):
   - Confirm there is at least one patron with `componentes` loaded (e.g., test patron `5182-6917` with 1 componente `amp-A` cantidadPorKit=3 stockMinimo=1) and at least one lote with `cantidad >= 1`.
3. **Create an OT that uses the patron**:
   - Use the technician PWA (reportes-ot) OR manually craft `reportes/{otNumber}.patronesSeleccionados: [{patronId:'<id>', lote:'<lote>'}]` via Firestore console.
   - Set the OT status to `CIERRE_ADMINISTRATIVO` so the cierre section renders.
4. **Open EditOTModal for that OT**:
   - Scroll to "Patrones consumidos" section (between Notas and Repuestos).
   - Verify: 1 row appears, sugerido=1 (1 ampolla por componente), lote pre-filled from the report.
5. **Edit the row**:
   - Change "Real" to `2` (admin says technician used more than reported).
   - Verify: "Motivo" input appears. Type "Técnico abrió 2 ampollas no documentadas".
6. **Confirm descuento**:
   - Click "Confirmar descuento de patrones".
   - Verify: button shows "Descontando…" briefly, then the section flips to read-only with green banner "Ya descontado".
   - Open Firestore console → `movimientosStock`: confirm 1 new doc with `entidadTipo:'patron'`, `patronId`, `lote`, `codigoComponente:'amp-A'`, `cantidad:2`, `motivo:'Divergencia admin: sugerido=1, real=2 — Técnico abrió 2 ampollas no documentadas'`.
   - Open the patron doc in Firestore: confirm `lotes[i].componentesConsumidos: [{codigoComponente:'amp-A', cantidadConsumida:2}]`.
   - Open `reportes/{otNumber}`: confirm `patronesSeleccionados` is UNCHANGED (reporte técnico intocable).
7. **Idempotency on re-cierre**:
   - Close the modal. Reopen the same OT in EditOTModal.
   - Verify: the section renders ONLY the read-only green banner ("Ya descontado el ... por ..." with 1 movimiento). No editable table.
   - If you try to call the service directly (e.g., dev console: `patronesService.consumirComponentes(...)`), it throws "Patrones ya descontados para OT X".
8. **Auto-Requerimiento (BOM-08)**:
   - In the patron editor, lower the `cantidad` of the lote to 1 (so saldo after the consumo of 2 ampollas is `1*3-2 = 1`, equal to stockMinimo=1 → triggers REQ).
   - Repeat the descuento with a different OT (otherwise idempotency blocks).
   - Verify: in `requerimientos_compra` collection, a new doc with `origen:'patron_minimo'`, `patronId`, `loteId`, `codigoComponente:'amp-A'`, `solicitadoPor: <your uid>`, `estado:'pendiente'`.
   - Try the same descuento again on a third OT (saldo still ≤ minimo): verify NO new REQ is created (idempotent skip).
9. **Legacy patron unaffected**:
   - Open a patron WITHOUT componentes loaded. Verify: nothing changes in its cierre flow; OTCierreAdminSection shows "No hay patrones con BOM en esta OT".
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues per checkpoint step (1-9).</resume-signal>
</task>

</tasks>

<verification>
- `pnpm type-check` GREEN
- `pnpm --filter @ags/sistema-modular test:patron-bom` 18/18 GREEN (after 14-04 Task 3 added 4 tests)
- Visual UAT covers 9 sub-steps spanning BOM-05 (prefill, edit, confirm, idempotency, legacy bypass) + BOM-08 (admin config + auto-req + idempotency)
- LOC budgets respected (CierrePatronesConsumidosSection ≤ 200; useCierrePatronesConsumidos ≤ 220; OTCierreAdminSection ≤ 280; ConfigFlujosPage ≤ 280)
- Hook uses service method (ordenesTrabajoService.getPatronesSeleccionados), NOT raw Firestore — confirms rule .claude/rules/firestore.md
</verification>

<success_criteria>
The full cycle works in production-like conditions: technician selects patron+lote in reportes-ot → admin opens cierre → section auto-prefills 1 ampolla per componente → admin edits if needed → confirms → 1 MovimientoStock per componente persisted with divergencia in motivo → reopening cierre shows read-only banner → if any componente crossed mínimo, auto-Requerimiento created (assigned to configured user) and idempotent on retry.
</success_criteria>

<output>
After completion, create `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-06-SUMMARY.md` documenting:
- LOC of all 5 modified/created files (now including otService.ts delta)
- Insertion point inside OTCierreAdminSection (line approx)
- Sample OT used for UAT (otNumber)
- Sample movimientos/requerimientos created (Firestore IDs)
- Confirmation: reporte técnico intocable (read confirmed by Firestore inspection)
- Confirmation: hook accesses Firestore only through ordenesTrabajoService.getPatronesSeleccionados — no raw getDoc inside hooks
- Heads-up for 14-07: reportes-ot needs the same patrón/lote that this plan worked with — make sure the test patron's bloqueado lote is visible in the technician selector.
</output>
