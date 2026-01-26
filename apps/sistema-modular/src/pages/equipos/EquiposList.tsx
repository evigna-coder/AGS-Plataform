import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sistemasService, categoriasEquipoService, clientesService } from '../../services/firebaseService';
import type { Sistema, CategoriaEquipo, Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

type ViewMode = 'cards' | 'list';

export const EquiposList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');
  
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Cargar preferencia de vista desde localStorage
  const getInitialViewMode = (): ViewMode => {
    const saved = localStorage.getItem('equipos-view-mode');
    return (saved === 'cards' || saved === 'list') ? saved : 'cards';
  };
  
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode());
  const [filters, setFilters] = useState({
    clienteId: clienteIdFilter || '',
    categoriaId: '',
    activosOnly: true,
  });
  
  // Guardar preferencia cuando cambia la vista
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('equipos-view-mode', mode);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (filters.clienteId || filters.categoriaId || filters.activosOnly !== undefined) {
      loadSistemas();
    }
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sistemasData, categoriasData, clientesData] = await Promise.all([
        sistemasService.getAll(filters),
        categoriasEquipoService.getAll(),
        clientesService.getAll(true),
      ]);
      setSistemas(sistemasData);
      setCategorias(categoriasData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadSistemas = async () => {
    try {
      setLoading(true);
      const data = await sistemasService.getAll({
        clienteId: filters.clienteId || undefined,
        activosOnly: filters.activosOnly,
      });
      setSistemas(data);
    } catch (error) {
      console.error('Error cargando sistemas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && sistemas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando equipos...</p>
      </div>
    );
  }

  const sistemasFiltrados = sistemas.filter(s => {
    if (filters.categoriaId && s.categoriaId !== filters.categoriaId) return false;
    return true;
  });

  const handleDeleteSistema = async (sistemaId: string, sistemaNombre: string) => {
    if (!confirm(`¿Está seguro de eliminar el sistema "${sistemaNombre}"?\n\nEsta acción eliminará también todos los módulos asociados y no se puede deshacer.`)) {
      return;
    }
    
    try {
      await sistemasService.delete(sistemaId);
      await loadData();
      alert('Sistema eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando sistema:', error);
      alert('Error al eliminar el sistema');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Equipos / Sistemas</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de sistemas y módulos</p>
        </div>
        <div className="flex gap-2">
          {/* Toggle de vista */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('cards')}
              className={`px-3 py-1.5 rounded text-xs font-black uppercase transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Vista de tarjetas"
            >
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1.5 rounded text-xs font-black uppercase transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Vista de lista"
            >
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <Link to="/equipos/nuevo">
            <Button>+ Nuevo Sistema</Button>
          </Link>
          <Link to="/categorias-equipo">
            <Button variant="outline">Gestionar Categorías</Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente</label>
            <SearchableSelect
              value={filters.clienteId}
              onChange={(value) => setFilters({ ...filters, clienteId: value })}
              options={[
                { value: '', label: 'Todos' },
                ...clientes.map(c => ({ value: c.id, label: c.razonSocial })),
              ]}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría</label>
            <SearchableSelect
              value={filters.categoriaId}
              onChange={(value) => setFilters({ ...filters, categoriaId: value })}
              options={[
                { value: '', label: 'Todas' },
                ...categorias.map(cat => ({ value: cat.id, label: cat.nombre })),
              ]}
              placeholder="Todas"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.activosOnly}
                onChange={(e) => setFilters({ ...filters, activosOnly: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-600 uppercase">Solo Activos</span>
            </label>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setFilters({ clienteId: '', categoriaId: '', activosOnly: true })}>
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Listado */}
      {sistemasFiltrados.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400">No se encontraron sistemas</p>
            <Link to="/equipos/nuevo" className="text-blue-600 hover:underline mt-2 inline-block">
              Crear primer sistema
            </Link>
          </div>
        </Card>
      ) : viewMode === 'cards' ? (
        // Vista de Tarjetas
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sistemasFiltrados.map((sistema) => {
            const cliente = clientes.find(c => c.id === sistema.clienteId);
            const categoria = categorias.find(c => c.id === sistema.categoriaId);
            return (
              <Card key={sistema.id}>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-lg text-slate-900 uppercase">{sistema.nombre}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      sistema.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {sistema.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p><span className="font-bold">Cliente:</span> {cliente?.razonSocial || 'N/A'}</p>
                    {categoria && <p><span className="font-bold">Categoría:</span> {categoria.nombre}</p>}
                    {sistema.codigoInternoCliente && (
                      <p><span className="font-bold">Código:</span> {sistema.codigoInternoCliente}</p>
                    )}
                    {sistema.software && (
                      <p><span className="font-bold">Software:</span> {sistema.software}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/equipos/${sistema.id}`} className="flex-1">
                      <Button className="w-full" variant="outline" size="sm">Ver Detalle</Button>
                    </Link>
                    <button
                      onClick={() => handleDeleteSistema(sistema.id, sistema.nombre)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-black uppercase"
                      title="Eliminar sistema"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        // Vista de Lista
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Software</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sistemasFiltrados.map((sistema) => {
                  const cliente = clientes.find(c => c.id === sistema.clienteId);
                  const categoria = categorias.find(c => c.id === sistema.categoriaId);
                  return (
                    <tr key={sistema.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-black text-slate-900 uppercase">{sistema.nombre}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {cliente?.razonSocial || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {categoria?.nombre || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600">
                        {sistema.codigoInternoCliente || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {sistema.software || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          sistema.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {sistema.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link to={`/equipos/${sistema.id}`}>
                            <Button variant="outline" size="sm">Ver</Button>
                          </Link>
                          <button
                            onClick={() => handleDeleteSistema(sistema.id, sistema.nombre)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-black uppercase"
                            title="Eliminar sistema"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
