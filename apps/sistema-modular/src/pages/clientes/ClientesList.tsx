import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clientesService, establecimientosService } from '../../services/firebaseService';
import type { Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateClienteModal } from '../../components/clientes/CreateClienteModal';

export const ClientesList = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientosByCliente, setEstablecimientosByCliente] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const [data, establecimientos] = await Promise.all([
        clientesService.getAll(),
        establecimientosService.getAll(),
      ]);
      setClientes(data);
      const byCliente: Record<string, number> = {};
      establecimientos.forEach((e) => {
        byCliente[e.clienteCuit] = (byCliente[e.clienteCuit] ?? 0) + 1;
      });
      setEstablecimientosByCliente(byCliente);
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
      const establecimientos = await establecimientosService.getAll();
      const byCliente: Record<string, number> = {};
      establecimientos.forEach((e) => {
        byCliente[e.clienteCuit] = (byCliente[e.clienteCuit] ?? 0) + 1;
      });
      setEstablecimientosByCliente(byCliente);
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
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Clientes"
        subtitle="Gestión de clientes y establecimientos"
        count={filteredClientes.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Cliente</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por razón social o CUIT..."
            />
          </div>
          <Button size="sm" onClick={handleSearch}>Buscar</Button>
          <Button size="sm" variant="outline" onClick={() => { setSearchTerm(''); loadClientes(); }}>
            Limpiar
          </Button>
          <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded ${
                viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-500'
              }`}
            >
              Tarjetas
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {filteredClientes.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron clientes</p>
              <button onClick={() => setShowCreate(true)} className="text-blue-600 hover:underline mt-2 inline-block text-sm">
                Crear primer cliente
              </button>
            </div>
          </Card>
        ) : viewMode === 'table' ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Razón Social</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">CUIT</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Rubro</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Establecimientos</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs font-semibold text-slate-900">{cliente.razonSocial}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 font-mono">{cliente.cuit || '-'}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{cliente.rubro || '-'}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{establecimientosByCliente[cliente.id] ?? 0}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          cliente.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {cliente.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          to={`/clientes/${cliente.id}`}
                          className="text-blue-600 hover:underline font-medium text-xs"
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
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-sm text-slate-900">{cliente.razonSocial}</h3>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      cliente.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {cliente.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-xs text-slate-600">
                    {cliente.cuit && <p><span className="font-medium">CUIT:</span> {cliente.cuit}</p>}
                    {cliente.rubro && <p><span className="font-medium">Rubro:</span> {cliente.rubro}</p>}
                    <p><span className="font-medium">Establecimientos:</span> {establecimientosByCliente[cliente.id] ?? 0}</p>
                  </div>
                  <Link to={`/clientes/${cliente.id}`}>
                    <Button className="w-full" variant="outline" size="sm">Ver Detalle</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateClienteModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadClientes} />
    </div>
  );
};
