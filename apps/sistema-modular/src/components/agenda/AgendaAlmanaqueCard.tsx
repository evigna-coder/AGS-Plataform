import { type FC } from 'react';
import type { AgendaEntry } from '@ags/shared';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';
import { useTabs } from '../../contexts/TabsContext';

/**
 * Franja izquierda por estado. Los `*_interior` caen a su estado base a
 * propósito: el viaje al interior es una marca ortogonal, no otro estado del
 * ciclo — en el portal, que no hace este reemplazo, salen todos grises.
 */
const BORDE: Record<string, string> = {
  pendiente: 'border-l-slate-400',
  tentativo: 'border-l-amber-400',
  confirmado: 'border-l-blue-500',
  en_progreso: 'border-l-teal-500',
  completado: 'border-l-emerald-500',
  cancelado: 'border-l-red-400',
};

interface Props {
  entry: AgendaEntry;
}

/**
 * Servicio dentro de una celda del almanaque (2026-08-14). Compacta a
 * propósito: entran varias por día sin que la fila crezca. Todo el detalle
 * completo está en la OT, a un click.
 */
export const AgendaAlmanaqueCard: FC<Props> = ({ entry }) => {
  const { navigateInActiveTab } = useTabs();
  const color = ESTADO_AGENDA_COLORS[entry.estadoAgenda] ?? 'bg-slate-100 text-slate-600';
  const borde = BORDE[entry.estadoAgenda.replace(/_interior$/, '')] ?? 'border-l-slate-400';
  const manual = !entry.otNumber;
  const titulo = manual ? (entry.titulo || 'Tarea') : `OT-${entry.otNumber}`;
  const detalle = [entry.tipoServicio, entry.sistemaNombre, entry.equipoModelo]
    .filter(Boolean).join(' · ');

  const cls = `block w-full text-left bg-white rounded border border-slate-200 border-l-4 ${borde} px-1.5 py-1 hover:shadow-sm transition-shadow`;
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <span className={`text-[10px] font-bold leading-tight truncate ${manual ? 'text-slate-700' : 'text-teal-600'}`}>
          {titulo}
        </span>
        <span className={`text-[8px] font-semibold px-1 py-px rounded-full shrink-0 leading-tight ${color}`}>
          {ESTADO_AGENDA_LABELS[entry.estadoAgenda] ?? entry.estadoAgenda}
        </span>
      </div>
      {!manual && entry.clienteNombre && (
        <p className="text-[10px] text-slate-700 font-medium leading-tight truncate">{entry.clienteNombre}</p>
      )}
      {detalle && <p className="text-[9px] text-slate-400 leading-tight truncate mt-0.5">{detalle}</p>}
      {entry.equipoAgsId && (
        <p className="text-[9px] font-mono text-slate-400 leading-tight truncate">{entry.equipoAgsId}</p>
      )}
      {/* Problema / Falla inicial (2026-08-19): en una visita de diagnóstico/reparación
          el tipo de servicio no dice cuál es el problema ni qué hay que llevar.
          Acá va a 2 líneas —la celda del almanaque es chica— y completo en el
          title; en el popover de la vista Planificación se ve entero. */}
      {entry.problemaFallaInicial && (
        <p className="text-[9px] text-slate-600 leading-tight mt-0.5 line-clamp-2"
          title={entry.problemaFallaInicial}>
          {entry.problemaFallaInicial}
        </p>
      )}
    </>
  );

  return manual ? (
    <div className={cls} title={entry.notas ?? undefined}>{contenido}</div>
  ) : (
    <button
      onClick={() => navigateInActiveTab(`/ordenes-trabajo/${entry.otNumber}`)}
      className={cls}
      title={`Abrir OT ${entry.otNumber}${entry.notas ? ` — ${entry.notas}` : ''}`}
    >
      {contenido}
    </button>
  );
};
