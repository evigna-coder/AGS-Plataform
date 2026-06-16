import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Importacion } from '@ags/shared';
import { buildEventos, totalPendiente, proximoPago, groupByMes, TIPO_LABEL, TIPO_COLOR, type EventoFlujo, type MesFlujo } from '@ags/shared';
import { importacionesService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-semibold mt-0.5 ${accent ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function MesCard({ mes, onOpen }: { mes: MesFlujo; onOpen: (e: EventoFlujo) => void }) {
  return (
    <Card compact>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800 capitalize">{mes.label}</p>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {mes.subtotales.map(s => (
            <span key={`${s.tipo}-${s.moneda}`} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLOR[s.tipo]}`}>
              {TIPO_LABEL[s.tipo]} {s.moneda} {fmt(s.monto)}
            </span>
          ))}
        </div>
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-slate-50">
          {mes.eventos.map(e => {
            const d = new Date(e.fecha + 'T00:00:00');
            return (
              <tr key={e.id} onClick={() => onOpen(e)} className="hover:bg-slate-50 cursor-pointer">
                <td className="py-1.5 pr-2 w-16 whitespace-nowrap font-mono text-slate-500">{d.getDate()} {MESES[d.getMonth()]}</td>
                <td className="py-1.5 pr-2 w-16">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLOR[e.tipo]}`}>{TIPO_LABEL[e.tipo]}</span>
                </td>
                <td className="py-1.5 pr-2 font-mono text-teal-700 whitespace-nowrap">OC {e.ocNumero}</td>
                <td className="py-1.5 pr-2 text-slate-600 truncate max-w-[220px]">{e.proveedor}</td>
                <td className="py-1.5 pl-2 text-right font-mono text-slate-800 whitespace-nowrap">
                  {e.monto != null ? `${e.moneda} ${fmt(e.monto)}` : <span className="text-slate-300">arribo</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export const PagosVEPPage = () => {
  const navigate = useNavigate();
  const [importaciones, setImportaciones] = useState<Importacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    importacionesService.getAll()
      .then(setImportaciones)
      .catch(err => console.error('Error cargando importaciones:', err))
      .finally(() => setLoading(false));
  }, []);

  const { meses, girosUSD, girosEUR, vepARS, prox, futurosCount } = useMemo(() => {
    const eventos = buildEventos(importaciones);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const futuros = eventos.filter(e => new Date(e.fecha + 'T00:00:00') >= hoy && !e.pagado);
    return {
      meses: groupByMes(futuros),
      girosUSD: totalPendiente(eventos, 'giro', 'USD'),
      girosEUR: totalPendiente(eventos, 'giro', 'EUR'),
      vepARS: totalPendiente(eventos, 'vep', 'ARS'),
      prox: proximoPago(eventos),
      futurosCount: futuros.length,
    };
  }, [importaciones]);

  const proxFecha = prox ? new Date(prox.fecha + 'T00:00:00') : null;
  const openEvento = (e: EventoFlujo) => navigate(`/stock/importaciones/${e.impId}`);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Pagos VEP" subtitle="Flujo de fondos comercio exterior — VEP, giros y arribos por mes"
        count={loading ? undefined : futurosCount} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Cargando...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Próximo pago"
                value={prox ? TIPO_LABEL[prox.tipo] : '—'}
                sub={prox ? `${proxFecha!.getDate()}-${MESES[proxFecha!.getMonth()]} · ${prox.moneda} ${fmt(prox.monto || 0)}` : 'sin pagos próximos'}
                accent="text-teal-700" />
              <Kpi label="Giros al exterior" value={`USD ${fmt(girosUSD)}`} sub={girosEUR > 0 ? `+ EUR ${fmt(girosEUR)}` : 'pendientes'} accent="text-teal-700" />
              <Kpi label="VEP pendientes" value={`ARS ${fmt(vepARS)}`} sub="a pagar a aduana" accent="text-amber-700" />
              <Kpi label="Eventos próximos" value={String(futurosCount)} sub="VEP + giros + arribos" />
            </div>

            {meses.length === 0 ? (
              <Card compact>
                <p className="text-center py-10 text-sm text-slate-400">Sin pagos ni arribos próximos</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {meses.map(m => <MesCard key={m.mes} mes={m} onOpen={openEvento} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
