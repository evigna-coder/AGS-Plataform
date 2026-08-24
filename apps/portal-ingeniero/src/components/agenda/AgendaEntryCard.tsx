import { Link } from 'react-router-dom';
import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';
import { EnvioEmailBadge } from '../ui/EnvioEmailBadge';
import type { OTInfoAgenda } from '../../hooks/useOTsAgenda';

const QUARTER_LABELS: Record<number, string> = { 1: 'AM1', 2: 'AM2', 3: 'PM1', 4: 'PM2' };

interface Props {
  entry: AgendaEntry;
  showEngineer?: boolean;
  /** Cierre y envío al cliente de la OT. Ausente = todavía no cargó. */
  otInfo?: OTInfoAgenda;
}

export default function AgendaEntryCard({ entry, showEngineer, otInfo }: Props) {
  const statusColor = ESTADO_AGENDA_COLORS[entry.estadoAgenda] ?? 'bg-slate-200 text-slate-700';
  const borderColor: Record<string, string> = {
    pendiente: 'border-l-slate-400',
    tentativo: 'border-l-amber-400',
    confirmado: 'border-l-blue-500',
    en_progreso: 'border-l-teal-500',
    completado: 'border-l-emerald-500',
    cancelado: 'border-l-red-400',
  };

  // Una OT cerrada se ATENÚA en vez de recibir un color propio: el borde
  // izquierdo ya codifica los seis estados de coordinación, y un séptimo color
  // competiría con esa lectura. La opacidad es otra dimensión y convive
  // (2026-08-23). Sigue visible y clickeable — lo hecho no se esconde, pasa a
  // segundo plano para que lo pendiente salga al frente.
  const cerrada = otInfo?.cerrada === true;
  const fondo = cerrada ? 'bg-slate-50 opacity-70' : 'bg-white';

  // Con OT vinculada, TODA la card navega al detalle (tap target mobile).
  const cardCls = `block ${fondo} rounded-xl border border-slate-200 border-l-4 ${borderColor[entry.estadoAgenda] ?? 'border-l-slate-400'} p-3 space-y-1.5`;
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-slate-400">
          {QUARTER_LABELS[entry.quarterStart]} – {QUARTER_LABELS[entry.quarterEnd]}
        </span>
        <div className="flex items-center gap-1.5">
          {showEngineer && entry.ingenieroNombre && (
            <span className="text-[9px] font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">
              {entry.ingenieroNombre.split(' ')[0]}
            </span>
          )}
          {cerrada && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600"
              title="La orden ya tiene cierre técnico">
              ✓ Cerrada
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor}`}>
            {ESTADO_AGENDA_LABELS[entry.estadoAgenda]}
          </span>
        </div>
      </div>
      <div>
        {entry.otNumber ? (
          <>
            <span className="text-xs font-semibold text-teal-600">OT {entry.otNumber}</span>
            {entry.clienteNombre && (
              <p className="text-xs text-slate-800 font-medium mt-0.5">{entry.clienteNombre}</p>
            )}
          </>
        ) : (
          <p className="text-xs font-semibold text-slate-700">{entry.titulo || 'Tarea'}</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
        {entry.tipoServicio && <span>{entry.tipoServicio}</span>}
        {entry.sistemaNombre && (
          <>
            <span className="text-slate-300">·</span>
            <span>{entry.sistemaNombre}</span>
          </>
        )}
        {entry.equipoModelo && (
          <>
            <span className="text-slate-300">·</span>
            <span>{entry.equipoModelo}</span>
          </>
        )}
        {entry.equipoAgsId && (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[10px]">{entry.equipoAgsId}</span>
          </>
        )}
      </div>
      {entry.establecimientoNombre && (
        <p className="text-[11px] text-slate-400">{entry.establecimientoNombre}</p>
      )}
      {entry.notas && (
        <p className="text-[11px] text-slate-500 italic line-clamp-2">{entry.notas}</p>
      )}
      {/* Solo con la OT cerrada: antes de que el reporte exista, "Sin envío"
          sería ruido en todas las visitas futuras. Es de lectura — para marcar
          el envío a mano está el historial; un botón acá viviría adentro del
          Link de la card. */}
      {cerrada && (
        <div className="pt-0.5">
          <EnvioEmailBadge envio={otInfo?.envio} envioManual={otInfo?.envioManual} />
        </div>
      )}
    </>
  );

  return entry.otNumber ? (
    <Link to={`/ordenes-trabajo/${entry.otNumber}`} className={`${cardCls} hover:border-teal-400 active:bg-teal-50/50 transition-colors`}>
      {inner}
    </Link>
  ) : (
    <div className={cardCls}>{inner}</div>
  );
}
