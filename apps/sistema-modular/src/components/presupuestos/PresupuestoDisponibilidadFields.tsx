import React from 'react';
import type { Disponibilidad } from '@ags/shared';
import { DISPONIBILIDAD_LABELS } from '@ags/shared';

interface PresupuestoDisponibilidadFieldsProps {
  disponibilidad: Disponibilidad | null | undefined;
  etaDiasEstimados: number | null | undefined;
  onChange: (next: { disponibilidad: Disponibilidad | null; etaDiasEstimados: number | null }) => void;
  /** 'modal' = vertical stack full-width; 'row' = inline 2-col compact. Default 'modal'. */
  variant?: 'modal' | 'row';
  /** When known, shows a small ATP caption below the select. */
  atpHint?: { atp: number } | null;
  disabled?: boolean;
}

type DispOption = { value: Disponibilidad | ''; label: string };

const DISP_OPTIONS: DispOption[] = [
  { value: '',                 label: '— Sin definir —' },
  { value: 'stock',            label: DISPONIBILIDAD_LABELS.stock },
  { value: 'post_facturacion', label: DISPONIBILIDAD_LABELS.post_facturacion },
  { value: 'a_importar',       label: DISPONIBILIDAD_LABELS.a_importar },
  { value: 'en_transito',      label: DISPONIBILIDAD_LABELS.en_transito },
];

const LABEL_CLS =
  'block text-[10px] uppercase tracking-wide font-mono text-slate-500 mb-1';
const INPUT_CLS =
  'w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400';

export const PresupuestoDisponibilidadFields: React.FC<PresupuestoDisponibilidadFieldsProps> = ({
  disponibilidad,
  etaDiasEstimados,
  onChange,
  variant = 'modal',
  atpHint,
  disabled,
}) => {
  const handleDispChange = (v: string) => {
    const next = (v || null) as Disponibilidad | null;
    onChange({ disponibilidad: next, etaDiasEstimados: etaDiasEstimados ?? null });
  };

  const handleEtaChange = (v: string) => {
    const parsed = v.trim() === '' ? null : Number(v);
    const safe = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    onChange({ disponibilidad: disponibilidad ?? null, etaDiasEstimados: safe });
  };

  const layoutCls = variant === 'row' ? 'grid grid-cols-2 gap-2' : 'space-y-3';

  return (
    <div className={layoutCls}>
      <div>
        <label className={LABEL_CLS}>Disponibilidad</label>
        <select
          value={disponibilidad ?? ''}
          onChange={(e) => handleDispChange(e.target.value)}
          className={INPUT_CLS}
          disabled={disabled}
          data-testid="disp-select"
        >
          {DISP_OPTIONS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {atpHint != null && (
          <span className="block text-[10px] text-slate-400 mt-1 font-mono">
            ATP: {atpHint.atp}
          </span>
        )}
      </div>
      <div>
        <label className={LABEL_CLS}>ETA (días desde aceptación)</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={etaDiasEstimados ?? ''}
          onChange={(e) => handleEtaChange(e.target.value)}
          placeholder={variant === 'row' ? '—' : 'Ej: 30'}
          className={INPUT_CLS}
          disabled={disabled}
          data-testid="disp-eta"
        />
      </div>
    </div>
  );
};
