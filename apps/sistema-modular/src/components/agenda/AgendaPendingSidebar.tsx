import { type FC, useState, useMemo } from 'react';
import { OT_ESTADO_COLORS, OT_ESTADO_LABELS, otSinAgenda, tipoOTEfectivo, TIPO_OT_LABELS, OT_SIN_AGENDA_ESPERA } from '@ags/shared';
import type { WorkOrder, OTEstadoAdmin } from '@ags/shared';
import { useDraggable } from '@dnd-kit/core';
import { matchesSearch } from '../../utils/searchTerms';

interface AgendaPendingSidebarProps {
  pendingOTs: WorkOrder[];
  /** sistemaId → agsVisibleId (ID de equipo) para mostrar en cada tarjeta. */
  equipoIdBySistema?: Map<string, string>;
  selectedOTs: Set<string>;
  onToggleSelect?: (otNumber: string) => void;
  onCopyOT?: (ot: WorkOrder) => void;
  width?: number;
}

/**
 * OTs que NO se agendan (2026-08-21): entrega de partes, proveedor externo y
 * alquiler. Figuran en su propia pestaña para reclamarlas, no para coordinar
 * una visita que nunca va a existir.
 *
 * Antes solo contemplaba las entregas, así que alquiler y proveedor externo
 * caían en la cola de servicios esperando ser arrastrados a un día.
 * `otSinAgenda` resuelve por `tipoOT` y, si falta, deriva del tipo de servicio.
 */
const esEntrega = (ot: WorkOrder) => otSinAgenda(ot);

