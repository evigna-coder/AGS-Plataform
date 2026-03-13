import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { presupuestosService, clientesService } from '../../services/firebaseService';
import type { Presupuesto, Cliente, TipoPresupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, TIPO_PRESUPUESTO_LABELS, TIPO_PRESUPUESTO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreatePresupuestoModal } from '../../components/presupuestos/CreatePresupuestoModal';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const PresupuestosList = () => {
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [filters, setFilters] = useState({
    cliente: '',
    estado: '' as Presupuesto['estado'] | '',
    tipo: '' as TipoPresupuesto | '',
  });
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
      if (filters.cliente && p.clienteId !== filters.cliente) return false;
      if (filters.estado && p.estado !== filters.estado) return false;
      if (filters.tipo && p.tipo !== filters.tipo) return false;
      return true;
    });
    return sortByField(result, sortField, sortDir);
  }, [presupuestos, filters.cliente, filters.estado, filters.tipo, sortField, sortDir]);

  const getClienteNombre = (clienteId: string) => {
    return clientes.find(c => c.id === clienteId)?.razonSocial || 'Cliente no encontrado';
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleDateString('es-AR'); } catch { return dateString; }
  };

  if (loading && presupuestos.length === 0) {
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
            <SearchableSelect value={filters.cliente} onChange={(v) => setFilters({ ...filters, cliente: v })}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente" />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect value={filters.estado}
              onChange={(v) => setFilters({ ...filters, estado: v as Presupuesto['estado'] | '' })}
              options={[{ value: '', label: 'Todos' }, ...Object.entries(ESTADO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
              placeholder="Estado" />
          </div>
          <div className="min-w-[140px]">
            <SearchableSelect value={filters.tipo}
              onChange={(v) => setFilters({ ...filters, tipo: v as TipoPresupuesto | '' })}
              options={[{ value: '', label: 'Todos' }, ...Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }))]}
              placeholder="Tipo" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setFilters({ cliente: '', estado: '', tipo: '' })}>Limpiar</Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {presupuestosFiltrados.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay presupuestos para mostrar</p>
              <button onClick={() => setShowCreate(true)}
                className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primer presupuesto
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: 75 }} />
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 50 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Numero" field="numero" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Cliente" field="clienteId" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-center`}>Moneda</th>
                  <th className={`${thClass} text-right`}>Items</th>
                  <th className={`${thClass} text-right`}>Total</th>
                  <SortableHeader label="Creado" field="createdAt" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Enviado" field="fechaEnvio" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presupuestosFiltrados.map((p) => {
                  const sym = MONEDA_SIMBOLO[(p.moneda || 'USD') as keyof typeof MONEDA_SIMBOLO] || '$';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/presupuestos/${p.id}`)}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-semibold text-indigo-600 text-xs">{p.numero}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate" title={getClienteNombre(p.clienteId)}>
                        {getClienteNombre(p.clienteId)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_PRESUPUESTO_COLORS[p.tipo || 'servicio']}`}>
                          {TIPO_PRESUPUESTO_LABELS[p.tipo || 'servicio']}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[p.estado]}`}>
                          {ESTADO_PRESUPUESTO_LABELS[p.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-center text-slate-500 whitespace-nowrap">{p.moneda || 'USD'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 text-right tabular-nums whitespace-nowrap">{p.items.length}</td>
                      <td className="px-3 py-2 text-xs text-slate-900 font-medium text-right tabular-nums whitespace-nowrap">
                        {sym} {p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(p.fechaEnvio)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/presupuestos/${p.id}`}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                            Ver
                          </Link>
                        </div>
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
