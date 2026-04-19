import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { articulosService, unidadesService } from '../../services/firebaseService';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import type { Articulo } from '@ags/shared';

interface ArticuloConStock extends Articulo {
  stockActual: number;
  deficit: number;
}

export const AlertasStockPage = () => {
  const [items, setItems] = useState<ArticuloConStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('deficit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const sorted = useMemo(() => sortByField(items, sortField, sortDir), [items, sortField, sortDir]);

  const unsubRef = useRef<(() => void) | null>(null);

  const computeAlertas = useCallback(async (articulos: import('@ags/shared').Articulo[]) => {
    try {
      const alertas: ArticuloConStock[] = [];
      for (const art of articulos) {
        if (art.stockMinimo <= 0) continue;
        const unidades = await unidadesService.getByArticulo(art.id);
        const disponibles = unidades.filter(u => u.activo && u.estado === 'disponible').length;
        if (disponibles < art.stockMinimo) {
          alertas.push({
            ...art,
            stockActual: disponibles,
            deficit: art.stockMinimo - disponibles,
          });
        }
      }
      alertas.sort((a, b) => b.deficit - a.deficit);
      setItems(alertas);
    } catch (err) {
      console.error('Error calculando alertas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = articulosService.subscribe(
      { activoOnly: true },
      (articulos) => { computeAlertas(articulos); },
      (err) => { console.error('Error cargando articulos:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [computeAlertas]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Alertas de Stock"
        subtitle="Articulos con stock por debajo del minimo configurado"
        count={items.length}
      />

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Calculando niveles de stock...</p>
          </div>
        ) : items.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-green-600 font-medium">Todos los artículos están dentro de los niveles mínimos</p>
              <p className="text-slate-400 text-sm mt-1">No hay alertas activas</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    <SortableHeader label="Codigo" field="codigo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Descripcion" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Categoria" field="categoriaEquipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Stock actual" field="stockActual" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                    <SortableHeader label="Minimo" field="stockMinimo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                    <SortableHeader label="Deficit" field="deficit" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                    <th className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(art => (
                    <tr key={art.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link to={`/stock/articulos/${art.id}`} className="font-mono text-xs text-teal-600 hover:underline font-medium">
                          {art.codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-700 max-w-[250px] truncate">
                        {art.descripcion}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {art.categoriaEquipo}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center tabular-nums font-semibold text-red-600">
                        {art.stockActual}
                      </td>
                      <td className="px-4 py-2 text-center tabular-nums text-slate-600">
                        {art.stockMinimo}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                          -{art.deficit}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          to={`/stock/articulos/${art.id}`}
                          className="text-[10px] font-medium text-teal-600 hover:underline"
                        >
                          Ver detalle
                        </Link>
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
