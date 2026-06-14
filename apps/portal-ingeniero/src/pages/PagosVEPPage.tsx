import { useEffect, useMemo, useState } from 'react';
import type { Importacion } from '@ags/shared';
import { PageHeader } from '../components/ui/PageHeader';
import { importacionesService } from '../services/importacionesService';
import { buildEventos, totalPendiente, proximoPago, TIPO_LABEL, TIPO_COLOR, type EventoFlujo } from '../utils/flujoFondos';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-semibold mt-0.5 ${accent ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function EventoRow({ e }: { e: EventoFlujo }) {
  const d = new Date(e.fecha + 'T00:00:00');
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      <div className="w-11 shrink-0 text-center">
        <div className="text-base font-semibold text-slate-900 leading-none">{d.getDate()}</div>
        <div className="text-[10px] text-slate-400 uppercase">{MESES[d.getMonth()]}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLOR[e.tipo]}`}>{TIPO_LABEL[e.tipo]}</span>
          <span className="text-xs font-mono text-teal-700">{e.impNumero}</span>
        </div>
        <div className="text-xs text-slate-500 truncate mt-0.5">{e.proveedor}</div>
      </div>
      <div className="text-right shrink-0">
        {e.monto != null
          ? <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">{e.moneda} {fmt(e.monto)}</span>
          : <span className="text-[11px] text-slate-400">arribo</span>}
      </div>
    </div>
  );
}

export default function PagosVEPPage() {
  const [importaciones, setImportaciones] = useState<Importacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    importacionesService.getAll()
      .then(setImportaciones)
      .catch(err => console.error('Error cargando importaciones:', err))
      .finally(() => setLoading(false));
  }, []);

  const { futuros, girosUSD, vepARS, prox, prox30 } = useMemo(() => {
    const eventos = buildEventos(importaciones);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const futuros = eventos.filter(e => new Date(e.fecha + 'T00:00:00') >= hoy && !e.pagado);
    const limite30 = new Date(hoy.getTime() + 30 * 86400000);
    const prox30 = futuros.filter(e => e.tipo !== 'arribo' && new Date(e.fecha + 'T00:00:00') <= limite30).length;
    return {
      futuros,
      girosUSD: totalPendiente(eventos, 'giro', 'USD'),
      vepARS: totalPendiente(eventos, 'vep', 'ARS'),
      prox: proximoPago(eventos),
      prox30,
    };
  }, [importaciones]);

  const proxFecha = prox ? new Date(prox.fecha + 'T00:00:00') : null;

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Pagos VEP" subtitle="Flujo de fondos · solo consulta" count={loading ? undefined : futuros.length} />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Cargando...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Próximo pago"
                value={prox ? `${TIPO_LABEL[prox.tipo]}` : '—'}
                sub={prox ? `${proxFecha!.getDate()}-${MESES[proxFecha!.getMonth()]} · ${prox.moneda} ${fmt(prox.monto || 0)}` : 'sin pagos próximos'}
                accent="text-teal-700"
              />
              <KpiCard label="Próx. 30 días" value={String(prox30)} sub="pagos comprometidos" />
              <KpiCard label="Giros al exterior" value={`USD ${fmt(girosUSD)}`} sub="pendientes" accent="text-teal-700" />
              <KpiCard label="VEP pendientes" value={`ARS ${fmt(vepARS)}`} sub="pendientes" accent="text-amber-700" />
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2 px-1">Próximos pagos</p>
              {futuros.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                  Sin pagos ni arribos próximos
                </div>
              ) : (
                <div className="space-y-2">
                  {futuros.map(e => <EventoRow key={e.id} e={e} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
