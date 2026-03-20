import { type FC, useState } from 'react';
import type { WorkOrder } from '@ags/shared';
import { useDraggable } from '@dnd-kit/core';

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
  const filtered = pendingOTs.filter(ot => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ot.otNumber.toLowerCase().includes(q) || ot.razonSocial.toLowerCase().includes(q);
  });

  const selCount = selectedOTs.size;

  return (
    <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700">A programar</h3>
          {selCount > 0 && (
            <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
              {selCount} sel.
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">{pendingOTs.length} OTs sin asignar</p>
        {pendingOTs.length > 5 && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar OT o cliente..."
            className="mt-1.5 w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-[11px] text-slate-400 text-center py-6">
            {search ? 'Sin resultados' : 'No hay OTs pendientes'}
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-md px-2.5 py-2 cursor-grab active:cursor-grabbing border transition-shadow hover:shadow-sm
        ${selected
          ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
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
              ? 'bg-indigo-600 border-indigo-600'
              : 'border-slate-300 hover:border-indigo-400'
          }`}
        >
          {selected && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">OT-{ot.otNumber}</span>
        {isDragging && selected && selectionCount > 1 && (
          <span className="text-[8px] font-bold text-white bg-indigo-600 rounded-full w-4 h-4 flex items-center justify-center shrink-0">
            {selectionCount}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onCopy?.(ot); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[9px] text-slate-400 hover:text-indigo-600 transition-colors px-1 shrink-0"
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
