import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sistemasService, categoriasEquipoService, clientesService, establecimientosService } from '../../services/firebaseService';
import type { Sistema, CategoriaEquipo, Cliente, Establecimiento } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateEquipoModal } from '../../components/equipos/CreateEquipoModal';

type ViewMode = 'cards' | 'list';

export const EquiposList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');

  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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
      const [sistemasData, categoriasData, clientesData, establecimientosData] = await Promise.all([
        sistemasService.getAll({
          clienteCuit: filters.clienteId || undefined,
          clienteId: filters.clienteId || undefined,
          activosOnly: filters.activosOnly,
        }),
        categoriasEquipoService.getAll(),
        clientesService.getAll(true),
        establecimientosService.getAll(),
      ]);
      setSistemas(sistemasData);
      setCategorias(categoriasData);
      setClientes(clientesData);
      setEstablecimientos(establecimientosData);
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
        clienteCuit: filters.clienteId || undefined,
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
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Equipos / Sistemas"
        subtitle="Gestión de sistemas y módulos"
        count={sistemasFiltrados.length}
        actions={
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => handleViewModeChange('cards')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Vista de tarjetas"
              >
                <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Vista de lista"
              >
                <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Sistema</Button>
            <Link to="/categorias-equipo">
              <Button size="sm" variant="outline">Categorías</Button>
            </Link>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[180px]">
            <SearchableSelect
              value={filters.clienteId}
              onChange={(value) => setFilters({ ...filters, clienteId: value })}
              options={[
                { value: '', label: 'Todos los clientes' },
                ...clientes.map(c => ({ value: c.id, label: c.razonSocial })),
              ]}
              placeholder="Todos"
            />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filters.categoriaId}
              onChange={(value) => setFilters({ ...filters, categoriaId: value })}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categorias.map(cat => ({ value: cat.id, label: cat.nombre })),
              ]}
              placeholder="Todas"
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.activosOnly}
              onChange={(e) => setFilters({ ...filters, activosOnly: e.target.checked })}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-500">Solo activos</span>
          </label>
          <Button size="sm" variant="ghost" onClick={() => setFilters({ clienteId: '', categoriaId: '', activosOnly: true })}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {sistemasFiltrados.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron sistemas</p>
              <button onClick={() => setShowCreate(true)} className="text-blue-600 hover:underline mt-2 inline-block text-xs">
                Crear primer sistema
              </button>
            </div>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sistemasFiltrados.map((sistema) => {
              const establecimiento = establecimientos.find(e => e.id === sistema.establecimientoId);
              const cliente = clientes.find(c => c.id === (establecimiento?.clienteCuit ?? sistema.clienteId));
              const categoria = categorias.find(c => c.id === sistema.categoriaId);
              return (
                <Card key={sistema.id}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-sm text-slate-900">{sistema.nombre}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        sistema.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {sistema.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-xs text-slate-600">
                      <p><span className="font-medium">Cliente:</span> {cliente?.razonSocial || 'N/A'}</p>
                      {establecimiento && <p><span className="font-medium">Estab.:</span> {establecimiento.nombre}</p>}
                      {categoria && <p><span className="font-medium">Cat.:</span> {categoria.nombre}</p>}
                      {sistema.codigoInternoCliente && (
                        <p><span className="font-medium">Código:</span> {sistema.codigoInternoCliente}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/equipos/${sistema.id}`} className="flex-1">
                        <Button className="w-full" variant="outline" size="sm">Ver</Button>
                      </Link>
                      <button
                        onClick={() => handleDeleteSistema(sistema.id, sistema.nombre)}
                        className="px-2 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-[10px] font-medium"
                        title="Eliminar sistema"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Nombre</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Establecimiento</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Categoría</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Código</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Software</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sistemasFiltrados.map((sistema) => {
                    const establecimiento = establecimientos.find(e => e.id === sistema.establecimientoId);
                    const cliente = clientes.find(c => c.id === (establecimiento?.clienteCuit ?? sistema.clienteId));
                    const categoria = categorias.find(c => c.id === sistema.categoriaId);
                    return (
                      <tr key={sistema.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs font-semibold text-slate-900">{sistema.nombre}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">{cliente?.razonSocial || 'N/A'}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">{establecimiento?.nombre || '-'}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">{categoria?.nombre || '-'}</td>
                        <td className="px-4 py-2 text-xs font-mono text-slate-600">{sistema.codigoInternoCliente || '-'}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">{sistema.software || '-'}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            sistema.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {sistema.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <Link to={`/equipos/${sistema.id}`}>
                              <Button variant="outline" size="sm">Ver</Button>
                            </Link>
                            <button
                              onClick={() => handleDeleteSistema(sistema.id, sistema.nombre)}
                              className="px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-[10px] font-medium"
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

      <CreateEquipoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
