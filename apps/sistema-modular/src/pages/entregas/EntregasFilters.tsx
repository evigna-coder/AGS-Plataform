import React from 'react';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { Semaforo } from '../../utils/entregasResolver';
import { SEMAFORO_LABELS } from '../../utils/entregasResolver';
import type { EstadoImportacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS } from '@ags/shared';

interface Filters {
  clienteId: string;
  semaforo: string;
  estadoImp: string;
  search: string;
}

interface Props {
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  clienteOptions: Array<{ value: string; label: string }>;
}

const SEMAFOROS: Semaforo[] = ['verde', 'amarillo', 'rojo', 'entregado', 'sin_eta'];
const ESTADOS_IMP: EstadoImportacion[] = [
  'preparacion', 'embarcado', 'en_transito', 'en_aduana', 'despachado', 'recibido', 'cancelado',
];

export const EntregasFilters: React.FC<Props> = ({ filters, setFilter, clienteOptions }) => {
  const hasActive = !!(filters.clienteId || filters.semaforo !== '__pendientes__' || filters.estadoImp || filters.search);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
        placeholder="Buscar item, presupuesto, OT, OC..."
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
        data-testid="entregas-search"
      />
      <div className="min-w-[180px]">
        <SearchableSelect
          value={filters.clienteId}
          onChange={(v: string) => setFilter('clienteId', v)}
          options={[{ value: '', label: 'Cliente: Todos' }, ...clienteOptions]}
          placeholder="Cliente"
          size="sm"
        />
      </div>
      <select
        value={filters.semaforo}
        onChange={(e) => setFilter('semaforo', e.target.value)}
        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="__pendientes__">Semáforo: Pendientes</option>
        <option value="">Semáforo: Todos</option>
        {SEMAFOROS.map(s => (
          <option key={s} value={s}>{SEMAFORO_LABELS[s]}</option>
        ))}
      </select>
      <select
        value={filters.estadoImp}
        onChange={(e) => setFilter('estadoImp', e.target.value)}
        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">Estado IMP: Todos</option>
        {ESTADOS_IMP.map(e => (
          <option key={e} value={e}>{ESTADO_IMPORTACION_LABELS[e]}</option>
        ))}
      </select>
      {hasActive && (
        <button
          type="button"
          onClick={() => {
            setFilter('clienteId', '');
            setFilter('semaforo', '__pendientes__');
            setFilter('estadoImp', '');
            setFilter('search', '');
          }}
          className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
        >
          Limpiar
        </button>
      )}
    </div>
  );
};
