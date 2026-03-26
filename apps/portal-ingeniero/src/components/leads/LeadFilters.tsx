import { useState } from 'react';
import type { LeadEstado, LeadArea, LeadPrioridad, MotivoLlamado } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS, LEAD_AREA_LABELS, LEAD_PRIORIDAD_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

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
  verCreados: boolean;
  verTodos: boolean;
  fechaDesde: string;
  fechaHasta: string;
}

export const INITIAL_FILTERS: LeadFiltersState = {
  motivo: '', area: '', prioridad: '', responsable: '',
  verCreados: false, verTodos: false,
  fechaDesde: '', fechaHasta: '',
};

interface LeadFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  estadoFilter: LeadEstado | '';
  onEstadoChange: (v: LeadEstado | '') => void;
  filters: LeadFiltersState;
  onFiltersChange: (f: LeadFiltersState) => void;
  usuarios: { id: string; displayName: string }[];
  isAdmin?: boolean;
}

export const LeadFilters = ({ search, onSearchChange, estadoFilter, onEstadoChange, filters, onFiltersChange, usuarios, isAdmin }: LeadFiltersProps) => {
  const set = (partial: Partial<LeadFiltersState>) => onFiltersChange({ ...filters, ...partial });
  const hasAdvanced = filters.motivo || filters.area || filters.prioridad || filters.responsable || filters.fechaDesde || filters.fechaHasta;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      {/* Row 1: search + estado tabs + visibility toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por razón social, contacto..." value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto">
          {ESTADO_TABS.map(tab => (
            <button key={tab.value} onClick={() => onEstadoChange(tab.value as LeadEstado | '')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                estadoFilter === tab.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.verCreados}
              onChange={e => set({ verCreados: e.target.checked })}
              className="rounded border-slate-300" />
            <span className="hidden sm:inline">Mis creados</span>
            <span className="sm:hidden">Creados</span>
          </label>
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={filters.verTodos}
                onChange={e => set({ verTodos: e.target.checked, verCreados: false })}
                className="rounded border-slate-300" />
              Ver todos
            </label>
          )}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
              showAdvanced || hasAdvanced ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            Filtros
            {hasAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </button>
        </div>
      </div>

      {/* Mobile: estado select (replaces tabs) */}
      <div className="md:hidden mt-2">
        <select value={estadoFilter} onChange={e => onEstadoChange(e.target.value as LeadEstado | '')}
          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {ESTADO_TABS.map(tab => (
            <option key={tab.value} value={tab.value}>{tab.value ? tab.label : 'Estado: Todos'}</option>
          ))}
        </select>
      </div>

      {/* Row 2: advanced filters (collapsible) */}
      {showAdvanced && (
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-100">
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
          {filters.verTodos && (
            <div className="min-w-[120px]">
              <SearchableSelect size="sm" value={filters.responsable}
                onChange={v => set({ responsable: v })}
                options={[{ value: '', label: 'Responsable: Todos' }, ...usuarios.filter(u => u.displayName).map(u => ({ value: u.id, label: u.displayName }))]}
                placeholder="Responsable" />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input type="date" value={filters.fechaDesde} onChange={e => set({ fechaDesde: e.target.value })}
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Desde" />
            <span className="text-[10px] text-slate-300">—</span>
            <input type="date" value={filters.fechaHasta} onChange={e => set({ fechaHasta: e.target.value })}
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Hasta" />
          </div>
          {hasAdvanced && (
            <button onClick={() => onFiltersChange(INITIAL_FILTERS)}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium px-2 py-1">
              Limpiar
            </button>
          )}
        </div>
      )}
    </>
  );
};
