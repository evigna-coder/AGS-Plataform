import { useEffect, useState } from 'react';
import type { Pendiente, PendienteEstado } from '@ags/shared';
import {
  PENDIENTE_TIPO_LABELS,
  PENDIENTE_TIPO_COLORS,
  PENDIENTE_ESTADO_LABELS,
  PENDIENTE_ESTADO_COLORS,
} from '@ags/shared';
import { pendientesService } from '../../services/pendientesService';
import { CreatePendienteModal } from './CreatePendienteModal';
import { DescartarPendienteModal } from './DescartarPendienteModal';

interface Props {
  clienteId: string;
  clienteNombre: string;
  /** Si se pasa, filtra al equipo específico + pendientes generales del cliente (sin equipo) */
  equipoId?: string | null;
  equipoNombre?: string | null;
  /** Si es true, solo muestra lo del equipo específico (sin las generales del cliente) */
  strictEquipo?: boolean;
  /** Permite crear desde la sección */
  allowCreate?: boolean;
  title?: string;
}

const ESTADO_TABS: Array<{ value: PendienteEstado | ''; label: string }> = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'completada', label: 'Completadas' },
  { value: 'descartada', label: 'Descartadas' },
  { value: '', label: 'Todas' },
];

export const PendientesClienteSection: React.FC<Props> = ({
  clienteId,
  clienteNombre,
  equipoId,
  equipoNombre,
  strictEquipo = false,
  allowCreate = true,
  title = 'Pendientes',
}) => {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState<PendienteEstado | ''>('pendiente');
  const [showCreate, setShowCreate] = useState(false);
  const [editPendiente, setEditPendiente] = useState<Pendiente | null>(null);
  const [descartarPendiente, setDescartarPendiente] = useState<Pendiente | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    const unsub = pendientesService.subscribe(
      {
        clienteId,
        estado: estadoFilter || undefined,
        includeDescartadas: estadoFilter === 'descartada' || estadoFilter === '',
      },
      data => {
        let filtered = data;
        if (equipoId) {
          if (strictEquipo) {
            filtered = data.filter(p => p.equipoId === equipoId);
          } else {
            filtered = data.filter(p => !p.equipoId || p.equipoId === equipoId);
          }
        }
        setPendientes(filtered);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [clienteId, equipoId, estadoFilter, strictEquipo]);

  const handleReabrir = async (p: Pendiente) => {
    await pendientesService.reabrir(p.id);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-medium text-slate-500">{title}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Recordatorios que aparecen al crear presupuestos u órdenes de trabajo
          </p>
        </div>
        {allowCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-[11px] font-medium text-teal-600 hover:text-teal-700 border border-teal-300 rounded-md px-2.5 py-1 hover:bg-teal-50"
          >
            + Nueva
          </button>
        )}
      </div>

      {/* Estado tabs */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-1">
        {ESTADO_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setEstadoFilter(tab.value)}
            className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${
              estadoFilter === tab.value
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="p-3">
        {loading ? (
          <p className="text-[11px] text-slate-400 text-center py-4">Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-4">
            {estadoFilter === 'pendiente' ? 'No hay pendientes activas' : 'No hay resultados'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {pendientes.map(p => {
              const isPending = p.estado === 'pendiente';
              const isCompleted = p.estado === 'completada';
              const isDescartada = p.estado === 'descartada';
              return (
                <div
                  key={p.id}
                  className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 text-[9px] font-medium px-1.5 py-px rounded-full ${PENDIENTE_TIPO_COLORS[p.tipo]}`}
                    >
                      {PENDIENTE_TIPO_LABELS[p.tipo]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700">{p.descripcion}</p>
                      {p.equipoNombre && !equipoId && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {p.equipoNombre}
                          {p.equipoAgsId && (
                            <span className="font-mono ml-1">({p.equipoAgsId})</span>
                          )}
                        </p>
                      )}
                      {isCompleted && p.resolucionDocLabel && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          ✓ Resuelta en {p.resolucionDocLabel}
                          {p.completadaPorNombre && ` · ${p.completadaPorNombre}`}
                        </p>
                      )}
                      {isDescartada && p.descartadaMotivo && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5">
                          {p.descartadaMotivo}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-[9px] font-medium px-1.5 py-px rounded-full ${PENDIENTE_ESTADO_COLORS[p.estado]}`}
                    >
                      {PENDIENTE_ESTADO_LABELS[p.estado]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                      {p.createdByName && ` · ${p.createdByName}`}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      {isPending && (
                        <>
                          <button
                            onClick={() => setEditPendiente(p)}
                            className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-100"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDescartarPendiente(p)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50"
                          >
                            Descartar
                          </button>
                        </>
                      )}
                      {(isCompleted || isDescartada) && (
                        <button
                          onClick={() => handleReabrir(p)}
                          className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreatePendienteModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => setShowCreate(false)}
        initialClienteId={clienteId}
        initialClienteNombre={clienteNombre}
        initialEquipoId={equipoId || undefined}
        initialEquipoNombre={equipoNombre || undefined}
      />

      <CreatePendienteModal
        open={!!editPendiente}
        pendiente={editPendiente}
        onClose={() => setEditPendiente(null)}
        onSaved={() => setEditPendiente(null)}
      />

      <DescartarPendienteModal
        open={!!descartarPendiente}
        pendiente={descartarPendiente}
        onClose={() => setDescartarPendiente(null)}
        onDescartada={() => setDescartarPendiente(null)}
      />
    </div>
  );
};
