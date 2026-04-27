import { useState } from 'react';
import type { Cliente, Sistema, TipoServicio, UsuarioAGS } from '@ags/shared';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

interface FiltersShape {
  clienteId: string;
  sistemaId: string;
  estadoAdmin: string;
  busquedaOT: string;
  busquedaModulo: string;
  busquedaEquipo: string;
  tipoServicio: string;
  ingenieroId: string;
  fechaDesde: string;
  fechaHasta: string;
  soloFacturable: boolean;
  soloContrato: boolean;
  soloGarantia: boolean;
}

interface Props {
  filters: FiltersShape;
  // Loose signature para que el setFilter de useUrlFilters (genérico sobre el
  // schema completo, que incluye sortField/sortDir además de FiltersShape) sea
  // asignable. Acá solo seteamos las keys de FiltersShape.
  setFilter: (key: string, value: string | boolean) => void;
  resetFilters: () => void;
  clientes: Cliente[];
  sistemas: Sistema[];
  tiposServicioList: TipoServicio[];
  ingenierosList: UsuarioAGS[];
}

const ESTADO_OPTIONS = [
  { value: '__pendientes__', label: 'Pendientes' },
  { value: '', label: 'Todos' },
  ...OT_ESTADO_ORDER.map(e => ({ value: e, label: OT_ESTADO_LABELS[e] })),
];

/** Header bar de filtros para OTList. Toggleable "Más filtros" para los avanzados. */
export const OTFiltersBar: React.FC<Props> = ({
  filters, setFilter, resetFilters,
  clientes, sistemas, tiposServicioList, ingenierosList,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="min-w-[120px]">
          <SearchableSelect size="sm"
            value={filters.clienteId}
            onChange={(value) => setFilter('clienteId', value)}
            options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
            placeholder="Cliente"
          />
        </div>
        <div className="min-w-[120px]">
          <SearchableSelect size="sm"
            value={filters.sistemaId}
            onChange={(value) => setFilter('sistemaId', value)}
            options={[{ value: '', label: 'Todos' }, ...sistemas.map(s => ({ value: s.id, label: s.nombre }))]}
            placeholder="Sistema"
          />
        </div>
        <div className="min-w-[110px]">
          <SearchableSelect size="sm"
            value={filters.estadoAdmin}
            onChange={(value) => setFilter('estadoAdmin', value)}
            options={ESTADO_OPTIONS}
            placeholder="Estado"
          />
        </div>
        <input
          type="text"
          value={filters.busquedaOT}
          onChange={e => setFilter('busquedaOT', e.target.value)}
          placeholder="Buscar OT #"
          className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
        />
        <input
          type="text"
          value={filters.busquedaEquipo}
          onChange={e => setFilter('busquedaEquipo', e.target.value)}
          placeholder="Id Equipo"
          className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
        />
        <input
          type="text"
          value={filters.busquedaModulo}
          onChange={e => setFilter('busquedaModulo', e.target.value)}
          placeholder="Módulo / N° serie"
          className="w-36 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
        />
        <Button size="sm" variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? 'Menos filtros' : 'Más filtros'}
        </Button>
        <Button size="sm" variant="ghost" onClick={resetFilters}>
          Limpiar
        </Button>
      </div>
      {showAdvanced && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <div className="min-w-[110px]">
            <SearchableSelect size="sm" value={filters.tipoServicio}
              onChange={v => setFilter('tipoServicio', v)}
              options={[{ value: '', label: 'Tipo servicio' }, ...tiposServicioList.map(t => ({ value: t.nombre, label: t.nombre }))]}
              placeholder="Tipo servicio" />
          </div>
          <div className="min-w-[120px]">
            <SearchableSelect size="sm" value={filters.ingenieroId}
              onChange={v => setFilter('ingenieroId', v)}
              options={[{ value: '', label: 'Ingeniero' }, ...ingenierosList.map(u => ({ value: u.id, label: u.displayName }))]}
              placeholder="Ingeniero" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Desde</span>
            <input type="date" value={filters.fechaDesde}
              onChange={e => setFilter('fechaDesde', e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 outline-none" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Hasta</span>
            <input type="date" value={filters.fechaHasta}
              onChange={e => setFilter('fechaHasta', e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 outline-none" />
          </div>
          <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={filters.soloFacturable}
              onChange={e => setFilter('soloFacturable', e.target.checked)}
              className="rounded border-slate-300" /> Facturable
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={filters.soloContrato}
              onChange={e => setFilter('soloContrato', e.target.checked)}
              className="rounded border-slate-300" /> Contrato
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={filters.soloGarantia}
              onChange={e => setFilter('soloGarantia', e.target.checked)}
              className="rounded border-slate-300" /> Garantía
          </label>
        </div>
      )}
    </>
  );
};
