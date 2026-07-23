import type { TipoMovimiento } from '@ags/shared';

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia',
  consumo: 'Consumo', devolucion: 'Devolucion', ajuste: 'Ajuste',
};
const TIPOS: TipoMovimiento[] = ['ingreso', 'egreso', 'transferencia', 'consumo', 'devolucion', 'ajuste'];

interface Props {
  tipo: string;
  onTipoChange: (val: string) => void;
  localSearch: string;
  onSearchChange: (val: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (val: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (val: string) => void;
}

const inputCls = 'px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelCls = 'text-[10px] font-mono uppercase tracking-wide text-slate-400';

/**
 * Barra de filtros de MovimientosPage — extraída para respetar el presupuesto de
 * líneas del componente (regla components.md). El buscador matchea código,
 * descripción, N° de OC, N° de despacho y N° de serie/lote (ver `matchesSearch`
 * en MovimientosPage). El rango de fecha se persiste en la URL.
 */
export function MovimientosFilters({
  tipo, onTipoChange,
  localSearch, onSearchChange,
  fechaDesde, onFechaDesdeChange,
  fechaHasta, onFechaHastaChange,
}: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select value={tipo} onChange={e => onTipoChange(e.target.value)} className={inputCls}>
        <option value="">Todos los tipos</option>
        {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
      </select>
      <input
        type="text"
        placeholder="Codigo, descripcion, OC, despacho, serie/lote..."
        value={localSearch}
        onChange={e => onSearchChange(e.target.value)}
        className={`${inputCls} w-64`}
      />
      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Desde</span>
        <input type="date" value={fechaDesde} onChange={e => onFechaDesdeChange(e.target.value)} className={inputCls} />
      </label>
      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Hasta</span>
        <input type="date" value={fechaHasta} onChange={e => onFechaHastaChange(e.target.value)} className={inputCls} />
      </label>
    </div>
  );
}
