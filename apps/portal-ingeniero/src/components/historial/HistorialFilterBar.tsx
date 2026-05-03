import { useState, useMemo } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Cliente { id: string; razonSocial: string }
interface TipoServicio { id: string; nombre: string }

interface LookbackOption { value: string; label: string }

interface Props {
  search: string;
  cliente: string;
  equipo: string;
  tipoServicio: string;
  fechaDesde: string;
  fechaHasta: string;
  lookback: string;
  lookbackOptions: LookbackOption[];
  clientes: Cliente[];
  tiposServicio: TipoServicio[];
  onChange: {
    search: (v: string) => void;
    cliente: (v: string) => void;
    equipo: (v: string) => void;
    tipoServicio: (v: string) => void;
    fechaDesde: (v: string) => void;
    fechaHasta: (v: string) => void;
    lookback: (v: string) => void;
  };
  onReset: () => void;
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500';
const lbl = 'block text-[10px] font-mono font-semibold uppercase tracking-wide text-slate-400 mb-1';

export default function HistorialFilterBar(props: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let n = 0;
    if (props.cliente) n++;
    if (props.equipo) n++;
    if (props.tipoServicio) n++;
    if (props.fechaDesde) n++;
    if (props.fechaHasta) n++;
    return n;
  }, [props.cliente, props.equipo, props.tipoServicio, props.fechaDesde, props.fechaHasta]);

  const clienteOptions = useMemo(
    () => [{ value: '', label: 'Todos los clientes' }, ...props.clientes.map(c => ({ value: c.id, label: c.razonSocial }))],
    [props.clientes],
  );

  return (
    <div className="shrink-0 px-4 pb-3 space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 shrink-0">Rango</span>
        {props.lookbackOptions.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => props.onChange.lookback(o.value)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              props.lookback === o.value
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por número, modelo, serie..."
            value={props.search}
            onChange={e => props.onChange.search(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
            open || activeCount > 0
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros
          {activeCount > 0 && (
            <span className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
              open ? 'bg-white text-teal-700' : 'bg-teal-600 text-white'
            }`}>
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
          <div>
            <label className={lbl}>Cliente</label>
            <SearchableSelect
              size="sm"
              value={props.cliente}
              onChange={props.onChange.cliente}
              options={clienteOptions}
              placeholder="Todos los clientes"
              emptyMessage="Sin clientes"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Tipo de servicio</label>
              <select
                value={props.tipoServicio}
                onChange={e => props.onChange.tipoServicio(e.target.value)}
                className={inp}
              >
                <option value="">Todos</option>
                {props.tiposServicio.map(t => (
                  <option key={t.id} value={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Equipo (modelo / serie / AGS-ID)</label>
              <input
                type="text"
                value={props.equipo}
                onChange={e => props.onChange.equipo(e.target.value)}
                placeholder="HPLC 1260, AGS-EQ-..."
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Desde</label>
              <input
                type="date"
                value={props.fechaDesde}
                onChange={e => props.onChange.fechaDesde(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Hasta</label>
              <input
                type="date"
                value={props.fechaHasta}
                onChange={e => props.onChange.fechaHasta(e.target.value)}
                className={inp}
              />
            </div>
          </div>
          {activeCount > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={props.onReset}
                className="text-[11px] text-slate-500 hover:text-teal-600 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
