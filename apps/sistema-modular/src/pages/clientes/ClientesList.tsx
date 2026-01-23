import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clientesService } from '../../services/firebaseService';
import type { Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export const ClientesList = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await clientesService.getAll();
      setClientes(data);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      alert('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadClientes();
      return;
    }
    try {
      setLoading(true);
      const results = await clientesService.search(searchTerm);
      setClientes(results);
    } catch (error) {
      console.error('Error buscando clientes:', error);
      alert('Error al buscar clientes');
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = clientes.filter(c => c.activo !== false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Clientes</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de clientes y contactos</p>
        </div>
        <Link to="/clientes/nuevo">
          <Button>+ Nuevo Cliente</Button>
        </Link>
      </div>

      {/* Búsqueda y filtros */}
      <Card>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Buscar (Razón Social, CUIT, Contacto)
            </label>
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar cliente..."
            />
          </div>
          <Button onClick={handleSearch}>Buscar</Button>
          <Button variant="outline" onClick={() => { setSearchTerm(''); loadClientes(); }}>
            Limpiar
          </Button>
          <div className="flex gap-2 border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-bold uppercase rounded ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-xs font-bold uppercase rounded ${
                viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Tarjetas
            </button>
          </div>
        </div>
      </Card>

      {/* Listado */}
      {filteredClientes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400">No se encontraron clientes</p>
            <Link to="/clientes/nuevo" className="text-blue-600 hover:underline mt-2 inline-block">
              Crear primer cliente
            </Link>
          </div>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-slate-600 uppercase text-xs">Razón Social</th>
                  <th className="px-4 py-3 text-left font-black text-slate-600 uppercase text-xs">CUIT</th>
                  <th className="px-4 py-3 text-left font-black text-slate-600 uppercase text-xs">Rubro</th>
                  <th className="px-4 py-3 text-left font-black text-slate-600 uppercase text-xs">Contactos</th>
                  <th className="px-4 py-3 text-left font-black text-slate-600 uppercase text-xs">Estado</th>
                  <th className="px-4 py-3 text-right font-black text-slate-600 uppercase text-xs">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{cliente.razonSocial}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{cliente.cuit || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{cliente.rubro || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{cliente.contactos?.length || 0} contacto(s)</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        cliente.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="text-blue-600 hover:underline font-bold text-xs uppercase"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente) => (
            <Card key={cliente.id}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-black text-lg text-slate-900 uppercase">{cliente.razonSocial}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    cliente.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  {cliente.cuit && <p><span className="font-bold">CUIT:</span> {cliente.cuit}</p>}
                  {cliente.rubro && <p><span className="font-bold">Rubro:</span> {cliente.rubro}</p>}
                  <p><span className="font-bold">Contactos:</span> {cliente.contactos?.length || 0}</p>
                </div>
                <Link to={`/clientes/${cliente.id}`}>
                  <Button className="w-full" variant="outline">Ver Detalle</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
