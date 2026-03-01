import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { remitosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRemitoModal } from '../../components/stock/CreateRemitoModal';
import type { Remito, TipoRemito, EstadoRemito } from '@ags/shared';

const TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolución', interno: 'Interno', derivacion_proveedor: 'Derivación proveedor', loaner_salida: 'Loaner salida' };
const ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En tránsito', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };
const TIPO_COLORS: Record<TipoRemito, string> = { salida_campo: 'bg-blue-50 text-blue-700', entrega_cliente: 'bg-indigo-50 text-indigo-700', devolucion: 'bg-emerald-50 text-emerald-700', interno: 'bg-slate-100 text-slate-600', derivacion_proveedor: 'bg-purple-50 text-purple-700', loaner_salida: 'bg-amber-50 text-amber-700' };

export const RemitosList = () => {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '', tipo: '', showAll: false });
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadData(); }, [filters.estado, filters.tipo, filters.showAll]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await remitosService.getAll({
        estado: filters.estado || undefined,
        tipo: filters.tipo || undefined,
      });
      const filtered = filters.showAll ? data : data.filter(r => r.estado !== 'cancelado');
      setRemitos(filtered);
    } catch (error) {
      console.error('Error cargando remitos:', error);
      alert('Error al cargar los remitos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este remito borrador?')) return;
    try {
      await remitosService.delete(id);
      setRemitos(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error eliminando remito:', error);
      alert('Error al eliminar el remito');
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading && remitos.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando remitos...</p></div>;
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Remitos"
        subtitle="Gestionar remitos de stock"
        count={remitos.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo remito</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_LABELS) as EstadoRemito[]).map(k => (
              <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_LABELS) as TipoRemito[]).map(k => (
              <option key={k} value={k}>{TIPO_LABELS[k]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
            <input type="checkbox" checked={filters.showAll} onChange={e => setFilters({ ...filters, showAll: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-slate-300" />
            Mostrar cancelados
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {remitos.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron remitos</p></div></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Ingeniero</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Items</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Fecha salida</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">OTs</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {remitos.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-semibold text-indigo-600">{r.numero}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[r.tipo]}`}>
                          {TIPO_LABELS[r.tipo]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[r.estado]}`}>
                          {ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-900">{r.ingenieroNombre}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{r.items?.length ?? 0}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatDate(r.fechaSalida)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {r.otNumbers?.length ? r.otNumbers.join(', ') : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link to={`/stock/remitos/${r.id}`} className="text-xs text-indigo-600 hover:underline font-medium">Ver</Link>
                          {r.estado === 'borrador' && (
                            <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline font-medium">Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <CreateRemitoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
    </div>
  );
};
