import type { Presupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_COLORS, ESTADO_PRESUPUESTO_LABELS, MONEDA_SIMBOLO, OT_ESTADO_LABELS } from '@ags/shared';
import type { PresupuestoControlRow } from '../../hooks/useControlSemanal';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { ComentarioInline } from './ComentarioInline';
import { DiasTrabado } from './DiasTrabado';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

/** Por qué este presupuesto está en el control y qué falta para sacarlo. */
const QueFalta = ({ row }: { row: PresupuestoControlRow }) => {
  if (row.facturadoEstaSemana) return <p className="text-[10px] text-emerald-700 font-semibold">✓ Facturado esta semana</p>;
  if (row.avisoEnviado) return <p className="text-[10px] text-emerald-600 font-medium">✓ Aviso enviado</p>;
  const items: React.ReactNode[] = [];
  // Aviso parcial (2026-08-20): se pasó una parte a facturar y falta el resto.
  // Antes desaparecía del control como si estuviera resuelto.
  if (row.avisoParcialPct != null) {
    items.push(
      <p key="parcial" className="text-[10px] text-amber-700 font-medium">
        Aviso PARCIAL — {row.avisoParcialPct}% pasado a facturar, falta el {Math.max(0, 100 - row.avisoParcialPct)}%
      </p>,
    );
  }
  if (row.pagoAnticipado) {
    items.push(
      <p key="anticipo" className="text-[10px] text-purple-700 font-medium">
        Pago anticipado — se factura antes del servicio (ej. esperando ingreso de importación)
      </p>,
    );
  }
  if (row.sinAceptar) {
    items.push(
      <p key="sinaceptar" className="text-[10px] text-violet-700 font-medium">
        OT realizada con presupuesto sin aceptar — completar precios y aceptarlo
      </p>,
    );
  }
  // Sin NINGUNA OT agendada (2026-08-15). Son dos situaciones con dos acciones
  // distintas y se nombran distinto: crear la OT, o coordinar la que ya existe.
  if (row.sinOtAgendada) {
    items.push(row.otsSinAgendar.length > 0 ? (
      <p key="sinot" className="text-[10px] text-orange-600 font-medium">
        OT creada sin agendar: {row.otsSinAgendar.map(n => `OT-${n}`).join(', ')} — coordinar en agenda
      </p>
    ) : (
      <p key="sinot" className="text-[10px] text-orange-600 font-medium">
        Sin OT creada — crear la OT o entregar las partes
      </p>
    ));
  }
  if (row.entregasPendientes.length > 0) {
    items.push(
      <p key="entregas" className="text-[10px] text-orange-600 font-medium">
        Entrega de partes pendiente: {row.entregasPendientes.map(n => `OT-${n}`).join(', ')}
      </p>,
    );
  }
  // Agendada para otra semana: no es pendiente de coordinar, está resuelta —
  // se dice cuándo y listo (2026-08-15).
  if (row.agendadaOtraSemana) {
    const [a, m, d] = row.agendadaOtraSemana.split('-');
    items.push(
      <p key="otrasemana" className="text-[10px] text-slate-400">
        Agendada para el {d}/{m}/{a}
      </p>,
    );
  }
  if (row.otsEnSemana.length > 0) {
    items.push(
      <p key="semana" className="text-[10px] text-teal-700">
        Agendada esta semana: {row.otsEnSemana.map(n => `OT-${n}`).join(', ')}
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

interface Props {
  rows: PresupuestoControlRow[];
  onOpenPresupuesto: (id: string) => void;
  onGenerarAviso: (p: Presupuesto) => void;
  generandoId: string | null;
  onSaveComentario: (presupuestoId: string, comentario: string) => Promise<void>;
  /** Saca el presupuesto del control de esta semana (lo pendiente se resolvió después). */
  onExcluir?: (presupuestoId: string) => void;
}

/** Tabla de presupuestos del control. Se instancia dos veces: lo de la semana
 *  y el arrastre (2026-08-15). */
export const PresupuestosControlTabla: React.FC<Props> = ({
  rows, onOpenPresupuesto, onGenerarAviso, generandoId, onSaveComentario, onExcluir,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
    <table className="tabla-compacta w-full">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className={thClass}>Presupuesto</th>
          <th className={thClass}>Cliente</th>
          <th className={thClass}>Total</th>
          <th className={thClass}>Estado</th>
          <th className={thClass}>Sin facturar</th>
          <th className={thClass}>Qué falta</th>
          <th className={`${thClass} w-56`}>Comentario (soporte)</th>
          <th className={`${thClass} text-right`}>Acción</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const p = row.presupuesto;
          const sym = MONEDA_SIMBOLO[p.moneda as keyof typeof MONEDA_SIMBOLO] || '$';
          return (
            <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${row.avisoEnviado ? 'bg-emerald-50/40' : ''}`}>
              <td className="px-3 py-2 whitespace-nowrap">
                <button onClick={() => onOpenPresupuesto(p.id)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                  title="Abrir el presupuesto">
                  {p.numero}
                </button>
              </td>
              <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[180px]"
                title={row.establecimientoNombre ? `${row.clienteNombre} (${row.establecimientoNombre})` : row.clienteNombre}>
                {row.clienteNombre}
                {row.establecimientoNombre && (
                  <span className="text-slate-400"> ({row.establecimientoNombre})</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                {sym} {(p.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <StatusBadge label={ESTADO_PRESUPUESTO_LABELS[p.estado]} colorClass={ESTADO_PRESUPUESTO_COLORS[p.estado]} />
                  {row.pagoAnticipado && (
                    <span className="text-[9px] font-mono font-semibold uppercase tracking-wide bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5"
                      title="Condición de pago anticipada — se factura antes del servicio">
                      Anticip.
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <DiasTrabado dias={row.diasTrabado} desdeQue={row.desdeQue} />
              </td>
              <td className="px-3 py-2"><QueFalta row={row} /></td>
              <td className="px-3 py-2">
                <ComentarioInline id={p.id} valor={p.comentarioControlSemanal || ''}
                  placeholder="Comentario…" onSave={onSaveComentario} />
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {row.listoParaAviso && (
                  <Button size="sm" onClick={() => onGenerarAviso(p)} disabled={generandoId !== null}>
                    {generandoId === p.id ? 'Generando…' : 'Generar aviso'}
                  </Button>
                )}
                {/* Quitar (2026-08-19): el ppto se arrastra mientras tenga algo
                    pendiente. Si eso se resolvió después, sale de la foto de la
                    semana que pasó y sigue en las demás. */}
                {onExcluir && (
                  <button onClick={() => onExcluir(p.id)}
                    title="Sacar del control de esta semana — sigue figurando en las demás"
                    className="ml-2 text-[10px] text-slate-300 hover:text-red-600 hover:underline">
                    Quitar
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
