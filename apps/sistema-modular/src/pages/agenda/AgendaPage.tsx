import { type FC, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { AgendaEntry, WorkOrder, EstadoAgenda } from '@ags/shared';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent, Modifier } from '@dnd-kit/core';

/** Keep the drag chip centered on the cursor regardless of grab origin. */
const CHIP = 13; // half of 26px chip
const snapToCursor: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
  if (!activatorEvent || !activeNodeRect) return transform;
  const ev = activatorEvent as PointerEvent;
  const grabX = ev.clientX - activeNodeRect.left;
  const grabY = ev.clientY - activeNodeRect.top;
  return {
    ...transform,
    x: transform.x + grabX - CHIP,
    y: transform.y + grabY - CHIP,
  };
};
import { addDays, differenceInCalendarDays, parseISO, isWeekend } from 'date-fns';
import { sistemasService } from '../../services/firebaseService';
import { ordenesTrabajoService } from '../../services/otService';
import { useAgenda } from '../../hooks/useAgenda';
import { useAgendaKeyboard, type AgendaKeyboardCallbacks } from '../../hooks/useAgendaKeyboard';
import { AgendaHeader } from '../../components/agenda/AgendaHeader';
import { AgendaInfoBar } from '../../components/agenda/AgendaInfoBar';
import { AgendaGrid } from '../../components/agenda/AgendaGrid';
import { AgendaPendingSidebar } from '../../components/agenda/AgendaPendingSidebar';
import { findEntriesAtCell, formatDateKey, normalizeRange, type SelectedCell, type SelectionRange } from '../../utils/agendaDateUtils';

