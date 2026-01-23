import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sistemasService, categoriasEquipoService, clientesService } from '../../services/firebaseService';
import type { Sistema, CategoriaEquipo, Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export const EquiposList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');
  
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    clienteId: clienteIdFilter || '',
    categoriaId: '',
    activosOnly: true,
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Equipos / Sistemas</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de sistemas y módulos</p>
        </div>
        <div className="flex gap-2">
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
            <select
              value={filters.clienteId}
              onChange={(e) => setFilters({ ...filters, clienteId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.razonSocial}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría</label>
            <select
              value={filters.categoriaId}
              onChange={(e) => setFilters({ ...filters, categoriaId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
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
      ) : (
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
                    {sistema.descripcion && <p className="text-xs italic">{sistema.descripcion}</p>}
                  </div>
                  <Link to={`/equipos/${sistema.id}`}>
                    <Button className="w-full" variant="outline">Ver Detalle</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
