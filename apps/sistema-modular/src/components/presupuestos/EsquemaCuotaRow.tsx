/**
 * EsquemaCuotaRow — Single editable row in the cuota schema editor.
 * Part of Phase 12 Plan 02: EsquemaFacturacionSection UI.
 *
 * Props:
 *   cuota         — the cuota data
 *   index         — 0-based index (for numero display)
 *   monedasActivas — which moneda columns to show
 *   totalsByCurrency — gross total per moneda (for monto preview)
 *   readOnly      — true when ppto.estado !== 'borrador'
 *   onChange      — called with the updated cuota
 *   onDelete      — called when X is clicked
 */
import React from 'react';
import type { PresupuestoCuotaFacturacion, MonedaCuota } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';

const HITO_LABELS: Record<PresupuestoCuotaFacturacion['hito'], string> = {
  ppto_aceptado:     'Aceptación',
  oc_recibida:       'OC recibida',
  pre_embarque:      'Pre-embarque',
  todas_ots_cerradas: 'Todas las OTs cerradas',
  manual:            'Manual',
};

const HITO_OPTIONS = Object.entries(HITO_LABELS) as [PresupuestoCuotaFacturacion['hito'], string][];

const LOCKED_ESTADOS: PresupuestoCuotaFacturacion['estado'][] = ['solicitada', 'facturada', 'cobrada'];

interface Props {
  cuota: PresupuestoCuotaFacturacion;
  index: number;
  monedasActivas: MonedaCuota[];
  totalsByCurrency: Partial<Record<MonedaCuota, number>>;
  readOnly: boolean;
  onChange: (updated: PresupuestoCuotaFacturacion) => void;
  onDelete: () => void;
}

export const EsquemaCuotaRow: React.FC<Props> = ({
  cuota, index, monedasActivas, totalsByCurrency, readOnly, onChange, onDelete,
}) => {
  const isDeleteLocked = LOCKED_ESTADOS.includes(cuota.estado);

  const handlePorcentajeChange = (moneda: MonedaCuota, raw: string) => {
    const val = raw === '' ? undefined : parseFloat(raw);
    const porcentaje = val === undefined || isNaN(val) ? undefined : val;
    onChange({
      ...cuota,
      porcentajePorMoneda: {
        ...cuota.porcentajePorMoneda,
        [moneda]: porcentaje,
      },
    });
  };

  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      {/* Numero */}
      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400 pt-2 w-5 shrink-0 text-right">
        {index + 1}
      </span>

      {/* Descripción */}
      <div className="flex-1 min-w-0">
        <label className="block font-mono text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
          Descripción
        </label>
        <input
          type="text"
          value={cuota.descripcion}
          disabled={readOnly}
          onChange={e => onChange({ ...cuota, descripcion: e.target.value })}
          placeholder="Ej: Anticipo 30%"
          className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-700"
        />
      </div>

      {/* Hito */}
      <div className="w-40 shrink-0">
        <label className="block font-mono text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
          Hito
        </label>
        <select
          value={cuota.hito}
          disabled={readOnly}
          onChange={e => onChange({ ...cuota, hito: e.target.value as PresupuestoCuotaFacturacion['hito'] })}
          className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-700"
        >
          {HITO_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* % por moneda + monto preview */}
      {monedasActivas.map(m => {
        const pct = cuota.porcentajePorMoneda[m];
        const total = totalsByCurrency[m] ?? 0;
        const monto = ((pct ?? 0) / 100) * total;
        const simbolo = MONEDA_SIMBOLO[m] || '$';
        return (
          <div key={m} className="w-28 shrink-0">
            <label className="block font-mono text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
              % {m}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={pct ?? ''}
              disabled={readOnly}
              onChange={e => handlePorcentajeChange(m, e.target.value)}
              placeholder="0"
              className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
            {total > 0 && (pct ?? 0) > 0 && (
              <span className="block text-[10px] text-slate-400 mt-0.5">
                {simbolo} {monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        );
      })}

      {/* Delete */}
      <div className="pt-5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          disabled={readOnly || isDeleteLocked}
          onClick={onDelete}
          title={isDeleteLocked ? 'No se puede eliminar una cuota solicitada/facturada/cobrada' : 'Eliminar cuota'}
          className="text-slate-400 hover:text-red-500 px-1.5 py-1"
        >
          ✕
        </Button>
      </div>
    </div>
  );
};
