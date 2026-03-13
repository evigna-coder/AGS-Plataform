import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fichasService, clientesService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CreateFichaModal } from '../../components/fichas/CreateFichaModal';
import type { FichaPropiedad, EstadoFicha, Cliente } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS } from '@ags/shared';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export function FichasList() {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [filters, setFilters] = useState({
    estado: '',
    cliente: '',
    showEntregadas: false,
  });
  const [sortField, setSortField] = useState('fechaIngreso');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fichasService.getAll({ activasOnly: !filters.showEntregadas }),
      clientesService.getAll(),
    ]).then(([f, c]) => {
      setFichas(f);
      setClientes(c);
    }).finally(() => setLoading(false));
  }, [filters.showEntregadas]);

  const filtered = useMemo(() => {
    let result = fichas.filter(f => {
      if (filters.estado && f.estado !== filters.estado) return false;
      if (filters.cliente && f.clienteId !== filters.cliente) return false;
      return true;
    });
    return sortByField(result, sortField, sortDir);
  }, [fichas, filters.estado, filters.cliente, sortField, sortDir]);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta ficha?')) return;
    await fichasService.delete(id);
    setFichas(prev => prev.filter(f => f.id !== id));
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '—'; }
  };

  if (loading && fichas.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando fichas...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Fichas Propiedad del Cliente"
        subtitle="Módulos y equipos ingresados para reparación"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva ficha</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[160px]">
            <SearchableSelect value={filters.cliente} onChange={(v) => setFilters({ ...filters, cliente: v })}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente" />
          </div>
          <div className="min-w-[150px]">
            <SearchableSelect value={filters.estado}
              onChange={(v) => setFilters({ ...filters, estado: v })}
              options={[{ value: '', label: 'Todos' }, ...(Object.keys(ESTADO_FICHA_LABELS) as EstadoFicha[]).map(e => ({ value: e, label: ESTADO_FICHA_LABELS[e] }))]}
              placeholder="Estado" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showEntregadas}
              onChange={e => setFilters({ ...filters, showEntregadas: e.target.checked })}
              className="rounded border-slate-300"
            />
            Mostrar entregadas
          </label>
          <Button size="sm" variant="ghost" onClick={() => setFilters({ estado: '', cliente: '', showEntregadas: false })}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay fichas registradas</p>
              <button onClick={() => setShowCreate(true)}
                className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primera ficha
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: 75 }} />
                <col style={{ width: '15%' }} />
                <col />
                <col style={{ width: 85 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 75 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Numero" field="numero" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Descripcion</th>
                  <SortableHeader label="Estado" field="estado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Ingreso" field="fechaIngreso" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>OT Ref</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/fichas/${f.id}`)}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-semibold text-indigo-600 text-xs">{f.numero}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 truncate" title={f.clienteNombre}>{f.clienteNombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate" title={f.moduloNombre || f.descripcionLibre || ''}>
                      {f.moduloNombre || f.descripcionLibre || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_FICHA_COLORS[f.estado]}`}>
                        {ESTADO_FICHA_LABELS[f.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(f.fechaIngreso)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {f.otReferencia ? (
                        <Link to={`/ordenes-trabajo/${f.otReferencia}`} className="text-indigo-600 hover:underline" onClick={e => e.stopPropagation()}>
                          {f.otReferencia}
                        </Link>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => navigate(`/fichas/${f.id}`)}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                          Ver
                        </button>
                        {f.estado === 'recibido' && (
                          <button onClick={() => handleDelete(f.id)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateFichaModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {
        Promise.all([
          fichasService.getAll({ activasOnly: !filters.showEntregadas }),
          clientesService.getAll(),
        ]).then(([f, c]) => { setFichas(f); setClientes(c); });
      }} />
    </div>
  );
}
