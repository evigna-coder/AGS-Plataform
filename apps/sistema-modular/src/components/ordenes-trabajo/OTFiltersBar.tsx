import { useState, useRef, useEffect } from 'react';
import type { Cliente, Sistema, TipoServicio, UsuarioAGS } from '@ags/shared';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { DateInput } from '../ui/DateInput';

interface FiltersShape {
  clienteId: string;
  sistemaId: string;
  estadoAdmin: string;
  busqueda: string;
  busquedaDescripcion: string;
  tipoServicio: string;
  ingenieroId: string;
  fechaDesde: string;
  fechaHasta: string;
  tipoFecha: string;
  soloFacturable: boolean;
  soloContrato: boolean;
  soloGarantia: boolean;
}

const TIPO_FECHA_OPTIONS = [
  { value: 'createdAt', label: 'Creación' },
  // Derivada del estadoHistorial en useOTListData (campo fechaAsignacion adjuntado).
  { value: 'fechaAsignacion', label: 'Asignación' },
  { value: 'fechaInicio', label: 'Realización' },
  { value: 'fechaCierre', label: 'Finalización' },
];

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
  /** sistemaId → términos de módulo (modelo/serie de las OTs cargadas), para que
   *  el filtro de sistema matchee también buscando un módulo (ej. G1314A). */
  moduloTermsBySistema?: Map<string, string>;
}

const ESTADO_OPTIONS = [
  { value: '__pendientes__', label: 'Pendientes' },
  { value: '', label: 'Todos' },
  ...OT_ESTADO_ORDER.map(e => ({ value: e, label: OT_ESTADO_LABELS[e] })),
];

/** Header bar de filtros para OTList. Un buscador unificado + estado siempre
 *  visibles; el resto se esconde en "Más filtros". */
export const OTFiltersBar: React.FC<Props> = ({
  filters, setFilter, resetFilters,
  clientes, sistemas, tiposServicioList, ingenierosList,
  moduloTermsBySistema,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Inputs de texto con estado local instantáneo + propagación debounced al filtro
  // (que escribe la URL vía useUrlFilters). Sin esto, atar el value directo a
  // filters.* hace que cada tecla dispare un write de URL async que reordena/come
  // letras en Electron — el bug clásico de los buscadores del repo.
  const [busquedaLocal, setBusquedaLocal] = useState(filters.busqueda);
  const [descLocal, setDescLocal] = useState(filters.busquedaDescripcion);
  const timers = useRef<{ b?: ReturnType<typeof setTimeout>; d?: ReturnType<typeof setTimeout> }>({});
  // Último valor que NOSOTROS propagamos al filtro, para distinguir el "eco" de
  // nuestro propio push de un cambio externo (ej. "Limpiar"). Sin esto, el efecto
  // de sincronización pisa la última letra cuando el debounce dispara mientras se tipea.
  const lastPushed = useRef({ b: filters.busqueda, d: filters.busquedaDescripcion });

  useEffect(() => {
    if (filters.busqueda !== lastPushed.current.b) {
      lastPushed.current.b = filters.busqueda;
      setBusquedaLocal(filters.busqueda);
    }
  }, [filters.busqueda]);
  useEffect(() => {
    if (filters.busquedaDescripcion !== lastPushed.current.d) {
      lastPushed.current.d = filters.busquedaDescripcion;
      setDescLocal(filters.busquedaDescripcion);
    }
  }, [filters.busquedaDescripcion]);

  const onBusqueda = (v: string) => {
    setBusquedaLocal(v);
    clearTimeout(timers.current.b);
    timers.current.b = setTimeout(() => { lastPushed.current.b = v; setFilter('busqueda', v); }, 200);
  };
  const onDesc = (v: string) => {
    setDescLocal(v);
    clearTimeout(timers.current.d);
    timers.current.d = setTimeout(() => { lastPushed.current.d = v; setFilter('busquedaDescripcion', v); }, 200);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={busquedaLocal}
          onChange={e => onBusqueda(e.target.value)}
          placeholder="Buscar cliente, N° OT, equipo, módulo, N° serie…"
          className="flex-1 min-w-[260px] border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
        />
        <div className="min-w-[120px]">
          <SearchableSelect size="sm"
            value={filters.estadoAdmin}
            onChange={(value) => setFilter('estadoAdmin', value)}
            options={ESTADO_OPTIONS}
            placeholder="Estado"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? 'Menos filtros' : 'Más filtros'}
        </Button>
        <Button size="sm" variant="ghost" onClick={resetFilters}>
          Limpiar
        </Button>
      </div>
      {showAdvanced && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <div className="min-w-[140px]">
            <SearchableSelect size="sm"
              value={filters.clienteId}
              onChange={(value) => setFilter('clienteId', value)}
              options={[{ value: '', label: 'Cliente' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente"
            />
          </div>
          <div className="min-w-[170px]">
            {/* Buscable por nombre de sistema, ID de equipo (agsVisibleId), código
                interno del cliente y módulo (via linkedCode — UAT 2026-07-17). */}
            <SearchableSelect size="sm"
              value={filters.sistemaId}
              onChange={(value) => setFilter('sistemaId', value)}
              options={[{ value: '', label: 'Sistema' }, ...sistemas.map(s => {
                const idEquipo = s.agsVisibleId || '';
                const codInterno = s.codigoInternoCliente || '';
                return {
                  value: s.id,
                  label: s.nombre,
                  linkedCode: [idEquipo, codInterno, moduloTermsBySistema?.get(s.id)].filter(Boolean).join(' '),
                  subLabel: [idEquipo, codInterno].filter(Boolean).join(' · ') || undefined,
                };
              })]}
              placeholder="Sistema / ID equipo / módulo"
            />
          </div>
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
          <input
            type="text"
            value={descLocal}
            onChange={e => onDesc(e.target.value)}
            placeholder="Buscar en descripción"
            className="w-44 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
          />
          <div className="min-w-[110px]">
            <SearchableSelect size="sm" value={filters.tipoFecha}
              onChange={v => setFilter('tipoFecha', v)}
              options={TIPO_FECHA_OPTIONS}
              placeholder="Tipo fecha" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Desde</span>
            <DateInput value={filters.fechaDesde} onChange={v => setFilter('fechaDesde', v)} ariaLabel="Fecha desde" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Hasta</span>
            <DateInput value={filters.fechaHasta} onChange={v => setFilter('fechaHasta', v)} ariaLabel="Fecha hasta" />
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
