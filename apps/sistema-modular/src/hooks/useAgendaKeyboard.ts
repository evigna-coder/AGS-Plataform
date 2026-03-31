import { useEffect } from 'react';
import type { Ingeniero, AgendaEntry } from '@ags/shared';
import { isWeekend } from 'date-fns';
import { formatDateKey, findEntriesAtCell, type SelectedCell, type SelectionRange } from '../utils/agendaDateUtils';

export interface AgendaKeyboardCallbacks {
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
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

      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
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
          // Up/Down don't extend selection range (different engineer)
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
        // Shift+Arrow: extend selection range
        setSelectionRange({
          ingenieroId: selectedCell.ingenieroId,
          ingenieroNombre: selectedCell.ingenieroNombre,
          startFecha: selectedCell.fecha,
          startQuarter: selectedCell.quarter,
          endFecha: fecha,
          endQuarter: nq,
        });
      } else {
        // Normal arrow: move anchor, clear range
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
