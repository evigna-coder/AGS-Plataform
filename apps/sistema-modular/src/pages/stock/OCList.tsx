import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrdenesCompra } from '../../hooks/useOrdenesCompra';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import type { EstadoOC, TipoOC } from '@ags/shared';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const TIPO_LABELS: Record<TipoOC, string> = { nacional: 'Nacional', importacion: 'Importacion' };
const TIPO_COLORS: Record<TipoOC, string> = { nacional: 'bg-emerald-100 text-emerald-700', importacion: 'bg-violet-100 text-violet-700' };
const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '\u20AC' };

export const OCList = () => {
  const { ordenes, loading, loadOrdenes, deleteOrden } = useOrdenesCompra();
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('oc-list');
  const [filtroEstado, setFiltroEstado] = useState<EstadoOC | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<TipoOC | ''>('');
  const [showCanceladas, setShowCanceladas] = useState(false);
  const [sortField, setSortField] = useState('fechaEntregaEstimada');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => { loadOrdenes(); }, []);

  const filtered = useMemo(() => {
    let result = ordenes.filter(o => {
      if (filtroEstado && o.estado !== filtroEstado) return false;
      if (filtroTipo && o.tipo !== filtroTipo) return false;
      if (!showCanceladas && o.estado === 'cancelada') return false;
      return true;
    });
    return sortByField(result, sortField, sortDir);
  }, [ordenes, filtroEstado, filtroTipo, showCanceladas, sortField, sortDir]);

  const handleDelete = async (id: string) => {
    if (!await confirm('Eliminar esta orden de compra?')) return;
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
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_OC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as TipoOC | '')}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
              )}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(0)}`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    Numero
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(1)}`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    Tipo
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(2)}`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    Estado
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(3)}`}>
                    <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                    Proveedor
                    <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(4)}`}>
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    Items
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(5)}`}>
                    <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                    Total
                    <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(6)}`}>
                    <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                    Moneda
                    <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <SortableHeader label="Entrega est." field="fechaEntregaEstimada" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(7)}`}>
                    <ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />
                    <div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider relative">
                    Acciones
                    <div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => {
                  const sym = MONEDA_SYM[o.moneda] || '$';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-2 ${getAlignClass(0)}`}>
                        <Link to={`/stock/ordenes-compra/${o.id}`} className="font-mono font-semibold text-teal-600 hover:underline text-xs">{o.numero}</Link>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(1)}`}>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_COLORS[o.tipo]}`}>{TIPO_LABELS[o.tipo]}</span>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(2)}`}>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_OC_COLORS[o.estado]}`}>{ESTADO_OC_LABELS[o.estado]}</span>
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-700 ${getAlignClass(3)}`}>{o.proveedorNombre}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 tabular-nums ${getAlignClass(4)}`}>{o.items.length}</td>
                      <td className={`px-4 py-2 text-xs text-slate-900 font-medium tabular-nums ${getAlignClass(5)}`}>
                        {o.total != null ? `${sym} ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-500 ${getAlignClass(6)}`}>{o.moneda}</td>
                      <td className={`px-4 py-2 text-xs text-slate-500 ${getAlignClass(7)}`}>
                        {o.fechaEntregaEstimada ? new Date(o.fechaEntregaEstimada).toLocaleDateString('es-AR') : '-'}
                      </td>
                      <td className="px-4 py-2 text-center space-x-1">
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
