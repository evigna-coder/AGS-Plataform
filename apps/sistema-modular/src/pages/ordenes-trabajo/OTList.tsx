import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService } from '../../services/firebaseService';
import type { WorkOrder, Cliente, Sistema } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

type ViewMode = 'cards' | 'list';
type StatusFilter = 'all' | 'BORRADOR' | 'FINALIZADO';

export const OTList = () => {
  const [searchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get('cliente');
  const sistemaIdFilter = searchParams.get('sistema');
  
  const [ordenes, setOrdenes] = useState<WorkOrder[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Cargar preferencia de vista desde localStorage
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
  
  // Guardar preferencia cuando cambia la vista
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('ot-view-mode', mode);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadOrdenes();
  }, [filters]);

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
      
      const data = await ordenesTrabajoService.getAll(Object.keys(filtersToApply).length > 0 ? filtersToApply : undefined);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Órdenes de Trabajo</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de reportes de servicio</p>
        </div>
        <div className="flex gap-2">
          {/* Toggle de vista */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('cards')}
              className={`px-3 py-1.5 rounded text-xs font-black uppercase transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Vista de tarjetas"
            >
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1.5 rounded text-xs font-black uppercase transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Vista de lista"
            >
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <Link to="/tipos-servicio">
            <Button variant="outline">Gestionar Tipos de Servicio</Button>
          </Link>
          <Link to="/ordenes-trabajo/nuevo">
            <Button>+ Nueva OT</Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente</label>
            <SearchableSelect
              value={filters.clienteId}
              onChange={(value) => setFilters({ ...filters, clienteId: value })}
              options={[
                { value: '', label: 'Todos' },
                ...clientes.map(c => ({ value: c.id, label: c.razonSocial })),
              ]}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Sistema</label>
            <SearchableSelect
              value={filters.sistemaId}
              onChange={(value) => setFilters({ ...filters, sistemaId: value })}
              options={[
                { value: '', label: 'Todos' },
                ...sistemas.map(s => ({ value: s.id, label: s.nombre })),
              ]}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Estado</label>
            <SearchableSelect
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value as StatusFilter })}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'BORRADOR', label: 'Borrador' },
                { value: 'FINALIZADO', label: 'Finalizado' },
              ]}
              placeholder="Todos"
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setFilters({ clienteId: '', sistemaId: '', status: 'all' })}>
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Listado */}
      {ordenes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400">No se encontraron órdenes de trabajo</p>
            <Link to="/ordenes-trabajo/nuevo" className="text-blue-600 hover:underline mt-2 inline-block">
              Crear primera orden de trabajo
            </Link>
          </div>
        </Card>
      ) : viewMode === 'cards' ? (
        // Vista de Tarjetas
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordenes.map((ot) => {
            const cliente = clientes.find(c => c.id === ot.clienteId);
            const sistema = sistemas.find(s => s.id === ot.sistemaId);
            return (
              <Card key={ot.otNumber}>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-lg text-blue-700 uppercase">OT-{ot.otNumber}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      ot.status === 'FINALIZADO'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ot.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p><span className="font-bold">Cliente:</span> {ot.razonSocial}</p>
                    {sistema && <p><span className="font-bold">Sistema:</span> {sistema.nombre}</p>}
                    {ot.moduloModelo && (
                      <p><span className="font-bold">Módulo:</span> {ot.moduloModelo} {ot.moduloSerie && `(S/N: ${ot.moduloSerie})`}</p>
                    )}
                    <p><span className="font-bold">Tipo:</span> {ot.tipoServicio}</p>
                    {ot.accionesTomar && (
                      <p className="text-xs text-slate-500 line-clamp-2"><span className="font-bold">Problema:</span> {ot.accionesTomar}</p>
                    )}
                    {ot.createdAt && (
                      <p className="text-xs"><span className="font-bold">Creada:</span> {formatDate(ot.createdAt)}</p>
                    )}
                    <p><span className="font-bold">Fecha:</span> {formatDate(ot.fechaInicio)}</p>
                    {ot.status === 'FINALIZADO' && ot.fechaFin && (
                      <p className="text-xs"><span className="font-bold">Cerrada:</span> {formatDate(ot.fechaFin)}</p>
                    )}
                  </div>
                  <Link to={`/ordenes-trabajo/${ot.otNumber}`}>
                    <Button className="w-full" variant="outline" size="sm">Ver Detalle</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        // Vista de Lista
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">OT</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Sistema</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Módulo</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Tipo Servicio</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Problema</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Creada</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordenes.map((ot) => {
                  const sistema = sistemas.find(s => s.id === ot.sistemaId);
                  return (
                    <tr key={ot.otNumber} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-black text-blue-700 uppercase">OT-{ot.otNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ot.razonSocial}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {sistema?.nombre || ot.sistema || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ot.moduloModelo || '-'}
                        {ot.moduloSerie && <span className="text-xs text-slate-400 ml-1">({ot.moduloSerie})</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ot.tipoServicio}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                        {ot.accionesTomar ? (
                          <span className="line-clamp-2" title={ot.accionesTomar}>{ot.accionesTomar}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ot.createdAt ? formatDate(ot.createdAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(ot.fechaInicio)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          ot.status === 'FINALIZADO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {ot.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Link to={`/ordenes-trabajo/${ot.otNumber}`}>
                            <Button variant="outline" size="sm">Ver</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
