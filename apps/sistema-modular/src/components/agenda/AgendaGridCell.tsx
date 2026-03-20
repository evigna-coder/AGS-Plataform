import { type FC, useCallback } from 'react';
import type { AgendaEntry, EstadoAgenda } from '@ags/shared';
import { useDroppable, useDraggable } from '@dnd-kit/core';
// CSS utility no longer needed — we use DragOverlay instead of transforming the source cell

const CELL_BG: Record<EstadoAgenda, string> = {
  pendiente: 'bg-slate-300',
  tentativo: 'bg-amber-300',
  confirmado: 'bg-blue-300',
  en_progreso: 'bg-indigo-300',
  completado: 'bg-emerald-300',
  cancelado: 'bg-red-200',
};

const CELL_TEXT: Record<EstadoAgenda, string> = {
  pendiente: 'text-slate-800',
  tentativo: 'text-amber-900',
  confirmado: 'text-blue-900',
  en_progreso: 'text-indigo-900',
  completado: 'text-emerald-900',
  cancelado: 'text-red-700',
};

interface AgendaGridCellProps {
  ingenieroId: string;
  fecha: string;
  quarter: 1 | 2 | 3 | 4;
  entry?: AgendaEntry;
  isStart?: boolean;
  isEnd?: boolean;
  entryCount?: number;
  isToday?: boolean;
  showText?: boolean;
  compact?: boolean;
  selectedCellKey: string | null;
  rowHeight: string;
  onClick?: () => void;
}

export const AgendaGridCell: FC<AgendaGridCellProps> = ({
  ingenieroId,
  fecha,
  quarter,
  entry,
  isStart,
  isEnd,
  entryCount = 0,
  isToday,
  showText,
  compact,
  selectedCellKey,
  rowHeight,
  onClick,
}) => {
  const droppableId = `cell:${ingenieroId}:${fecha}:${quarter}`;
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: droppableId });

  // Only the start cell of an entry is draggable
  const draggableId = entry && isStart ? `entry:${entry.id}` : `noop:${droppableId}`;
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: draggableId,
    data: { type: 'entry', entry },
    disabled: !entry || !isStart,
  });

  const isSelected = selectedCellKey === `${ingenieroId}:${fecha}:${quarter}`;
  const hasMultiple = entryCount > 1;

  const cancelled = entry?.estadoAgenda === 'cancelado';
  const bg = entry ? CELL_BG[entry.estadoAgenda] : '';
  const text = entry ? CELL_TEXT[entry.estadoAgenda] : '';
  const rounded = entry
    ? `${isStart ? 'rounded-l-sm' : ''} ${isEnd ? 'rounded-r-sm' : ''}`
    : '';

  const isDayEnd = quarter === 4;
  const borderClass = compact
    ? `${isDayEnd ? 'border-r border-r-slate-300' : 'border-r border-slate-100/30'} border-b border-b-slate-200`
    : `${isDayEnd ? 'border-r-2 border-r-slate-300' : 'border-r border-slate-100/50'} border-b-2 border-b-slate-200`;

  // Merge refs for combined draggable+droppable
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  }, [setDropRef, setDragRef]);

  return (
    <div
      ref={setNodeRef}
      {...(entry && isStart ? { ...listeners, ...attributes } : {})}
      className={`${borderClass} cursor-pointer transition-colors relative
        ${entry ? bg : 'hover:bg-slate-50'}
        ${rounded}
        ${isToday && !entry ? 'bg-indigo-50/40' : ''}
        ${cancelled ? 'opacity-40' : ''}
        ${isSelected ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}
        ${isOver && !isSelected ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50/60' : ''}
        ${isDragging ? 'opacity-30' : ''}
        ${entry && isStart ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{ height: rowHeight }}
      onClick={onClick}
      title={entry ? `OT-${entry.otNumber} | ${entry.clienteNombre}${hasMultiple ? ` (+${entryCount - 1} más)` : ''}` : undefined}
    >
      {isStart && entry && showText && (
        <span
          className={`text-[8px] font-semibold px-0.5 truncate block whitespace-nowrap overflow-hidden ${text} ${cancelled ? 'line-through' : ''}`}
          style={{ lineHeight: rowHeight }}
        >
          {entry.otNumber}
        </span>
      )}
      {/* Multiple entries indicator — small dot at bottom-right */}
      {hasMultiple && !compact && (
        <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-indigo-600 m-px" />
      )}
    </div>
  );
};
