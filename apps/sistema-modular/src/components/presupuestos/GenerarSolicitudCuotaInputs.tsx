// Per 12-04 W5 — inputs block extracted to GenerarSolicitudCuotaInputs.tsx for ≤250 line budget.
import React from 'react';
import { MONEDA_SIMBOLO } from '@ags/shared';
import type { MonedaCuota } from '@ags/shared';

interface Props {
  monedasInCuota: MonedaCuota[];
  montos: Record<string, string>;
  setMonto: (moneda: MonedaCuota, value: string) => void;
  defaults: Record<string, number>;
  /** Raw totals per moneda, used to compute the override threshold */
  totalsByCurrency: Record<string, number>;
  /** porcentajePorMoneda per moneda — shown in the label */
  porcentajesPorMoneda: Record<string, number>;
}

/**
 * Renders N monto inputs (one per active moneda in the cuota) with optional
 * override warning when the user enters a value different from the cuota default.
 *
 * Used by GenerarSolicitudCuotaModal to stay under the 250-line budget.
 */
export const GenerarSolicitudCuotaInputs: React.FC<Props> = ({
  monedasInCuota,
  montos,
  setMonto,
  defaults,
  totalsByCurrency,
  porcentajesPorMoneda,
}) => {
  return (
    <div className="space-y-4">
      {monedasInCuota.map(m => {
        const simbolo = MONEDA_SIMBOLO[m] ?? '$';
        const defaultVal = defaults[m] ?? 0;
        const pct = porcentajesPorMoneda[m] ?? 0;
        const currentVal = parseFloat(montos[m] ?? '') || 0;
        const total = totalsByCurrency[m] ?? 0;
        // Override threshold: 0.01% of total (or 0.01 absolute if total tiny)
        const threshold = Math.max(total * 0.0001, 0.01);
        const isOverride = montos[m] !== '' && Math.abs(currentVal - defaultVal) > threshold;

        return (
          <div key={m}>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide font-mono mb-1">
              Monto {simbolo} ({pct}% del total)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={montos[m] ?? ''}
              onChange={e => setMonto(m, e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder={`${simbolo} ${defaultVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
            />
            {isOverride && (
              <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Override: monto distinto al {pct}% del total ({simbolo} {defaultVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}). Continuara pero quedara registrado en la solicitud.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
