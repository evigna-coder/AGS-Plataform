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
  /** Bloqueo DURO de feriados (2026-07-30): devuelve la fecha del feriado tocado
   *  o null. El guard corre ANTES del drop porque el sync de la OT (ingeniero +
   *  ASIGNADA) es paralelo al alta de la entrada. */
  primerFeriadoEnRango?: (inicio: string, fin: string) => string | null;
  /** Día AGS (2026-08-02): día no laborable POR INGENIERO — bloquea el drop
   *  sobre la celda de ese ingeniero, igual que un feriado pero individual. */
  primerDiaAgsEnRango?: (ingenieroId: string, inicio: string, fin: string) => string | null;
  /** El comentario de la celda describe al servicio, no a la celda física
   *  (UAT 2026-07-30): al mover una entrada por DnD, relocaliza el comentario
   *  de la celda origen a la celda destino. */
  moverNotaConEntry?: (
    src: { ingenieroId: string; fecha: string; quarter: 1 | 2 | 3 | 4 },
    tgt: { ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1 | 2 | 3 | 4 },
  ) => void;
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
    primerFeriadoEnRango, primerDiaAgsEnRango, moverNotaConEntry,
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

    // Bloqueo duro de feriados: nada se puede soltar sobre un día feriado.
    const feriadoTarget = primerFeriadoEnRango?.(targetFecha, targetFecha);
    if (feriadoTarget) {
      alert(`El ${feriadoTarget} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
      return;
    }
    // Día AGS del ingeniero destino: no laborable para ÉL — mismo bloqueo.
    const diaAgsTarget = primerDiaAgsEnRango?.(targetIngenieroId, targetFecha, targetFecha);
    if (diaAgsTarget) {
      alert(`El ${diaAgsTarget} es día AGS de ${targetIngeniero.nombre} (no laborable) — no se le puede agendar ese día. Para hacerlo, quitá el día AGS (click derecho sobre la celda).`);
      return;
    }

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
          // Sync la OT: asignar ingeniero + fecha y transicionar a ASIGNADA si
          // estaba en CREADA. El estado se lee FRESCO de Firestore (2026-08-03):
          // el `ot` de la cola puede tener hasta 60s de atraso — tras eliminar
          // una entrada (que revierte la OT a CREADA) decía ASIGNADA, no se
          // promocionaba, y la OT re-agendada quedaba CREADA.
          ordenesTrabajoService.getByOtNumber(ot.otNumber).then(fresh => {
            const shouldPromote = !fresh?.estadoAdmin || fresh.estadoAdmin === 'CREADA';
            // skipAgendaSync: la entrada se crea acá — evita el duplicado del
            // rebote OT→agenda si el ensure gana la carrera al addDoc.
            return ordenesTrabajoService.update(ot.otNumber, {
              ingenieroAsignadoId: targetIngenieroId,
              ingenieroAsignadoNombre: targetIngeniero.nombre,
              fechaServicioAprox: targetFecha,
              ...(shouldPromote ? { estadoAdmin: 'ASIGNADA', estadoAdminFecha: new Date().toISOString() } : {}),
            }, { skipAgendaSync: true });
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

      // Mover TODOS los servicios de la celda juntos (pedido 2026-08-03):
      // el drag movía solo la entrada de arriba y los demás quedaban atrás.
      const cellMates = findEntriesAtCell(entries, entry.ingenieroId, entry.fechaInicio, entry.quarterStart);
      const toMove = cellMates.length > 0 ? cellMates : [entry];

      const movedEntries: AgendaEntry[] = [];
      for (const en of toMove) {
        const daySpan = differenceInCalendarDays(parseISO(en.fechaFin), parseISO(en.fechaInicio));
        const newStart = parseISO(targetFecha);
        const newEnd = daySpan > 0 ? addDays(newStart, daySpan) : newStart;
        // Entradas de UN día: preservar la DURACIÓN en cuartos, no el
        // quarterEnd crudo (2026-08-04: mover Q1→Q3 dejaba Q3-Q1, rango
        // invertido = entrada INVISIBLE en la grilla). Multi-día: el fin cae
        // en otro día, cualquier cuarto es válido.
        const quarterEnd = daySpan === 0
          ? (Math.min(4, targetQuarter + Math.max(0, en.quarterEnd - en.quarterStart)) as 1 | 2 | 3 | 4)
          : en.quarterEnd;
        const cambios = {
          fechaInicio: targetFecha,
          fechaFin: formatDateKey(newEnd),
          quarterStart: targetQuarter,
          quarterEnd,
          ingenieroId: targetIngenieroId,
          ingenieroNombre: targetIngeniero.nombre,
        };
        movedEntries.push({ ...en, ...cambios });
        updateEntry(en.id, cambios);

        // Sync de la OT al mover (2026-08-03): el drag dejaba fechaServicioAprox
        // e ingeniero VIEJOS en la OT — la grilla decía una cosa y la OT otra.
        // skipAgendaSync: sin él, syncFromOT rebotaría sobre la entrada recién
        // movida y colapsaría un servicio de varios días a uno solo.
        if (en.otNumber) {
          const otNum = en.otNumber;
          ordenesTrabajoService.getByOtNumber(otNum).then(fresh => {
            if (!fresh) return;
            const shouldPromote = !fresh.estadoAdmin || fresh.estadoAdmin === 'CREADA';
            return ordenesTrabajoService.update(otNum, {
              ingenieroAsignadoId: targetIngenieroId,
              ingenieroAsignadoNombre: targetIngeniero.nombre,
              fechaServicioAprox: targetFecha,
              ...(shouldPromote ? { estadoAdmin: 'ASIGNADA', estadoAdminFecha: new Date().toISOString() } : {}),
            }, { skipAgendaSync: true });
          }).catch(err => console.error('[useAgendaDnd] sync OT al mover entrada falló:', err));
        }
      }

      // El comentario de la celda origen viaja con el servicio (quedaba
      // "pegado" a la celda al mover la entrada).
      moverNotaConEntry?.(
        { ingenieroId: entry.ingenieroId, fecha: entry.fechaInicio, quarter: entry.quarterStart },
        { ingenieroId: targetIngenieroId, ingenieroNombre: targetIngeniero.nombre, fecha: targetFecha, quarter: targetQuarter },
      );

      setSelectedCell({
        ingenieroId: targetIngenieroId,
        ingenieroNombre: targetIngeniero.nombre,
        fecha: targetFecha,
        quarter: targetQuarter,
        entry: movedEntries[0],
        allEntries: movedEntries,
      });
    }
  }, [pendingOTs, ingenieros, entries, createEntry, updateEntry, setSelectedPendingOTs, setSelectedCell, primerFeriadoEnRango, primerDiaAgsEnRango, moverNotaConEntry]);

  return {
    sensors,
    activeDragOT,
    activeDragEntry,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
