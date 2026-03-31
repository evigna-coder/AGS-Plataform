import { type FC, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { AgendaEntry, WorkOrder, EstadoAgenda } from '@ags/shared';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, Modifier } from '@dnd-kit/core';
import { addDays, differenceInCalendarDays, parseISO, isWeekend } from 'date-fns';
import { useAgenda } from '../../hooks/useAgenda';
import { useAgendaKeyboard, type AgendaKeyboardCallbacks } from '../../hooks/useAgendaKeyboard';
import { AgendaHeader } from '../../components/agenda/AgendaHeader';
import { AgendaInfoBar } from '../../components/agenda/AgendaInfoBar';
import { AgendaGrid } from '../../components/agenda/AgendaGrid';
import { AgendaPendingSidebar } from '../../components/agenda/AgendaPendingSidebar';
import { findEntriesAtCell, formatDateKey, normalizeRange, type SelectedCell, type SelectionRange } from '../../utils/agendaDateUtils';

/** Keep the small drag overlay centered under the cursor. */
const OVERLAY_W = 16;
const OVERLAY_H = 16;
const snapOverlayToCursor: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
  if (!activatorEvent || !activeNodeRect) return transform;
  const ev = activatorEvent as PointerEvent;
  const grabX = ev.clientX - activeNodeRect.left;
  const grabY = ev.clientY - activeNodeRect.top;
  return {
    ...transform,
    x: transform.x + grabX - OVERLAY_W / 2,
    y: transform.y + grabY - OVERLAY_H / 2,
  };
};

/** Advance a date by `n` weekdays (skip weekends). */
function addWeekdays(date: Date, n: number): Date {
  let current = date;
  let remaining = n;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (!isWeekend(current)) remaining--;
  }
  return current;
}

/** What's stored in the internal clipboard. */
interface ClipboardData {
  type: 'entry' | 'pending';
  /** Copied from an existing entry */
  entry?: AgendaEntry;
  /** Copied from a pending OT */
  ot?: WorkOrder;
}

