import { type FC } from 'react';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';
import type { AgendaEntry } from '@ags/shared';
import type { SelectedCell } from '../../utils/agendaDateUtils';

interface AgendaInfoBarProps {
  selectedCell: SelectedCell | null;
  clipboardLabel?: string | null;
  onDeleteEntry?: (entryId: string) => void;
  onExtendEntry?: (entryId: string) => void;
  onShrinkEntry?: (entryId: string) => void;
  onSelectEntry?: (entry: AgendaEntry) => void;
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
}) => {
  const entry = selectedCell?.entry ?? null;
  const allEntries = selectedCell?.allEntries ?? [];
  const hasMultiple = allEntries.length > 1;

  return (
    <div className={`shrink-0 border-b px-4 flex items-center gap-3 h-7 ${
      entry ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
    }`}>
      {selectedCell ? (
        entry ? (
          <>
            {hasMultiple && (
              <div className="flex items-center gap-0.5 border-r border-indigo-200 pr-2 mr-1">
                {allEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEntry?.(e)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      e.id === entry.id
                        ? 'bg-indigo-200 text-indigo-800'
                        : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {e.otNumber}
                  </button>
                ))}
              </div>
            )}

            <span className="text-[11px] font-semibold text-indigo-700">OT-{entry.otNumber}</span>
            <span className="text-[11px] text-slate-600">{entry.clienteNombre}</span>
            <span className="text-[11px] text-slate-500">{entry.tipoServicio}</span>
            {entry.sistemaNombre && <span className="text-[11px] text-slate-400">{entry.sistemaNombre}</span>}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_AGENDA_COLORS[entry.estadoAgenda]}`}>
              {ESTADO_AGENDA_LABELS[entry.estadoAgenda]}
            </span>
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
