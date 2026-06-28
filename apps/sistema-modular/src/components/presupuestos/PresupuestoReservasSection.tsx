import React, { useEffect, useState, useCallback } from 'react';
import { useTabs } from '../../contexts/TabsContext';
import { reservasService } from '../../services/stockService';
import type { UnidadStock } from '@ags/shared';

interface Props {
  presupuestoId: string;
  /** Bump this value to force a refresh (e.g. after reservar/aceptar). */
  refreshKey?: number;
}

/** Identificador legible de la unidad reservada (serie / lote / cantidad). */
function unidadIdent(u: UnidadStock): string {
  if (u.nroSerie) return `S/N ${u.nroSerie}`;
  if (u.nroLote) return `Lote ${u.nroLote}${(u.cantidad ?? 1) > 1 ? ` ×${u.cantidad}` : ''}`;
  return `${u.cantidad ?? 1} u.`;
}

/**
 * Muestra las unidades de stock actualmente reservadas para este presupuesto
 * (estado 'reservado', campo reservadoParaPresupuestoId). Da visibilidad de lo
 * que la aceptación reservó automáticamente y lo que Materiales debe apartar.
 */
export const PresupuestoReservasSection: React.FC<Props> = ({ presupuestoId, refreshKey = 0 }) => {
  const { navigateInActiveTab } = useTabs();
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUnidades(await reservasService.getByPresupuesto(presupuestoId));
    } catch (err) {
      console.error('[PresupuestoReservasSection] Error cargando reservas:', err);
      setUnidades([]);
    } finally {
      setLoading(false);
    }
  }, [presupuestoId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading && unidades.length === 0) return null;
  if (!loading && unidades.length === 0) return null;

  const totalUnidades = unidades.reduce((acc, u) => acc + (u.cantidad ?? 1), 0);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase flex items-center gap-2">
          Stock reservado
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">
            {totalUnidades}
          </span>
        </span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono mb-2">
            Unidades reservadas para este presupuesto
          </p>
          {unidades.map(u => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-slate-100 hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{u.articuloCodigo}</span>
                  <span className="text-xs text-slate-700 truncate">{u.articuloDescripcion}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">{unidadIdent(u)}</span>
                  <span className="text-[10px] text-slate-400">· {u.ubicacion?.referenciaNombre ?? 'RESERVAS'}</span>
                </div>
              </div>
              <button
                onClick={() => navigateInActiveTab('/stock/unidades?estado=reservado')}
                className="text-[10px] text-teal-700 hover:text-teal-900 underline whitespace-nowrap"
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
