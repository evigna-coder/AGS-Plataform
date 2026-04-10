import type { LeadArea, LeadPrioridad, MotivoLlamado, UsuarioAGS } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS, LEAD_AREA_LABELS, LEAD_PRIORIDAD_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

export type EstadoFilterValue = '' | 'nuevo' | 'en_proceso' | 'finalizado';

const ESTADO_TABS: { value: EstadoFilterValue; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'finalizado', label: 'Finalizado' },
];

export interface LeadFiltersState {
  motivo: MotivoLlamado | '';
  area: LeadArea | '';
  prioridad: LeadPrioridad | '';
  responsable: string;
  soloMios: boolean;
  misCreados: boolean;
  misDerivados: boolean;
  mostrarFinalizados: boolean;
  fechaDesde: string;
  fechaHasta: string;
}

export const INITIAL_FILTERS: LeadFiltersState = {
  motivo: '', area: '', prioridad: '', responsable: '',
  soloMios: false, misCreados: false, misDerivados: false, mostrarFinalizados: false, fechaDesde: '', fechaHasta: '',
};

interface LeadFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  estadoFilter: EstadoFilterValue;
  onEstadoChange: (v: EstadoFilterValue) => void;
  filters: LeadFiltersState;
  onFiltersChange: (f: LeadFiltersState) => void;
  usuarios: UsuarioAGS[];
}

export const LeadFilters = ({ search, onSearchChange, estadoFilter, onEstadoChange, filters, onFiltersChange, usuarios }: LeadFiltersProps) => {
  const set = (partial: Partial<LeadFiltersState>) => onFiltersChange({ ...filters, ...partial });
  const hasAdvanced = filters.motivo || filters.area || filters.prioridad || filters.responsable || filters.fechaDesde || filters.fechaHasta;

  return (
    <>
      {/* Row 1: search + estado tabs + mis leads */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por razón social, contacto..." value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64" />
        <div className="flex items-center gap-1.5">
          {ESTADO_TABS.map(tab => (
            <button key={tab.value} onClick={() => onEstadoChange(tab.value)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                estadoFilter === tab.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.soloMios} onChange={e => set({ soloMios: e.target.checked, misCreados: false, misDerivados: false })} className="rounded border-slate-300" />
            Mis tickets
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.misCreados} onChange={e => set({ misCreados: e.target.checked, soloMios: false, misDerivados: false })} className="rounded border-slate-300" />
            Mis creados
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.misDerivados} onChange={e => set({ misDerivados: e.target.checked, soloMios: false, misCreados: false })} className="rounded border-slate-300" />
            Mis derivados
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.mostrarFinalizados} onChange={e => set({ mostrarFinalizados: e.target.checked })} className="rounded border-slate-300" />
            Finalizados
          </label>
        </div>
      </div>

      {/* Row 2: advanced filters */}
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
        {!filters.soloMios && !filters.misCreados && !filters.misDerivados && (
          <div className="min-w-[120px]">
            <SearchableSelect size="sm" value={filters.responsable}
              onChange={v => set({ responsable: v })}
              options={[{ value: '', label: 'Responsable: Todos' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
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
