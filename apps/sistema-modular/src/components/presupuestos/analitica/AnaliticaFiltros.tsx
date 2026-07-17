import type { Cliente, UsuarioAGS } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS } from '@ags/shared';
import { Button } from '../../ui/Button';
import { SearchableSelect } from '../../ui/SearchableSelect';

export interface AnaliticaUrlFilters {
  fechaDesde: string;
  fechaHasta: string;
  cliente: string;
  tipo: string;
  responsable: string;
}

interface Props {
  filters: AnaliticaUrlFilters;
  onChange: (key: keyof AnaliticaUrlFilters, value: string) => void;
  onReset: () => void;
  clientes: Cliente[];
  usuarios: UsuarioAGS[];
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const inputCls =
  'text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500';

/** Rango de fechas con presets + cliente/tipo/responsable. Todo persiste en la URL. */
export const AnaliticaFiltros: React.FC<Props> = ({ filters, onChange, onReset, clientes, usuarios }) => {
  const setRango = (desde: string, hasta: string) => {
    onChange('fechaDesde', desde);
    onChange('fechaHasta', hasta);
  };

  const hoy = new Date();
  const presets: Array<{ label: string; desde: string; hasta: string }> = [
    { label: 'Este mes', desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) },
    {
      label: 'Mes pasado',
      desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    },
    { label: '90 días', desde: iso(new Date(hoy.getTime() - 90 * 86_400_000)), hasta: iso(hoy) },
    { label: 'Este año', desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) },
    { label: 'Histórico', desde: '', hasta: '' },
  ];

  const isActive = (p: { desde: string; hasta: string }) =>
    filters.fechaDesde === p.desde && filters.fechaHasta === p.hasta;

  const hasFilters =
    filters.fechaDesde || filters.fechaHasta || filters.cliente || filters.tipo || filters.responsable;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Período</span>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => setRango(p.desde, p.hasta)}
            className={`px-2 py-1 text-[11px] transition-colors ${
              isActive(p) ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" value={filters.fechaDesde} onChange={e => onChange('fechaDesde', e.target.value)}
        className={inputCls} title="Desde" />
      <input type="date" value={filters.fechaHasta} onChange={e => onChange('fechaHasta', e.target.value)}
        className={inputCls} title="Hasta" />
      <div className="min-w-[130px]">
        <SearchableSelect size="sm" value={filters.cliente} onChange={v => onChange('cliente', v)}
          options={[{ value: '', label: 'Cliente: Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
          placeholder="Cliente" />
      </div>
      <div className="min-w-[100px]">
        <SearchableSelect size="sm" value={filters.tipo} onChange={v => onChange('tipo', v)}
          options={[{ value: '', label: 'Tipo: Todos' }, ...Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
          placeholder="Tipo" />
      </div>
      <div className="min-w-[110px]">
        <SearchableSelect size="sm" value={filters.responsable} onChange={v => onChange('responsable', v)}
          options={[{ value: '', label: 'Responsable' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
          placeholder="Responsable" />
      </div>
      {hasFilters && (
        <Button size="sm" variant="ghost" onClick={onReset}>Limpiar</Button>
      )}
    </div>
  );
};
