import { useEffect } from 'react';
import type { Ingeniero, AgendaEntry } from '@ags/shared';
import { isWeekend } from 'date-fns';
import { formatDateKey, findEntriesAtCell, type SelectedCell } from '../utils/agendaDateUtils';

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

      const weekdayKeys = visibleDays.filter(d => !isWeekend(d)).map(d => formatDateKey(d));
      const engIdx = ingenieros.findIndex(i => i.id === selectedCell.ingenieroId);
      const dateIdx = weekdayKeys.indexOf(selectedCell.fecha);
      if (engIdx === -1 || dateIdx === -1) return;

      let ne = engIdx;
      let nd = dateIdx;
      let nq = selectedCell.quarter;

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
          if (ne > 0) ne--;
          else return;
          break;
        case 'ArrowDown':
          if (ne < ingenieros.length - 1) ne++;
          else return;
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedCell(null);
          return;
        default:
          return;
      }

      e.preventDefault();
      const ing = ingenieros[ne];
      const fecha = weekdayKeys[nd];
      const found = findEntriesAtCell(entries, ing.id, fecha, nq);
      setSelectedCell({
        ingenieroId: ing.id,
        ingenieroNombre: ing.nombre,
        fecha,
        quarter: nq,
        entry: found[0] || null,
        allEntries: found,
      });
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCell, setSelectedCell, ingenieros, visibleDays, entries, callbacks]);
}
