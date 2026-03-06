import { useState, useEffect, useMemo } from 'react';
import { requerimientosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRequerimientoModal } from '../../components/stock/CreateRequerimientoModal';
import type { RequerimientoCompra, EstadoRequerimiento, OrigenRequerimiento } from '@ags/shared';
import {
  ESTADO_REQUERIMIENTO_LABELS,
  ESTADO_REQUERIMIENTO_COLORS,
  ORIGEN_REQUERIMIENTO_LABELS,
} from '@ags/shared';

const ORIGEN_COLORS: Record<OrigenRequerimiento, string> = {
  manual: 'bg-slate-100 text-slate-600',
  presupuesto: 'bg-indigo-50 text-indigo-700',
  stock_minimo: 'bg-amber-50 text-amber-700',
  ingeniero: 'bg-blue-50 text-blue-700',
};

export const RequerimientosList = () => {
  const [requerimientos, setRequerimientos] = useState<RequerimientoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '', origen: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [sortField, setSortField] = useState('fechaSolicitud');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const sorted = useMemo(() => sortByField(requerimientos, sortField, sortDir), [requerimientos, sortField, sortDir]);

  useEffect(() => { loadData(); }, [filters.estado, filters.origen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await requerimientosService.getAll({
        estado: filters.estado || undefined,
        origen: filters.origen || undefined,
      });
      setRequerimientos(data);
    } catch (error) {
      console.error('Error cargando requerimientos:', error);
      alert('Error al cargar los requerimientos');
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (id: string) => {
    if (!confirm('¿Aprobar este requerimiento?')) return;
    try {
      await requerimientosService.update(id, {
        estado: 'aprobado',
        fechaAprobacion: new Date().toISOString(),
      });
      setRequerimientos(prev =>
        prev.map(r => r.id === id ? { ...r, estado: 'aprobado' as const, fechaAprobacion: new Date().toISOString() } : r)
      );
    } catch (error) {
      console.error('Error aprobando requerimiento:', error);
      alert('Error al aprobar el requerimiento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este requerimiento pendiente?')) return;
    try {
      await requerimientosService.delete(id);
      setRequerimientos(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error eliminando requerimiento:', error);
      alert('Error al eliminar el requerimiento');
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading && requerimientos.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando requerimientos...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Requerimientos de Compra"
        subtitle="Requisiciones de compra"
        count={sorted.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo requerimiento</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_REQUERIMIENTO_LABELS) as EstadoRequerimiento[]).map(k => (
              <option key={k} value={k}>{ESTADO_REQUERIMIENTO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.origen} onChange={e => setFilters({ ...filters, origen: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los orígenes</option>
            {(Object.keys(ORIGEN_REQUERIMIENTO_LABELS) as OrigenRequerimiento[]).map(k => (
              <option key={k} value={k}>{ORIGEN_REQUERIMIENTO_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {sorted.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron requerimientos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Artículo</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cantidad</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Origen</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Solicitado por</th>
                  <SortableHeader label="Fecha" field="fechaSolicitud" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider" />
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs font-semibold text-indigo-600">{r.numero}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-900">{r.articuloDescripcion}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {r.cantidad} {r.unidadMedida}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ORIGEN_COLORS[r.origen]}`}>
                        {ORIGEN_REQUERIMIENTO_LABELS[r.origen]}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_REQUERIMIENTO_COLORS[r.estado]}`}>
                        {ESTADO_REQUERIMIENTO_LABELS[r.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-900">{r.solicitadoPor}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{formatDate(r.fechaSolicitud)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {r.estado === 'pendiente' && (
                          <button onClick={() => handleAprobar(r.id)} className="text-xs text-green-600 hover:underline font-medium">
                            Aprobar
                          </button>
                        )}
                        <button className="text-xs text-indigo-600 hover:underline font-medium">Ver</button>
                        {r.estado === 'pendiente' && (
                          <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline font-medium">
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

      <CreateRequerimientoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
