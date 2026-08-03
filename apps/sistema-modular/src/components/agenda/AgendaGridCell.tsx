import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AgendaEntry, EstadoAgenda } from '@ags/shared';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { AgendaCellPopover } from './AgendaCellPopover';

// Colores 2026-07-30: tentativo pasó al GRIS (igual a pendiente, pedido user);
// los estados "interior" (clientes a +200 km de CABA) se diferencian con
// marrón verdoso (tentativo) y azul grisáceo (confirmado).
const CELL_BG: Record<EstadoAgenda, string> = {
  pendiente: 'bg-slate-300',
  tentativo: 'bg-slate-300',
  tentativo_interior: 'bg-[#a09a4e]',
  confirmado: 'bg-blue-300',
  confirmado_interior: 'bg-[#7d90a8]',
  en_progreso: 'bg-teal-300',
  completado: 'bg-emerald-300',
  cancelado: 'bg-red-200',
};

const CELL_TEXT: Record<EstadoAgenda, string> = {
  pendiente: 'text-slate-800',
  tentativo: 'text-slate-800',
  tentativo_interior: 'text-[#26240c]',
  confirmado: 'text-blue-900',
  confirmado_interior: 'text-white',
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
  /** Día AGS del ingeniero (no laborable individual) — celda turquesa (2026-08-02). */
  isDiaAgs?: boolean;
  showText?: boolean;
  compact?: boolean;
  isSelected?: boolean;
  inSelectionRange?: boolean;
  rowHeight: string;
  // Entry object only needed for draggable data — passed by ref, not compared in memo
  entryRef?: AgendaEntry;
  // All entries in this cell — used for hover popover, not compared in memo
  allEntriesRef?: AgendaEntry[];
  /** Comentario del día (estilo Excel): triangulito rojo + tooltip. Solo lo recibe
   *  la última celda del día (quarter 4) para que quede en la esquina del día. */
  notaTexto?: string | null;
  onClick?: (e?: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** Lightweight cell — only re-renders when its own data changes. */
export const AgendaGridCell = memo<AgendaGridCellProps>(({
  ingenieroId, fecha, quarter,
  entryId, entryOtNumber, entryTitulo, entryEstado,
  isStart, isEnd, entryCount = 0,
  isToday, isFeriado, isDiaAgs, showText, compact, isSelected, inSelectionRange, rowHeight,
  entryRef, allEntriesRef, notaTexto, onClick, onContextMenu,
}) => {
  const hasEntry = !!entryId;
  const droppableId = `cell:${ingenieroId}:${fecha}:${quarter}`;
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: droppableId });

  // Only the start cell of an entry is draggable (for moving)
  const draggableId = hasEntry && isStart ? `entry:${entryId}` : `noop:${droppableId}`;
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: draggableId,
    data: { type: 'entry', entry: entryRef },
    disabled: !hasEntry || !isStart,
  });

  // Resize handle — only the END cell of an entry (non-compact)
  const resizeId = `resize:${ingenieroId}:${fecha}:${quarter}`;
  const { setNodeRef: setResizeRef, listeners: resizeListeners, attributes: resizeAttrs, isDragging: isResizing } = useDraggable({
    id: resizeId,
    data: { type: 'resize' },
    disabled: !hasEntry || !isEnd || !!compact,
  });

  const hasMultiple = entryCount > 1;
  const cancelled = entryEstado === 'cancelado';
  const bg = entryEstado ? CELL_BG[entryEstado] : '';
  const text = entryEstado ? CELL_TEXT[entryEstado] : '';
  const rounded = hasEntry
    ? `${isStart ? 'rounded-l-sm' : ''} ${isEnd ? 'rounded-r-sm' : ''}`
    : '';

  // Hover popover for multi-entry cells
  const [showPopover, setShowPopover] = useState(false);
  // Globito del comentario (estilo Excel): flota hacia ARRIBA para no pisarse
  // con el popover de servicios, que se despliega hacia abajo (2026-07-30).
  const [showNota, setShowNota] = useState(false);
  const cellElementRef = useRef<HTMLElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  const isDayEnd = quarter === 4;
  const borderClass = compact
    ? `${isDayEnd ? 'border-r border-r-slate-300' : 'border-r border-slate-100/30'} border-b border-b-slate-200`
    : `${isDayEnd ? 'border-r-2 border-r-slate-300' : 'border-r border-slate-100/50'} border-b-2 border-b-slate-200`;

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
    cellElementRef.current = node;
  }, [setDropRef, setDragRef]);

  return (
    <>
      <div
        ref={setNodeRef}
        {...(hasEntry && isStart ? { ...listeners, ...attributes } : {})}
        className={`${borderClass} cursor-pointer transition-colors relative
          ${hasEntry ? bg : isDiaAgs ? 'bg-cyan-200/70' : isFeriado ? 'bg-red-50' : 'hover:bg-slate-50'}
          ${rounded}
          ${isToday && !hasEntry && !isFeriado && !isDiaAgs ? 'bg-teal-50/40' : ''}
          ${cancelled ? 'opacity-40' : ''}
          ${isSelected ? 'ring-2 ring-inset ring-teal-500 z-10' : ''}
          ${inSelectionRange && !isSelected ? 'bg-teal-100/60 ring-1 ring-inset ring-teal-300' : ''}
          ${isOver && !isSelected && !inSelectionRange ? 'ring-2 ring-inset ring-teal-400 bg-teal-50/60' : ''}
          ${isDragging ? 'opacity-30' : ''}
          ${hasEntry && isStart ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        style={{ height: rowHeight }}
        {...(isSelected ? { 'data-agenda-selected': 'true' } : {})}
        onClick={(e) => onClick?.(e)}
        onContextMenu={(e) => {
          // Cerrar popover y globito: el menú contextual se abre en el mismo
          // lugar y quedaba tapado/mezclado con ellos (2026-08-03).
          setShowPopover(false);
          setShowNota(false);
          onContextMenu?.(e);
        }}
        onMouseEnter={() => {
          if (hasEntry && allEntriesRef && allEntriesRef.length > 0) {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            setShowPopover(true);
          }
          if (notaTexto) setShowNota(true);
        }}
        onMouseLeave={() => {
          if (showPopover) hideTimerRef.current = setTimeout(() => setShowPopover(false), 150);
          setShowNota(false);
        }}
      >
        {isStart && hasEntry && showText && (
          <span
            className={`text-[8px] font-semibold px-0.5 truncate block whitespace-nowrap overflow-hidden ${text} ${cancelled ? 'line-through' : ''}`}
            style={{ lineHeight: rowHeight }}
          >
            {entryOtNumber || entryTitulo || '—'}
          </span>
        )}
        {isOver && !hasEntry && (
          <span className="absolute inset-0 flex items-center justify-center text-teal-500 text-[10px] font-bold pointer-events-none select-none">+</span>
        )}
        {hasMultiple && !compact && (
          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-teal-600 m-px" />
        )}
        {/* Comentario del día (estilo Excel): triangulito rojo en la esquina */}
        {notaTexto && (
          <span className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-t-red-500 border-l-[6px] border-l-transparent pointer-events-none z-10" />
        )}
        {/* Resize handle — right edge of the last cell of an entry */}
        {hasEntry && isEnd && !compact && (
          <div
            ref={setResizeRef}
            {...resizeListeners}
            {...resizeAttrs}
            className={`absolute top-0 right-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group
              ${isResizing ? 'bg-teal-600/40' : 'hover:bg-teal-400/50'}`}
            onClick={e => e.stopPropagation()}
            title="Arrastrar para cambiar duración"
          >
            <span className="w-0.5 h-3 rounded bg-current opacity-50 group-hover:opacity-100" />
          </div>
        )}
      </div>
      {showNota && notaTexto && cellElementRef.current && createPortal(
        (() => {
          const rect = cellElementRef.current!.getBoundingClientRect();
          // En las filas de abajo el popover de servicios se da vuelta hacia
          // ARRIBA (mismo umbral 160px) y tapaba al globito — ahí el globito
          // baja, en espejo (2026-08-03). z por encima del popover (9999).
          const popoverArriba = window.innerHeight - rect.bottom < 160;
          return (
            <div
              className="fixed z-[10000] max-w-[260px] bg-amber-50 border border-amber-300 rounded-lg shadow-lg px-2.5 py-1.5 pointer-events-none"
              style={{
                left: Math.min(rect.left, window.innerWidth - 280),
                ...(popoverArriba
                  ? { top: rect.bottom + 4 }
                  : { bottom: window.innerHeight - rect.top + 4 }),
              }}
            >
              <p className="text-[11px] text-amber-900 whitespace-pre-wrap break-words">{notaTexto}</p>
            </div>
          );
        })(),
        document.body,
      )}
      {showPopover && allEntriesRef && allEntriesRef.length > 0 && cellElementRef.current && createPortal(
        <AgendaCellPopover
          entries={allEntriesRef}
          cellRect={cellElementRef.current.getBoundingClientRect()}
          onMouseEnter={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }}
          onMouseLeave={() => setShowPopover(false)}
        />,
        document.body,
      )}
    </>
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
    prev.isDiaAgs === next.isDiaAgs &&
    prev.isSelected === next.isSelected &&
    prev.inSelectionRange === next.inSelectionRange &&
    prev.compact === next.compact &&
    prev.showText === next.showText &&
    prev.rowHeight === next.rowHeight &&
    prev.notaTexto === next.notaTexto
  );
});
