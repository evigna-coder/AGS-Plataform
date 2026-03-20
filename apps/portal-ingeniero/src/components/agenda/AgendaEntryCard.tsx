import { Link } from 'react-router-dom';
import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';

const QUARTER_LABELS: Record<number, string> = { 1: 'AM1', 2: 'AM2', 3: 'PM1', 4: 'PM2' };

interface Props {
  entry: AgendaEntry;
}

export default function AgendaEntryCard({ entry }: Props) {
  const statusColor = ESTADO_AGENDA_COLORS[entry.estadoAgenda] ?? 'bg-slate-200 text-slate-700';
  const borderColor: Record<string, string> = {
    pendiente: 'border-l-slate-400',
    tentativo: 'border-l-amber-400',
    confirmado: 'border-l-blue-500',
    en_progreso: 'border-l-indigo-500',
    completado: 'border-l-emerald-500',
    cancelado: 'border-l-red-400',
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor[entry.estadoAgenda] ?? 'border-l-slate-400'} p-3 space-y-1.5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-slate-400">
          {QUARTER_LABELS[entry.quarterStart]} – {QUARTER_LABELS[entry.quarterEnd]}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor}`}>
          {ESTADO_AGENDA_LABELS[entry.estadoAgenda]}
        </span>
      </div>
      <div>
        <Link
          to={`/ordenes-trabajo/${entry.otNumber}`}
          className="text-xs font-semibold text-indigo-600 hover:underline"
        >
          OT {entry.otNumber}
        </Link>
        <p className="text-xs text-slate-800 font-medium mt-0.5">{entry.clienteNombre}</p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        {entry.tipoServicio && <span>{entry.tipoServicio}</span>}
        {entry.sistemaNombre && (
          <>
            <span className="text-slate-300">·</span>
            <span>{entry.sistemaNombre}</span>
          </>
        )}
      </div>
      {entry.establecimientoNombre && (
        <p className="text-[11px] text-slate-400">{entry.establecimientoNombre}</p>
      )}
      {entry.notas && (
        <p className="text-[11px] text-slate-500 italic line-clamp-2">{entry.notas}</p>
      )}
    </div>
  );
}
