import type { Presupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_COLORS, ESTADO_PRESUPUESTO_LABELS, MONEDA_SIMBOLO, OT_ESTADO_LABELS } from '@ags/shared';
import type { PresupuestoControlRow } from '../../hooks/useControlSemanal';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

interface Props {
  rows: PresupuestoControlRow[];
  kpis: { conTrabajo: number; listosSinAviso: number; esperandoOTs: number; sinOC: number; anticipadas: number };
  mostrarEnviados: boolean;
  onToggleEnviados: (v: boolean) => void;
  onOpenPresupuesto: (id: string) => void;
  onGenerarAviso: (p: Presupuesto) => void;
  /** id del ppto cuyo aviso se está generando (deshabilita el botón). */
  generandoId: string | null;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const Kpi = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`text-base font-black leading-none ${tone}`}>{value}</p>
  </div>
);

const QueFalta = ({ row }: { row: PresupuestoControlRow }) => {
  if (row.avisoEnviado) return <p className="text-[10px] text-emerald-600 font-medium">✓ Aviso enviado</p>;
  const items: React.ReactNode[] = [];
  if (row.pagoAnticipado) {
    items.push(
      <p key="anticipo" className="text-[10px] text-purple-700 font-medium">
        Pago anticipado — se factura antes del servicio (ej. esperando ingreso de importación)
      </p>,
    );
  }
  if (row.otsPendientes.length > 0) {
    items.push(
      <p key="ots" className="text-[10px] text-red-600">
        Pendiente cierre: {row.otsPendientes
          .map(o => `${o.otNumber} (${o.estadoAdmin ? OT_ESTADO_LABELS[o.estadoAdmin] : 'Sin estado'})`)
          .join(', ')}
      </p>,
    );
  }
  if (row.sinOC) items.push(<p key="oc" className="text-[10px] text-amber-600">Pendiente OC del cliente</p>);
  if (row.listoParaAviso) items.push(<p key="listo" className="text-[10px] text-teal-700 font-medium">Listo — falta generar el aviso</p>);
  if (items.length === 0) return <span className="text-[10px] text-slate-300">—</span>;
  return <div className="space-y-0.5">{items}</div>;
};

export const PresupuestosControlSection: React.FC<Props> = ({
  rows, kpis, mostrarEnviados, onToggleEnviados, onOpenPresupuesto, onGenerarAviso, generandoId,
}) => {
  const enviados = rows.filter(r => r.avisoEnviado);
  const visibles = mostrarEnviados ? rows : rows.filter(r => !r.avisoEnviado);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
          2 · Presupuestos con trabajo realizado o pago anticipado — pendientes a hoy (no limita por semana)
        </p>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarEnviados}
            onChange={e => onToggleEnviados(e.target.checked)}
            className="rounded border-slate-300"
          />
          Mostrar enviados ({enviados.length})
        </label>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Kpi label="En control" value={kpis.conTrabajo} tone="text-slate-700" />
        <Kpi label="Listos sin aviso" value={kpis.listosSinAviso} tone="text-teal-700" />
        <Kpi label="Esperando otras OTs" value={kpis.esperandoOTs} tone="text-red-600" />
        <Kpi label="Sin OC del cliente" value={kpis.sinOC} tone="text-amber-600" />
        <Kpi label="Pago anticipado" value={kpis.anticipadas} tone="text-purple-700" />
      </div>

      {visibles.length === 0 ? (
        <EmptyState message={rows.length === 0
          ? 'Ningún presupuesto con OTs cerradas ni pago anticipado pendiente de facturación'
          : 'Todos los avisos a facturación fueron enviados'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className={thClass}>Presupuesto</th>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Total</th>
                <th className={thClass}>Estado</th>
                <th className={thClass}>Qué falta</th>
                <th className={`${thClass} text-right`}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(row => {
                const p = row.presupuesto;
                const sym = MONEDA_SIMBOLO[p.moneda as keyof typeof MONEDA_SIMBOLO] || '$';
                return (
                  <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${row.avisoEnviado ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => onOpenPresupuesto(p.id)}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                        title="Abrir el presupuesto"
                      >
                        {p.numero}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[180px]">{row.clienteNombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {sym} {(p.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <StatusBadge
                          label={ESTADO_PRESUPUESTO_LABELS[p.estado]}
                          colorClass={ESTADO_PRESUPUESTO_COLORS[p.estado]}
                        />
                        {row.pagoAnticipado && (
                          <span
                            className="text-[9px] font-mono font-semibold uppercase tracking-wide bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5"
                            title="Condición de pago anticipada — se factura antes del servicio"
                          >
                            Anticip.
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2"><QueFalta row={row} /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.listoParaAviso && (
                        <Button
                          size="sm"
                          onClick={() => onGenerarAviso(p)}
                          disabled={generandoId !== null}
                        >
                          {generandoId === p.id ? 'Generando…' : 'Generar aviso'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
