import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConsumos, ORIGEN_CONSUMO_LABELS, ORIGEN_CONSUMO_COLORS } from '../../hooks/useConsumos';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { matchesSearch } from '../../utils/searchTerms';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { DateInput } from '../../components/ui/DateInput';

const FILTER_SCHEMA = {
  clienteId:  { type: 'string' as const, default: '' },
  equipoId:   { type: 'string' as const, default: '' },
  // Sin selector propio: llega prefijado por link desde el detalle de establecimiento.
  establecimientoId: { type: 'string' as const, default: '' },
  fechaDesde: { type: 'string' as const, default: '' },
  fechaHasta: { type: 'string' as const, default: '' },
  busqueda:   { type: 'string' as const, default: '' },
};

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const ConsumosPage = () => {
  const { rows, clientes, sistemas, loading } = useConsumos();
  const [filters, setFilter, _setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);

  const filtered = useMemo(() => {
    const q = filters.busqueda.trim();
    return rows.filter(r => {
      if (filters.clienteId && r.clienteId !== filters.clienteId) return false;
      if (filters.equipoId && r.sistemaId !== filters.equipoId) return false;
      if (filters.establecimientoId && r.establecimientoId !== filters.establecimientoId) return false;
      const dia = (r.fecha || '').slice(0, 10);
      if (filters.fechaDesde && dia < filters.fechaDesde) return false;
      if (filters.fechaHasta && dia > filters.fechaHasta) return false;
      if (q && !matchesSearch(q, r.articuloCodigo, r.articuloDescripcion, r.otNumber, r.clienteNombre, r.sistemaNombre)) return false;
      return true;
    });
  }, [rows, filters.clienteId, filters.equipoId, filters.establecimientoId, filters.fechaDesde, filters.fechaHasta, filters.busqueda]);

  const kpis = useMemo(() => ({
    total: filtered.length,
    articulos: new Set(filtered.map(r => r.articuloCodigo ?? r.articuloDescripcion ?? '—')).size,
    cantidad: filtered.reduce((acc, r) => acc + (r.cantidad || 0), 0),
  }), [filtered]);

  const clienteOpts = useMemo(() => [
    { value: '', label: 'Cliente: Todos' },
    ...clientes.map(c => ({ value: c.id, label: c.razonSocial })),
  ], [clientes]);

  // Equipos: si hay cliente elegido, mostrar sus sistemas (clienteId directo) más los
  // sistemas que ya aparecen en consumos de ese cliente (cubre la relación vía
  // establecimiento sin cargar establecimientos acá).
  const equipoOpts = useMemo(() => {
    let list = sistemas;
    if (filters.clienteId) {
      const enRows = new Set(rows.filter(r => r.clienteId === filters.clienteId && r.sistemaId).map(r => r.sistemaId!));
      list = sistemas.filter(s => (s as { clienteId?: string | null }).clienteId === filters.clienteId || enRows.has(s.id));
    }
    return [{ value: '', label: 'Equipo: Todos' }, ...list.map(s => ({ value: s.id, label: s.nombre }))];
  }, [sistemas, rows, filters.clienteId]);

  const hasActive = !!(filters.clienteId || filters.equipoId || filters.establecimientoId || filters.fechaDesde || filters.fechaHasta || filters.busqueda);
  const th = 'px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap';
  const td = 'px-3 py-2 text-xs';
  const kpi = 'font-mono text-[10px] uppercase tracking-wide text-slate-400';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Consumos por equipo" subtitle="Qué se consumió en cada OT: partes, componentes y materiales" count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={filters.busqueda}
            onChange={e => setFilter('busqueda', e.target.value)}
            placeholder="Buscar artículo, OT, cliente, equipo…"
            className="w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="min-w-[180px]">
            <SearchableSelect value={filters.clienteId} options={clienteOpts} placeholder="Cliente" size="sm"
              onChange={(v: string) => { setFilter('clienteId', v); if (filters.equipoId) setFilter('equipoId', ''); }} />
          </div>
          <div className="min-w-[180px]">
            <SearchableSelect value={filters.equipoId} options={equipoOpts} placeholder="Equipo" size="sm"
              onChange={(v: string) => setFilter('equipoId', v)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Desde</span>
            <DateInput value={filters.fechaDesde} onChange={v => setFilter('fechaDesde', v)} ariaLabel="Fecha desde" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Hasta</span>
            <DateInput value={filters.fechaHasta} onChange={v => setFilter('fechaHasta', v)} ariaLabel="Fecha hasta" />
          </div>
          {hasActive && (
            <button type="button" onClick={resetFilters}
              className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100">
              Limpiar
            </button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <Card compact><p className={kpi}>Consumos</p><p className="text-lg font-semibold text-slate-900 tabular-nums">{kpis.total}</p></Card>
          <Card compact><p className={kpi}>Artículos distintos</p><p className="text-lg font-semibold text-slate-900 tabular-nums">{kpis.articulos}</p></Card>
          <Card compact><p className={kpi}>Cantidad total</p><p className="text-lg font-semibold text-slate-900 tabular-nums">{kpis.cantidad.toLocaleString('es-AR')}</p></Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando consumos...</p></div>
        ) : filtered.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay consumos para los filtros elegidos.</p></div></Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>OT</th>
                  <th className={th}>Cliente</th>
                  <th className={th}>Equipo</th>
                  <th className={th}>Artículo</th>
                  <th className={`${th} text-right`}>Cant.</th>
                  <th className={th}>Origen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                    <td className={`${td} text-slate-600 whitespace-nowrap`}>{fmtFecha(r.fecha)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.otNumber ? (
                        // estadoAdmin= (vacío) fuerza "Todos" en OTList: las OTs con consumo suelen estar finalizadas.
                        <Link to={`/ordenes-trabajo?busqueda=${r.otNumber}&estadoAdmin=`}
                          className="font-mono font-semibold text-teal-600 hover:text-teal-800 hover:underline">
                          {r.otNumber}
                        </Link>
                      ) : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className={`${td} text-slate-600 truncate max-w-[160px]`}>{r.clienteNombre || <span className="text-[10px] text-slate-300">—</span>}</td>
                    <td className={`${td} text-slate-600 truncate max-w-[160px]`}>{r.sistemaNombre || <span className="text-[10px] text-slate-300">—</span>}</td>
                    <td className={td}>
                      <span className="font-mono font-semibold text-teal-800 whitespace-nowrap">{r.articuloCodigo || '—'}</span>
                      {r.articuloDescripcion && <span className="block text-[10px] text-slate-400 max-w-[260px] truncate">{r.articuloDescripcion}</span>}
                    </td>
                    <td className={`${td} text-right tabular-nums text-slate-700 whitespace-nowrap`}>{r.cantidad}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ORIGEN_CONSUMO_COLORS[r.origen]}`}>
                        {ORIGEN_CONSUMO_LABELS[r.origen]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};
