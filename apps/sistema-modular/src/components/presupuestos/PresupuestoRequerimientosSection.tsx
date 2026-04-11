import React, { useEffect, useState, useCallback } from 'react';
import { useTabs } from '../../contexts/TabsContext';
import { requerimientosService } from '../../services/importacionesService';
import type { RequerimientoCompra } from '@ags/shared';

interface Props {
  presupuestoId: string;
  /** Bump this value to force a refresh (e.g. after save that may have triggered auto-req). */
  refreshKey?: number;
}

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  aprobado: 'bg-blue-100 text-blue-800',
  ordenado: 'bg-indigo-100 text-indigo-800',
  recibido: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-slate-100 text-slate-500',
};

/**
 * Displays requerimientos de compra auto-generados por este presupuesto.
 * Queries `requerimientos_compra` filtered by presupuestoId and shows a
 * collapsible card with the list. Provides visibility into the
 * otherwise-silent auto-generation performed by presupuestosService.
 */
export const PresupuestoRequerimientosSection: React.FC<Props> = ({ presupuestoId, refreshKey = 0 }) => {
  const { navigateInActiveTab } = useTabs();
  const [requerimientos, setRequerimientos] = useState<RequerimientoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requerimientosService.getAll({ presupuestoId });
      setRequerimientos(data);
    } catch (err) {
      console.error('[PresupuestoRequerimientosSection] Error cargando requerimientos:', err);
      setRequerimientos([]);
    } finally {
      setLoading(false);
    }
  }, [presupuestoId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading && requerimientos.length === 0) return null;
  if (!loading && requerimientos.length === 0) return null;

  const count = requerimientos.length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase flex items-center gap-2">
          Requerimientos de compra
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-teal-600 text-white text-[10px] font-semibold">
            {count}
          </span>
        </span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono mb-2">
            Auto-generados por items vinculados a stock
          </p>
          {requerimientos.map(req => (
            <div
              key={req.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-slate-100 hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{req.numero}</span>
                  <span className="text-xs text-slate-700 truncate">{req.articuloDescripcion}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">
                    Cant: <strong>{req.cantidad}</strong> {req.unidadMedida}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ESTADO_STYLES[req.estado] || 'bg-slate-100 text-slate-600'}`}>
                    {req.estado}
                  </span>
                  {req.ordenCompraNumero && (
                    <span className="text-[10px] text-slate-500">OC: {req.ordenCompraNumero}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigateInActiveTab('/stock/requerimientos')}
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
