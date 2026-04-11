import { useEffect, useMemo, useState } from 'react';
import type { Pendiente, PendienteTipo } from '@ags/shared';
import { PENDIENTE_TIPO_LABELS, PENDIENTE_TIPO_COLORS } from '@ags/shared';
import { pendientesService } from '../../services/pendientesService';

export interface PendientesActivosBannerProps {
  /** Cliente al que filtrar. Si es null/undefined, no carga nada. */
  clienteId: string | null | undefined;
  /** Si se pasa, solo muestra pendientes de ese equipo o sin equipo específico */
  equipoId?: string | null;
  /** Contexto: solo mostrar pendientes relevantes para este flujo */
  context: 'presupuesto' | 'ot';
  /** IDs de pendientes marcadas para incluir (controlado) */
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** Callback al descartar. El banner lo maneja vía service. */
  onDescartar?: (pendiente: Pendiente) => void;
}

/**
 * Banner expandible que muestra pendientes activas del cliente al crear presupuesto u OT.
 * - Carga real-time
 * - Filtrado por tipo (presupuesto/visita/ambos) según el contexto
 * - Si hay equipoId, filtra también por equipo (o sin equipo específico)
 * - Permite marcar cuáles incluir (checkbox) y descartar las que no aplican
 */
export const PendientesActivosBanner: React.FC<PendientesActivosBannerProps> = ({
  clienteId,
  equipoId,
  context,
  selectedIds,
  onSelectionChange,
  onDescartar,
}) => {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [descartandoId, setDescartandoId] = useState<string | null>(null);

  // Tipos relevantes según contexto
  const tiposRelevantes: PendienteTipo[] = useMemo(
    () => (context === 'presupuesto' ? ['presupuesto', 'ambos'] : ['visita', 'ambos']),
    [context],
  );

  useEffect(() => {
    if (!clienteId) {
      setPendientes([]);
      return;
    }
    setLoading(true);
    const unsub = pendientesService.subscribe(
      { clienteId, estado: 'pendiente' },
      data => {
        // Filtrar por tipo relevante para el contexto
        let filtered = data.filter(p => tiposRelevantes.includes(p.tipo));
        // Si se pasó un equipo, mostrar las de ese equipo + las sin equipo (generales del cliente)
        if (equipoId) {
          filtered = filtered.filter(p => !p.equipoId || p.equipoId === equipoId);
        }
        setPendientes(filtered);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [clienteId, equipoId, tiposRelevantes]);

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pendientes.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(pendientes.map(p => p.id)));
    }
  };

  const handleDescartarClick = async (p: Pendiente) => {
    const confirmado = confirm(`¿Descartar pendiente?\n\n"${p.descripcion}"`);
    if (!confirmado) return;
    setDescartandoId(p.id);
    try {
      await pendientesService.descartar(p.id, `Descartada al crear ${context}`);
      onDescartar?.(p);
    } catch (err) {
      console.error('Error descartando:', err);
      alert('No se pudo descartar');
    } finally {
      setDescartandoId(null);
    }
  };

  if (!clienteId) return null;
  if (loading && pendientes.length === 0) return null;
  if (pendientes.length === 0) return null;

  const selectedCount = selectedIds.size;
  const contextLabel = context === 'presupuesto' ? 'presupuesto' : 'OT';

  return (
    <div className="bg-amber-50/60 border border-amber-300 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-100/40 transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 text-amber-600 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
          Pendientes del cliente
        </span>
        <span className="text-[11px] font-medium text-amber-600 bg-white border border-amber-200 rounded-full px-1.5 py-px">
          {pendientes.length}
        </span>
        {selectedCount > 0 && (
          <span className="text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-1.5 py-px">
            {selectedCount} incluida{selectedCount > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-[10px] text-amber-600">
          {expanded ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-amber-200 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-amber-700/80">
              Marca las que correspondan a este {contextLabel}. Al guardar se marcarán como
              completadas.
            </p>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[10px] font-medium text-teal-600 hover:text-teal-700"
            >
              {selectedIds.size === pendientes.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>
          {pendientes.map(p => {
            const isSelected = selectedIds.has(p.id);
            const isDescartando = descartandoId === p.id;
            return (
              <div
                key={p.id}
                className={`flex items-start gap-2 bg-white border rounded-md px-2.5 py-1.5 transition-colors ${
                  isSelected ? 'border-teal-400 bg-teal-50/30' : 'border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(p.id)}
                  className="mt-0.5 rounded border-slate-300"
                  disabled={isDescartando}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[9px] font-medium px-1.5 py-px rounded-full ${PENDIENTE_TIPO_COLORS[p.tipo]}`}
                    >
                      {PENDIENTE_TIPO_LABELS[p.tipo]}
                    </span>
                    {p.equipoNombre && (
                      <span className="text-[10px] text-slate-500">
                        {p.equipoNombre}
                        {p.equipoAgsId && (
                          <span className="font-mono ml-0.5">({p.equipoAgsId})</span>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-700 mt-0.5">{p.descripcion}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDescartarClick(p)}
                  disabled={isDescartando}
                  className="shrink-0 text-[10px] text-slate-400 hover:text-red-600 transition-colors px-1"
                  title="Descartar pendiente (no aplica más)"
                >
                  {isDescartando ? '...' : 'Descartar'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
