import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articulosService, unidadesService } from '../../services/firebaseService';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Articulo } from '@ags/shared';

interface ArticuloConStock extends Articulo {
  stockActual: number;
  deficit: number;
}

export const AlertasStockPage = () => {
  const [items, setItems] = useState<ArticuloConStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Traer todos los artículos activos
        const articulos = await articulosService.getAll({ activoOnly: true });

        // Para cada artículo, contar unidades disponibles
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

        // Ordenar por déficit descendente
        alertas.sort((a, b) => b.deficit - a.deficit);
        setItems(alertas);
      } catch (err) {
        console.error('Error calculando alertas:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Alertas de Stock"
        subtitle="Articulos con stock por debajo del minimo configurado"
        count={items.length}
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
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
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Codigo</th>
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Categoria</th>
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-right">Stock actual</th>
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-right">Minimo</th>
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-right">Deficit</th>
                    <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(art => (
                    <tr key={art.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <Link to={`/stock/articulos/${art.id}`} className="font-mono text-xs text-indigo-600 hover:underline font-medium">
                          {art.codigo}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-[250px] truncate">
                        {art.descripcion}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {art.categoriaEquipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-600">
                        {art.stockActual}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {art.stockMinimo}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                          -{art.deficit}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/stock/articulos/${art.id}`}
                          className="text-[10px] font-medium text-indigo-600 hover:underline"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
