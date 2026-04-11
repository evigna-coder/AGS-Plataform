import { useState } from 'react';
import type { PendienteTipo } from '@ags/shared';
import { PENDIENTE_TIPO_LABELS } from '@ags/shared';

export interface PendienteDraft {
  tempId: string;
  tipo: PendienteTipo;
  descripcion: string;
  equipoId: string | null;
  equipoNombre: string | null;
  equipoAgsId: string | null;
}

export interface PendientesDraftListProps {
  drafts: PendienteDraft[];
  onChange: (drafts: PendienteDraft[]) => void;
  /** Opciones de equipo del cliente seleccionado. Vacío = no mostrar selector */
  equipos?: Array<{ id: string; nombre: string; agsVisibleId?: string | null }>;
  disabled?: boolean;
}

/**
 * Sección compacta para agregar pendientes en el flujo de finalizar ticket
 * (u otros flujos donde se crean pendientes en lote antes del commit).
 * El parent es responsable de persistir los drafts cuando corresponda.
 */
export const PendientesDraftList: React.FC<PendientesDraftListProps> = ({
  drafts,
  onChange,
  equipos = [],
  disabled = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTipo, setNewTipo] = useState<PendienteTipo>('ambos');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [newEquipoId, setNewEquipoId] = useState('');

  const handleAdd = () => {
    if (!newDescripcion.trim()) return;
    const equipo = equipos.find(e => e.id === newEquipoId);
    const draft: PendienteDraft = {
      tempId: crypto.randomUUID(),
      tipo: newTipo,
      descripcion: newDescripcion.trim(),
      equipoId: newEquipoId || null,
      equipoNombre: equipo?.nombre ?? null,
      equipoAgsId: equipo?.agsVisibleId ?? null,
    };
    onChange([...drafts, draft]);
    setNewDescripcion('');
    setNewEquipoId('');
    setNewTipo('ambos');
    setShowAddForm(false);
  };

  const handleRemove = (tempId: string) => {
    onChange(drafts.filter(d => d.tempId !== tempId));
  };

  const TIPO_COLORS: Record<PendienteTipo, string> = {
    presupuesto: 'bg-blue-50 text-blue-700 border-blue-200',
    visita: 'bg-amber-50 text-amber-700 border-amber-200',
    ambos: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="space-y-2">
      {drafts.length > 0 && (
        <div className="space-y-1.5">
          {drafts.map(d => (
            <div
              key={d.tempId}
              className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5"
            >
              <span
                className={`shrink-0 text-[9px] font-medium px-1.5 py-px rounded-full border ${TIPO_COLORS[d.tipo]}`}
              >
                {PENDIENTE_TIPO_LABELS[d.tipo]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-700">{d.descripcion}</p>
                {d.equipoNombre && (
                  <p className="text-[10px] text-slate-400">
                    {d.equipoNombre}
                    {d.equipoAgsId && <span className="font-mono ml-1">({d.equipoAgsId})</span>}
                  </p>
                )}
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(d.tempId)}
                  className="shrink-0 text-[10px] text-slate-400 hover:text-red-600 transition-colors"
                  title="Quitar"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddForm ? (
        <div className="border border-teal-200 bg-teal-50/30 rounded-md p-2 space-y-2">
          <div className="flex items-center gap-1">
            {(Object.keys(PENDIENTE_TIPO_LABELS) as PendienteTipo[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setNewTipo(t)}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${
                  newTipo === t
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'
                }`}
              >
                {PENDIENTE_TIPO_LABELS[t]}
              </button>
            ))}
          </div>

          {equipos.length > 0 && (
            <select
              value={newEquipoId}
              onChange={e => setNewEquipoId(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] bg-white"
            >
              <option value="">Sin equipo específico</option>
              {equipos.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                  {e.agsVisibleId ? ` (${e.agsVisibleId})` : ''}
                </option>
              ))}
            </select>
          )}

          <textarea
            value={newDescripcion}
            onChange={e => setNewDescripcion(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] resize-none"
            placeholder="Ej: Cotizar filtros de split en próximo mantenimiento"
            maxLength={500}
            autoFocus
          />

          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewDescripcion('');
                setNewEquipoId('');
              }}
              className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-0.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newDescripcion.trim()}
              className="text-[10px] bg-teal-600 text-white px-2.5 py-0.5 rounded hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Agregar
            </button>
          </div>
        </div>
      ) : (
        !disabled && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full text-[11px] text-teal-600 hover:text-teal-700 font-medium border border-dashed border-teal-300 hover:border-teal-400 bg-teal-50/30 hover:bg-teal-50 rounded-md px-2 py-1.5 transition-colors"
          >
            + Agregar pendiente
          </button>
        )
      )}
    </div>
  );
};