/** In-memory cache for sistemaId → agsVisibleId lookups within a session. */
const agsIdCache = new Map<string, string | null>();
async function resolveEquipoAgsId(sistemaId: string | undefined | null): Promise<string | null> {
  if (!sistemaId) return null;
  if (agsIdCache.has(sistemaId)) return agsIdCache.get(sistemaId)!;
  try {
    const sistema = await sistemasService.getById(sistemaId);
    const agsId = sistema?.agsVisibleId ?? null;
    agsIdCache.set(sistemaId, agsId);
    return agsId;
  } catch {
    return null;
  }
}

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
    goToPrev, goToNext, goToToday, goToDate,
    ingenieros, entries, pendingOTs, feriados, loading,
    createEntry, updateEntry, deleteEntry, toggleFeriado,
  } = useAgenda();

  const [activeDragOT, setActiveDragOT] = useState<WorkOrder | null>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<AgendaEntry | null>(null);
  // Row highlight during drag: DOM-only, no React state (onDragOver fires at 60fps)
  const highlightedRowRef = useRef<HTMLElement | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [selectedPendingOTs, setSelectedPendingOTs] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4 } | null>(null);
  const [manualTaskInput, setManualTaskInput] = useState<{ ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4; x: number; y: number; initialValue?: string } | null>(null);
  const manualTaskInputRef = useRef<HTMLInputElement>(null);

  // Clear selection on navigation/zoom change
  useEffect(() => { setSelectedCell(null); setSelectionRange(null); }, [anchor, zoomLevel]);

  // Auto-scroll selected cell into view when navigating with keyboard
  useEffect(() => {
    if (!selectedCell) return;
    const el = document.querySelector('[data-agenda-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedCell]);

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
      const existing = cb.entry.otNumber
        ? entries.find(e => e.otNumber === cb.entry!.otNumber && e.ingenieroId === cell.ingenieroId)
        : null;
      if (existing) {
        const newEnd = fechaFin > existing.fechaFin ? fechaFin : existing.fechaFin;
        updateEntry(existing.id, {
          fechaFin: newEnd,
          quarterEnd: newEnd === fechaFin ? quarterEnd : existing.quarterEnd,
        });
      } else {
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
      }
    } else if (cb.type === 'pending' && cb.ot) {
      const existing = entries.find(e => e.otNumber === cb.ot!.otNumber && e.ingenieroId === cell.ingenieroId);
      if (existing) {
        const newEnd = fechaFin > existing.fechaFin ? fechaFin : existing.fechaFin;
        updateEntry(existing.id, {
          fechaFin: newEnd,
          quarterEnd: newEnd === fechaFin ? quarterEnd : existing.quarterEnd,
        });
      } else {
        const ot = cb.ot;
        resolveEquipoAgsId(ot.sistemaId).then(equipoAgsId => {
          createEntry({
            fechaInicio, fechaFin, quarterStart, quarterEnd,
            ingenieroId: cell.ingenieroId,
            ingenieroNombre: ingeniero.nombre,
            otNumber: ot.otNumber,
            clienteNombre: ot.razonSocial,
            tipoServicio: ot.tipoServicio,
            sistemaNombre: ot.sistema || null,
            establecimientoNombre: null,
            equipoModelo: ot.moduloModelo || null,
            equipoAgsId,
            estadoAgenda: 'tentativo',
            notas: null,
            titulo: null,
          });
        });
        // Sync la OT: asignar ingeniero + fecha y, si estaba en CREADA, transicionar
        // a ASIGNADA. Best-effort post-entry (no bloquea el drop si falla).
        const shouldPromote = ot.estadoAdmin === 'CREADA' || !ot.estadoAdmin;
        ordenesTrabajoService.update(ot.otNumber, {
          ingenieroAsignadoId: cell.ingenieroId,
          ingenieroAsignadoNombre: ingeniero.nombre,
          fechaServicioAprox: fechaInicio,
          ...(shouldPromote ? { estadoAdmin: 'ASIGNADA', estadoAdminFecha: new Date().toISOString() } : {}),
        }).catch(err => console.error('[AgendaPage] sync OT al dropear pending falló:', err));
      }
    }
  }, [ingenieros, entries, createEntry, updateEntry]);

  const handleKeyDelete = useCallback(() => {
    const cell = selectedCellRef.current;
    if (!cell?.entry) return;
    deleteEntry(cell.entry.id);
    setSelectedCell(null);
  }, [deleteEntry]);

  const handleTypeStart = useCallback((char: string) => {
    const cell = selectedCellRef.current;
    if (!cell || cell.entry) return;
    const ing = ingenieros.find(i => i.id === cell.ingenieroId);
    setManualTaskInput({
      ingenieroId: cell.ingenieroId,
      ingenieroNombre: ing?.nombre || '',
      fecha: cell.fecha,
      quarter: cell.quarter,
      x: window.innerWidth / 2 - 120,
      y: window.innerHeight / 2 - 80,
      initialValue: char,
    });
  }, [ingenieros]);

  const keyboardCallbacks = useMemo<AgendaKeyboardCallbacks>(() => ({
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleKeyDelete,
    onNavigatePrev: goToPrev,
    onNavigateNext: goToNext,
    onTypeStart: handleTypeStart,
  }), [handleCopy, handlePaste, handleKeyDelete, goToPrev, goToNext, handleTypeStart]);

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

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = String(event.over?.id || '');
    const newIngId = overId.startsWith('cell:') ? overId.split(':')[1] : null;
    // Direct DOM — zero React re-renders during drag
    if (highlightedRowRef.current) {
      highlightedRowRef.current.style.backgroundColor = '';
      highlightedRowRef.current.style.borderLeft = '';
      highlightedRowRef.current = null;
    }
    if (newIngId) {
      const el = document.querySelector<HTMLElement>(`[data-engineer-id="${newIngId}"]`);
      if (el) {
        el.style.backgroundColor = 'rgb(240 253 250)';
        el.style.borderLeft = '2px solid rgb(20 184 166)';
        highlightedRowRef.current = el;
      }
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragOT(null);
    setActiveDragEntry(null);
    // Clear DOM highlight
    if (highlightedRowRef.current) {
      highlightedRowRef.current.style.backgroundColor = '';
      highlightedRowRef.current.style.borderLeft = '';
      highlightedRowRef.current = null;
    }
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

    // ── Resize handle → extend fechaFin/quarterEnd ──
    if (activeId.startsWith('resize:')) {
      const [, srcIngId, srcFecha, srcQStr] = activeId.split(':');
      const srcQuarter = parseInt(srcQStr) as 1 | 2 | 3 | 4;
      const entriesToResize = findEntriesAtCell(entries, srcIngId, srcFecha, srcQuarter);
      for (const entry of entriesToResize) {
        if (targetFecha < entry.fechaInicio) continue; // can't resize before start
        updateEntry(entry.id, { fechaFin: targetFecha, quarterEnd: targetQuarter });
      }
      return;
    }

    // ── Pending OT(s) → create entries (extend if same OT already assigned) ──
    if (activeId.startsWith('pending:')) {
      const selected = selectedPendingOTsRef.current;
      const otsToAssign = pendingOTs.filter(o => selected.has(o.otNumber));
      if (otsToAssign.length === 0) return;

      for (const ot of otsToAssign) {
        const existing = entries.find(e => e.otNumber === ot.otNumber && e.ingenieroId === targetIngenieroId);
        if (existing) {
          const newEnd = targetFecha > existing.fechaFin ? targetFecha : existing.fechaFin;
          updateEntry(existing.id, {
            fechaFin: newEnd,
            quarterEnd: newEnd === targetFecha ? targetQuarter : existing.quarterEnd,
          });
        } else {
          resolveEquipoAgsId(ot.sistemaId).then(equipoAgsId => {
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
              equipoModelo: ot.moduloModelo || null,
              equipoAgsId,
              estadoAgenda: 'tentativo',
              notas: null,
              titulo: null,
            });
          });
          // Sync la OT: asignar ingeniero + fecha y transicionar a ASIGNADA si estaba en CREADA.
          const shouldPromote = ot.estadoAdmin === 'CREADA' || !ot.estadoAdmin;
          ordenesTrabajoService.update(ot.otNumber, {
            ingenieroAsignadoId: targetIngenieroId,
            ingenieroAsignadoNombre: targetIngeniero.nombre,
            fechaServicioAprox: targetFecha,
            ...(shouldPromote ? { estadoAdmin: 'ASIGNADA', estadoAdminFecha: new Date().toISOString() } : {}),
          }).catch(err => console.error('[AgendaPage] sync OT en DnD drop falló:', err));
        }
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
  }, [goToDate]);

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
      setTimeout(() => {
        const el = manualTaskInputRef.current;
        if (!el) return;
        el.focus();
        // Move cursor to end of any pre-filled value
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }, 50);
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

      <DndContext
        sensors={sensors}
        autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 15 }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
              defaultValue={manualTaskInput?.initialValue || ''}
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

        <DragOverlay dropAnimation={null} modifiers={[snapToCursor]}>
          {activeDragOT && (
            <div className="relative bg-amber-400 border border-amber-500 rounded-sm shadow-md pointer-events-none flex items-center justify-center"
              style={{ width: 26, height: 26 }}>
              <span className="text-[7px] font-bold text-amber-900 leading-none select-none truncate px-0.5">
                {activeDragOT.otNumber}
              </span>
              {selectedPendingOTs.size > 1 && (
                <span className="absolute -top-2 -right-2 text-[7px] font-bold text-white bg-teal-600 rounded-full w-3.5 h-3.5 flex items-center justify-center shadow">
                  {selectedPendingOTs.size}
                </span>
              )}
            </div>
          )}
          {activeDragEntry && (
            <div className="bg-teal-400 border border-teal-500 rounded-sm shadow-md pointer-events-none"
              style={{ width: 26, height: 26 }} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
