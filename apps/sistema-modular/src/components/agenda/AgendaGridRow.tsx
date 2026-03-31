import { memo, useMemo } from 'react';
import type { Ingeniero, AgendaEntry } from '@ags/shared';
import type { GridColumn, CellOccupation, SelectionRange } from '../../utils/agendaDateUtils';
import { isCellInRange } from '../../utils/agendaDateUtils';
import { AgendaGridCell } from './AgendaGridCell';

interface AgendaGridRowProps {
  ingeniero: Ingeniero;
  columns: GridColumn[];
  occupation: Map<number, CellOccupation[]>;
  showText: boolean;
  compact: boolean;
  selectedCellKey: string | null;
  selectionRange: SelectionRange | null;
  feriados?: Set<string>;
  rowHeight: string;
  onCellClick: (ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4, shiftKey?: boolean) => void;
  onEntryClick: (entries: AgendaEntry[], primary: AgendaEntry) => void;
  onCellContextMenu?: (ingenieroId: string, fecha: string, quarter: 1|2|3|4, e: React.MouseEvent) => void;
}

export const AgendaGridRow = memo<AgendaGridRowProps>(({
  ingeniero,
  columns,
  occupation,
  showText,
  compact,
  selectedCellKey,
  selectionRange,
  feriados,
  rowHeight,
  onCellClick,
  onEntryClick,
  onCellContextMenu,
}) => {
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

      {columns.map((col, idx) => {
        const occs = occupation.get(idx) || [];
        const primary = occs[0];
        const entry = primary?.entry;
        const cellKey = `${ingeniero.id}:${col.dateKey}:${col.quarter}`;
        return (
          <AgendaGridCell
            key={idx}
            ingenieroId={ingeniero.id}
            fecha={col.dateKey}
            quarter={col.quarter}
            entryId={entry?.id}
            entryOtNumber={entry?.otNumber}
            entryTitulo={entry?.titulo}
            entryEstado={entry?.estadoAgenda}
            entryClienteNombre={entry?.clienteNombre}
            entryTipoServicio={entry?.tipoServicio}
            entrySistemaNombre={entry?.sistemaNombre}
            entryNotas={entry?.notas}
            entryRef={entry}
            isStart={primary?.isStart}
            isEnd={primary?.isEnd}
            entryCount={occs.length}
            isToday={col.isToday}
            isFeriado={feriados?.has(col.dateKey)}
            showText={showText}
            compact={compact}
            isSelected={selectedCellKey === cellKey}
            inSelectionRange={isCellInRange(ingeniero.id, col.dateKey, col.quarter, selectionRange)}
            rowHeight={rowHeight}
            onClick={(e?: React.MouseEvent) => {
              if (occs.length > 0) onEntryClick(occs.map(o => o.entry), occs[0].entry);
              else onCellClick(ingeniero.id, col.dateKey, col.quarter, e?.shiftKey);
            }}
            onContextMenu={onCellContextMenu ? (e) => onCellContextMenu(ingeniero.id, col.dateKey, col.quarter, e) : undefined}
          />
        );
      })}
    </>
  );
});
