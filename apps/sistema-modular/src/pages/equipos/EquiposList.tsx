import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sistemasService, categoriasEquipoService, clientesService, establecimientosService } from '../../services/firebaseService';
import type { Sistema, CategoriaEquipo, Cliente, Establecimiento } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateEquipoModal } from '../../components/equipos/CreateEquipoModal';
import QREquipoModal from '../../components/equipos/QREquipoModal';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const EquiposList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');

  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [qrSistema, setQrSistema] = useState<Sistema | null>(null);

  const [filters, setFilters] = useState({
    clienteId: clienteIdFilter || '',
    categoriaId: '',
    activosOnly: true,
  });
  const [sortField, setSortField] = useState('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadSistemas(); }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sistemasData, categoriasData, clientesData, establecimientosData] = await Promise.all([
        sistemasService.getAll({
          clienteCuit: filters.clienteId || undefined,
          clienteId: filters.clienteId || undefined,
          activosOnly: filters.activosOnly,
        }),
        categoriasEquipoService.getAll(),
        clientesService.getAll(true),
        establecimientosService.getAll(),
      ]);
      setSistemas(sistemasData);
      setCategorias(categoriasData);
      setClientes(clientesData);
      setEstablecimientos(establecimientosData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadSistemas = async () => {
    try {
      setLoading(true);
      const data = await sistemasService.getAll({
        clienteCuit: filters.clienteId || undefined,
        clienteId: filters.clienteId || undefined,
        activosOnly: filters.activosOnly,
      });
      setSistemas(data);
    } catch (error) {
      console.error('Error cargando sistemas:', error);
    } finally {
      setLoading(false);
    }
  };

  const sistemasFiltrados = useMemo(() => {
    let result = sistemas;
    if (filters.categoriaId) result = result.filter(s => s.categoriaId === filters.categoriaId);
    return sortByField(result, sortField, sortDir);
  }, [sistemas, filters.categoriaId, sortField, sortDir]);

  const handleDeleteSistema = async (sistemaId: string, sistemaNombre: string) => {
    if (!confirm(`¿Está seguro de eliminar el sistema "${sistemaNombre}"?\n\nEsta acción eliminará también todos los módulos asociados y no se puede deshacer.`)) {
      return;
    }
    try {
      await sistemasService.delete(sistemaId);
      await loadData();
    } catch (error) {
      console.error('Error eliminando sistema:', error);
      alert('Error al eliminar el sistema');
    }
  };

  if (loading && sistemas.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando equipos...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Equipos / Sistemas"
        subtitle="Gestión de sistemas y módulos"
        count={sistemasFiltrados.length}
        actions={
          <div className="flex gap-2 items-center">
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Sistema</Button>
            <Link to="/categorias-equipo">
              <Button size="sm" variant="outline">Categorías</Button>
            </Link>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[180px]">
            <SearchableSelect
              value={filters.clienteId}
              onChange={(value) => setFilters({ ...filters, clienteId: value })}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente"
            />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filters.categoriaId}
              onChange={(value) => setFilters({ ...filters, categoriaId: value })}
              options={[{ value: '', label: 'Todas' }, ...categorias.map(cat => ({ value: cat.id, label: cat.nombre }))]}
              placeholder="Categoría"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.activosOnly}
              onChange={(e) => setFilters({ ...filters, activosOnly: e.target.checked })}
              className="rounded border-slate-300"
            />
            Solo activos
          </label>
          <Button size="sm" variant="ghost" onClick={() => setFilters({ clienteId: '', categoriaId: '', activosOnly: true })}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {sistemasFiltrados.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron sistemas</p>
              <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primer sistema
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: 80 }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Nombre" field="nombre" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Cliente</th>
                  <th className={thClass}>Establecimiento</th>
                  <SortableHeader label="Categoría" field="categoriaId" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Código</th>
                  <th className={thClass}>Software</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sistemasFiltrados.map((sistema) => {
                  const establecimiento = establecimientos.find(e => e.id === sistema.establecimientoId);
                  const cliente = clientes.find(c => c.id === (establecimiento?.clienteCuit ?? sistema.clienteId));
                  const categoria = categorias.find(c => c.id === sistema.categoriaId);
                  return (
                    <tr key={sistema.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/equipos/${sistema.id}`}>
                      <td className="px-3 py-2 text-xs font-semibold text-indigo-600 truncate" title={sistema.nombre}>
                        {sistema.nombre}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate" title={cliente?.razonSocial}>{cliente?.razonSocial || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate">{establecimiento?.nombre || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate">{categoria?.nombre || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap">{sistema.codigoInternoCliente || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate">{sistema.software || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          sistema.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {sistema.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/equipos/${sistema.id}`}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                            Ver
                          </Link>
                          {sistema.agsVisibleId && (
                            <button onClick={() => setQrSistema(sistema)}
                              className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 px-1 py-0.5 rounded hover:bg-indigo-50"
                              title={`QR — ${sistema.agsVisibleId}`}>
                              QR
                            </button>
                          )}
                          <button onClick={() => handleDeleteSistema(sistema.id, sistema.nombre)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                            Eliminar
                          </button>
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

      <CreateEquipoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />

      {qrSistema?.agsVisibleId && (
        <QREquipoModal
          agsVisibleId={qrSistema.agsVisibleId}
          equipoNombre={qrSistema.nombre}
          onClose={() => setQrSistema(null)}
        />
      )}
    </div>
  );
};
