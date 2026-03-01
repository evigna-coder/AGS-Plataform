import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService } from '../../services/firebaseService';
import type { WorkOrder, Cliente, Sistema } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateOTModal } from '../../components/ordenes-trabajo/CreateOTModal';

type ViewMode = 'cards' | 'list';
type StatusFilter = 'all' | 'BORRADOR' | 'FINALIZADO';

const ColGroup = () => (
  <colgroup>
    <col style={{ width: '9%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '11%' }} />
    <col style={{ width: '11%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '7%' }} />
    <col style={{ width: '7%' }} />
    <col style={{ width: '8%' }} />
    <col style={{ width: '5%' }} />
  </colgroup>
);

const thClass = 'px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider';

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
    status === 'FINALIZADO'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  }`}>
    {status === 'FINALIZADO' ? 'Finalizado' : 'Borrador'}
  </span>
);

export const OTList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');
  const sistemaIdFilter = searchParams.get('sistema');

  const [ordenes, setOrdenes] = useState<WorkOrder[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);

  const getInitialViewMode = (): ViewMode => {
    const saved = localStorage.getItem('ot-view-mode');
    return (saved === 'cards' || saved === 'list') ? saved : 'cards';
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode());
  const [filters, setFilters] = useState({
    clienteId: clienteIdFilter || '',
    sistemaId: sistemaIdFilter || '',
    status: 'all' as StatusFilter,
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('ot-view-mode', mode);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadOrdenes(); }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientesData, sistemasData] = await Promise.all([
        clientesService.getAll(true),
        sistemasService.getAll(),
      ]);
      setClientes(clientesData);
      setSistemas(sistemasData);
      await loadOrdenes();
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadOrdenes = async () => {
    try {
      setLoading(true);
      const filtersToApply: any = {};
      if (filters.clienteId) filtersToApply.clienteId = filters.clienteId;
      if (filters.sistemaId) filtersToApply.sistemaId = filters.sistemaId;
      if (filters.status !== 'all') filtersToApply.status = filters.status;
      const data = await ordenesTrabajoService.getAll(
        Object.keys(filtersToApply).length > 0 ? filtersToApply : undefined
      );
      setOrdenes(data);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-AR');
    } catch {
      return dateString;
    }
  };

  if (loading && ordenes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando órdenes de trabajo...</p>
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Órdenes de Trabajo"
        subtitle="Gestión de reportes de servicio"
        count={ordenes.length}
        actions={
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => handleViewModeChange('cards')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Vista de tarjetas"
              >
                <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Vista de lista"
              >
                <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <Link to="/tipos-servicio">
              <Button size="sm" variant="outline">Tipos de Servicio</Button>
            </Link>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva OT</Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filters.clienteId}
              onChange={(value) => setFilters({ ...filters, clienteId: value })}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente"
            />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filters.sistemaId}
              onChange={(value) => setFilters({ ...filters, sistemaId: value })}
              options={[{ value: '', label: 'Todos' }, ...sistemas.map(s => ({ value: s.id, label: s.nombre }))]}
              placeholder="Sistema"
            />
          </div>
          <div className="min-w-[130px]">
            <SearchableSelect
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value as StatusFilter })}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'BORRADOR', label: 'Borrador' },
                { value: 'FINALIZADO', label: 'Finalizado' },
              ]}
              placeholder="Estado"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setFilters({ clienteId: '', sistemaId: '', status: 'all' })}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {ordenes.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron órdenes de trabajo</p>
              <button onClick={() => setShowCreate(true)}
                className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
                Crear primera orden de trabajo
              </button>
            </div>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ordenes.map((ot) => {
              const sistema = sistemas.find(s => s.id === ot.sistemaId);
              return (
                <Card key={ot.otNumber}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-sm text-indigo-600 tracking-tight">OT-{ot.otNumber}</h3>
                      <StatusBadge status={ot.status} />
                    </div>
                    <div className="space-y-0.5 text-xs text-slate-600">
                      <p><span className="font-medium text-slate-700">Cliente:</span> {ot.razonSocial}</p>
                      {sistema && <p><span className="font-medium text-slate-700">Sistema:</span> {sistema.nombre}</p>}
                      {ot.moduloModelo && (
                        <p>
                          <span className="font-medium text-slate-700">Módulo:</span> {ot.moduloModelo}
                          {ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}
                        </p>
                      )}
                      <p><span className="font-medium text-slate-700">Tipo:</span> {ot.tipoServicio}</p>
                      {ot.accionesTomar && (
                        <p className="text-[10px] text-slate-500 line-clamp-2">
                          <span className="font-medium text-slate-600">Problema:</span> {ot.accionesTomar}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        <span className="font-medium">Fecha:</span> {formatDate(ot.fechaInicio)}
                      </p>
                    </div>
                    <Link to={`/ordenes-trabajo/${ot.otNumber}`}>
                      <Button className="w-full" variant="outline" size="sm">Ver detalle</Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full table-fixed">
              <ColGroup />
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={thClass}>OT</th>
                  <th className={thClass}>Cliente</th>
                  <th className={thClass}>Sistema</th>
                  <th className={thClass}>Módulo</th>
                  <th className={thClass}>Tipo Servicio</th>
                  <th className={thClass}>Problema</th>
                  <th className={thClass}>Creada</th>
                  <th className={thClass}>Fecha</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordenes.map((ot) => {
                  const sistema = sistemas.find(s => s.id === ot.sistemaId);
                  return (
                    <tr key={ot.otNumber} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2">
                        <span className="font-semibold text-indigo-600 text-xs">OT-{ot.otNumber}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700 truncate">{ot.razonSocial}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 truncate">
                        {sistema?.nombre || ot.sistema || '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 truncate">
                        {ot.moduloModelo || '—'}
                        {ot.moduloSerie && (
                          <span className="text-[10px] text-slate-400 ml-1">({ot.moduloSerie})</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 truncate">{ot.tipoServicio}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 max-w-0">
                        {ot.accionesTomar
                          ? <span className="block truncate" title={ot.accionesTomar}>{ot.accionesTomar}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {ot.createdAt ? formatDate(ot.createdAt) : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{formatDate(ot.fechaInicio)}</td>
                      <td className="px-4 py-2"><StatusBadge status={ot.status} /></td>
                      <td className="px-4 py-2 text-right">
                        <Link to={`/ordenes-trabajo/${ot.otNumber}`}>
                          <Button variant="ghost" size="sm">Ver</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateOTModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
