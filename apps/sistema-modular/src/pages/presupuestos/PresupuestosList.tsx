import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { presupuestosService, clientesService } from '../../services/firebaseService';
import type { Presupuesto, Cliente } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';

const estadoLabels: Record<Presupuesto['estado'], string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_seguimiento: 'En Seguimiento',
  pendiente_oc: 'Pendiente OC',
  aceptado: 'Aceptado',
  pendiente_certificacion: 'Pendiente Cert.',
  aguarda: 'Aguarda',
};

const estadoColors: Record<Presupuesto['estado'], string> = {
  borrador: 'bg-slate-100 text-slate-800',
  enviado: 'bg-blue-100 text-blue-800',
  en_seguimiento: 'bg-yellow-100 text-yellow-800',
  pendiente_oc: 'bg-orange-100 text-orange-800',
  aceptado: 'bg-green-100 text-green-800',
  pendiente_certificacion: 'bg-purple-100 text-purple-800',
  aguarda: 'bg-red-100 text-red-800',
};

export const PresupuestosList = () => {
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<Presupuesto['estado'] | ''>('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [presupuestosData, clientesData] = await Promise.all([
        presupuestosService.getAll(),
        clientesService.getAll(true),
      ]);
      setPresupuestos(presupuestosData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error cargando presupuestos:', error);
      alert('Error al cargar los presupuestos');
    } finally {
      setLoading(false);
    }
  };

  const presupuestosFiltrados = presupuestos.filter(p => {
    if (filtroCliente && p.clienteId !== filtroCliente) return false;
    if (filtroEstado && p.estado !== filtroEstado) return false;
    return true;
  });

  const getClienteNombre = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente?.razonSocial || 'Cliente no encontrado';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando presupuestos...</p>
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Presupuestos"
        subtitle="Gestión de presupuestos y cotizaciones"
        count={presupuestosFiltrados.length}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/presupuestos/categorias')}>
              Categorías
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/presupuestos/condiciones-pago')}>
              Condiciones
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              + Nuevo Presupuesto
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[180px]">
            <SearchableSelect
              value={filtroCliente}
              onChange={setFiltroCliente}
              options={[
                { value: '', label: 'Todos los clientes' },
                ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))
              ]}
              placeholder="Filtrar por cliente..."
            />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filtroEstado}
              onChange={(value) => setFiltroEstado(value as Presupuesto['estado'] | '')}
              options={[
                { value: '', label: 'Todos los estados' },
                ...Object.entries(estadoLabels).map(([value, label]) => ({ value, label }))
              ]}
              placeholder="Filtrar por estado..."
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFiltroCliente('');
              setFiltroEstado('');
            }}
          >
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {presupuestosFiltrados.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay presupuestos para mostrar</p>
              <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
                Crear primer presupuesto
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Número</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Items</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Total</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Creado</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Enviado</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Válido hasta</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {presupuestosFiltrados.map((presupuesto) => (
                    <tr key={presupuesto.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link
                          to={`/presupuestos/${presupuesto.id}`}
                          className="font-semibold text-blue-700 hover:underline text-xs"
                        >
                          {presupuesto.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">{getClienteNombre(presupuesto.clienteId)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoColors[presupuesto.estado]}`}>
                          {estadoLabels[presupuesto.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 text-right tabular-nums">{presupuesto.items.length}</td>
                      <td className="px-4 py-2 text-xs text-slate-900 font-medium text-right tabular-nums">
                        ${presupuesto.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {presupuesto.createdAt ? new Date(presupuesto.createdAt).toLocaleDateString('es-AR') : '-'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {presupuesto.fechaEnvio ? new Date(presupuesto.fechaEnvio).toLocaleDateString('es-AR') : '-'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {presupuesto.validUntil ? new Date(presupuesto.validUntil).toLocaleDateString('es-AR') : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/presupuestos/${presupuesto.id}`)}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <CreatePresupuestoModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};
