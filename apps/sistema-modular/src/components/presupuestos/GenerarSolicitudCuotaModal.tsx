// Hidden currency rendering: per 12-RESEARCH Open Question 3 recommendation,
// monedas with porcentajePorMoneda[m] === 0 || undefined are HIDDEN entirely
// (no input rendered). This is a research-recommended concrete decision,
// NOT CONTEXT-locked. If user later requests showing hidden currencies as
// disabled placeholders with a 0 default, this is revisitable without a new phase.
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GenerarSolicitudCuotaInputs } from './GenerarSolicitudCuotaInputs';
import { computeTotalsByCurrency } from '../../utils/cuotasFacturacion';
import { presupuestosService } from '../../services/presupuestosService';
import type {
  PresupuestoCuotaFacturacion,
  PresupuestoItem,
  MonedaPresupuesto,
  MonedaCuota,
} from '@ags/shared';

const HITO_LABELS: Record<string, string> = {
  ppto_aceptado: 'Ppto. aceptado',
  oc_recibida: 'OC recibida',
  pre_embarque: 'Pre-embarque',
  todas_ots_cerradas: 'Todas las OTs cerradas',
  manual: 'Manual',
};

interface Props {
  open: boolean;
  cuota: PresupuestoCuotaFacturacion;
  presupuestoId: string;
  itemsForTotals: PresupuestoItem[];
  pptoMoneda: MonedaPresupuesto;
  otsListasParaFacturar: string[];
  onClose: () => void;
  onGenerated: (solicitudId: string) => void;
  actor?: { uid: string; name?: string };
}

export const GenerarSolicitudCuotaModal: React.FC<Props> = ({
  open,
  cuota,
  presupuestoId,
  itemsForTotals,
  pptoMoneda,
  otsListasParaFacturar,
  onClose,
  onGenerated,
  actor,
}) => {
  // I3: sole source of truth for per-moneda totals
  const totalsByCurrency = computeTotalsByCurrency(itemsForTotals, pptoMoneda);

  // monedasInCuota: only monedas with porcentaje > 0 (zero/missing = HIDDEN per W6)
  const monedasInCuota = (Object.keys(cuota.porcentajePorMoneda ?? {}) as MonedaCuota[]).filter(
    m => (cuota.porcentajePorMoneda?.[m] ?? 0) > 0,
  );

  // Default value per moneda: (pct / 100) * total, rounded to 2 decimals
  const defaults: Record<string, number> = {};
  monedasInCuota.forEach(m => {
    const pct = cuota.porcentajePorMoneda?.[m] ?? 0;
    const total = totalsByCurrency[m] ?? 0;
    defaults[m] = Math.round((pct / 100) * total * 100) / 100;
  });

  const [montos, setMontos] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState('');
  const [selectedOts, setSelectedOts] = useState<Set<string>>(new Set());
  const [showOtSelector, setShowOtSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when cuota changes or modal opens
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      monedasInCuota.forEach(m => {
        initial[m] = defaults[m] !== undefined ? String(defaults[m]) : '';
      });
      setMontos(initial);
      setObservaciones('');
      setSelectedOts(new Set());
      setShowOtSelector(false);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cuota.id]);

  const setMonto = (moneda: MonedaCuota, value: string) => {
    setMontos(prev => ({ ...prev, [moneda]: value }));
  };

  const toggleOt = (ot: string) => {
    setSelectedOts(prev => {
      const next = new Set(prev);
      if (next.has(ot)) next.delete(ot); else next.add(ot);
      return next;
    });
  };

  const isConfirmDisabled = loading || monedasInCuota.some(m => {
    const v = parseFloat(montos[m] ?? '');
    return isNaN(v) || v <= 0;
  });

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const montoPorMoneda = Object.fromEntries(
        monedasInCuota.map(m => [m, parseFloat(montos[m]) || 0]),
      ) as Record<MonedaCuota, number>;

      const { solicitudId } = await presupuestosService.generarAvisoFacturacion(
        presupuestoId,
        Array.from(selectedOts),
        {
          cuotaId: cuota.id,
          montoPorMoneda,
          observaciones: observaciones.trim() || undefined,
          // monto legacy field intentionally omitted — cuotaId path uses montoPorMoneda
        },
        actor,
      );
      onGenerated(solicitudId);
      onClose();
    } catch (err: any) {
      // Do NOT close on error — surface inline for the user
      setError(err?.message || 'Error al generar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Generar solicitud — Cuota N° ${cuota.numero}`}
      subtitle={`${cuota.descripcion} — hito: ${HITO_LABELS[cuota.hito] ?? cuota.hito}`}
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={isConfirmDisabled}>
            {loading ? 'Generando...' : 'Confirmar'}
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Per 12-04 W5 — inputs block extracted to GenerarSolicitudCuotaInputs.tsx for ≤250 line budget. */}
        <GenerarSolicitudCuotaInputs
          monedasInCuota={monedasInCuota}
          montos={montos}
          setMonto={setMonto}
          defaults={defaults}
          totalsByCurrency={totalsByCurrency}
          porcentajesPorMoneda={cuota.porcentajePorMoneda as Record<string, number>}
        />

        {/* Observaciones */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide font-mono mb-1">
            Observaciones
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Notas libres para el contable (opcional)"
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
          />
        </div>

        {/* Optional OT reference selector */}
        {otsListasParaFacturar.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowOtSelector(v => !v)}
              className="text-[10px] font-mono uppercase tracking-wide text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1"
            >
              <span>{showOtSelector ? '▾' : '▸'}</span>
              Incluir OTs como referencia ({selectedOts.size} seleccionada{selectedOts.size !== 1 ? 's' : ''})
            </button>
            {showOtSelector && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-400">
                  Los nros de OT seleccionados apareceran en la solicitud como concepto. No se removeran de OTs listas para facturar (anticipo).
                </p>
                {otsListasParaFacturar.map(ot => (
                  <label key={ot} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOts.has(ot)}
                      onChange={() => toggleOt(ot)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="font-mono text-sm text-slate-700">{ot}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};
