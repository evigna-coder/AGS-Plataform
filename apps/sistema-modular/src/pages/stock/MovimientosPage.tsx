import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { movimientosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateMovimientoModal } from '../../components/stock/CreateMovimientoModal';
import type { MovimientoStock, TipoMovimiento } from '@ags/shared';

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia',
  consumo: 'Consumo', devolucion: 'Devolucion', ajuste: 'Ajuste',
};
const TIPO_COLORS: Record<TipoMovimiento, string> = {
  ingreso: 'bg-green-100 text-green-700', egreso: 'bg-red-100 text-red-700',
  transferencia: 'bg-blue-100 text-blue-700', consumo: 'bg-amber-100 text-amber-700',
  devolucion: 'bg-purple-100 text-purple-700', ajuste: 'bg-slate-100 text-slate-600',
};

const TIPOS: TipoMovimiento[] = ['ingreso', 'egreso', 'transferencia', 'consumo', 'devolucion', 'ajuste'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export const MovimientosPage = () => {
  const { pathname } = useLocation();
  const fromState = { from: pathname };

  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    tipo: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'createdAt' },
    sortDir:   { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);
  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [showCreate, setShowCreate] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    const queryFilters: { tipo?: string } = {};
    if (filters.tipo) queryFilters.tipo = filters.tipo;
    unsubRef.current = movimientosService.subscribe(
      queryFilters,
      (items) => { setItems(items); setLoading(false); },
      (err) => { console.error('Error cargando movimientos:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [filters.tipo]);

  const load = useCallback(() => {}, []);

  const filtered = useMemo(() => {
    let list = items;
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      list = list.filter(m =>
        m.articuloCodigo.toLowerCase().includes(term) ||
        m.articuloDescripcion.toLowerCase().includes(term));
    }
    return sortByField(list, filters.sortField, filters.sortDir as SortDir);
  }, [items, debouncedSearch, filters.sortField, filters.sortDir]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Movimientos de Stock"
        subtitle="Historial de movimientos de inventario"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Registrar movimiento</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filters.tipo}
            onChange={e => setFilter('tipo', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
          <input
            type="text"
            placeholder="Buscar por codigo o descripcion..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Cargando movimientos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron movimientos</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <SortableHeader label="Fecha" field="createdAt" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Tipo" field="tipo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Codigo" field="articuloCodigo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Descripcion" field="articuloDescripcion" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Cant." field="cantidad" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                  <SortableHeader label="Origen" field="origenNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Destino" field="destinoNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Motivo" field="motivo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Usuario" field="creadoPor" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <th className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Ref.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[m.tipo]}`}>
                        {TIPO_LABELS[m.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-700">{m.articuloCodigo}</td>
                    <td className="px-4 py-2 text-slate-700 max-w-[200px] truncate">{m.articuloDescripcion}</td>
                    <td className="px-4 py-2 text-center tabular-nums font-medium">{m.cantidad}</td>
                    <td className="px-4 py-2 text-slate-600">{m.origenTipo} — {m.origenNombre}</td>
                    <td className="px-4 py-2 text-slate-600">{m.destinoTipo} — {m.destinoNombre}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-[150px] truncate">{m.motivo ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{m.creadoPor}</td>
                    <td className="px-4 py-2 space-x-2">
                      {m.remitoId && (
                        <Link to={`/stock/remitos/${m.remitoId}`} state={fromState} className="text-teal-600 hover:underline text-[10px] font-medium">
                          Remito
                        </Link>
                      )}
                      {m.otNumber && (
                        <Link to={`/ordenes-trabajo/${m.otNumber}`} state={fromState} className="text-teal-600 hover:underline text-[10px] font-medium">
                          OT
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateMovimientoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
};
