import { type FC, useState, useMemo } from 'react';
import type { WorkOrder, OTEstadoAdmin } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { useDraggable } from '@dnd-kit/core';

const ESTADO_BADGE: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-500',
  ASIGNADA: 'bg-blue-100 text-blue-600',
  COORDINADA: 'bg-violet-100 text-violet-600',
  EN_CURSO: 'bg-amber-100 text-amber-600',
};

interface AgendaPendingSidebarProps {
  pendingOTs: WorkOrder[];
  selectedOTs: Set<string>;
  onToggleSelect?: (otNumber: string) => void;
  onCopyOT?: (ot: WorkOrder) => void;
}

export const AgendaPendingSidebar: FC<AgendaPendingSidebarProps> = ({
  pendingOTs, selectedOTs, onToggleSelect, onCopyOT,
}) => {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('');

  const filtered = useMemo(() => {
    return pendingOTs.filter(ot => {
      if (estadoFilter && (ot.estadoAdmin || 'CREADA') !== estadoFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return ot.otNumber.toLowerCase().includes(q) || ot.razonSocial.toLowerCase().includes(q);
    });
  }, [pendingOTs, search, estadoFilter]);

  // Count per estado for filter pills
  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pendingOTs.forEach(ot => {
      const est = ot.estadoAdmin || 'CREADA';
      counts[est] = (counts[est] || 0) + 1;
    });
    return counts;
  }, [pendingOTs]);

  const selCount = selectedOTs.size;

  return (
    <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
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

        {/* Estado filter pills */}
        {Object.keys(estadoCounts).length > 1 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            <button
              onClick={() => setEstadoFilter('')}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${!estadoFilter ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Todas ({pendingOTs.length})
            </button>
            {Object.entries(estadoCounts).map(([est, count]) => (
              <button
                key={est}
                onClick={() => setEstadoFilter(estadoFilter === est ? '' : est)}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${estadoFilter === est ? 'bg-slate-700 text-white' : `${ESTADO_BADGE[est] || 'bg-slate-100 text-slate-500'} hover:opacity-80`}`}
              >
                {OT_ESTADO_LABELS[est as OTEstadoAdmin] || est} ({count})
              </button>
            ))}
          </div>
        )}

        {pendingOTs.length > 5 && (
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
            selected={selectedOTs.has(ot.otNumber)}
            selectionCount={selCount}
            onToggleSelect={onToggleSelect}
            onCopy={onCopyOT}
          />
        ))}
      </div>
    </div>
  );
};

interface DraggableOTCardProps {
  ot: WorkOrder;
  selected: boolean;
  selectionCount: number;
  onToggleSelect?: (otNumber: string) => void;
  onCopy?: (ot: WorkOrder) => void;
}

const DraggableOTCard: FC<DraggableOTCardProps> = ({
  ot, selected, selectionCount, onToggleSelect, onCopy,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pending:${ot.otNumber}`,
    data: { type: 'pending', ot },
  });

  const estadoAdmin = ot.estadoAdmin || 'CREADA';
  const badgeClass = ESTADO_BADGE[estadoAdmin] || 'bg-slate-100 text-slate-500';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-md px-2.5 py-2 cursor-grab active:cursor-grabbing border transition-shadow hover:shadow-sm
        ${selected
          ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-300'
          : 'bg-amber-50 border-amber-200'}
        ${isDragging ? 'opacity-30' : ''}
      `}
    >
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(ot.otNumber); }}
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
        <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">OT-{ot.otNumber}</span>
        <span className={`text-[8px] font-medium px-1 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {OT_ESTADO_LABELS[estadoAdmin as OTEstadoAdmin] || estadoAdmin}
        </span>
        {isDragging && selected && selectionCount > 1 && (
          <span className="text-[8px] font-bold text-white bg-teal-600 rounded-full w-4 h-4 flex items-center justify-center shrink-0">
            {selectionCount}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onCopy?.(ot); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[9px] text-slate-400 hover:text-teal-600 transition-colors px-1 shrink-0"
          title="Copiar para pegar con Ctrl+V"
        >
          copiar
        </button>
      </div>
      <p className="text-[10px] text-slate-500 truncate mt-0.5 pl-5">{ot.razonSocial}</p>
      {ot.sistema && <p className="text-[10px] text-slate-400 truncate pl-5">{ot.sistema}</p>}
    </div>
  );
};
