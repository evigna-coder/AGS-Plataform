import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { articulosService, unidadesService, ordenesCompraService } from '../../services/firebaseService';
import { requerimientosService } from '../../services/importacionesService';
import {
  sweepStockMinimoRequerimientos, disponiblePorArticulo, pendienteOCPorArticulo,
} from '../../utils/stockMinimoRequerimientos';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import type { Articulo } from '@ags/shared';

interface ArticuloConStock extends Articulo {
  stockActual: number;
  /** Pendiente de recibir en OCs abiertas (cantidad pedida − recibida). */
  enOC: number;
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

  // articuloIds con requerimiento pendiente — los genera solo el sweep automático.
  const [reqPendientes, setReqPendientes] = useState<Set<string>>(new Set());

  const loadReqPendientes = useCallback(() => {
    // getByEstado (sin orderBy) evita el índice compuesto que pedía getAll({estado}).
    requerimientosService.getByEstado('pendiente')
      .then(reqs => setReqPendientes(new Set(reqs.map(r => r.articuloId).filter((id): id is string => !!id))))
      .catch(err => console.error('[AlertasStock] error cargando requerimientos pendientes:', err));
  }, []);

  // Cambio de lógica 2026-07-25: las alertas generan su requerimiento SOLAS (sweep
  // al montar, throttled). Después del sweep se refresca el set de pendientes.
  useEffect(() => {
    sweepStockMinimoRequerimientos()
      .catch(err => console.error('[AlertasStock] sweep automático falló:', err))
      .finally(loadReqPendientes);
  }, [loadReqPendientes]);

  const unsubRef = useRef<(() => void) | null>(null);

  const computeAlertas = useCallback(async (articulos: Articulo[]) => {
    try {
      const conMinimo = articulos.filter(a => a.stockMinimo > 0);
      if (conMinimo.length === 0) { setItems([]); return; }
      // Dos queries únicas (no N+1). Regla: alerta si disponible + pedido en OC < mínimo
      // (helpers compartidos con el sweep — una sola fuente para la agregación).
      const [unidades, ocs] = await Promise.all([
        unidadesService.getAll({ activoOnly: true }),
        ordenesCompraService.getAll(),
      ]);
      const dispoPorArt = disponiblePorArticulo(unidades);
      const ocPorArt = pendienteOCPorArticulo(ocs);
      const alertas: ArticuloConStock[] = [];
      for (const art of conMinimo) {
        const disponibles = dispoPorArt.get(art.id) ?? 0;
        const enOC = ocPorArt.get(art.id) ?? 0;
        const efectivo = disponibles + enOC; // físico + lo que viene en camino
        if (efectivo < art.stockMinimo) {
          alertas.push({ ...art, stockActual: disponibles, enOC, deficit: art.stockMinimo - efectivo });
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
        subtitle="Stock (disponible + pedido en OC) por debajo del mínimo — los requerimientos se generan automáticamente"
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
              <table className="tabla-compacta w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    <SortableHeader label="Codigo" field="codigo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Descripcion" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Categoria" field="categoriaEquipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Stock actual" field="stockActual" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                    <SortableHeader label="En OC" field="enOC" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
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
                      <td className="px-4 py-2 text-center tabular-nums">
                        {art.enOC > 0 ? <span className="text-teal-600 font-medium">+{art.enOC}</span> : <span className="text-slate-300">—</span>}
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
                        <div className="flex items-center gap-3">
                          {/* El sweep automático genera el requerimiento; acá solo se informa. */}
                          {reqPendientes.has(art.id) ? (
                            <span className="text-[10px] font-medium bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full" title="Requerimiento generado automáticamente, pendiente de compra">Req. generado</span>
                          ) : (
                            <span className="text-[10px] text-slate-300" title="Se generará en el próximo barrido automático">—</span>
                          )}
                          <Link to={`/stock/articulos/${art.id}`} className="text-[10px] font-medium text-slate-500 hover:underline">
                            Ver detalle
                          </Link>
                        </div>
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
