import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { requerimientosService, proveedoresService, ordenesCompraService, presupuestosService, clientesService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { matchesSearch } from '../../utils/searchTerms';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Button } from '../../components/ui/Button';
import { sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateRequerimientoModal } from '../../components/stock/CreateRequerimientoModal';
import { VerRequerimientoModal } from '../../components/stock/VerRequerimientoModal';
import { OrdenCompraModal } from '../../components/stock/OrdenCompraModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useRequerimientoInlineEdit } from '../../hooks/useRequerimientoInlineEdit';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { useGenerarOC } from '../../hooks/useGenerarOC';
import { RequerimientoRow, URGENCIA_LABELS } from './RequerimientoRow';
import { RequerimientosPartesTab } from './RequerimientosPartesTab';
import { sweepStockMinimoRequerimientos } from '../../utils/stockMinimoRequerimientos';
import type { RequerimientoCompra, EstadoRequerimiento, OrigenRequerimiento, UrgenciaRequerimiento } from '@ags/shared';
import { ESTADO_REQUERIMIENTO_LABELS, ORIGEN_REQUERIMIENTO_LABELS, ESTADO_OC_LABELS, type EstadoOC } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ExportarButton } from '../../components/ui/ExportarButton';
import {
  REQUERIMIENTOS_EXPORT_COLUMNS,
  buildRequerimientosExportRows,
  buildRequerimientosFiltrosExport,
} from '../../utils/exports/exportRequerimientos';

// Estados que ya no requieren acción: fuera de la vista por defecto (UAT 2026-07-16:
// un req ya comprado/ingresado no debe seguir figurando). 'completado' = legacy inválido.
// 'en_compra' (2026-07-31): ya está en una OC — no requiere acción acá; se sigue desde
// la OC o filtrando por estado "En compra" / "Todos".
const ESTADOS_CERRADOS = new Set(['comprado', 'cancelado', 'completado', 'en_compra']);

const FILTER_SCHEMA = {
  // Pestaña activa: 'requerimientos' (firmes: stock/aceptados/manual) | 'partes'
  // (items de presupuestos borrador/enviado, aún sin requerimiento).
  tab:         { type: 'string' as const, default: 'requerimientos' },
  // 'abiertos' (default) = todo lo que requiere acción; 'todos' = sin filtro; o un estado puntual.
  estado:      { type: 'string' as const, default: 'abiertos' },
  origen:      { type: 'string' as const, default: '' },
  urgencia:    { type: 'string' as const, default: '' },
  // FLOW-03: '' = todos, 'true' = solo condicionales, 'false' = solo firmes
  condicional: { type: 'string' as const, default: '' },
};

