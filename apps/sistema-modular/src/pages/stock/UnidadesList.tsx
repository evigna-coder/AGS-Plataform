import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { unidadesService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import type { UnidadStock, CondicionUnidad, EstadoUnidad } from '@ags/shared';

const CONDICION_LABELS: Record<CondicionUnidad, string> = { nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap' };
const CONDICION_COLORS: Record<CondicionUnidad, string> = { nuevo: 'bg-green-100 text-green-700', bien_de_uso: 'bg-blue-100 text-blue-700', reacondicionado: 'bg-amber-100 text-amber-700', vendible: 'bg-teal-100 text-teal-700', scrap: 'bg-red-100 text-red-700' };
const ESTADO_LABELS: Record<EstadoUnidad, string> = { disponible: 'Disponible', reservado: 'Reservado', asignado: 'Asignado', en_transito: 'En transito', consumido: 'Consumido', vendido: 'Vendido', baja: 'Baja' };
const ESTADO_COLORS: Record<EstadoUnidad, string> = { disponible: 'bg-green-100 text-green-700', reservado: 'bg-amber-100 text-amber-700', asignado: 'bg-blue-100 text-blue-700', en_transito: 'bg-purple-100 text-purple-700', consumido: 'bg-slate-100 text-slate-500', vendido: 'bg-slate-100 text-slate-500', baja: 'bg-red-100 text-red-700' };
const UBICACION_LABELS: Record<string, string> = { posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito' };

export const UnidadesList = () => {
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    estado: { type: 'string' as const, default: '' },
    condicion: { type: 'string' as const, default: '' },
    showInactive: { type: 'boolean' as const, default: false },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);

  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(filters.search, 300);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = unidadesService.subscribe(
      {
        estado: filters.estado || undefined,
        condicion: filters.condicion || undefined,
        activoOnly: !filters.showInactive,
      },
      (data) => { setUnidades(data); setLoading(false); },
      (err) => { console.error('Error cargando unidades:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.estado, filters.condicion, filters.showInactive]);


  const filtered = useMemo(() => {
    if (!debouncedSearch) return unidades;
    const term = debouncedSearch.toLowerCase();
    return unidades.filter(u =>
      u.articuloCodigo.toLowerCase().includes(term) ||
      u.articuloDescripcion.toLowerCase().includes(term)
    );
  }, [unidades, debouncedSearch]);

  if (loading && unidades.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando unidades...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Unidades de stock"
        subtitle="Inventario de unidades individuales"
        count={filtered.length}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por codigo o descripcion..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select
            value={filters.estado}
            onChange={e => setFilter('estado', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_LABELS) as EstadoUnidad[]).map(k => (
              <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={filters.condicion}
            onChange={e => setFilter('condicion', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todas las condiciones</option>
            {(Object.keys(CONDICION_LABELS) as CondicionUnidad[]).map(k => (
              <option key={k} value={k}>{CONDICION_LABELS[k]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
            <input
              type="checkbox"
              checked={filters.showInactive}
              onChange={e => setFilter('showInactive', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300"
            />
            Mostrar inactivos
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron unidades</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Codigo articulo</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Nro serie</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Nro lote</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Condicion</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Ubicacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(u => (
                    <tr key={u.id} className={`hover:bg-slate-50 ${!u.activo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2">
                        <Link to={`/stock/articulos/${u.articuloId}`} className="font-mono text-xs font-semibold text-teal-600 hover:underline">
                          {u.articuloCodigo}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-900">{u.articuloDescripcion}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 font-mono">{u.nroSerie ?? '-'}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{u.nroLote ?? '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONDICION_COLORS[u.condicion]}`}>
                          {CONDICION_LABELS[u.condicion]}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[u.estado]}`}>
                          {ESTADO_LABELS[u.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {UBICACION_LABELS[u.ubicacion.tipo] ?? u.ubicacion.tipo}
                        {u.ubicacion.referenciaNombre && (
                          <span className="text-slate-400"> — {u.ubicacion.referenciaNombre}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
};
