import type { Ingeniero } from '@ags/shared';
import { ESTADO_PREVISION_LABELS } from '@ags/shared';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Button } from '../ui/Button';

interface Props {
  filters: { anio: string; ingenieroId: string; estado: string; busqueda: string };
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  anios: number[];
  ingenieros: Ingeniero[];
}

const selectClass = 'border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

export const PrevisionesFiltersBar: React.FC<Props> = ({ filters, setFilter, resetFilters, anios, ingenieros }) => (
  <div className="flex flex-wrap gap-2 items-center">
    <select className={selectClass} value={filters.anio} onChange={e => setFilter('anio', e.target.value)}>
      {anios.map(a => <option key={a} value={String(a)}>{a}</option>)}
    </select>

    <div className="w-52">
      <SearchableSelect
        size="sm"
        value={filters.ingenieroId}
        onChange={v => setFilter('ingenieroId', v)}
        options={ingenieros.map(i => ({ value: i.usuarioId || i.id, label: i.nombre }))}
        placeholder="Todos los ingenieros"
      />
    </div>

    <select className={selectClass} value={filters.estado} onChange={e => setFilter('estado', e.target.value)}>
      <option value="">Todos los estados</option>
      {Object.entries(ESTADO_PREVISION_LABELS).map(([k, label]) => (
        <option key={k} value={k}>{label}</option>
      ))}
    </select>

    <div className="w-60">
      <Input
        inputSize="sm"
        value={filters.busqueda}
        onChange={e => setFilter('busqueda', e.target.value)}
        placeholder="Buscar cliente, equipo, servicio, OT..."
      />
    </div>

    <Button size="sm" variant="outline" onClick={resetFilters}>Limpiar</Button>
  </div>
);
