import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { presupuestosService, clientesService } from '../../services/firebaseService';
import type { Presupuesto, Cliente } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

const estadoLabels: Record<Presupuesto['estado'], string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_seguimiento: 'En Seguimiento',
  pendiente_oc: 'Pendiente OC',
  aceptado: 'Aceptado',
  pendiente_certificacion: 'Pendiente Certificación',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Presupuestos</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de presupuestos y cotizaciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/presupuestos/categorias')}>
            Categorías
          </Button>
          <Button variant="outline" onClick={() => navigate('/presupuestos/condiciones-pago')}>
            Condiciones
          </Button>
          <Button onClick={() => navigate('/presupuestos/nuevo')}>
            + Nuevo Presupuesto
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cliente</label>
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
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Estado</label>
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
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFiltroCliente('');
                setFiltroEstado('');
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de Presupuestos */}
      {presupuestosFiltrados.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400">No hay presupuestos para mostrar</p>
            <Button className="mt-4" onClick={() => navigate('/presupuestos/nuevo')}>
              Crear primer presupuesto
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {presupuestosFiltrados.map((presupuesto) => (
            <Card key={presupuesto.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      to={`/presupuestos/${presupuesto.id}`}
                      className="font-black text-blue-700 uppercase hover:underline text-lg"
                    >
                      {presupuesto.numero}
                    </Link>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${estadoColors[presupuesto.estado]}`}>
                      {estadoLabels[presupuesto.estado]}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-700">{getClienteNombre(presupuesto.clienteId)}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                    <span>{presupuesto.items.length} items</span>
                    <span>Total: ${presupuesto.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    {presupuesto.createdAt && (
                      <span>Creado: {new Date(presupuesto.createdAt).toLocaleDateString('es-AR')}</span>
                    )}
                    {presupuesto.fechaEnvio && (
                      <span className="font-bold text-blue-600">Enviado: {new Date(presupuesto.fechaEnvio).toLocaleDateString('es-AR')}</span>
                    )}
                    {presupuesto.validUntil && (
                      <span>Válido hasta: {new Date(presupuesto.validUntil).toLocaleDateString('es-AR')}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/presupuestos/${presupuesto.id}`)}
                  >
                    Ver
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
