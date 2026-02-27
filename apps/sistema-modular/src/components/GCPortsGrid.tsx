import React from 'react';
import type { ConfiguracionGC, InletType, DetectorType } from '@ags/shared';

interface GCPortsGridProps {
  value: ConfiguracionGC;
  onChange: (v: ConfiguracionGC) => void;
  readOnly?: boolean;
}

const INLET_OPTIONS: Array<{ value: InletType; label: string }> = [
  { value: 'SSL', label: 'SSL — Split/Splitless' },
  { value: 'COC', label: 'COC — Cool on Column' },
  { value: 'PTV', label: 'PTV — Programmed Temperature Vaporization' },
];

const DETECTOR_OPTIONS: Array<{ value: DetectorType; label: string }> = [
  { value: 'FID', label: 'FID — Flame Ionization Detector' },
  { value: 'NCD', label: 'NCD — Nitrogen/Phosphorus Detector' },
  { value: 'FPD', label: 'FPD — Flame Photometric Detector' },
  { value: 'ECD', label: 'ECD — Electron Capture Detector' },
  { value: 'SCD', label: 'SCD — Sulfur Chemiluminescence Detector' },
];

const selectClass =
  'w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400';

export const GCPortsGrid: React.FC<GCPortsGridProps> = ({ value, onChange, readOnly = false }) => {
  const handleChange = (field: keyof ConfiguracionGC, val: string) => {
    onChange({ ...value, [field]: val || null });
  };

  if (readOnly) {
    const noData =
      !value.puertoInyeccionFront &&
      !value.puertoInyeccionBack &&
      !value.detectorFront &&
      !value.detectorBack;

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-black uppercase text-amber-700 mb-3">Configuración de Puertos (GC)</p>
        {noData ? (
          <p className="text-xs text-slate-400 italic">Sin configuración de puertos cargada</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-sm items-center">
            <div />
            <p className="text-xs font-bold text-slate-500 text-center uppercase">Front</p>
            <p className="text-xs font-bold text-slate-500 text-center uppercase">Back</p>
            <p className="text-xs font-bold text-slate-700">Inyección</p>
            <p className="text-center font-mono font-bold text-slate-800">
              {value.puertoInyeccionFront ?? '—'}
            </p>
            <p className="text-center font-mono font-bold text-slate-800">
              {value.puertoInyeccionBack ?? '—'}
            </p>
            <p className="text-xs font-bold text-slate-700">Detector</p>
            <p className="text-center font-mono font-bold text-slate-800">
              {value.detectorFront ?? '—'}
            </p>
            <p className="text-center font-mono font-bold text-slate-800">
              {value.detectorBack ?? '—'}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-black uppercase text-amber-700 mb-3">Puertos (Cromatógrafo Gaseoso)</p>
      <div className="grid grid-cols-3 gap-3 items-center">
        {/* Header */}
        <div />
        <p className="text-xs font-black text-center text-slate-600 uppercase">Front</p>
        <p className="text-xs font-black text-center text-slate-600 uppercase">Back</p>

        {/* Puertos de inyección */}
        <p className="text-xs font-bold text-slate-700">Puertos de inyección</p>
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

        {/* Detectores */}
        <p className="text-xs font-bold text-slate-700">Detectores</p>
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
      </div>
    </div>
  );
};
