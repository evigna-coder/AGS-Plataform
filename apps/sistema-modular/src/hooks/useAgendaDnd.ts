import { useCallback, useRef, useState } from 'react';
import type { AgendaEntry, WorkOrder } from '@ags/shared';
import { useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent, Modifier } from '@dnd-kit/core';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { ordenesTrabajoService } from '../services/otService';
import { findEntriesAtCell, formatDateKey, type SelectedCell } from '../utils/agendaDateUtils';
import { resolveEquipoAgsId } from '../utils/agendaOTSync';

/** Keep the drag chip centered on the cursor regardless of grab origin. */
const CHIP = 13; // half of 26px chip
export const snapToCursor: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
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

interface UseAgendaDndArgs {
  entries: AgendaEntry[];
  pendingOTs: WorkOrder[];
  ingenieros: { id: string; nombre: string }[];
  selectedPendingOTs: Set<string>;
  setSelectedPendingOTs: (s: Set<string>) => void;
  setSelectedCell: (c: SelectedCell | null) => void;
  createEntry: (data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>) => void;
  updateEntry: (id: string, data: Partial<AgendaEntry>) => void;
}

/**
 * Hook con todo el flow de drag-and-drop de la agenda. Antes vivía inline
 * en AgendaPage.tsx — ~165 líneas de handlers + DOM-direct row highlight.
 *
 * Maneja 3 tipos de drag:
 *   - `pending:OT-XXXX` → crear entry o extender entry existente del mismo OT.
 *   - `entry:ID` → mover entry existente (preserva span de días).
 *   - `resize:ING:FECHA:Q` → extender fechaFin/quarterEnd al cell target.
 */
export function useAgendaDnd(args: UseAgendaDndArgs) {
  const {
    entries, pendingOTs, ingenieros, selectedPendingOTs,
    setSelectedPendingOTs, setSelectedCell, createEntry, updateEntry,
  } = args;

  const [activeDragOT, setActiveDragOT] = useState<WorkOrder | null>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<AgendaEntry | null>(null);
  // Row highlight during drag: DOM-only, no React state (onDragOver fires at 60fps)
  const highlightedRowRef = useRef<HTMLElement | null>(null);

  // Use ref to access latest selectedPendingOTs inside drag handler
  const selectedPendingOTsRef = useRef(selectedPendingOTs);
  selectedPendingOTsRef.current = selectedPendingOTs;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('pending:')) {
      const otNumber = activeId.replace('pending:', '');
      const ot = pendingOTs.find(o => o.otNumber === otNumber);
      if (ot && !selectedPendingOTs.has(otNumber)) {
        setSelectedPendingOTs(new Set([otNumber]));
      }
      setActiveDragOT(ot || null);
    } else if (activeId.startsWith('entry:')) {
      const entryData = event.active.data.current?.entry as AgendaEntry | undefined;
      setActiveDragEntry(entryData || null);
    }
  }, [pendingOTs, selectedPendingOTs, setSelectedPendingOTs]);

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
          }).catch(err => console.error('[useAgendaDnd] sync OT en DnD drop falló:', err));
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
  }, [pendingOTs, ingenieros, entries, createEntry, updateEntry, setSelectedPendingOTs, setSelectedCell]);

  return {
    sensors,
    activeDragOT,
    activeDragEntry,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
