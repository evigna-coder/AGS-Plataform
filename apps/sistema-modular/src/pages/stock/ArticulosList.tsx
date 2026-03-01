import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articulosService, marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateArticuloModal } from '../../components/stock/CreateArticuloModal';
import type { Articulo, Marca, CategoriaEquipoStock, TipoArticulo } from '@ags/shared';

const CATEGORIA_LABELS: Record<CategoriaEquipoStock, string> = {
  HPLC: 'HPLC', GC: 'GC', MSD: 'MSD', UV: 'UV', OSMOMETRO: 'Osmometro', GENERAL: 'General',
};
const TIPO_LABELS: Record<TipoArticulo, string> = {
  repuesto: 'Repuesto', consumible: 'Consumible', equipo: 'Equipo', columna: 'Columna',
  accesorio: 'Accesorio', muestra: 'Muestra', otro: 'Otro',
};

export const ArticulosList = () => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    categoriaEquipo: '' as string,
    marcaId: '' as string,
    tipo: '' as string,
    showInactive: false,
  });

  useEffect(() => {
    loadData();
  }, [filters.categoriaEquipo, filters.marcaId, filters.tipo, filters.showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [artData, marcasData] = await Promise.all([
        articulosService.getAll({
          categoriaEquipo: filters.categoriaEquipo || undefined,
          marcaId: filters.marcaId || undefined,
          tipo: filters.tipo || undefined,
          activoOnly: !filters.showInactive,
        }),
        marcas.length === 0 ? marcasService.getAll(false) : Promise.resolve(marcas),
      ]);
      setArticulos(artData);
      if (marcas.length === 0) setMarcas(marcasData as Marca[]);
    } catch (error) {
      console.error('Error cargando articulos:', error);
      alert('Error al cargar los articulos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (art: Articulo) => {
    if (!confirm(`Desactivar el articulo "${art.codigo} - ${art.descripcion}"?`)) return;
    try {
      await articulosService.deactivate(art.id);
      await loadData();
    } catch (error) {
      console.error('Error desactivando articulo:', error);
      alert('Error al desactivar el articulo');
    }
  };

  const handleDelete = async (art: Articulo) => {
    if (!confirm(`Eliminar permanentemente "${art.codigo}"?\n\nEsta accion no se puede deshacer.`)) return;
    try {
      await articulosService.delete(art.id);
      await loadData();
    } catch (error) {
      console.error('Error eliminando articulo:', error);
      alert('Error al eliminar el articulo');
    }
  };

  const getMarcaNombre = (marcaId: string) => marcas.find(m => m.id === marcaId)?.nombre ?? '-';

  const filtered = articulos.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return a.codigo.toLowerCase().includes(term) || a.descripcion.toLowerCase().includes(term);
  });

  if (loading && articulos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando articulos...</p>
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Articulos"
        subtitle="Catalogo de articulos de stock"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo articulo</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por codigo o descripcion..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.categoriaEquipo}
            onChange={e => setFilters({ ...filters, categoriaEquipo: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las categorias</option>
            {(Object.keys(CATEGORIA_LABELS) as CategoriaEquipoStock[]).map(k => (
              <option key={k} value={k}>{CATEGORIA_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={filters.marcaId}
            onChange={e => setFilters({ ...filters, marcaId: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las marcas</option>
            {marcas.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            value={filters.tipo}
            onChange={e => setFilters({ ...filters, tipo: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_LABELS) as TipoArticulo[]).map(k => (
              <option key={k} value={k}>{TIPO_LABELS[k]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
            <input
              type="checkbox"
              checked={filters.showInactive}
              onChange={e => setFilters({ ...filters, showInactive: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-slate-300"
            />
            Mostrar inactivos
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron articulos</p>
              <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primer articulo
              </button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Codigo</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Marca</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Categoria</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Stock min.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Precio ref.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(art => (
                    <tr key={art.id} className={`hover:bg-slate-50 ${!art.activo ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-semibold text-indigo-600">{art.codigo}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-900">{art.descripcion}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{getMarcaNombre(art.marcaId)}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {CATEGORIA_LABELS[art.categoriaEquipo] ?? art.categoriaEquipo}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                          {TIPO_LABELS[art.tipo] ?? art.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 text-right">{art.stockMinimo}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 text-right">
                        {art.precioReferencia != null
                          ? `${art.monedaPrecio === 'USD' ? 'US$' : '$'} ${art.precioReferencia.toLocaleString('es-AR')}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Link to={`/stock/articulos/${art.id}`}>
                            <Button variant="ghost" size="sm">Ver</Button>
                          </Link>
                          <Link to={`/stock/articulos/${art.id}/editar`}>
                            <Button variant="outline" size="sm">Editar</Button>
                          </Link>
                          {art.activo && (
                            <Button variant="outline" size="sm" onClick={() => handleDeactivate(art)}>
                              Desactivar
                            </Button>
                          )}
                          <button
                            onClick={() => handleDelete(art)}
                            className="px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <CreateArticuloModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
