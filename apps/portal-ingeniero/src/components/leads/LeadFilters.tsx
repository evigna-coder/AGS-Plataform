import type { LeadEstado, LeadArea, LeadPrioridad, MotivoLlamado } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS, LEAD_AREA_LABELS, LEAD_PRIORIDAD_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Button } from '../ui/Button';

const ESTADO_TABS: { value: LeadEstado | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'pendiente_info', label: 'Pend. info' },
  { value: 'en_presupuesto', label: 'Presupuesto' },
  { value: 'en_coordinacion', label: 'Coordinación' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'no_concretado', label: 'No concretado' },
];

export interface LeadFiltersState {
  motivo: MotivoLlamado | '';
  area: LeadArea | '';
  prioridad: LeadPrioridad | '';
  responsable: string;
  cliente: string;
  soloMios: boolean;
  fechaDesde: string;
  fechaHasta: string;
}

export const INITIAL_FILTERS: LeadFiltersState = {
  motivo: '', area: '', prioridad: '', responsable: '', cliente: '',
  soloMios: false, fechaDesde: '', fechaHasta: '',
};

interface LeadFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  estadoFilter: LeadEstado | '';
  onEstadoChange: (v: LeadEstado | '') => void;
  filters: LeadFiltersState;
  onFiltersChange: (f: LeadFiltersState) => void;
  usuarios: { id: string; displayName: string }[];
  clientes: { id: string; razonSocial: string }[];
}

export const LeadFilters = ({ search, onSearchChange, estadoFilter, onEstadoChange, filters, onFiltersChange, usuarios, clientes }: LeadFiltersProps) => {
  const set = (partial: Partial<LeadFiltersState>) => onFiltersChange({ ...filters, ...partial });
  const hasAdvanced = filters.motivo || filters.area || filters.prioridad || filters.responsable || filters.cliente || filters.fechaDesde || filters.fechaHasta;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por razón social, contacto..." value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
        <div className="flex items-center gap-1.5">
          {ESTADO_TABS.map(tab => (
            <button key={tab.value} onClick={() => onEstadoChange(tab.value as LeadEstado | '')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                estadoFilter === tab.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-auto">
          <input type="checkbox" checked={filters.soloMios} onChange={e => set({ soloMios: e.target.checked, responsable: '' })} className="rounded border-slate-300" />
          Mis leads
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2">
        <div className="min-w-[110px]">
          <SearchableSelect size="sm" value={filters.motivo}
            onChange={v => set({ motivo: v as MotivoLlamado | '' })}
            options={[{ value: '', label: 'Motivo: Todos' }, ...Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            placeholder="Motivo" />
        </div>
        <div className="min-w-[100px]">
          <SearchableSelect size="sm" value={filters.prioridad}
            onChange={v => set({ prioridad: v as LeadPrioridad | '' })}
            options={[{ value: '', label: 'Prioridad: Todas' }, ...Object.entries(LEAD_PRIORIDAD_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            placeholder="Prioridad" />
        </div>
        <div className="min-w-[110px]">
          <SearchableSelect size="sm" value={filters.area}
            onChange={v => set({ area: v as LeadArea | '' })}
            options={[{ value: '', label: 'Área: Todas' }, ...Object.entries(LEAD_AREA_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            placeholder="Área" />
        </div>
        {!filters.soloMios && (
          <div className="min-w-[120px]">
            <SearchableSelect size="sm" value={filters.responsable}
              onChange={v => set({ responsable: v })}
              options={[{ value: '', label: 'Responsable: Todos' }, ...usuarios.filter(u => u.displayName).map(u => ({ value: u.id, label: u.displayName }))]}
              placeholder="Responsable" />
          </div>
        )}
        <div className="min-w-[120px]">
          <SearchableSelect size="sm" value={filters.cliente} onChange={v => set({ cliente: v })}
            options={[{ value: '', label: 'Cliente: Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
            placeholder="Cliente" />
        </div>
        <input type="date" value={filters.fechaDesde} onChange={e => set({ fechaDesde: e.target.value })}
          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="Desde" />
        <input type="date" value={filters.fechaHasta} onChange={e => set({ fechaHasta: e.target.value })}
          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="Hasta" />
        {hasAdvanced && (
          <Button size="sm" variant="ghost" onClick={() => onFiltersChange(INITIAL_FILTERS)}>Limpiar</Button>
        )}
      </div>
    </>
  );
};
