import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { establecimientosService, clientesService } from '../../services/firebaseService';
import type { Establecimiento, Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

export const EstablecimientosList = () => {
  const [searchParams] = useSearchParams();
  const clienteCuitFromUrl = searchParams.get('cliente');

  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState(clienteCuitFromUrl || '');

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    loadEstablecimientos();
  }, [filtroCliente]);

  const loadClientes = async () => {
    try {
      const data = await clientesService.getAll(true);
      setClientes(data);
    } catch (e) {
      console.error('Error cargando clientes:', e);
    }
  };

  const loadEstablecimientos = async () => {
    try {
      setLoading(true);
      if (filtroCliente) {
        const data = await establecimientosService.getByCliente(filtroCliente);
        setEstablecimientos(data);
      } else {
        setEstablecimientos([]);
      }
    } catch (e) {
      console.error('Error cargando establecimientos:', e);
      setEstablecimientos([]);
    } finally {
      setLoading(false);
    }
  };

  const clienteNombre = filtroCliente
    ? clientes.find(c => c.id === filtroCliente)?.razonSocial || filtroCliente
    : '';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Establecimientos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Sedes y plantas por cliente
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={filtroCliente ? `/establecimientos/nuevo?cliente=${filtroCliente}` : '/clientes'}>
            <Button disabled={!filtroCliente} title={!filtroCliente ? 'Seleccione un cliente primero' : ''}>
              + Nuevo Establecimiento
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente</label>
            <SearchableSelect
              value={filtroCliente}
              onChange={setFiltroCliente}
              options={[
                { value: '', label: 'Seleccionar cliente...' },
                ...clientes.map(c => ({ value: c.id, label: `${c.razonSocial}${c.cuit ? ` (${c.cuit})` : ''}` })),
              ]}
              placeholder="Cliente"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-400">Cargando establecimientos...</p>
        </div>
      ) : !filtroCliente ? (
        <Card>
          <div className="text-center py-12 text-slate-500">
            Seleccione un cliente para ver sus establecimientos.
          </div>
        </Card>
      ) : establecimientos.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400">No hay establecimientos para este cliente</p>
            <Link to={`/establecimientos/nuevo?cliente=${filtroCliente}`}>
              <Button className="mt-4">Crear primer establecimiento</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {establecimientos.map((est) => (
            <Card key={est.id}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-black text-lg text-slate-900 uppercase">{est.nombre}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${est.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {est.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {est.direccion}, {est.localidad}, {est.provincia}
                </p>
                {clienteNombre && (
                  <p className="text-xs text-slate-500">Cliente: {clienteNombre}</p>
                )}
                <Link to={`/establecimientos/${est.id}`}>
                  <Button className="w-full" variant="outline" size="sm">Ver detalle</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
