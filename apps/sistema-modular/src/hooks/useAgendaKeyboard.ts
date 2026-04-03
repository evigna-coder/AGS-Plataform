import { useEffect } from 'react';
import type { Ingeniero, AgendaEntry } from '@ags/shared';
import { isWeekend } from 'date-fns';
import { formatDateKey, findEntriesAtCell, type SelectedCell, type SelectionRange } from '../utils/agendaDateUtils';

export interface AgendaKeyboardCallbacks {
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onTypeStart?: (char: string) => void;
}

export function useAgendaKeyboard(
  selectedCell: SelectedCell | null,
  setSelectedCell: (cell: SelectedCell | null) => void,
  ingenieros: Ingeniero[],
  visibleDays: Date[],
  entries: AgendaEntry[],
  callbacks?: AgendaKeyboardCallbacks,
  selectionRange?: SelectionRange | null,
  setSelectionRange?: (range: SelectionRange | null) => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl+C → copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        callbacks?.onCopy?.();
        return;
      }

      // Ctrl+V → paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        callbacks?.onPaste?.();
        return;
      }

      // Delete / Backspace → delete entry
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        callbacks?.onDelete?.();
        return;
      }

      // Escape → clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectionRange) {
          setSelectionRange?.(null);
        } else {
          setSelectedCell(null);
        }
        return;
      }

      const weekdayKeys = visibleDays.filter(d => !isWeekend(d)).map(d => formatDateKey(d));
      const engIdx = ingenieros.findIndex(i => i.id === selectedCell.ingenieroId);
      const dateIdx = weekdayKeys.indexOf(selectedCell.fecha);
      if (engIdx === -1 || dateIdx === -1) return;

      // ── Tab / Shift+Tab — navigate by full day ──
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          // Previous day
          const nd = Math.max(0, dateIdx - 1);
          if (nd === dateIdx) return;
          const fecha = weekdayKeys[nd];
          const ing = ingenieros[engIdx];
          const found = findEntriesAtCell(entries, ing.id, fecha, 1);
          setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha, quarter: 1, entry: found[0] || null, allEntries: found });
          setSelectionRange?.(null);
        } else {
          // Next day
          const nd = Math.min(weekdayKeys.length - 1, dateIdx + 1);
          if (nd === dateIdx) return;
          const fecha = weekdayKeys[nd];
          const ing = ingenieros[engIdx];
          const found = findEntriesAtCell(entries, ing.id, fecha, 1);
          setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha, quarter: 1, entry: found[0] || null, allEntries: found });
          setSelectionRange?.(null);
        }
        return;
      }

      // ── Enter / Shift+Enter — navigate by engineer ──
      if (e.key === 'Enter') {
        e.preventDefault();
        const ne = e.shiftKey
          ? Math.max(0, engIdx - 1)
          : Math.min(ingenieros.length - 1, engIdx + 1);
        if (ne === engIdx) return;
        const ing = ingenieros[ne];
        const found = findEntriesAtCell(entries, ing.id, selectedCell.fecha, selectedCell.quarter);
        setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha: selectedCell.fecha, quarter: selectedCell.quarter, entry: found[0] || null, allEntries: found });
        setSelectionRange?.(null);
        return;
      }

      // ── Home / End — jump to first / last visible day ──
      if (e.key === 'Home') {
        e.preventDefault();
        if (weekdayKeys.length === 0) return;
        const fecha = weekdayKeys[0];
        const ing = ingenieros[engIdx];
        const found = findEntriesAtCell(entries, ing.id, fecha, 1);
        setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha, quarter: 1, entry: found[0] || null, allEntries: found });
        setSelectionRange?.(null);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (weekdayKeys.length === 0) return;
        const fecha = weekdayKeys[weekdayKeys.length - 1];
        const ing = ingenieros[engIdx];
        const found = findEntriesAtCell(entries, ing.id, fecha, 4);
        setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha, quarter: 4, entry: found[0] || null, allEntries: found });
        setSelectionRange?.(null);
        return;
      }

      // ── Ctrl+Arrow — navigate to prev/next week ──
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          callbacks?.onNavigatePrev?.();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          callbacks?.onNavigateNext?.();
          return;
        }
      }

      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);

      // ── Printable char on empty cell → create task ──
      if (!isArrow && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!selectedCell.entry) {
          e.preventDefault();
          callbacks?.onTypeStart?.(e.key);
        }
        return;
      }

      if (!isArrow) return;

      e.preventDefault();

      // Determine current end position (from range or from anchor)
      const rangeEnd = selectionRange
        ? { fecha: selectionRange.endFecha, quarter: selectionRange.endQuarter }
        : { fecha: selectedCell.fecha, quarter: selectedCell.quarter };

      const endDateIdx = weekdayKeys.indexOf(rangeEnd.fecha);
      let nd = endDateIdx === -1 ? dateIdx : endDateIdx;
      let nq = rangeEnd.quarter;

      switch (e.key) {
        case 'ArrowLeft':
          if (nq > 1) nq = (nq - 1) as 1 | 2 | 3 | 4;
          else if (nd > 0) { nd--; nq = 4; }
          else return;
          break;
        case 'ArrowRight':
          if (nq < 4) nq = (nq + 1) as 1 | 2 | 3 | 4;
          else if (nd < weekdayKeys.length - 1) { nd++; nq = 1; }
          else return;
          break;
        case 'ArrowUp':
          if (!e.shiftKey) {
            const ne = engIdx > 0 ? engIdx - 1 : engIdx;
            if (ne === engIdx) return;
            const ing = ingenieros[ne];
            const found = findEntriesAtCell(entries, ing.id, selectedCell.fecha, selectedCell.quarter);
            setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha: selectedCell.fecha, quarter: selectedCell.quarter, entry: found[0] || null, allEntries: found });
            setSelectionRange?.(null);
          }
          return;
        case 'ArrowDown':
          if (!e.shiftKey) {
            const ne = engIdx < ingenieros.length - 1 ? engIdx + 1 : engIdx;
            if (ne === engIdx) return;
            const ing = ingenieros[ne];
            const found = findEntriesAtCell(entries, ing.id, selectedCell.fecha, selectedCell.quarter);
            setSelectedCell({ ingenieroId: ing.id, ingenieroNombre: ing.nombre, fecha: selectedCell.fecha, quarter: selectedCell.quarter, entry: found[0] || null, allEntries: found });
            setSelectionRange?.(null);
          }
          return;
      }

      const fecha = weekdayKeys[nd];

      if (e.shiftKey && setSelectionRange) {
        setSelectionRange({
          ingenieroId: selectedCell.ingenieroId,
          ingenieroNombre: selectedCell.ingenieroNombre,
          startFecha: selectedCell.fecha,
          startQuarter: selectedCell.quarter,
          endFecha: fecha,
          endQuarter: nq,
        });
      } else {
        const ing = ingenieros[engIdx];
        const found = findEntriesAtCell(entries, ing.id, fecha, nq);
        setSelectedCell({
          ingenieroId: ing.id,
          ingenieroNombre: ing.nombre,
          fecha,
          quarter: nq,
          entry: found[0] || null,
          allEntries: found,
        });
        setSelectionRange?.(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCell, setSelectedCell, ingenieros, visibleDays, entries, callbacks, selectionRange, setSelectionRange]);
}
