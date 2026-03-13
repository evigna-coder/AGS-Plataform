import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { clientesService, establecimientosService } from '../../services/firebaseService';
import type { Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateClienteModal } from '../../components/clientes/CreateClienteModal';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const ClientesList = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientosByCliente, setEstablecimientosByCliente] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
  });
  const [sortField, setSortField] = useState('razonSocial');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => { loadClientes(); }, []);

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

  const filtered = useMemo(() => {
    let result = clientes.filter(c => c.activo !== false);
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(c =>
        c.razonSocial.toLowerCase().includes(q) ||
        (c.cuit || '').toLowerCase().includes(q)
      );
    }
    return sortByField(result, sortField, sortDir);
  }, [clientes, filters.search, sortField, sortDir]);

  if (loading && clientes.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando clientes...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Clientes"
        subtitle="Gestión de clientes y establecimientos"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Cliente</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar por razón social o CUIT..."
            className="w-64 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          />
          <Button size="sm" variant="ghost" onClick={() => setFilters({ search: '' })}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron clientes</p>
              <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primer cliente
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Razón Social" field="razonSocial" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>CUIT</th>
                  <SortableHeader label="Rubro" field="rubro" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={`${thClass} text-center`}>Establec.</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/clientes/${cliente.id}`}>
                    <td className="px-3 py-2 text-xs font-semibold text-indigo-600 truncate" title={cliente.razonSocial}>
                      {cliente.razonSocial}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 font-mono whitespace-nowrap">{cliente.cuit || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate">{cliente.rubro || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 text-center tabular-nums whitespace-nowrap">{establecimientosByCliente[cliente.id] ?? 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        cliente.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/clientes/${cliente.id}`}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateClienteModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadClientes} />
    </div>
  );
};
