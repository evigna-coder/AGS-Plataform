import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ingresoEmpresasService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { IngresoEmpresaModal } from '../../components/ingreso-empresas/IngresoEmpresaModal';
import type { IngresoEmpresa, TipoIngresoCliente, DocumentoIngresoStatus } from '@ags/shared';
import { TIPO_INGRESO_LABELS, DOCUMENTACION_INGRESO_KEYS } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const STATUS_ICON: Record<DocumentoIngresoStatus, { symbol: string; cls: string }> = {
  no_requerido: { symbol: '—', cls: 'text-slate-300' },
  requerido: { symbol: '✓', cls: 'text-emerald-600 font-bold' },
  con_contrato: { symbol: '✓C', cls: 'text-blue-600 font-bold' },
  con_nomina: { symbol: '✓N', cls: 'text-purple-600 font-bold' },
  con_contrato_y_nomina: { symbol: '✓CN', cls: 'text-amber-700 font-bold' },
};

export const IngresoEmpresasList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('ingreso-empresas-list');
  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    tipo: { type: 'string' as const, default: '' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);

  const [items, setItems] = useState<IngresoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IngresoEmpresa | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = ingresoEmpresasService.subscribe(
      false,
      (data) => { setItems(data); setLoading(false); },
      (err) => { console.error('Error cargando ingresos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const loadData = useCallback(() => {}, []);

  const filtered = useMemo(() => {
    let result = items;
    if (filters.tipo) result = result.filter(i => i.tipo !== filters.tipo ? false : true);
    if (!debouncedSearch) return result;
    const t = debouncedSearch.toLowerCase();
    return result.filter(i =>
      i.clienteNombre.toLowerCase().includes(t) || i.contacto.toLowerCase().includes(t)
    );
  }, [items, filters.tipo, debouncedSearch]);

  const handleEdit = (item: IngresoEmpresa) => {
    setEditItem(item);
    setShowModal(true);
  };

  const handleDelete = async (item: IngresoEmpresa) => {
    if (!await confirm(`Eliminar ingreso de "${item.clienteNombre}"?`)) return;
    try {
      await ingresoEmpresasService.delete(item.id);
    } catch (err) {
      console.error('Error eliminando:', err);
      alert('Error al eliminar');
    }
  };

  const isInitialLoad = loading && items.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Ingreso a Empresas"
        subtitle="Documentación requerida para ingreso a clientes"
        count={isInitialLoad ? undefined : filtered.length}
        actions={<Button size="sm" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Nuevo ingreso</Button>}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select
            value={filters.tipo}
            onChange={e => setFilter('tipo', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_INGRESO_LABELS) as TipoIngresoCliente[]).map(k => (
              <option key={k} value={k}>{TIPO_INGRESO_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 text-center py-12">
            <p className="text-slate-400">No se encontraron registros</p>
            <button onClick={() => { setEditItem(null); setShowModal(true); }} className="text-teal-600 hover:underline mt-2 inline-block text-xs">
              Crear primer ingreso
            </button>
          </div>
        ) : (
          <div className="bg-white overflow-x-auto rounded-lg border border-slate-200">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '12%' }} />
                  {DOCUMENTACION_INGRESO_KEYS.map(({ key }) => (
                    <col key={key} style={{ width: `${52 / DOCUMENTACION_INGRESO_KEYS.length}%` }} />
                  ))}
                  <col style={{ width: '12%' }} />
                </colgroup>
              )}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider sticky left-0 bg-slate-50 z-10 relative ${getAlignClass(0)}`}><ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />Cliente<div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />Tipo<div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Induc.<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Contacto<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  {DOCUMENTACION_INGRESO_KEYS.map(({ key, label }, idx) => (
                    <th key={key} className={`px-1.5 py-2 text-[10px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(4 + idx)}`}><ColAlignIcon align={colAligns?.[4 + idx] || 'left'} onClick={() => cycleAlign(4 + idx)} />{label}<div onMouseDown={e => onResizeStart(4 + idx, e)} onDoubleClick={() => onAutoFit(4 + idx)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  ))}
                  <th className="px-2 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider relative">Acciones<div onMouseDown={e => onResizeStart(4 + DOCUMENTACION_INGRESO_KEYS.length, e)} onDoubleClick={() => onAutoFit(4 + DOCUMENTACION_INGRESO_KEYS.length)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className={`px-3 py-2 text-xs font-medium text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap ${getAlignClass(0)}`}>
                      <button onClick={() => handleEdit(item)} className="text-teal-700 hover:underline text-left">{item.clienteNombre}</button>
                    </td>
                    <td className={`px-2 py-2 ${getAlignClass(1)}`}>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${item.tipo === 'PI' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className={`px-2 py-2 ${getAlignClass(2)}`}>
                      {item.induccion.requerida ? (
                        <span className="text-emerald-600 font-bold text-xs" title={item.induccion.descripcion}>Sí</span>
                      ) : (
                        <span className="text-slate-300 text-xs">No</span>
                      )}
                    </td>
                    <td className={`px-2 py-2 text-xs text-slate-600 max-w-[200px] truncate ${getAlignClass(3)}`} title={item.contacto}>{item.contacto || '—'}</td>
                    {DOCUMENTACION_INGRESO_KEYS.map(({ key }, idx) => {
                      const st = item.documentacion[key];
                      const { symbol, cls } = STATUS_ICON[st];
                      return (
                        <td key={key} className={`px-1.5 py-2 text-[11px] ${cls} ${getAlignClass(4 + idx)}`} title={st.replace(/_/g, ' ')}>
                          {symbol}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(item)} className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">Editar</button>
                        <button onClick={() => handleDelete(item)} className="px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IngresoEmpresaModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); }}
        onSaved={loadData}
        editData={editItem}
      />
    </div>
  );
};