export const AgendaPendingSidebar: FC<AgendaPendingSidebarProps> = ({
  pendingOTs, equipoIdBySistema, selectedOTs, onToggleSelect, onCopyOT, width = 256,
}) => {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('');
  /** Pestañas de la cola (2026-08-04): servicios (agendables) vs entregas. */
  const [tab, setTab] = useState<'servicios' | 'entregas'>('servicios');

  const servicios = useMemo(() => pendingOTs.filter(ot => !esEntrega(ot)), [pendingOTs]);
  const entregas = useMemo(() => pendingOTs.filter(esEntrega), [pendingOTs]);
  const enTab = tab === 'servicios' ? servicios : entregas;

  const filtered = useMemo(() => {
    return enTab.filter(ot => {
      if (estadoFilter && (ot.estadoAdmin || 'CREADA') !== estadoFilter) return false;
      if (!search) return true;
      return matchesSearch(search, ot.otNumber, ot.razonSocial);
    });
  }, [enTab, search, estadoFilter]);

  // Count per estado for filter pills (de la pestaña activa)
  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enTab.forEach(ot => {
      const est = ot.estadoAdmin || 'CREADA';
      counts[est] = (counts[est] || 0) + 1;
    });
    return counts;
  }, [enTab]);

  const selCount = selectedOTs.size;

  return (
    <div className="h-full bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden" style={{ width }}>
      <div className="px-3 py-2 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700">A programar</h3>
          {selCount > 0 && (
            <span className="text-[9px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
              {selCount} sel.
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">{pendingOTs.length} OTs sin asignar</p>

        {/* Pestañas: servicios (se agendan) / entregas de partes (solo reclamo) */}
        <div className="flex gap-1 mt-1.5">
          <button
            onClick={() => { setTab('servicios'); setEstadoFilter(''); }}
            className={`flex-1 text-[10px] px-2 py-1 rounded font-medium transition-colors ${tab === 'servicios' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            Servicios ({servicios.length})
          </button>
          <button
            onClick={() => { setTab('entregas'); setEstadoFilter(''); }}
            className={`flex-1 text-[10px] px-2 py-1 rounded font-medium transition-colors ${tab === 'entregas' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            Sin agenda ({entregas.length})
          </button>
        </div>
        {tab === 'entregas' && (
          <p className="text-[9px] text-orange-600 mt-1">
            Entregas, proveedor externo y alquiler NO se agendan — esta lista es para reclamarlas.
          </p>
        )}
        {selCount > 0 && (
          <p className="text-[9px] text-teal-600 mt-1">
            Arrastrá a la celda destino, o presioná <kbd className="bg-slate-100 px-1 rounded text-slate-600">Ctrl+V</kbd> en la celda seleccionada
          </p>
        )}

        {/* Estado filter pills */}
        {Object.keys(estadoCounts).length > 1 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            <button
              onClick={() => setEstadoFilter('')}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${!estadoFilter ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Todas ({enTab.length})
            </button>
            {Object.entries(estadoCounts).map(([est, count]) => (
              <button
                key={est}
                onClick={() => setEstadoFilter(estadoFilter === est ? '' : est)}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${estadoFilter === est ? 'bg-slate-700 text-white' : `${OT_ESTADO_COLORS[est] || 'bg-slate-100 text-slate-500'} hover:opacity-80`}`}
              >
                {OT_ESTADO_LABELS[est as OTEstadoAdmin] || est} ({count})
              </button>
            ))}
          </div>
        )}

        {enTab.length > 5 && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar OT o cliente..."
            className="mt-1.5 w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-[11px] text-slate-400 text-center py-6">
            {search || estadoFilter ? 'Sin resultados' : 'No hay OTs pendientes'}
          </p>
        )}
        {filtered.map(ot => (
          <DraggableOTCard
            key={ot.otNumber}
            ot={ot}
            equipoAgsId={(ot.sistemaId && equipoIdBySistema?.get(ot.sistemaId)) || ''}
            selected={selectedOTs.has(ot.otNumber)}
            selectionCount={selCount}
            onToggleSelect={tab === 'servicios' ? onToggleSelect : undefined}
            onCopy={tab === 'servicios' ? onCopyOT : undefined}
            arrastrable={tab === 'servicios'}
          />
        ))}
      </div>
    </div>
  );
};

interface DraggableOTCardProps {
  ot: WorkOrder;
  /** agsVisibleId del sistema de la OT ('' si no tiene). */
  equipoAgsId: string;
  selected: boolean;
  selectionCount: number;
  onToggleSelect?: (otNumber: string) => void;
  onCopy?: (ot: WorkOrder) => void;
  /** false = entrega de partes: no se arrastra a la agenda (2026-08-04). */
  arrastrable?: boolean;
}

const DraggableOTCard: FC<DraggableOTCardProps> = ({
  ot, equipoAgsId, selected, selectionCount, onToggleSelect, onCopy, arrastrable = true,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pending:${ot.otNumber}`,
    data: { type: 'pending', ot },
    disabled: !arrastrable,
  });

  const estadoAdmin = ot.estadoAdmin || 'CREADA';
  const badgeClass = OT_ESTADO_COLORS[estadoAdmin] || 'bg-slate-100 text-slate-500';

  return (
    <div
      ref={setNodeRef}
      {...(arrastrable ? { ...listeners, ...attributes } : {})}
      className={`rounded-md px-2.5 py-2 border transition-shadow hover:shadow-sm
        ${arrastrable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${selected
          ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-300'
          : arrastrable ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200'}
        ${isDragging ? 'opacity-30' : ''}
      `}
    >
      <div className="flex items-center gap-1.5">
        {onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(ot.otNumber); }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              selected
                ? 'bg-teal-600 border-teal-600'
                : 'border-slate-300 hover:border-teal-400'
            }`}
          >
            {selected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}
        <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">OT-{ot.otNumber}</span>
        <span className={`text-[8px] font-medium px-1 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {OT_ESTADO_LABELS[estadoAdmin as OTEstadoAdmin] || estadoAdmin}
        </span>
        {isDragging && selected && selectionCount > 1 && (
          <span className="text-[8px] font-bold text-white bg-teal-600 rounded-full w-4 h-4 flex items-center justify-center shrink-0">
            {selectionCount}
          </span>
        )}
        {onCopy && (
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(ot); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-[9px] text-slate-400 hover:text-teal-600 transition-colors px-1 shrink-0"
            title="Copiar para pegar con Ctrl+V"
          >
            copiar
          </button>
        )}
      </div>
      <p className={`text-[10px] text-slate-500 truncate mt-0.5 ${onToggleSelect ? 'pl-5' : ''}`}>{ot.razonSocial}</p>
      {/* Qué espera esta OT para poder cerrarse (2026-08-21). Las tres familias
          sin agenda conviven en la misma pestaña y cada una se reclama distinto:
          sin esto, "Alquiler" y "Entrega" se ven iguales y no se sabe a quién
          reclamarle. */}
      {!arrastrable && tipoOTEfectivo(ot) !== 'servicio' && (
        <p className={`text-[9px] text-orange-700 truncate ${onToggleSelect ? 'pl-5' : ''}`}
          title={OT_SIN_AGENDA_ESPERA[tipoOTEfectivo(ot) as Exclude<typeof ot.tipoOT, 'servicio' | undefined | null>]}>
          {TIPO_OT_LABELS[tipoOTEfectivo(ot)]} — espera: {OT_SIN_AGENDA_ESPERA[tipoOTEfectivo(ot) as 'entrega' | 'proveedor_externo' | 'alquiler']}
        </p>
      )}
      {ot.sistema && <p className={`text-[10px] text-slate-400 truncate ${onToggleSelect ? 'pl-5' : ''}`}>{ot.sistema}</p>}
      {/* Tipo de servicio + ID de equipo (UAT 2026-07-17). Sin '—' si faltan. */}
      {(ot.tipoServicio || equipoAgsId) && (
        <p className="text-[10px] font-mono text-slate-400 truncate pl-5">
          {ot.tipoServicio}
          {ot.tipoServicio && equipoAgsId ? ' · ' : ''}
          {equipoAgsId}
        </p>
      )}
    </div>
  );
};
