import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { establecimientosService, clientesService } from '../../services/firebaseService';
import type { Establecimiento, Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateEstablecimientoModal } from '../../components/establecimientos/CreateEstablecimientoModal';

export const EstablecimientosList = () => {
  const [searchParams] = useSearchParams();
  const clienteCuitFromUrl = searchParams.get('cliente');

  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState(clienteCuitFromUrl || '');
  const [showCreate, setShowCreate] = useState(false);

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
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Establecimientos"
        subtitle="Sedes y plantas por cliente"
        count={establecimientos.length}
        actions={
          <Button size="sm" disabled={!filtroCliente} title={!filtroCliente ? 'Seleccione un cliente primero' : ''}
            onClick={() => setShowCreate(true)}>
            + Nuevo Establecimiento
          </Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[260px]">
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
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Nombre</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Dirección</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Localidad</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Provincia</th>
                    {clienteNombre && (
                      <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
                    )}
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {establecimientos.map((est) => (
                    <tr key={est.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs font-semibold text-slate-900">{est.nombre}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{est.direccion}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{est.localidad}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{est.provincia}</td>
                      {clienteNombre && (
                        <td className="px-4 py-2 text-xs text-slate-500">{clienteNombre}</td>
                      )}
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          est.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {est.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link to={`/establecimientos/${est.id}`}>
                          <Button variant="ghost" size="sm">Ver</Button>
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

      <CreateEstablecimientoModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={loadEstablecimientos} preselectedClienteId={filtroCliente || undefined} />
    </div>
  );
};
