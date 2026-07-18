import type { WorkOrder } from '@ags/shared';
import type { PresupuestoVinculado, MaterialServicio, ReservaServicio } from '../../../hooks/useOTVinculos';
import { GCard, FRow } from './atoms';

/** Presupuestos vinculados (budgets[]) + OCs del cliente. */
export function PresupuestoOCCard({ ot, presupuestos }: { ot: WorkOrder; presupuestos: PresupuestoVinculado[] }) {
  // OCs cargadas directo en la OT (legacy + múltiples) que no estén ya via presupuesto
  const ocsPresupuestos = new Set(presupuestos.flatMap(p => p.ocNumeros));
  const ocsOT = [...(ot.ordenesCompra ?? []), ...(ot.ordenCompra ? [ot.ordenCompra] : [])]
    .filter((oc, i, arr) => oc && arr.indexOf(oc) === i && !ocsPresupuestos.has(oc));

  if (presupuestos.length === 0 && ocsOT.length === 0) return null;

  return (
    <GCard label="Presupuesto / OC">
      {presupuestos.map(p => (
        <div key={p.numero}>
          <FRow k="Presupuesto">
            <span className="font-mono text-xs font-semibold text-teal-900">{p.numero}</span>
            {p.estado && <span className="ml-2 text-[11px] text-slate-500 capitalize">{p.estado.replace(/_/g, ' ')}</span>}
          </FRow>
          {p.ocNumeros.map(oc => <FRow key={oc} k="OC cliente" mono>{oc}</FRow>)}
        </div>
      ))}
      {ocsOT.map(oc => <FRow key={oc} k="OC cliente" mono>{oc}</FRow>)}
    </GCard>
  );
}

/** Materiales del servicio: items con stock de los presupuestos + unidades reservadas. */
export function MaterialesCard({ materiales, reservas }: { materiales: MaterialServicio[]; reservas: ReservaServicio[] }) {
  if (materiales.length === 0 && reservas.length === 0) return null;
  return (
    <GCard label="Materiales para el servicio">
      {materiales.map((m, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2 border-b border-slate-200 last:border-b-0 text-[13.5px]">
          <span className="font-mono text-[11px] font-semibold text-teal-900 bg-teal-50 rounded-md px-1.5 py-px shrink-0">
            {m.cantidad}×
          </span>
          <span className="flex-1 min-w-0 text-slate-800">{m.descripcion}</span>
          {m.codigo && <span className="font-mono text-[11px] text-slate-500 shrink-0">{m.codigo}</span>}
        </div>
      ))}
      {reservas.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">Reservado en stock</p>
          {reservas.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5 text-[13px]">
              <span className="font-mono text-[11px] font-semibold text-teal-900 bg-teal-50 rounded-md px-1.5 py-px shrink-0">
                {r.cantidad}×
              </span>
              <span className="flex-1 min-w-0 text-slate-800">{r.descripcion}</span>
              {(r.nroSerie || r.nroLote) && (
                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                  {r.nroSerie ? `S/N ${r.nroSerie}` : `Lote ${r.nroLote}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </GCard>
  );
}

/** Problema / falla reportada por el cliente. */
export function ProblemaCard({ ot }: { ot: WorkOrder & { problemaFallaInicial?: string } }) {
  if (!ot.problemaFallaInicial) return null;
  return (
    <GCard label="Problema reportado" amber>
      <p className="text-[13px] text-amber-900 leading-relaxed whitespace-pre-wrap">{ot.problemaFallaInicial}</p>
    </GCard>
  );
}
