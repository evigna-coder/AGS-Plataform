import { memo, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AgendaEntry, EstadoAgenda } from '@ags/shared';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { AgendaCellPopover } from './AgendaCellPopover';
import { colorDeCeldaAgenda } from '../../utils/agendaCellColor';

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
  /** Pago adelantado (2026-08-04): diagonal azul marino sobre el color del estado. */
  entryPagoAdelantado?: boolean;
  /** Requiere inducción (2026-08-05): diagonal inferior NEGRA. */
  entryRequiereInduccion?: boolean;
  /** Venta concretada (2026-08-09): pinta la celda ENTERA de verde agua. */
  entryVentaConcretada?: boolean;
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
  entryId, entryOtNumber, entryTitulo, entryEstado, entryTipoServicio, entryPagoAdelantado, entryRequiereInduccion,
  entryVentaConcretada,
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
  // El color de la celda lo puede mandar el tipo de servicio o el título por
  // encima del estado — la tabla de reglas vive en utils/agendaCellColor.
  const { bg, text } = colorDeCeldaAgenda({
    estado: entryEstado,
    tipoServicio: entryTipoServicio,
    titulo: entryTitulo,
    ventaConcretada: entryVentaConcretada,
  });
  const rounded = hasEntry
    ? `${isStart ? 'rounded-l-sm' : ''} ${isEnd ? 'rounded-r-sm' : ''}`
    : '';

  // Hover popover for multi-entry cells
  const [showPopover, setShowPopover] = useState(false);
  // Globito del comentario (estilo Excel): flota hacia ARRIBA para no pisarse
  // con el popover de servicios, que se despliega hacia abajo (2026-07-30).
  const [showNota, setShowNota] = useState(false);
  const cellElementRef = useRef<HTMLElement | null>(null);

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
          if (hasEntry && allEntriesRef && allEntriesRef.length > 0) setShowPopover(true);
          if (notaTexto) setShowNota(true);
        }}
        onMouseLeave={() => {
          setShowPopover(false);
          setShowNota(false);
        }}
      >
        {/* Pago adelantado: media celda AZUL MARINO en diagonal, el resto deja
            ver el color del estado (pedido 2026-08-04 — flag ortogonal). */}
        {hasEntry && entryPagoAdelantado && !cancelled && (
          <span
            className="absolute inset-0 bg-[#1e3a8a] pointer-events-none"
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          />
        )}
        {/* Requiere inducción (2026-08-05): mitad INFERIOR negra — convive con
            la diagonal azul del pago adelantado (mitad superior). */}
        {hasEntry && entryRequiereInduccion && !cancelled && (
          <span
            className="absolute inset-0 bg-black pointer-events-none"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
          />
        )}
        {isStart && hasEntry && showText && (
          <span
            className={`relative text-[8px] font-semibold px-0.5 truncate block whitespace-nowrap overflow-hidden ${text} ${cancelled ? 'line-through' : ''} ${(entryPagoAdelantado || entryRequiereInduccion || entryVentaConcretada) ? 'text-white [text-shadow:0_0_2px_rgba(0,0,0,0.5)]' : ''}`}
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
    prev.entryTipoServicio === next.entryTipoServicio &&
    prev.entryPagoAdelantado === next.entryPagoAdelantado &&
    prev.entryRequiereInduccion === next.entryRequiereInduccion &&
    prev.entryVentaConcretada === next.entryVentaConcretada &&
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
