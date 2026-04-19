import React from 'react';
import type { ConfiguracionGC, InletType, DetectorType } from '@ags/shared';

interface GCPortsGridProps {
  value: ConfiguracionGC;
  onChange: (v: ConfiguracionGC) => void;
  readOnly?: boolean;
}

const INLET_OPTIONS: Array<{ value: InletType; label: string }> = [
  { value: 'SSL', label: 'SSL' },
  { value: 'COC', label: 'COC' },
  { value: 'PTV', label: 'PTV' },
  { value: 'PP', label: 'PP' },
];

const DETECTOR_OPTIONS: Array<{ value: DetectorType; label: string }> = [
  { value: 'FID', label: 'FID' },
  { value: 'TCD', label: 'TCD' },
  { value: 'NCD', label: 'NCD' },
  { value: 'FPD', label: 'FPD' },
  { value: 'ECD', label: 'ECD' },
  { value: 'uECD', label: 'uECD' },
  { value: 'SCD', label: 'SCD' },
  { value: 'MSD', label: 'MSD' },
];

const selectClass =
  'w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400';

export const GCPortsGrid: React.FC<GCPortsGridProps> = ({ value, onChange, readOnly = false }) => {
  const handleChange = (field: keyof ConfiguracionGC, val: string) => {
    onChange({ ...value, [field]: val || null });
  };

  if (readOnly) {
    const noData =
      !value.puertoInyeccionFront &&
      !value.puertoInyeccionBack &&
      !value.puertoInyeccionAux &&
      !value.detectorFront &&
      !value.detectorBack &&
      !value.detectorAux;

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase text-amber-600 tracking-wider mb-1.5">Puertos GC</p>
        {noData ? (
          <p className="text-[11px] text-slate-400 italic">Sin configuración cargada</p>
        ) : (
          <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 items-center">
            <div />
            <p className="text-[10px] font-medium text-slate-400 text-center uppercase">Front</p>
            <p className="text-[10px] font-medium text-slate-400 text-center uppercase">Back</p>
            <p className="text-[10px] font-medium text-slate-400 text-center uppercase">Aux</p>
            <p className="text-[11px] font-medium text-slate-600">Inyección</p>
            <p className="text-center font-mono text-xs font-semibold text-slate-800">
              {value.puertoInyeccionFront ?? '—'}
            </p>
            <p className="text-center font-mono text-xs font-semibold text-slate-800">
              {value.puertoInyeccionBack ?? '—'}
            </p>
            <p className="text-center font-mono text-xs font-semibold text-slate-800">
              {value.puertoInyeccionAux ?? '—'}
            </p>
            <p className="text-[11px] font-medium text-slate-600">Detector</p>
            <p className="text-center font-mono text-xs font-semibold text-slate-800">
              {value.detectorFront ?? '—'}
            </p>
            <p className="text-center font-mono text-xs font-semibold text-slate-800">
              {value.detectorBack ?? '—'}
            </p>
            <p className="text-center font-mono text-xs font-semibold text-slate-800">
              {value.detectorAux ?? '—'}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-amber-600 tracking-wider mb-1.5">Puertos GC</p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 items-center">
        {/* Header */}
        <div />
        <p className="text-[10px] font-medium text-center text-slate-500 uppercase">Front</p>
        <p className="text-[10px] font-medium text-center text-slate-500 uppercase">Back</p>
        <p className="text-[10px] font-medium text-center text-slate-500 uppercase">Aux</p>

        {/* Puertos de inyección */}
        <p className="text-[11px] font-medium text-slate-700">Inyección</p>
        <select
          value={value.puertoInyeccionFront ?? ''}
          onChange={e => handleChange('puertoInyeccionFront', e.target.value)}
          className={selectClass}
        >
          <option value="">— Ninguno —</option>
          {INLET_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={value.puertoInyeccionBack ?? ''}
          onChange={e => handleChange('puertoInyeccionBack', e.target.value)}
          className={selectClass}
        >
          <option value="">— Ninguno —</option>
          {INLET_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={value.puertoInyeccionAux ?? ''}
          onChange={e => handleChange('puertoInyeccionAux', e.target.value)}
          className={selectClass}
        >
          <option value="">— Ninguno —</option>
          {INLET_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Detectores */}
        <p className="text-[11px] font-medium text-slate-700">Detector</p>
        <select
          value={value.detectorFront ?? ''}
          onChange={e => handleChange('detectorFront', e.target.value)}
          className={selectClass}
        >
          <option value="">— Ninguno —</option>
          {DETECTOR_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={value.detectorBack ?? ''}
          onChange={e => handleChange('detectorBack', e.target.value)}
          className={selectClass}
        >
          <option value="">— Ninguno —</option>
          {DETECTOR_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={value.detectorAux ?? ''}
          onChange={e => handleChange('detectorAux', e.target.value)}
          className={selectClass}
        >
          <option value="">— Ninguno —</option>
          {DETECTOR_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
