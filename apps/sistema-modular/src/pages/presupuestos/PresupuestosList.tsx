import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { presupuestosService, clientesService } from '../../services/firebaseService';
import type { Presupuesto, Cliente, TipoPresupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, TIPO_PRESUPUESTO_LABELS, TIPO_PRESUPUESTO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';

export const PresupuestosList = () => {
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<Presupuesto['estado'] | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<TipoPresupuesto | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => { loadData(); }, []);

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

  const presupuestosFiltrados = useMemo(() => {
    let result = presupuestos.filter(p => {
      if (filtroCliente && p.clienteId !== filtroCliente) return false;
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (filtroTipo && p.tipo !== filtroTipo) return false;
      return true;
    });
    return sortByField(result, sortField, sortDir);
  }, [presupuestos, filtroCliente, filtroEstado, filtroTipo, sortField, sortDir]);

  const getClienteNombre = (clienteId: string) => {
    return clientes.find(c => c.id === clienteId)?.razonSocial || 'Cliente no encontrado';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando presupuestos...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Presupuestos"
        subtitle="Gestion de presupuestos y cotizaciones"
        count={presupuestosFiltrados.length}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/presupuestos/conceptos-servicio')}>Conceptos</Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/presupuestos/categorias')}>Categorias</Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/presupuestos/condiciones-pago')}>Condiciones</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Presupuesto</Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[180px]">
            <SearchableSelect value={filtroCliente} onChange={setFiltroCliente}
              options={[{ value: '', label: 'Todos los clientes' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Filtrar por cliente..." />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect value={filtroEstado}
              onChange={(value) => setFiltroEstado(value as Presupuesto['estado'] | '')}
              options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
              placeholder="Filtrar por estado..." />
          </div>
          <div className="min-w-[140px]">
            <SearchableSelect value={filtroTipo}
              onChange={(value) => setFiltroTipo(value as TipoPresupuesto | '')}
              options={[{ value: '', label: 'Todos los tipos' }, ...Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
              placeholder="Filtrar por tipo..." />
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setFiltroCliente(''); setFiltroEstado(''); setFiltroTipo(''); }}>Limpiar</Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {presupuestosFiltrados.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay presupuestos para mostrar</p>
              <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>Crear primer presupuesto</Button>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Moneda</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Items</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Total</th>
                    <SortableHeader label="Creado" field="createdAt" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider" />
                    <SortableHeader label="Enviado" field="fechaEnvio" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider" />
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {presupuestosFiltrados.map((p) => {
                    const sym = MONEDA_SIMBOLO[(p.moneda || 'USD') as keyof typeof MONEDA_SIMBOLO] || '$';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link to={`/presupuestos/${p.id}`} className="font-semibold text-indigo-600 hover:underline text-xs">{p.numero}</Link>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-700">{getClienteNombre(p.clienteId)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_PRESUPUESTO_COLORS[p.tipo || 'servicio']}`}>
                            {TIPO_PRESUPUESTO_LABELS[p.tipo || 'servicio']}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[p.estado]}`}>
                            {ESTADO_PRESUPUESTO_LABELS[p.estado]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-center text-slate-500">{p.moneda || 'USD'}</td>
                        <td className="px-4 py-2 text-xs text-slate-600 text-right tabular-nums">{p.items.length}</td>
                        <td className="px-4 py-2 text-xs text-slate-900 font-medium text-right tabular-nums">
                          {sym} {p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {p.fechaEnvio ? new Date(p.fechaEnvio).toLocaleDateString('es-AR') : '-'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/presupuestos/${p.id}`)}>Ver</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
      </div>

      <CreatePresupuestoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
