import { type FC, useMemo } from 'react';
import type { Ingeniero, AgendaEntry } from '@ags/shared';
import type { GridColumn, CellOccupation } from '../../utils/agendaDateUtils';
import { AgendaGridCell } from './AgendaGridCell';

interface AgendaGridRowProps {
  ingeniero: Ingeniero;
  columns: GridColumn[];
  occupation: Map<number, CellOccupation[]>;
  showText: boolean;
  compact: boolean;
  selectedCellKey: string | null;
  rowHeight: string;
  onCellClick: (ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4) => void;
  onEntryClick: (entries: AgendaEntry[], primary: AgendaEntry) => void;
}

export const AgendaGridRow: FC<AgendaGridRowProps> = ({
  ingeniero,
  columns,
  occupation,
  showText,
  compact,
  selectedCellKey,
  rowHeight,
  onCellClick,
  onEntryClick,
}) => {
  // Utilization: occupied quarters / total quarters
  const utilPct = useMemo(() => {
    if (compact) return null;
    let occupied = 0;
    for (let i = 0; i < columns.length; i++) {
      const occs = occupation.get(i);
      if (occs && occs.length > 0 && occs[0].entry.estadoAgenda !== 'cancelado') occupied++;
    }
    return columns.length > 0 ? Math.round((occupied / columns.length) * 100) : 0;
  }, [columns, occupation, compact]);

  const utilColor = utilPct !== null
    ? utilPct > 80 ? 'text-red-500' : utilPct > 50 ? 'text-amber-500' : 'text-emerald-500'
    : '';

  return (
    <>
      {/* Engineer name + utilization */}
      <div
        className={`bg-white border-r border-r-slate-200 flex items-center px-1 truncate ${compact ? 'border-b border-b-slate-200' : 'border-b-2 border-b-slate-200'}`}
        style={{ height: rowHeight }}
        title={utilPct !== null ? `${utilPct}% ocupado` : undefined}
      >
        <span className={`${compact ? 'text-[7px]' : 'text-[10px]'} font-medium text-slate-700 truncate`}>{ingeniero.nombre}</span>
        {utilPct !== null && showText && (
          <span className={`text-[8px] font-medium ml-auto shrink-0 ${utilColor}`}>{utilPct}%</span>
        )}
      </div>

      {/* Calendar cells */}
      {columns.map((col, idx) => {
        const occs = occupation.get(idx) || [];
        const primary = occs[0];
        return (
          <AgendaGridCell
            key={idx}
            ingenieroId={ingeniero.id}
            fecha={col.dateKey}
            quarter={col.quarter}
            entry={primary?.entry}
            isStart={primary?.isStart}
            isEnd={primary?.isEnd}
            entryCount={occs.length}
            isToday={col.isToday}
            showText={showText}
            compact={compact}
            selectedCellKey={selectedCellKey}
            rowHeight={rowHeight}
            onClick={() => {
              if (occs.length > 0) onEntryClick(occs.map(o => o.entry), occs[0].entry);
              else onCellClick(ingeniero.id, col.dateKey, col.quarter);
            }}
          />
        );
      })}
    </>
  );
};
