import type { VistaFlujo, FiltroTipoFlujo } from '@ags/shared';

interface Props {
  vista: VistaFlujo;
  tipo: FiltroTipoFlujo;
  onVista: (v: VistaFlujo) => void;
  onTipo: (t: FiltroTipoFlujo) => void;
}

const VISTAS: { value: VistaFlujo; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
];
const TIPOS: { value: FiltroTipoFlujo; label: string }[] = [
  { value: '', label: 'Todo' },
  { value: 'vep', label: 'Solo VEP' },
  { value: 'giro', label: 'Solo giros' },
];

function Segmentado<T extends string>({ value, opciones, onChange, title }: {
  value: T; opciones: { value: T; label: string }[]; onChange: (v: T) => void; title: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden" title={title}>
      {opciones.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs transition-colors ${o.value === value
            ? 'bg-teal-700 text-white'
            : 'text-slate-600 hover:bg-slate-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Vista de Pagos VEP a gusto de cada usuario (2026-09-17): período de las
 * tarjetas (semana / quincena / mes) y qué mostrar (todo, solo VEP, solo
 * giros). Viven en la URL de la pestaña, que se persiste por PC.
 */
export function FlujoFondosFiltros({ vista, tipo, onVista, onTipo }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Segmentado value={vista} opciones={VISTAS} onChange={onVista} title="Agrupar los pagos por semana, quincena o mes" />
      <Segmentado value={tipo} opciones={TIPOS} onChange={onTipo} title="Qué pagos mostrar (las tarjetas de arriba siguen el mismo filtro)" />
    </div>
  );
}