export const RequerimientosList = () => {
  const [requerimientos, setRequerimientos] = useState<RequerimientoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [showCreate, setShowCreate] = useState(false);
  const [verReq, setVerReq] = useState<RequerimientoCompra | null>(null);

  // Ruta /stock/requerimientos/nuevo (ej. "Crear req." desde Planificación):
  // abre el modal de creación con el artículo prefilleado y normaliza la URL.
  const location = useLocation();
  const navigate = useNavigate();
  const [prefillArticuloId, setPrefillArticuloId] = useState<string | null>(null);
  useEffect(() => {
    if (!location.pathname.endsWith('/nuevo')) return;
    const state = location.state as { prefillArticuloId?: string } | null;
    setPrefillArticuloId(state?.prefillArticuloId ?? null);
    setShowCreate(true);
    navigate('/stock/requerimientos', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const [ocModalId, setOcModalId] = useState<string | null>(null);
  const [ocModalOpen, setOcModalOpen] = useState(false);
  const [sortField, setSortField] = useState('fechaSolicitud');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { editingCell, editValue, setEditValue, startEdit, cancelEdit, saveEdit, saveProveedorEdit } = useRequerimientoInlineEdit();

  // Buscador (pedido 2026-07-31): cliente / proveedor / artículo / número.
  const [localSearch, setLocalSearch] = useState('');
  const busqueda = useDebounce(localSearch, 300);

  // Cliente del presupuesto origen (el req no lo denormaliza) — para mostrarlo
  // bajo el badge de origen y para el buscador.
  const [clientePorPresupuesto, setClientePorPresupuesto] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    Promise.all([presupuestosService.getAll(), clientesService.getAll(true)])
      .then(([ps, cs]) => {
        const nombre = new Map(cs.map(c => [c.id, c.razonSocial]));
        setClientePorPresupuesto(new Map(ps.map(p => [p.id, nombre.get(p.clienteId) ?? ''])));
      })
      .catch(() => {});
  }, []);
  const clienteDeReq = useCallback((r: RequerimientoCompra) =>
    (r.presupuestoId && clientePorPresupuesto.get(r.presupuestoId)) || '',
  [clientePorPresupuesto]);

  // Proveedores activos para el select inline de "Proveedor sugerido" (UAT 2026-07-16).
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string }>>([]);
  useEffect(() => {
    proveedoresService.getAll(true)
      .then((ps: Array<{ id: string; nombre: string }>) => setProveedores(ps.map(p => ({ id: p.id, nombre: p.nombre }))))
      .catch(() => setProveedores([]));
  }, []);
  const { generarOCs, agregarAOCExistente, loading: generandoOC } = useGenerarOC();

  // ── Agregar reqs a una OC EXISTENTE (pedido 2026-07-31) ──
  const [showAgregarOC, setShowAgregarOC] = useState(false);
  const [ocsAbiertas, setOcsAbiertas] = useState<Array<{ id: string; numero: string; proveedorNombre: string; estado: EstadoOC }>>([]);
  const [ocDestinoId, setOcDestinoId] = useState('');
  useEffect(() => {
    if (!showAgregarOC) return;
    // Solo OCs donde tiene sentido sumar items: borrador o ya enviada al proveedor.
    ordenesCompraService.getAll()
      .then(ocs => setOcsAbiertas(
        ocs.filter(o => o.estado === 'borrador' || o.estado === 'enviada_proveedor')
          .map(o => ({ id: o.id, numero: o.numero, proveedorNombre: o.proveedorNombre, estado: o.estado }))
          .sort((a, b) => (b.numero || '').localeCompare(a.numero || '')),
      ))
      .catch(() => setOcsAbiertas([]));
  }, [showAgregarOC]);

  const handleAgregarAOC = async () => {
    if (!ocDestinoId) { alert('Seleccioná la orden de compra destino'); return; }
    const sel = sorted.filter(r => selectedIds.has(r.id));
    const sinOC = sel.filter(r => !r.ordenCompraId);
    if (sinOC.length === 0) { alert('Los requerimientos seleccionados ya están vinculados a una OC.'); return; }
    if (sinOC.length < sel.length) {
      alert(`${sel.length - sinOC.length} requerimiento(s) ya tenían OC y se saltean; se agregan ${sinOC.length}.`);
    }
    const ok = await agregarAOCExistente(ocDestinoId, sinOC);
    if (ok) {
      setSelectedIds(new Set());
      setShowAgregarOC(false);
      // Refrescar la lista (los reqs pasaron a en_compra → salen de "Abiertos").
      setRequerimientos(prev => prev.map(r =>
        sinOC.some(s => s.id === r.id)
          ? { ...r, estado: 'en_compra' as EstadoRequerimiento, ordenCompraId: ocDestinoId, ordenCompraNumero: ocsAbiertas.find(o => o.id === ocDestinoId)?.numero ?? r.ordenCompraNumero }
          : r,
      ));
      // Abrir la OC para revisar los items agregados.
      setOcModalId(ocDestinoId);
      setOcModalOpen(true);
      setOcDestinoId('');
    } else {
      alert('Error al agregar los requerimientos a la OC');
    }
  };
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass, resetWidths } = useResizableColumns('requerimientos-list');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const filtered = useMemo(() => {
    return requerimientos.filter(r => {
      if (filters.estado === 'abiertos' && ESTADOS_CERRADOS.has(r.estado)) return false;
      if (filters.urgencia && r.urgencia !== filters.urgencia) return false;
      // FLOW-03: filtro por flag condicional
      if (filters.condicional === 'true' && !(r as any).condicional) return false;
      if (filters.condicional === 'false' && (r as any).condicional) return false;
      // Buscador (2026-07-31): cliente, proveedor (sugerido o asignado), artículo, números.
      if (busqueda.trim() && !matchesSearch(
        busqueda, r.numero, r.articuloCodigo, r.articuloDescripcion,
        clienteDeReq(r), r.proveedorSugeridoNombre, r.proveedorNombre,
        r.presupuestoNumero, r.ordenCompraNumero,
      )) return false;
      return true;
    });
  }, [requerimientos, filters.estado, filters.urgencia, filters.condicional, busqueda, clienteDeReq]);
  const sorted = useMemo(() => sortByField(filtered, sortField, sortDir), [filtered, sortField, sortDir]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === sorted.length && sorted.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map(r => r.id)));
  };

  // Sweep automático de stock mínimo (cambio 2026-07-25): al abrir Requerimientos se
  // generan solos los reqs de artículos bajo mínimo sin pedido abierto (throttled).
  // La suscripción de abajo levanta los nuevos docs en vivo, sin refresh manual.
  useEffect(() => {
    sweepStockMinimoRequerimientos().catch(err =>
      console.error('[RequerimientosList] sweep stock mínimo falló:', err));
  }, []);

  // Recalcular a demanda (2026-08-28): fuerza el sweep (salteando el freno de
  // 5 min) y recarga los datos auxiliares que se traen una sola vez al montar
  // (clientes de pptos, proveedores). La tabla en sí ya es una suscripción viva.
  const [recalculando, setRecalculando] = useState(false);
  const handleRecalcular = async () => {
    setRecalculando(true);
    try {
      const r = await sweepStockMinimoRequerimientos({ force: true });
      const [ps, cs, provs] = await Promise.all([
        presupuestosService.getAll(),
        clientesService.getAll(true),
        proveedoresService.getAll(true),
      ]);
      const nombre = new Map(cs.map(c => [c.id, c.razonSocial]));
      setClientePorPresupuesto(new Map(ps.map(p => [p.id, nombre.get(p.clienteId) ?? ''])));
      setProveedores((provs as Array<{ id: string; nombre: string }>).map(p => ({ id: p.id, nombre: p.nombre })));
      if (r.creados > 0 || r.cancelados > 0) {
        alert(`Recalculado: ${r.creados} requerimiento(s) nuevo(s) por stock mínimo, ${r.cancelados} cancelado(s) por stock repuesto.`);
      }
    } catch (err) {
      console.error('[RequerimientosList] recalcular falló:', err);
      alert('Error al recalcular');
    } finally {
      setRecalculando(false);
    }
  };

  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = requerimientosService.subscribe(
      // 'abiertos'/'todos' no son estados de Firestore: se suscribe a todo y se filtra en cliente.
      {
        estado: filters.estado === 'abiertos' || filters.estado === 'todos' ? undefined : filters.estado || undefined,
        origen: filters.origen || undefined,
      },
      (items) => { setRequerimientos(items); setLoading(false); },
      (err) => { console.error('Error cargando requerimientos:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [filters.estado, filters.origen]);

  const loadData = useCallback(() => {}, []);

  const handleAprobar = async (id: string) => {
    if (!await confirm('¿Aprobar este requerimiento?')) return;
    try {
      await requerimientosService.update(id, { estado: 'aprobado', fechaAprobacion: new Date().toISOString() });
      setRequerimientos(prev => prev.map(r => r.id === id ? { ...r, estado: 'aprobado' as const, fechaAprobacion: new Date().toISOString() } : r));
    } catch { alert('Error al aprobar el requerimiento'); }
  };

  const handleDelete = async (id: string) => {
    const r = requerimientos.find(x => x.id === id);
    const aviso = r?.ordenCompraNumero
      ? `\n\nAtención: está vinculado a la OC ${r.ordenCompraNumero}. Esa OC quedará con un item sin requerimiento; lo ideal es eliminar primero la OC.`
      : '';
    if (!await confirm(`¿Eliminar este requerimiento?${aviso}`)) return;
    try {
      await requerimientosService.delete(id);
      setRequerimientos(prev => prev.filter(r => r.id !== id));
    } catch { alert('Error al eliminar el requerimiento'); }
  };

  const handleGenerarOC = async () => {
    const sel = sorted.filter(r => selectedIds.has(r.id));
    const ocIds = await generarOCs(sel);
    if (ocIds.length > 0) {
      setSelectedIds(new Set());
      // Abrir directo la OC generada para completar precios/proveedor.
      // Si se generó más de una (varios proveedores), se abre la primera.
      if (ocIds.length > 1) {
        alert(`Se generaron ${ocIds.length} OCs (una por proveedor). Se abre la primera; el resto está en Órdenes de Compra.`);
      }
      setOcModalId(ocIds[0]);
      setOcModalOpen(true);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isInitialLoad = loading && requerimientos.length === 0;

  // Export Excel/PDF del array filtrado+ordenado que muestra la tabla.
  const exportRows = useMemo(() => buildRequerimientosExportRows(sorted, clienteDeReq), [sorted, clienteDeReq]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Requerimientos de Compra"
        subtitle="Requisiciones de compra"
        count={isInitialLoad ? undefined : sorted.length}
        actions={
          filters.tab === 'partes' ? undefined :
          <>
            <Button size="sm" variant="outline" onClick={() => void handleRecalcular()} disabled={recalculando}
              title="Corre el barrido de stock mínimo ahora (sin esperar los 5 min) y refresca clientes/proveedores. La tabla ya se actualiza sola en vivo.">
              {recalculando ? 'Recalculando…' : '↻ Recalcular'}
            </Button>
            <ExportarButton
              columnas={REQUERIMIENTOS_EXPORT_COLUMNS}
              data={exportRows}
              titulo="Requerimientos"
              filename="requerimientos"
              filtrosAplicados={buildRequerimientosFiltrosExport(filters, busqueda)}
            />
            {selectedIds.size > 0 && (
              <>
                <Button size="sm" onClick={handleGenerarOC} disabled={generandoOC}>
                  {generandoOC ? 'Generando...' : `Generar OC (${selectedIds.size})`}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAgregarOC(true)} disabled={generandoOC}>
                  Agregar a OC existente
                </Button>
              </>
            )}
            {colWidths && (
              <Button size="sm" variant="outline" onClick={resetWidths} title="Restablecer ancho de columnas a los valores por defecto">
                Reset anchos
              </Button>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo requerimiento</Button>
          </>
        }
      >
        {/* Pestañas: requerimientos firmes vs partes de presupuestos sin confirmar (no se mezclan) */}
        <div className="flex items-center gap-1 mb-2">
          {([['requerimientos', 'Requerimientos'], ['partes', 'Partes de presupuestos']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter('tab', key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filters.tab === key ? 'bg-teal-700 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
              {label}
            </button>
          ))}
        </div>
        {filters.tab !== 'partes' && (
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Buscar por cliente, proveedor, artículo o número…"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
          />
          <select value={filters.estado} onChange={e => setFilter('estado', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="abiertos">Abiertos</option>
            <option value="todos">Todos los estados</option>
            {(Object.keys(ESTADO_REQUERIMIENTO_LABELS) as EstadoRequerimiento[]).map(k => (
              <option key={k} value={k}>{ESTADO_REQUERIMIENTO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.origen} onChange={e => setFilter('origen', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los orígenes</option>
            {(Object.keys(ORIGEN_REQUERIMIENTO_LABELS) as OrigenRequerimiento[]).map(k => (
              <option key={k} value={k}>{ORIGEN_REQUERIMIENTO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.urgencia} onChange={e => setFilter('urgencia', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todas las urgencias</option>
            {(Object.keys(URGENCIA_LABELS) as UrgenciaRequerimiento[]).map(k => (
              <option key={k} value={k}>{URGENCIA_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.condicional} onChange={e => setFilter('condicional', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos</option>
            <option value="true">Solo condicionales</option>
            <option value="false">Solo firmes</option>
          </select>
        </div>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {filters.tab === 'partes' ? (
          <RequerimientosPartesTab />
        ) : isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando requerimientos...</p></div>
        ) : sorted.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron requerimientos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table ref={tableRef} className="tabla-compacta w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
              )}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="relative px-3 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedIds.size === sorted.length && sorted.length > 0}
                      onChange={toggleAll} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />Numero<div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Artículo<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Cantidad<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(4)}`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />Origen<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(5)}`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Estado<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(6)}`}><ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />Urgencia<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(7)}`}><ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />Proveedor sugerido<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(8)}`}><ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} />Solicitado por<div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`relative px-2 py-2 text-[11px] font-medium text-slate-400 tracking-wider cursor-pointer ${getAlignClass(9)}`} onClick={() => handleSort('fechaSolicitud')}>
                    <ColAlignIcon align={colAligns?.[9] || 'left'} onClick={() => cycleAlign(9)} />
                    Fecha {sortField === 'fechaSolicitud' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    <div onMouseDown={e => onResizeStart(9, e)} onDoubleClick={() => onAutoFit(9)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </th>
                  <th className="relative px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones<div onMouseDown={e => onResizeStart(10, e)} onDoubleClick={() => onAutoFit(10)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(r => (
                  <RequerimientoRow
                    key={r.id}
                    r={r}
                    selected={selectedIds.has(r.id)}
                    onToggle={() => toggleSelect(r.id)}
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    startEdit={startEdit}
                    cancelEdit={cancelEdit}
                    saveEdit={saveEdit}
                    proveedores={proveedores}
                    onSelectProveedor={saveProveedorEdit}
                    onVer={setVerReq}
                    onAprobar={handleAprobar}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                    getAlignClass={getAlignClass}
                    clienteNombre={clienteDeReq(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateRequerimientoModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setPrefillArticuloId(null); }}
        onCreated={loadData}
        prefillArticuloId={prefillArticuloId}
      />

      {verReq && <VerRequerimientoModal key={verReq.id} req={verReq} proveedores={proveedores} onClose={() => setVerReq(null)} />}

      <OrdenCompraModal
        open={ocModalOpen}
        ocId={ocModalId}
        onClose={() => { setOcModalOpen(false); setOcModalId(null); }}
        onSaved={loadData}
      />

      {/* Agregar requerimientos seleccionados a una OC existente (2026-07-31) */}
      <Modal open={showAgregarOC} onClose={() => { setShowAgregarOC(false); setOcDestinoId(''); }}
        title="Agregar a OC existente"
        subtitle={`${selectedIds.size} requerimiento(s) seleccionado(s)`}
        maxWidth="sm"
        footer={<>
          <Button variant="outline" size="sm" onClick={() => { setShowAgregarOC(false); setOcDestinoId(''); }}>Cancelar</Button>
          <Button size="sm" onClick={() => void handleAgregarAOC()} disabled={generandoOC || !ocDestinoId}>
            {generandoOC ? 'Agregando...' : 'Agregar a la OC'}
          </Button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Orden de compra destino *</label>
            <SearchableSelect
              value={ocDestinoId}
              onChange={setOcDestinoId}
              options={ocsAbiertas.map(o => ({
                value: o.id,
                label: `${o.numero} — ${o.proveedorNombre || 'Sin proveedor'} (${ESTADO_OC_LABELS[o.estado]})`,
              }))}
              placeholder="Buscar OC por número o proveedor…"
            />
            {ocsAbiertas.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">No hay OCs en borrador o enviadas al proveedor.</p>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Los items se agregan al final de la OC (precio a completar en la OC) y los
            requerimientos pasan a "En compra" — salen de la vista Abiertos.
          </p>
        </div>
      </Modal>
    </div>
  );
};
