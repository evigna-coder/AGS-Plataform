import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrdenesCompra } from '../../hooks/useOrdenesCompra';
import type { EstadoOC, TipoOC } from '@ags/shared';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';

const TIPO_LABELS: Record<TipoOC, string> = { nacional: 'Nacional', importacion: 'Importacion' };
const TIPO_COLORS: Record<TipoOC, string> = { nacional: 'bg-emerald-100 text-emerald-700', importacion: 'bg-violet-100 text-violet-700' };
const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '\u20AC' };

export const OCList = () => {
  const { ordenes, loading, loadOrdenes, deleteOrden } = useOrdenesCompra();
  const [filtroEstado, setFiltroEstado] = useState<EstadoOC | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<TipoOC | ''>('');
  const [showCanceladas, setShowCanceladas] = useState(false);

  useEffect(() => { loadOrdenes(); }, []);

  const filtered = ordenes.filter(o => {
    if (filtroEstado && o.estado !== filtroEstado) return false;
    if (filtroTipo && o.tipo !== filtroTipo) return false;
    if (!showCanceladas && o.estado === 'cancelada') return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta orden de compra?')) return;
    try {
      await deleteOrden(id);
      await loadOrdenes();
    } catch { alert('Error al eliminar'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando ordenes de compra...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Ordenes de Compra"
        subtitle="Gestionar ordenes de compra"
        count={filtered.length}
        actions={
          <Link to="/stock/ordenes-compra/nuevo">
            <Button size="sm">+ Nueva OC</Button>
          </Link>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as EstadoOC | '')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_OC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as TipoOC | '')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los tipos</option>
            <option value="nacional">Nacional</option>
            <option value="importacion">Importacion</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showCanceladas} onChange={e => setShowCanceladas(e.target.checked)} className="rounded border-slate-300" />
            Mostrar canceladas
          </label>
          <Button size="sm" variant="ghost" onClick={() => { setFiltroEstado(''); setFiltroTipo(''); setShowCanceladas(false); }}>Limpiar</Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay ordenes de compra para mostrar</p>
              <Link to="/stock/ordenes-compra/nuevo"><Button className="mt-4" size="sm">Crear primera OC</Button></Link>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Proveedor</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Items</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Total</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Moneda</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Entrega est.</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => {
                  const sym = MONEDA_SYM[o.moneda] || '$';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link to={`/stock/ordenes-compra/${o.id}`} className="font-mono font-semibold text-indigo-600 hover:underline text-xs">{o.numero}</Link>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLORS[o.tipo]}`}>{TIPO_LABELS[o.tipo]}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_OC_COLORS[o.estado]}`}>{ESTADO_OC_LABELS[o.estado]}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">{o.proveedorNombre}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 text-right tabular-nums">{o.items.length}</td>
                      <td className="px-4 py-2 text-xs text-slate-900 font-medium text-right tabular-nums">
                        {o.total != null ? `${sym} ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-xs text-center text-slate-500">{o.moneda}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {o.fechaEntregaEstimada ? new Date(o.fechaEntregaEstimada).toLocaleDateString('es-AR') : '-'}
                      </td>
                      <td className="px-4 py-2 text-right space-x-1">
                        <Link to={`/stock/ordenes-compra/${o.id}`}><Button variant="ghost" size="sm">Ver</Button></Link>
                        {o.estado === 'borrador' && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(o.id)}>Eliminar</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
