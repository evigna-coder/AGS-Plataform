import type { LeadEstado, LeadArea, LeadPrioridad, MotivoLlamado } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS, TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

const ESTADO_TABS: { value: LeadEstado | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'relevamiento_pendiente', label: 'Relevamiento' },
  { value: 'presupuesto_pendiente', label: 'Presupuesto pend.' },
  { value: 'en_seguimiento', label: 'En seguimiento' },
  { value: 'en_coordinacion', label: 'Coordinación' },
  { value: 'no_concretado', label: 'No concretado' },
  { value: 'finalizado', label: 'Finalizado' },
];

export interface LeadFiltersState {
  motivo: MotivoLlamado | '';
  area: LeadArea | '';
  prioridad: LeadPrioridad | '';
  responsable: string;
  soloMios: boolean;
  misCreados: boolean;
  fechaDesde: string;
  fechaHasta: string;
}

export const INITIAL_FILTERS: LeadFiltersState = {
  motivo: '', area: '', prioridad: '', responsable: '',
  soloMios: false, misCreados: false, fechaDesde: '', fechaHasta: '',
};

interface LeadFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  estadoFilter: LeadEstado | '';
  onEstadoChange: (v: LeadEstado | '') => void;
  filters: LeadFiltersState;
  onFiltersChange: (f: LeadFiltersState) => void;
  usuarios: { id: string; displayName: string }[];
}

export const LeadFilters = ({ search, onSearchChange, estadoFilter, onEstadoChange, filters, onFiltersChange, usuarios }: LeadFiltersProps) => {
  const set = (partial: Partial<LeadFiltersState>) => onFiltersChange({ ...filters, ...partial });
  const hasAdvanced = filters.motivo || filters.area || filters.prioridad || filters.responsable || filters.fechaDesde || filters.fechaHasta;

  return (
    <>
      {/* Row 1: search + estado tabs + visibility */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por razón social, contacto..." value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64" />
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto">
          {ESTADO_TABS.map(tab => (
            <button key={tab.value} onClick={() => onEstadoChange(tab.value as LeadEstado | '')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                estadoFilter === tab.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.soloMios} onChange={e => set({ soloMios: e.target.checked, misCreados: false })} className="rounded border-slate-300" />
            Mis leads
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.misCreados} onChange={e => set({ misCreados: e.target.checked, soloMios: false })} className="rounded border-slate-300" />
            Mis creados
          </label>
        </div>
      </div>

      {/* Mobile: estado select (replaces tabs) */}
      <div className="md:hidden mt-2">
        <select value={estadoFilter} onChange={e => onEstadoChange(e.target.value as LeadEstado | '')}
          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500">
          {ESTADO_TABS.map(tab => (
            <option key={tab.value} value={tab.value}>{tab.value ? tab.label : 'Estado: Todos'}</option>
          ))}
        </select>
      </div>

      {/* Row 2: advanced filters (always visible) */}
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
            options={[{ value: '', label: 'Prioridad: Todas' }, ...Object.entries(TICKET_PRIORIDAD_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            placeholder="Prioridad" />
        </div>
        <div className="min-w-[110px]">
          <SearchableSelect size="sm" value={filters.area}
            onChange={v => set({ area: v as LeadArea | '' })}
            options={[{ value: '', label: 'Área: Todas' }, ...Object.entries(TICKET_AREA_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            placeholder="Área" />
        </div>
        {!filters.soloMios && !filters.misCreados && (
          <div className="min-w-[120px]">
            <SearchableSelect size="sm" value={filters.responsable}
              onChange={v => set({ responsable: v })}
              options={[{ value: '', label: 'Responsable: Todos' }, ...usuarios.filter(u => u.displayName).map(u => ({ value: u.id, label: u.displayName }))]}
              placeholder="Responsable" />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input type="date" value={filters.fechaDesde} onChange={e => set({ fechaDesde: e.target.value })}
            className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
            title="Desde" />
          <span className="text-[10px] text-slate-300">—</span>
          <input type="date" value={filters.fechaHasta} onChange={e => set({ fechaHasta: e.target.value })}
            className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
            title="Hasta" />
        </div>
        {hasAdvanced && (
          <button onClick={() => onFiltersChange(INITIAL_FILTERS)}
            className="text-[11px] text-slate-400 hover:text-slate-600 font-medium px-2 py-1">
            Limpiar
          </button>
        )}
      </div>
    </>
  );
};
