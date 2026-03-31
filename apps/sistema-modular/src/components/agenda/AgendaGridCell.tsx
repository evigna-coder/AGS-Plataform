import { memo, useCallback } from 'react';
import type { AgendaEntry, EstadoAgenda } from '@ags/shared';
import { ESTADO_AGENDA_LABELS } from '@ags/shared';
import { useDroppable, useDraggable } from '@dnd-kit/core';

const CELL_BG: Record<EstadoAgenda, string> = {
  pendiente: 'bg-slate-300',
  tentativo: 'bg-amber-300',
  confirmado: 'bg-blue-300',
  en_progreso: 'bg-teal-300',
  completado: 'bg-emerald-300',
  cancelado: 'bg-red-200',
};

const CELL_TEXT: Record<EstadoAgenda, string> = {
  pendiente: 'text-slate-800',
  tentativo: 'text-amber-900',
  confirmado: 'text-blue-900',
  en_progreso: 'text-teal-900',
  completado: 'text-emerald-900',
  cancelado: 'text-red-700',
};

interface AgendaGridCellProps {
  ingenieroId: string;
  fecha: string;
  quarter: 1 | 2 | 3 | 4;
  entryId?: string;
  entryOtNumber?: string;
  entryTitulo?: string | null;
  entryEstado?: EstadoAgenda;
  entryClienteNombre?: string;
  entryTipoServicio?: string;
  entrySistemaNombre?: string | null;
  entryNotas?: string | null;
  isStart?: boolean;
  isEnd?: boolean;
  entryCount?: number;
  isToday?: boolean;
  isFeriado?: boolean;
  showText?: boolean;
  compact?: boolean;
  isSelected?: boolean;
  inSelectionRange?: boolean;
  rowHeight: string;
  // Entry object only needed for draggable data — passed by ref, not compared in memo
  entryRef?: AgendaEntry;
  onClick?: (e?: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** Lightweight cell — only re-renders when its own data changes. */
export const AgendaGridCell = memo<AgendaGridCellProps>(({
  ingenieroId, fecha, quarter,
  entryId, entryOtNumber, entryTitulo, entryEstado, entryClienteNombre,
  entryTipoServicio, entrySistemaNombre, entryNotas,
  isStart, isEnd, entryCount = 0,
  isToday, isFeriado, showText, compact, isSelected, inSelectionRange, rowHeight,
  entryRef, onClick, onContextMenu,
}) => {
  const hasEntry = !!entryId;
  const droppableId = `cell:${ingenieroId}:${fecha}:${quarter}`;
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: droppableId });

  // Only the start cell of an entry is draggable
  const draggableId = hasEntry && isStart ? `entry:${entryId}` : `noop:${droppableId}`;
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: draggableId,
    data: { type: 'entry', entry: entryRef },
    disabled: !hasEntry || !isStart,
  });

  const hasMultiple = entryCount > 1;
  const cancelled = entryEstado === 'cancelado';
  const bg = entryEstado ? CELL_BG[entryEstado] : '';
  const text = entryEstado ? CELL_TEXT[entryEstado] : '';
  const rounded = hasEntry
    ? `${isStart ? 'rounded-l-sm' : ''} ${isEnd ? 'rounded-r-sm' : ''}`
    : '';

  const isDayEnd = quarter === 4;
  const borderClass = compact
    ? `${isDayEnd ? 'border-r border-r-slate-300' : 'border-r border-slate-100/30'} border-b border-b-slate-200`
    : `${isDayEnd ? 'border-r-2 border-r-slate-300' : 'border-r border-slate-100/50'} border-b-2 border-b-slate-200`;

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  }, [setDropRef, setDragRef]);

  return (
    <div
      ref={setNodeRef}
      {...(hasEntry && isStart ? { ...listeners, ...attributes } : {})}
      className={`${borderClass} cursor-pointer transition-colors relative
        ${hasEntry ? bg : isFeriado ? 'bg-red-50' : 'hover:bg-slate-50'}
        ${rounded}
        ${isToday && !hasEntry && !isFeriado ? 'bg-teal-50/40' : ''}
        ${cancelled ? 'opacity-40' : ''}
        ${isSelected ? 'ring-2 ring-inset ring-teal-500 z-10' : ''}
        ${inSelectionRange && !isSelected ? 'bg-teal-100/60 ring-1 ring-inset ring-teal-300' : ''}
        ${isOver && !isSelected && !inSelectionRange ? 'ring-2 ring-inset ring-teal-400 bg-teal-50/60' : ''}
        ${isDragging ? 'opacity-30' : ''}
        ${hasEntry && isStart ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{ height: rowHeight }}
      onClick={(e) => onClick?.(e)}
      onContextMenu={onContextMenu}
      title={hasEntry ? `${entryOtNumber ? `OT-${entryOtNumber}` : entryTitulo || 'Tarea'}\n${entryClienteNombre || ''}${entryTipoServicio ? `\n${entryTipoServicio}` : ''}${entrySistemaNombre ? `\n${entrySistemaNombre}` : ''}\n${ESTADO_AGENDA_LABELS[entryEstado!]}${entryNotas ? `\n${entryNotas}` : ''}${hasMultiple ? `\n(+${entryCount - 1} más)` : ''}` : undefined}
    >
      {isStart && hasEntry && showText && (
        <span
          className={`text-[8px] font-semibold px-0.5 truncate block whitespace-nowrap overflow-hidden ${text} ${cancelled ? 'line-through' : ''}`}
          style={{ lineHeight: rowHeight }}
        >
          {entryOtNumber || entryTitulo || '—'}
        </span>
      )}
      {hasMultiple && !compact && (
        <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-teal-600 m-px" />
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparator — only re-render when visual data changes
  return (
    prev.entryId === next.entryId &&
    prev.entryOtNumber === next.entryOtNumber &&
    prev.entryEstado === next.entryEstado &&
    prev.entryTitulo === next.entryTitulo &&
    prev.isStart === next.isStart &&
    prev.isEnd === next.isEnd &&
    prev.entryCount === next.entryCount &&
    prev.isToday === next.isToday &&
    prev.isFeriado === next.isFeriado &&
    prev.isSelected === next.isSelected &&
    prev.inSelectionRange === next.inSelectionRange &&
    prev.compact === next.compact &&
    prev.showText === next.showText &&
    prev.rowHeight === next.rowHeight
  );
});
