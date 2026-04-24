import { useState } from 'react';
import type { LeadArea, LeadPrioridad, MotivoLlamado } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS, TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

/** Valores simplificados del filtro de estado en la UI */
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
  soloMios: true, misCreados: false, misDerivados: false, mostrarFinalizados: false, fechaDesde: '', fechaHasta: '',
};

interface LeadFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  estadoFilter: EstadoFilterValue;
  onEstadoChange: (v: EstadoFilterValue) => void;
  filters: LeadFiltersState;
  onFiltersChange: (f: LeadFiltersState) => void;
  usuarios: { id: string; displayName: string }[];
  /** If false, user is locked to their own tickets (cannot untick "Mis tickets"). */
  canSeeAll?: boolean;
}

export const LeadFilters = ({ search, onSearchChange, estadoFilter, onEstadoChange, filters, onFiltersChange, usuarios, canSeeAll = true }: LeadFiltersProps) => {
  const set = (partial: Partial<LeadFiltersState>) => onFiltersChange({ ...filters, ...partial });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvanced = filters.motivo || filters.area || filters.prioridad || filters.responsable || filters.fechaDesde || filters.fechaHasta || estadoFilter;
  const advancedCount = [filters.motivo, filters.area, filters.prioridad, filters.responsable, filters.fechaDesde, estadoFilter].filter(Boolean).length;

  return (
    <>
      {/* Row 1: search + checkboxes */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por razón social, contacto..." value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 ml-auto">
          {canSeeAll ? (
            <>
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
            </>
          ) : (
            // Non-admin: radio group (one must always be active)
            <>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="radio"
                  name="tickets-scope"
                  checked={filters.soloMios}
                  onChange={() => set({ soloMios: true, misCreados: false, misDerivados: false })}
                  className="border-slate-300"
                />
                Mis asignados
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="radio"
                  name="tickets-scope"
                  checked={filters.misCreados}
                  onChange={() => set({ soloMios: false, misCreados: true, misDerivados: false })}
                  className="border-slate-300"
                />
                Mis creados
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="radio"
                  name="tickets-scope"
                  checked={filters.misDerivados}
                  onChange={() => set({ soloMios: false, misCreados: false, misDerivados: true })}
                  className="border-slate-300"
                />
                Mis derivados
              </label>
            </>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.mostrarFinalizados} onChange={e => set({ mostrarFinalizados: e.target.checked })} className="rounded border-slate-300" />
            Finalizados
          </label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
              showAdvanced || hasAdvanced ? 'text-teal-700 bg-teal-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            Filtros{advancedCount > 0 && ` (${advancedCount})`}
          </button>
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      {showAdvanced && (
        <div className="mt-2 p-2 md:p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-slide-in">
          {/* Estado tabs (desktop) */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto">
            {ESTADO_TABS.map(tab => (
              <button key={tab.value} onClick={() => onEstadoChange(tab.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  estadoFilter === tab.value ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-200 border border-slate-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile: grid 2-col compacto. Desktop: flex-wrap horizontal. */}
          <div className="grid grid-cols-2 gap-1.5 md:flex md:items-center md:gap-2 md:flex-wrap">
            {/* Estado select (mobile only) — ocupa fila completa */}
            <div className="col-span-2 md:hidden min-w-0">
              <select value={estadoFilter} onChange={e => onEstadoChange(e.target.value as EstadoFilterValue)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                {ESTADO_TABS.map(tab => (
                  <option key={tab.value} value={tab.value}>{tab.value ? tab.label : 'Estado: Todos'}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0 md:min-w-[110px]">
              <SearchableSelect size="sm" value={filters.motivo}
                onChange={v => set({ motivo: v as MotivoLlamado | '' })}
                options={[{ value: '', label: 'Motivo: Todos' }, ...Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
                placeholder="Motivo" />
            </div>
            <div className="min-w-0 md:min-w-[100px]">
              <SearchableSelect size="sm" value={filters.prioridad}
                onChange={v => set({ prioridad: v as LeadPrioridad | '' })}
                options={[{ value: '', label: 'Prioridad: Todas' }, ...Object.entries(TICKET_PRIORIDAD_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
                placeholder="Prioridad" />
            </div>
            <div className="min-w-0 md:min-w-[110px]">
              <SearchableSelect size="sm" value={filters.area}
                onChange={v => set({ area: v as LeadArea | '' })}
                options={[{ value: '', label: 'Área: Todas' }, ...Object.entries(TICKET_AREA_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
                placeholder="Área" />
            </div>
            {!filters.soloMios && !filters.misCreados && (
              <div className="min-w-0 md:min-w-[120px]">
                <SearchableSelect size="sm" value={filters.responsable}
                  onChange={v => set({ responsable: v })}
                  options={[{ value: '', label: 'Responsable: Todos' }, ...usuarios.filter(u => u.displayName).map(u => ({ value: u.id, label: u.displayName }))]}
                  placeholder="Responsable" />
              </div>
            )}
            <input type="date" value={filters.fechaDesde} onChange={e => set({ fechaDesde: e.target.value })}
              className="w-full md:w-auto text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-0"
              title="Desde" />
            <input type="date" value={filters.fechaHasta} onChange={e => set({ fechaHasta: e.target.value })}
              className="w-full md:w-auto text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-0"
              title="Hasta" />
            {hasAdvanced && (
              <button onClick={() => { onFiltersChange(INITIAL_FILTERS); onEstadoChange(''); }}
                className="col-span-2 md:col-span-1 text-[11px] text-slate-400 hover:text-slate-600 font-medium px-2 py-1 md:w-auto">
                Limpiar todo
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
