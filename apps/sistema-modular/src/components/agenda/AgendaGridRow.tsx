import { type FC } from 'react';
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
  return (
    <>
      {/* Engineer name */}
      <div
        className={`bg-white border-r border-r-slate-200 flex items-center px-1 truncate ${compact ? 'border-b border-b-slate-200' : 'border-b-2 border-b-slate-200'}`}
        style={{ height: rowHeight }}
      >
        <span className={`${compact ? 'text-[7px]' : 'text-[10px]'} font-medium text-slate-700 truncate`}>{ingeniero.nombre}</span>
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
