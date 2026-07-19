import { useEffect, useState, useMemo } from 'react';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { matchesSearch } from '../../utils/searchTerms';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import { articulosService } from '../../services/stockService';
import { marcasService } from '../../services/catalogService';
import { proveedoresService } from '../../services/personalService';
import type { Articulo } from '@ags/shared';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PlanificacionRow } from './PlanificacionRow';

// Step 0 pre-check outcome (recorded in 09-03-SUMMARY.md):
// marcasService found in catalogService.ts — getAll() returns Marca[] with { id, nombre }
// proveedoresService found in personalService.ts — getAll() returns Proveedor[] with { id, nombre }
// Both dropdowns are wired.

const FILTER_SCHEMA = {
  texto:            { type: 'string' as const, default: '' },
  marcaId:          { type: 'string' as const, default: '' },
  proveedorId:      { type: 'string' as const, default: '' },
  soloComprometido: { type: 'string' as const, default: '' },
};

export function PlanificacionStockPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  // Input responsivo: valor local inmediato, URL (y por ende la lista) con debounce.
  const [textoInput, setTextoInput] = useDebouncedUrlText(filters.texto, v => setFilter('texto', v));

  // Build marca lookup for display in rows (avoid per-row service calls)
  const marcaById = useMemo(() => {
    const map: Record<string, string> = {};
    marcas.forEach(m => { map[m.id] = m.nombre; });
    return map;
  }, [marcas]);

  useEffect(() => {
    // Direct service calls — NO serviceCache usage (STKP-04)
    (async () => {
      const [arts, ms, ps] = await Promise.all([
        articulosService.getAll({ activoOnly: true }),
        marcasService.getAll(true).catch(() => [] as Array<{ id: string; nombre: string }>),
        proveedoresService.getAll(true).catch(() => [] as Array<{ id: string; nombre: string }>),
      ]);
      setArticulos(arts);
      setMarcas(ms.map((m: { id: string; nombre: string }) => ({ id: m.id, nombre: m.nombre })));
      setProveedores(ps.map((p: { id: string; nombre: string }) => ({ id: p.id, nombre: p.nombre })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = filters.texto.trim();
    return articulos.filter(a => {
      if (t && !matchesSearch(t, a.codigo, a.descripcion)) {
        return false;
      }
      if (filters.marcaId && a.marcaId !== filters.marcaId) return false;
      // proveedorIds is string[] — check if the selected proveedor is included
      if (filters.proveedorId && !a.proveedorIds?.includes(filters.proveedorId)) return false;
      return true;
    });
  }, [articulos, filters.texto, filters.marcaId, filters.proveedorId]);

  const hideIfNotComprometido = filters.soloComprometido === 'true';
  const hasAdvancedFilters = !!(filters.marcaId || filters.proveedorId || filters.soloComprometido);

  const th = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Planificación de Stock</h1>
            {!loading && (
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} artículos</p>
            )}
          </div>
        </div>

        {/* Filter row 1: texto + soloComprometido */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={textoInput}
            onChange={e => setTextoInput(e.target.value)}
            placeholder="Buscar por código o descripción..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-72 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={filters.soloComprometido === 'true'}
              onChange={e => setFilter('soloComprometido', e.target.checked ? 'true' : '')}
              className="rounded border-slate-300"
            />
            Solo con comprometido &gt; 0
          </label>
        </div>

        {/* Filter row 2: marca + proveedor dropdowns */}
        <div className="flex items-center gap-3 flex-wrap mt-2">
          {marcas.length > 0 && (
            <div className="min-w-[160px]">
              <SearchableSelect
                value={filters.marcaId}
                onChange={v => setFilter('marcaId', v ?? '')}
                options={[
                  { value: '', label: 'Marca: Todas' },
                  ...marcas.map(m => ({ value: m.id, label: m.nombre })),
                ]}
                placeholder="Marca"
              />
            </div>
          )}
          {proveedores.length > 0 && (
            <div className="min-w-[180px]">
              <SearchableSelect
                value={filters.proveedorId}
                onChange={v => setFilter('proveedorId', v ?? '')}
                options={[
                  { value: '', label: 'Proveedor: Todos' },
                  ...proveedores.map(p => ({ value: p.id, label: p.nombre })),
                ]}
                placeholder="Proveedor"
              />
            </div>
          )}
          {hasAdvancedFilters && (
            <button onClick={resetFilters} className="text-xs text-teal-700 hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-5 pb-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-slate-400 text-sm">Cargando planificación...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">No se encontraron artículos con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={th}>Código</th>
                  <th className={th}>Descripción</th>
                  <th className={th}>Marca</th>
                  <th className={`${th} text-center w-16`}>Disp</th>
                  <th className={`${th} text-center w-16`}>Tráns</th>
                  <th className={`${th} text-center w-16`}>Reserv</th>
                  <th className={`${th} text-center w-20`}>Comprom</th>
                  <th className={`${th} text-center w-16 border-l border-slate-200`}>ATP</th>
                  <th className={th + ' text-right'}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <PlanificacionRow
                    key={a.id}
                    articulo={a}
                    hideIfNotComprometido={hideIfNotComprometido}
                    marcaNombre={marcaById[a.marcaId]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
