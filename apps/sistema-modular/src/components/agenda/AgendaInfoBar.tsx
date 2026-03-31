import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';
import type { AgendaEntry, EstadoAgenda } from '@ags/shared';
import type { SelectedCell } from '../../utils/agendaDateUtils';

const ESTADO_ORDER: EstadoAgenda[] = ['pendiente', 'tentativo', 'confirmado', 'en_progreso', 'completado', 'cancelado'];

interface AgendaInfoBarProps {
  selectedCell: SelectedCell | null;
  clipboardLabel?: string | null;
  onDeleteEntry?: (entryId: string) => void;
  onExtendEntry?: (entryId: string) => void;
  onShrinkEntry?: (entryId: string) => void;
  onSelectEntry?: (entry: AgendaEntry) => void;
  onChangeEstado?: (entryId: string, estado: EstadoAgenda) => void;
}

function EntryRange({ entry }: { entry: AgendaEntry }) {
  if (entry.fechaInicio === entry.fechaFin) {
    return <span className="text-[10px] text-slate-400">Q{entry.quarterStart}-Q{entry.quarterEnd}</span>;
  }
  return <span className="text-[10px] text-slate-400">{entry.fechaInicio} Q{entry.quarterStart} → {entry.fechaFin} Q{entry.quarterEnd}</span>;
}

export const AgendaInfoBar: FC<AgendaInfoBarProps> = ({
  selectedCell,
  clipboardLabel,
  onDeleteEntry,
  onExtendEntry,
  onShrinkEntry,
  onSelectEntry,
  onChangeEstado,
}) => {
  const entry = selectedCell?.entry ?? null;
  const allEntries = selectedCell?.allEntries ?? [];
  const hasMultiple = allEntries.length > 1;

  return (
    <div className={`shrink-0 border-b px-4 flex items-center gap-3 h-7 ${
      entry ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
    }`}>
      {selectedCell ? (
        entry ? (
          <>
            {hasMultiple && (
              <div className="flex items-center gap-0.5 border-r border-teal-200 pr-2 mr-1">
                {allEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEntry?.(e)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      e.id === entry.id
                        ? 'bg-teal-200 text-teal-800'
                        : 'text-teal-400 hover:text-teal-600 hover:bg-teal-100'
                    }`}
                  >
                    {e.otNumber || e.titulo || '—'}
                  </button>
                ))}
              </div>
            )}

            {entry.otNumber ? (
              <Link
                to={`/ordenes-trabajo/${entry.otNumber}`}
                className="text-[11px] font-semibold text-teal-700 hover:underline shrink-0"
                title="Ver OT"
              >
                OT-{entry.otNumber}
              </Link>
            ) : (
              <span className="text-[11px] font-semibold text-slate-700 shrink-0">
                {entry.titulo || 'Tarea'}
              </span>
            )}
            {entry.clienteNombre && <span className="text-[11px] text-slate-600 truncate">{entry.clienteNombre}</span>}
            {entry.tipoServicio && <span className="text-[11px] text-slate-500 truncate">{entry.tipoServicio}</span>}
            {entry.sistemaNombre && <span className="text-[11px] text-slate-400 truncate">{entry.sistemaNombre}</span>}

            {/* Estado dropdown */}
            <select
              value={entry.estadoAgenda}
              onChange={e => onChangeEstado?.(entry.id, e.target.value as EstadoAgenda)}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${ESTADO_AGENDA_COLORS[entry.estadoAgenda]}`}
            >
              {ESTADO_ORDER.map(est => (
                <option key={est} value={est}>{ESTADO_AGENDA_LABELS[est]}</option>
              ))}
            </select>

            <EntryRange entry={entry} />

            <div className="flex-1" />

            {clipboardLabel && (
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium shrink-0">
                Ctrl+V: {clipboardLabel}
              </span>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onShrinkEntry?.(entry.id)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                title="Reducir 1 cuarto"
              >
                ←
              </button>
              <button
                onClick={() => onExtendEntry?.(entry.id)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                title="Extender 1 cuarto"
              >
                →
              </button>
              <button
                onClick={() => onDeleteEntry?.(entry.id)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Eliminar asignación (Del)"
              >
                ✕
              </button>
            </div>

            <span className="text-[11px] text-slate-400 shrink-0">{selectedCell.ingenieroNombre}</span>
          </>
        ) : (
          <>
            <span className="text-[11px] font-medium text-slate-600">{selectedCell.ingenieroNombre}</span>
            <span className="text-[11px] text-slate-400">{selectedCell.fecha} Q{selectedCell.quarter}</span>
            {clipboardLabel ? (
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                Ctrl+V para pegar {clipboardLabel}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 italic">Sin asignacion</span>
            )}
          </>
        )
      ) : (
        <span className="text-[11px] text-slate-400">Seleccione una celda para ver detalles</span>
      )}
    </div>
  );
};
