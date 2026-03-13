import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { establecimientosService, clientesService } from '../../services/firebaseService';
import type { Establecimiento, Cliente } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateEstablecimientoModal } from '../../components/establecimientos/CreateEstablecimientoModal';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const EstablecimientosList = () => {
  const [searchParams] = useSearchParams();
  const clienteCuitFromUrl = searchParams.get('cliente');

  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [filters, setFilters] = useState({
    clienteId: clienteCuitFromUrl || '',
  });
  const [sortField, setSortField] = useState('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => { loadClientes(); }, []);
  useEffect(() => { loadEstablecimientos(); }, [filters.clienteId]);

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
      if (filters.clienteId) {
        const data = await establecimientosService.getByCliente(filters.clienteId);
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

  const sorted = useMemo(() => sortByField(establecimientos, sortField, sortDir), [establecimientos, sortField, sortDir]);

  if (loading && establecimientos.length === 0 && filters.clienteId) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando establecimientos...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Establecimientos"
        subtitle="Sedes y plantas por cliente"
        count={sorted.length}
        actions={
          <Button size="sm" disabled={!filters.clienteId} title={!filters.clienteId ? 'Seleccione un cliente primero' : ''}
            onClick={() => setShowCreate(true)}>
            + Nuevo Establecimiento
          </Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[260px]">
            <SearchableSelect
              value={filters.clienteId}
              onChange={(v) => setFilters({ ...filters, clienteId: v })}
              options={[
                { value: '', label: 'Seleccionar cliente...' },
                ...clientes.map(c => ({ value: c.id, label: `${c.razonSocial}${c.cuit ? ` (${c.cuit})` : ''}` })),
              ]}
              placeholder="Cliente"
            />
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {!filters.clienteId ? (
          <Card>
            <div className="text-center py-12 text-slate-500 text-xs">
              Seleccione un cliente para ver sus establecimientos.
            </div>
          </Card>
        ) : sorted.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay establecimientos para este cliente</p>
              <button onClick={() => setShowCreate(true)}
                className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primer establecimiento
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Nombre" field="nombre" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Dirección</th>
                  <SortableHeader label="Localidad" field="localidad" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Provincia" field="provincia" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((est) => (
                  <tr key={est.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/establecimientos/${est.id}`}>
                    <td className="px-3 py-2 text-xs font-semibold text-indigo-600 truncate" title={est.nombre}>{est.nombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate" title={est.direccion}>{est.direccion}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate">{est.localidad}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate">{est.provincia}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        est.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {est.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/establecimientos/${est.id}`}
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

      <CreateEstablecimientoModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={loadEstablecimientos} preselectedClienteId={filters.clienteId || undefined} />
    </div>
  );
};
