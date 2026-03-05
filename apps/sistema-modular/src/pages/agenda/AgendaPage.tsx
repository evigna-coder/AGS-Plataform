import { type FC, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { AgendaEntry, WorkOrder } from '@ags/shared';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, Modifier } from '@dnd-kit/core';
import { addDays, differenceInCalendarDays, parseISO, isWeekend } from 'date-fns';
import { useAgenda } from '../../hooks/useAgenda';
import { useAgendaKeyboard, type AgendaKeyboardCallbacks } from '../../hooks/useAgendaKeyboard';
import { AgendaHeader } from '../../components/agenda/AgendaHeader';
import { AgendaInfoBar } from '../../components/agenda/AgendaInfoBar';
import { AgendaGrid } from '../../components/agenda/AgendaGrid';
import { AgendaPendingSidebar } from '../../components/agenda/AgendaPendingSidebar';
import { findEntriesAtCell, formatDateKey, type SelectedCell } from '../../utils/agendaDateUtils';

/** Keep the small drag overlay centered under the cursor. */
const OVERLAY_W = 14;
const OVERLAY_H = 22;
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
    ingenieros, entries, pendingOTs, loading,
    createEntry, updateEntry, deleteEntry,
  } = useAgenda();

  const [activeDragOT, setActiveDragOT] = useState<WorkOrder | null>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<AgendaEntry | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [selectedPendingOTs, setSelectedPendingOTs] = useState<Set<string>>(new Set());

  // Clear selection on navigation/zoom change
  useEffect(() => { setSelectedCell(null); }, [anchor, zoomLevel]);

  // ── Clipboard handlers ──

  // Use ref to avoid stale closures in the keyboard callback
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;

  const handleCopy = useCallback(() => {
    const cell = selectedCellRef.current;
    if (!cell?.entry) return;
    setClipboard({ type: 'entry', entry: cell.entry });
  }, []);

  const handlePaste = useCallback(() => {
    const cell = selectedCellRef.current;
    const cb = clipboardRef.current;
    if (!cell || !cb) return;

    const ingeniero = ingenieros.find(i => i.id === cell.ingenieroId);
    if (!ingeniero) return;

    if (cb.type === 'entry' && cb.entry) {
      // Paste creates a new entry with same OT data at target cell
      createEntry({
        fechaInicio: cell.fecha,
        fechaFin: cell.fecha,
        quarterStart: cell.quarter,
        quarterEnd: 4,
        ingenieroId: cell.ingenieroId,
        ingenieroNombre: ingeniero.nombre,
        otNumber: cb.entry.otNumber,
        clienteNombre: cb.entry.clienteNombre,
        tipoServicio: cb.entry.tipoServicio,
        sistemaNombre: cb.entry.sistemaNombre,
        establecimientoNombre: cb.entry.establecimientoNombre,
        estadoAgenda: 'tentativo',
        notas: null,
      });
    } else if (cb.type === 'pending' && cb.ot) {
      createEntry({
        fechaInicio: cell.fecha,
        fechaFin: cell.fecha,
        quarterStart: cell.quarter,
        quarterEnd: 4,
        ingenieroId: cell.ingenieroId,
        ingenieroNombre: ingeniero.nombre,
        otNumber: cb.ot.otNumber,
        clienteNombre: cb.ot.razonSocial,
        tipoServicio: cb.ot.tipoServicio,
        sistemaNombre: cb.ot.sistema || null,
        establecimientoNombre: null,
        estadoAgenda: 'tentativo',
        notas: null,
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
  useAgendaKeyboard(selectedCell, setSelectedCell, ingenieros, visibleDays, entries, keyboardCallbacks);

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
          quarterEnd: 4,
          ingenieroId: targetIngenieroId,
          ingenieroNombre: targetIngeniero.nombre,
          otNumber: ot.otNumber,
          clienteNombre: ot.razonSocial,
          tipoServicio: ot.tipoServicio,
          sistemaNombre: ot.sistema || null,
          establecimientoNombre: null,
          estadoAgenda: 'tentativo',
          notas: null,
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

  const handleCellClick = useCallback((ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4) => {
    const ing = ingenieros.find(i => i.id === ingenieroId);
    const found = findEntriesAtCell(entries, ingenieroId, fecha, quarter);
    setSelectedCell({
      ingenieroId,
      ingenieroNombre: ing?.nombre || '',
      fecha,
      quarter,
      entry: found[0] || null,
      allEntries: found,
    });
  }, [ingenieros, entries]);

  const handleEntryClick = useCallback((allEntries: AgendaEntry[], primary: AgendaEntry) => {
    setSelectedCell({
      ingenieroId: primary.ingenieroId,
      ingenieroNombre: primary.ingenieroNombre,
      fecha: primary.fechaInicio,
      quarter: primary.quarterStart,
      entry: primary,
      allEntries,
    });
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

  // ── Info bar actions ──

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
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="text-indigo-600 font-bold text-xl tracking-tight">AGS</span>
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
              onCellClick={handleCellClick}
              onEntryClick={handleEntryClick}
              onZoomChange={setZoomLevel}
              onWeekClick={handleWeekClick}
            />
          )}

          <AgendaPendingSidebar
            pendingOTs={pendingOTs}
            selectedOTs={selectedPendingOTs}
            onToggleSelect={handleTogglePendingOT}
            onCopyOT={handleCopyPendingOT}
          />
        </div>

        <DragOverlay dropAnimation={null} modifiers={[snapOverlayToCursor]}>
          {activeDragOT && (
            <div
              className="relative bg-amber-400 border border-amber-500 rounded-sm shadow-md pointer-events-none"
              style={{ width: 14, height: 22 }}
            >
              {selectedPendingOTs.size > 1 && (
                <span className="absolute -top-2 -right-2 text-[7px] font-bold text-white bg-indigo-600 rounded-full w-3.5 h-3.5 flex items-center justify-center shadow">
                  {selectedPendingOTs.size}
                </span>
              )}
            </div>
          )}
          {activeDragEntry && (
            <div
              className="bg-indigo-400 border border-indigo-500 rounded-sm shadow-md pointer-events-none"
              style={{ width: 14, height: 22 }}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
