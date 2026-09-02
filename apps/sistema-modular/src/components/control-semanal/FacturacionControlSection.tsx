import { MONEDA_SIMBOLO, SOLICITUD_FACTURACION_ESTADO_COLORS, SOLICITUD_FACTURACION_ESTADO_LABELS } from '@ags/shared';
import type { FacturacionControlRow } from '../../hooks/useControlSemanal';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ComentarioInline } from './ComentarioInline';
import { DiasTrabado } from './DiasTrabado';

interface Props {
  rows: FacturacionControlRow[];
  kpis: { sinFacturar: number; facturadasSemana: number; montoSinFacturar: Record<string, number> };
  onOpenSolicitud: (id: string) => void;
  /** Comentario de ADMINISTRACIÓN sobre una solicitud (por qué no se facturó, etc.). */
  onSaveComentario: (solicitudId: string, comentario: string) => Promise<void>;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const Kpi = ({ label, value, tone }: { label: string; value: string | number; tone: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`text-base font-black leading-none ${tone}`}>{value}</p>
  </div>
);

const fmtFecha = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

/**
 * Sección 3 del control semanal (2026-08-05): el cruce de ADMINISTRACIÓN —
 * todo lo que soporte pasó a facturar (solicitudes de facturación), ¿se
 * facturó? Las sin facturar quedan a la vista todas las semanas hasta que se
 * facturen, con comentario del porqué; las facturadas de la semana confirman
 * el cruce.
 */
export const FacturacionControlSection: React.FC<Props> = ({ rows, kpis, onOpenSolicitud, onSaveComentario }) => {
  const sinFacturar = rows.filter(r => !r.facturada);
  const facturadas = rows.filter(r => r.facturada);

  const montoLabel = Object.entries(kpis.montoSinFacturar)
    .map(([m, t]) => `${MONEDA_SIMBOLO[m as keyof typeof MONEDA_SIMBOLO] || '$'} ${t.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
    .join(' + ') || '—';

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
        3 · Cruce con facturación: lo pasado a facturar vs lo facturado (administración)
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Sin facturar" value={kpis.sinFacturar} tone={kpis.sinFacturar > 0 ? 'text-red-600' : 'text-emerald-600'} />
        <Kpi label="Facturadas esta semana" value={kpis.facturadasSemana} tone="text-emerald-600" />
        <Kpi label="Monto sin facturar" value={montoLabel} tone="text-slate-700" />
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No hay avisos a facturación pendientes ni facturas de esta semana" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="tabla-compacta w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className={thClass}>Pasado el</th>
                <th className={thClass}>En facturación</th>
                <th className={thClass}>Presupuesto</th>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Monto</th>
                <th className={thClass}>OTs</th>
                <th className={thClass}>Estado</th>
                <th className={thClass}>N° factura</th>
                <th className={`${thClass} w-64`}>Comentario (administración)</th>
              </tr>
            </thead>
            <tbody>
              {[...sinFacturar, ...facturadas].map(({ solicitud: s, facturada, diasTrabado, desdeQue }) => {
                const sym = MONEDA_SIMBOLO[s.moneda as keyof typeof MONEDA_SIMBOLO] || '$';
                return (
                  <tr key={s.id} className={`border-b border-slate-100 last:border-0 ${facturada ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">{fmtFecha(s.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <DiasTrabado dias={diasTrabado} desdeQue={desdeQue} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => onOpenSolicitud(s.id)}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                        title="Abrir el aviso a facturación"
                      >
                        {s.presupuestoNumero}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[160px]">{s.clienteNombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {sym} {(s.montoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">
                      {s.otNumbers?.length ? s.otNumbers.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusBadge
                        label={SOLICITUD_FACTURACION_ESTADO_LABELS[s.estado]}
                        colorClass={SOLICITUD_FACTURACION_ESTADO_COLORS[s.estado]}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap">{s.numeroFactura || '—'}</td>
                    <td className="px-3 py-2">
                      {facturada
                        ? <span className="text-[10px] text-slate-400">{s.comentarioControl || '—'}</span>
                        : <ComentarioInline id={s.id} valor={s.comentarioControl || ''}
                            placeholder="Comentario de administración…" onSave={onSaveComentario} />}
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