export const AgendaPage: FC = () => {
  const {
    anchor, zoomLevel, visibleDays,
    setZoomLevel, goToPrev, goToNext, goToToday, goToDate,
    ingenieros, entries, pendingOTs, feriados, loading,
    createEntry, updateEntry, deleteEntry, toggleFeriado,
  } = useAgenda();

  const [activeDragOT, setActiveDragOT] = useState<WorkOrder | null>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<AgendaEntry | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [selectedPendingOTs, setSelectedPendingOTs] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4 } | null>(null);
  const [manualTaskInput, setManualTaskInput] = useState<{ ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4; x: number; y: number } | null>(null);
  const manualTaskInputRef = useRef<HTMLInputElement>(null);

  // Clear selection on navigation/zoom change
  useEffect(() => { setSelectedCell(null); setSelectionRange(null); }, [anchor, zoomLevel]);

  // ── Clipboard handlers ──

  // Use ref to avoid stale closures in the keyboard callback
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  const handleCopy = useCallback(() => {
    const cell = selectedCellRef.current;
    if (!cell?.entry) return;
    setClipboard({ type: 'entry', entry: cell.entry });
  }, []);

  const handlePaste = useCallback(() => {
    const cell = selectedCellRef.current;
    const cb = clipboardRef.current;
    const range = selectionRangeRef.current;
    if (!cell || !cb) return;

    const ingeniero = ingenieros.find(i => i.id === cell.ingenieroId);
    if (!ingeniero) return;

    // Determine paste range: use multi-selection if exists, otherwise single cell
    const nr = range ? normalizeRange(range) : null;
    const fechaInicio = nr ? nr.startFecha : cell.fecha;
    const fechaFin = nr ? nr.endFecha : cell.fecha;
    const quarterStart = nr ? nr.startQuarter : cell.quarter;
    const quarterEnd = nr ? nr.endQuarter : cell.quarter;

    if (cb.type === 'entry' && cb.entry) {
      createEntry({
        fechaInicio, fechaFin, quarterStart, quarterEnd,
        ingenieroId: cell.ingenieroId,
        ingenieroNombre: ingeniero.nombre,
        otNumber: cb.entry.otNumber,
        clienteNombre: cb.entry.clienteNombre,
        tipoServicio: cb.entry.tipoServicio,
        sistemaNombre: cb.entry.sistemaNombre,
        establecimientoNombre: cb.entry.establecimientoNombre,
        estadoAgenda: 'tentativo',
        notas: null,
        titulo: cb.entry.titulo || null,
      });
    } else if (cb.type === 'pending' && cb.ot) {
      createEntry({
        fechaInicio, fechaFin, quarterStart, quarterEnd,
        ingenieroId: cell.ingenieroId,
        ingenieroNombre: ingeniero.nombre,
        otNumber: cb.ot.otNumber,
        clienteNombre: cb.ot.razonSocial,
        tipoServicio: cb.ot.tipoServicio,
        sistemaNombre: cb.ot.sistema || null,
        establecimientoNombre: null,
        estadoAgenda: 'tentativo',
        notas: null,
        titulo: null,
      });
    }
  }, [ingenieros, createEntry]);

  const handleKeyDelete = useCallback(() => {
    const cell = selectedCellRef.current;
    if (!cell?.entry) return;
    deleteEntry(cell.entry.id);
    setSelectedCell(null);
  }, [deleteEntry]);

  const keyboardCallbacks = useMemo<AgendaKeyboardCallbacks>(() => ({
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleKeyDelete,
  }), [handleCopy, handlePaste, handleKeyDelete]);

  // Keyboard navigation + copy/paste/delete
  useAgendaKeyboard(selectedCell, setSelectedCell, ingenieros, visibleDays, entries, keyboardCallbacks, selectionRange, setSelectionRange);

  /** Copy a pending OT from sidebar (called via click) */
  const handleCopyPendingOT = useCallback((ot: WorkOrder) => {
    setClipboard({ type: 'pending', ot });
  }, []);

  /** Toggle selection of a pending OT in sidebar */
  const handleTogglePendingOT = useCallback((otNumber: string) => {
    setSelectedPendingOTs(prev => {
      const next = new Set(prev);
      if (next.has(otNumber)) next.delete(otNumber);
      else next.add(otNumber);
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('pending:')) {
      const otNumber = activeId.replace('pending:', '');
      const ot = pendingOTs.find(o => o.otNumber === otNumber);
      // If dragging a non-selected card, auto-select it
      if (ot && !selectedPendingOTs.has(otNumber)) {
        setSelectedPendingOTs(new Set([otNumber]));
      }
      setActiveDragOT(ot || null);
    } else if (activeId.startsWith('entry:')) {
      const entryData = event.active.data.current?.entry as AgendaEntry | undefined;
      setActiveDragEntry(entryData || null);
    }
  }, [pendingOTs, selectedPendingOTs]);

  // Use ref to access latest selectedPendingOTs inside drag handler
  const selectedPendingOTsRef = useRef(selectedPendingOTs);
  selectedPendingOTsRef.current = selectedPendingOTs;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragOT(null);
    setActiveDragEntry(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!overId.startsWith('cell:')) return;

    const parts = overId.split(':');
    const targetIngenieroId = parts[1];
    const targetFecha = parts[2];
    const targetQuarter = parseInt(parts[3]) as 1 | 2 | 3 | 4;
    const targetIngeniero = ingenieros.find(i => i.id === targetIngenieroId);
    if (!targetIngeniero) return;

    // ── Pending OT(s) → create entries for all selected ──
    if (activeId.startsWith('pending:')) {
      const selected = selectedPendingOTsRef.current;
      const otsToAssign = pendingOTs.filter(o => selected.has(o.otNumber));
      if (otsToAssign.length === 0) return;

      for (const ot of otsToAssign) {
        createEntry({
          fechaInicio: targetFecha,
          fechaFin: targetFecha,
          quarterStart: targetQuarter,
          quarterEnd: targetQuarter,
          ingenieroId: targetIngenieroId,
          ingenieroNombre: targetIngeniero.nombre,
          otNumber: ot.otNumber,
          clienteNombre: ot.razonSocial,
          tipoServicio: ot.tipoServicio,
          sistemaNombre: ot.sistema || null,
          establecimientoNombre: null,
          estadoAgenda: 'tentativo',
          notas: null,
          titulo: null,
        });
      }
      setSelectedPendingOTs(new Set());
      return;
    }

    // ── Existing entry → move ──
    if (activeId.startsWith('entry:')) {
      const entryId = activeId.replace('entry:', '');
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const origStart = parseISO(entry.fechaInicio);
      const origEnd = parseISO(entry.fechaFin);
      const daySpan = differenceInCalendarDays(origEnd, origStart);
      const newStart = parseISO(targetFecha);
      const newEnd = daySpan > 0 ? addDays(newStart, daySpan) : newStart;

      const movedEntry: AgendaEntry = {
        ...entry,
        fechaInicio: targetFecha,
        fechaFin: formatDateKey(newEnd),
        quarterStart: targetQuarter,
        ingenieroId: targetIngenieroId,
        ingenieroNombre: targetIngeniero.nombre,
      };

      updateEntry(entryId, {
        fechaInicio: targetFecha,
        fechaFin: formatDateKey(newEnd),
        quarterStart: targetQuarter,
        quarterEnd: entry.quarterEnd,
        ingenieroId: targetIngenieroId,
        ingenieroNombre: targetIngeniero.nombre,
      });

      setSelectedCell({
        ingenieroId: targetIngenieroId,
        ingenieroNombre: targetIngeniero.nombre,
        fecha: targetFecha,
        quarter: targetQuarter,
        entry: movedEntry,
        allEntries: [movedEntry],
      });
    }
  }, [pendingOTs, ingenieros, entries, createEntry, updateEntry]);

  const handleCellClick = useCallback((ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4, shiftKey?: boolean) => {
    const ing = ingenieros.find(i => i.id === ingenieroId);
    const found = findEntriesAtCell(entries, ingenieroId, fecha, quarter);

    // Shift+Click: extend selection range from anchor cell
    if (shiftKey && selectedCell && selectedCell.ingenieroId === ingenieroId) {
      setSelectionRange({
        ingenieroId,
        ingenieroNombre: ing?.nombre || '',
        startFecha: selectedCell.fecha,
        startQuarter: selectedCell.quarter,
        endFecha: fecha,
        endQuarter: quarter,
      });
      return;
    }

    // Normal click: set anchor, clear range
    setSelectedCell({
      ingenieroId,
      ingenieroNombre: ing?.nombre || '',
      fecha,
      quarter,
      entry: found[0] || null,
      allEntries: found,
    });
    setSelectionRange(null);
  }, [ingenieros, entries, selectedCell]);

  const handleEntryClick = useCallback((allEntries: AgendaEntry[], primary: AgendaEntry) => {
    setSelectedCell({
      ingenieroId: primary.ingenieroId,
      ingenieroNombre: primary.ingenieroNombre,
      fecha: primary.fechaInicio,
      quarter: primary.quarterStart,
      entry: primary,
      allEntries,
    });
    setSelectionRange(null);
  }, []);

  const handleSelectEntry = useCallback((entry: AgendaEntry) => {
    if (!selectedCell) return;
    setSelectedCell({ ...selectedCell, entry });
  }, [selectedCell]);

  const handleWeekClick = useCallback((weekStart: Date) => {
    goToDate(weekStart);
    if (zoomLevel === 'month') setZoomLevel('2weeks');
    else if (zoomLevel === '2weeks') setZoomLevel('week');
  }, [goToDate, zoomLevel, setZoomLevel]);

  // ── Context menu for manual tasks ──

  const handleContextMenu = useCallback((ingenieroId: string, fecha: string, quarter: 1|2|3|4, e: React.MouseEvent) => {
    e.preventDefault();
    const ing = ingenieros.find(i => i.id === ingenieroId);
    setContextMenu({ x: e.clientX, y: e.clientY, ingenieroId, ingenieroNombre: ing?.nombre || '', fecha, quarter });
  }, [ingenieros]);

  const handleOpenManualTaskInput = useCallback(() => {
    if (!contextMenu) return;
    setManualTaskInput({
      ingenieroId: contextMenu.ingenieroId,
      ingenieroNombre: contextMenu.ingenieroNombre,
      fecha: contextMenu.fecha,
      quarter: contextMenu.quarter,
      x: contextMenu.x,
      y: contextMenu.y,
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleConfirmManualTask = useCallback((titulo: string) => {
    if (!manualTaskInput || !titulo.trim()) { setManualTaskInput(null); return; }
    createEntry({
      fechaInicio: manualTaskInput.fecha,
      fechaFin: manualTaskInput.fecha,
      quarterStart: manualTaskInput.quarter,
      quarterEnd: manualTaskInput.quarter,
      ingenieroId: manualTaskInput.ingenieroId,
      ingenieroNombre: manualTaskInput.ingenieroNombre,
      otNumber: '',
      clienteNombre: '',
      tipoServicio: '',
      sistemaNombre: null,
      establecimientoNombre: null,
      estadoAgenda: 'confirmado',
      notas: null,
      titulo: titulo.trim(),
    });
    setManualTaskInput(null);
  }, [manualTaskInput, createEntry]);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Auto-focus the manual task input when it appears
  useEffect(() => {
    if (manualTaskInput) {
      setTimeout(() => manualTaskInputRef.current?.focus(), 50);
    }
  }, [manualTaskInput]);

  // ── Sidebar resize ──

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setSidebarWidth(Math.max(200, Math.min(500, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // ── Info bar actions ──

  const handleChangeEstado = useCallback((entryId: string, estado: EstadoAgenda) => {
    updateEntry(entryId, { estadoAgenda: estado });
    // Update selected cell entry in-place for instant UI feedback
    if (selectedCell?.entry?.id === entryId) {
      setSelectedCell({
        ...selectedCell,
        entry: { ...selectedCell.entry, estadoAgenda: estado },
        allEntries: selectedCell.allEntries.map(e => e.id === entryId ? { ...e, estadoAgenda: estado } : e),
      });
    }
  }, [updateEntry, selectedCell]);

  const handleDeleteEntry = useCallback((entryId: string) => {
    deleteEntry(entryId);
    if (selectedCell && selectedCell.allEntries.length > 1) {
      const remaining = selectedCell.allEntries.filter(e => e.id !== entryId);
      setSelectedCell({ ...selectedCell, entry: remaining[0] || null, allEntries: remaining });
    } else {
      setSelectedCell(null);
    }
  }, [deleteEntry, selectedCell]);

  const handleExtendEntry = useCallback((entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.quarterEnd < 4) {
      updateEntry(entryId, { quarterEnd: (entry.quarterEnd + 1) as 1 | 2 | 3 | 4 });
    } else {
      const endDate = parseISO(entry.fechaFin);
      const nextDay = addWeekdays(endDate, 1);
      updateEntry(entryId, { fechaFin: formatDateKey(nextDay), quarterEnd: 1 });
    }
  }, [entries, updateEntry]);

  const handleShrinkEntry = useCallback((entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.fechaInicio === entry.fechaFin && entry.quarterStart === entry.quarterEnd) return;

    if (entry.quarterEnd > 1) {
      updateEntry(entryId, { quarterEnd: (entry.quarterEnd - 1) as 1 | 2 | 3 | 4 });
    } else {
      const endDate = parseISO(entry.fechaFin);
      let prevDay = addDays(endDate, -1);
      while (isWeekend(prevDay)) prevDay = addDays(prevDay, -1);
      const prevFecha = formatDateKey(prevDay);
      if (prevFecha < entry.fechaInicio) return;
      updateEntry(entryId, { fechaFin: prevFecha, quarterEnd: 4 });
    }
  }, [entries, updateEntry]);

  const selectedCellKey = selectedCell
    ? `${selectedCell.ingenieroId}:${selectedCell.fecha}:${selectedCell.quarter}`
    : null;

  const clipboardLabel = clipboard
    ? clipboard.type === 'entry' && clipboard.entry
      ? `OT-${clipboard.entry.otNumber}`
      : clipboard.type === 'pending' && clipboard.ot
        ? `OT-${clipboard.ot.otNumber}`
        : null
    : null;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <AgendaHeader
        anchor={anchor}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        onPrev={goToPrev}
        onNext={goToNext}
        onToday={goToToday}
      />

      <AgendaInfoBar
        selectedCell={selectedCell}
        clipboardLabel={clipboardLabel}
        onDeleteEntry={handleDeleteEntry}
        onExtendEntry={handleExtendEntry}
        onShrinkEntry={handleShrinkEntry}
        onSelectEntry={handleSelectEntry}
        onChangeEstado={handleChangeEstado}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 relative overflow-hidden">
          {/* Grid area — absolute positioning decouples grid from sidebar */}
          <div
            className="absolute top-0 left-0 bottom-0 overflow-hidden"
            style={{ right: sidebarWidth + 6 }}
          >
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <span className="text-teal-600 font-bold text-xl tracking-tight">AGS</span>
                  <p className="text-xs text-slate-400 mt-2">Cargando agenda...</p>
                </div>
              </div>
            ) : (
              <AgendaGrid
                ingenieros={ingenieros}
                visibleDays={visibleDays}
                zoom={zoomLevel}
                entries={entries}
                selectedCellKey={selectedCellKey}
                selectionRange={selectionRange}
                onCellClick={handleCellClick}
                onEntryClick={handleEntryClick}
                onZoomChange={setZoomLevel}
                onWeekClick={handleWeekClick}
                onCellContextMenu={handleContextMenu}
                feriados={feriados}
                onToggleFeriado={toggleFeriado}
              />
            )}
          </div>

          {/* Resize handle */}
          <div
            className="absolute top-0 bottom-0 cursor-col-resize hover:bg-teal-200 active:bg-teal-300 transition-colors bg-slate-200"
            style={{ right: sidebarWidth, width: 6 }}
            onMouseDown={handleResizeStart}
          />

          {/* Sidebar — fixed to right edge */}
          <div className="absolute top-0 right-0 bottom-0 overflow-hidden" style={{ width: sidebarWidth }}>
            <AgendaPendingSidebar
              pendingOTs={pendingOTs}
              selectedOTs={selectedPendingOTs}
              onToggleSelect={handleTogglePendingOT}
              onCopyOT={handleCopyPendingOT}
              width={sidebarWidth}
            />
          </div>
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={handleOpenManualTaskInput}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar tarea manual
            </button>
          </div>
        )}

        {/* Manual task inline input */}
        {manualTaskInput && (
          <div
            className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[240px]"
            style={{ left: manualTaskInput.x, top: manualTaskInput.y }}
            onClick={e => e.stopPropagation()}
          >
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Título de la tarea
            </label>
            <input
              ref={manualTaskInputRef}
              type="text"
              placeholder="Ej: Llevar auto al mecánico..."
              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmManualTask((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setManualTaskInput(null);
              }}
            />
            <div className="flex justify-end gap-1.5 mt-2">
              <button onClick={() => setManualTaskInput(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmManualTask(manualTaskInputRef.current?.value || '')}
                className="text-xs bg-teal-600 text-white px-3 py-1 rounded hover:bg-teal-700"
              >
                Crear
              </button>
            </div>
          </div>
        )}

        <DragOverlay dropAnimation={null} modifiers={[snapOverlayToCursor]}>
          {activeDragOT && (
            <div
              className="relative bg-amber-400 border border-amber-500 rounded-sm shadow-md pointer-events-none"
              style={{ width: 16, height: 16 }}
            >
              {selectedPendingOTs.size > 1 && (
                <span className="absolute -top-2 -right-2 text-[7px] font-bold text-white bg-teal-600 rounded-full w-3.5 h-3.5 flex items-center justify-center shadow">
                  {selectedPendingOTs.size}
                </span>
              )}
            </div>
          )}
          {activeDragEntry && (
            <div
              className="bg-teal-400 border border-teal-500 rounded-sm shadow-md pointer-events-none"
              style={{ width: 16, height: 16 }}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
