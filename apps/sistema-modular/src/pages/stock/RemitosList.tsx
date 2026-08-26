import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { remitosService, clientesService } from '../../services/firebaseService';
import { fichasService } from '../../services/fichasService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { RemitoFormModal } from '../../components/remitos/RemitoFormModal';
import { RemitoDescargaModal } from '../../components/remitos/RemitoDescargaModal';
import { RemitoItemsInline } from '../../components/remitos/RemitoItemsInline';
import { RemitoVerModal } from '../../components/remitos/RemitoVerModal';
import { itemRemitoConEfectoAplicado } from '../../services/movimientosAplicar';
import { imprimirRemitoStock } from '../../utils/remitoImprimir';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import type { Remito, TipoRemito, EstadoRemito, Cliente } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ExportarButton } from '../../components/ui/ExportarButton';
import {
  REMITOS_EXPORT_COLUMNS, buildRemitosFiltrosExport,
  REMITO_TIPO_LABELS as TIPO_LABELS,
  REMITO_ESTADO_LABELS as ESTADO_LABELS,
  type RemitoExportRow,
} from '../../utils/exports/exportRemitos';
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', en_proveedor: 'bg-orange-100 text-orange-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };
const TIPO_COLORS: Record<TipoRemito, string> = { salida_campo: 'bg-blue-50 text-blue-700', entrega_cliente: 'bg-teal-50 text-teal-700', devolucion: 'bg-emerald-50 text-emerald-700', interno: 'bg-slate-100 text-slate-600', derivacion_proveedor: 'bg-purple-50 text-purple-700', loaner_salida: 'bg-amber-50 text-amber-700', servicio: 'bg-cyan-50 text-cyan-700' };

export const RemitosList = () => {
  const confirm = useConfirm();
  // v2 (2026-08-04): +columna Cliente — clave nueva para descartar anchos guardados de 8 columnas.
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('remitos-list-v2');
  const FILTER_SCHEMA = useMemo(() => ({
    // Default 'pendientes' (2026-08-04): borrador + confirmado + en tránsito.
    // Los devueltos/finalizados salen de la vista salvo elección explícita.
    estado: { type: 'string' as const, default: 'pendientes' },
    // Pestañas (2026-08-10): el talonario preimpreso —los que van al cliente y
    // llevan numeración fiscal— aparte de los internos REM-, que son
    // comprobantes de movimiento y ensuciaban la vista principal.
    tab: { type: 'string' as const, default: 'talonario' },
    tipo: { type: 'string' as const, default: '' },
    showAll: { type: 'boolean' as const, default: false },
    clienteId: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'fechaSalida' },
    sortDir: { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);

  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  // Rework 2026-07-31: mismo modal para editar (solo borrador sin imprimir).
  const [editRemito, setEditRemito] = useState<Remito | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<string | null>(null);
  // Desplegable de artículos + acciones de estado en la línea (2026-08-04).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [descargaRemito, setDescargaRemito] = useState<Remito | null>(null);
  const [verRemito, setVerRemito] = useState<Remito | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  /** Tiene items 'sale y vuelve' sin resolver, descargables desde el remito. */
  const esDescargable = (r: Remito) =>
    ['confirmado', 'en_transito', 'en_proveedor', 'completado_parcial'].includes(r.estado)
    && (r.items ?? []).some(it => !it.devuelto && !it.consumido && it.tipoItem === 'sale_y_vuelve'
      && (!!it.asignacionId || itemRemitoConEfectoAplicado(it)));

  const handleEstado = async (r: Remito, estado: EstadoRemito, extra?: Partial<Remito>) => {
    setActingId(r.id);
    try { await remitosService.update(r.id, { estado, ...extra }); }
    catch (err) { console.error('Error actualizando remito:', err); alert('Error al actualizar el remito'); }
    finally { setActingId(null); }
  };

  /**
   * Completar es un cambio de ESTADO, no una descarga: no descuenta stock ni
   * resuelve items. Si quedan items pendientes, el remito desaparece del cierre
   * de OT con la mercadería sin imputar (caso 0001-00017420, 2026-08-25) — se
   * avisa antes de dejar hacerlo.
   */
  const handleCompletar = async (r: Remito) => {
    const pendientes = (r.items ?? []).filter(it =>
      !it.devuelto && !it.consumido && it.cantidad - (it.cantidadConsumida ?? 0) > 0);
    if (pendientes.length > 0 && !confirm(
      `El remito ${r.numero} tiene ${pendientes.length} ítem(s) sin resolver (ni devueltos ni consumidos).\n\n` +
      'Completarlo NO descuenta stock, y esas partes dejan de ofrecerse como origen en el cierre de OT.\n' +
      'Si la mercadería se va a imputar a una OT, dejá el remito como está y descargala desde el cierre.\n\n' +
      '¿Completar igual?'
    )) return;
    await handleEstado(r, 'completado', { fechaDevolucion: new Date().toISOString() });
  };

  /** Entregado en el proveedor: además del remito, estampa la fecha en las
   *  unidades de stock que viajaban (no pasan por ficha). */
  const handleEntregado = async (r: Remito) => {
    setActingId(r.id);
    try { await remitosService.marcarEntregadoEnProveedor(r.id); }
    catch (err) { console.error('Error marcando entregado:', err); alert('Error al marcar como entregado'); }
    finally { setActingId(null); }
  };

  const handleImprimir = async (r: Remito) => {
    setImprimiendoId(r.id);
    try {
      await imprimirRemitoStock(r);
    } catch (err) {
      console.error('Error imprimiendo remito:', err);
      alert('Error al imprimir el remito');
    } finally {
      setImprimiendoId(null);
    }
  };

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const unsubRef = useRef<(() => void) | null>(null);

  // Load reference data (clientes) once
  useEffect(() => { clientesService.getAll(true).then(setClientes); }, []);

  // Dueño de las fichas involucradas (2026-08-07): los remitos de derivación
  // anteriores a esta fecha se guardaron sin clienteNombre — se resuelve por
  // fichaId contra el catálogo de fichas (cacheado) en lugar de migrarlos.
  const [clientePorFicha, setClientePorFicha] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    fichasService.getAll().then(fs => {
      setClientePorFicha(new Map(fs.map(f => [f.id, f.clienteNombre])));
    }).catch(() => {});
  }, []);

  /**
   * Nunca vacío: cliente del remito → dueño de la ficha que contiene → AGS.
   * Un remito sin cliente es material propio (loaner, patrón, parte de stock o
   * salida a campo sin cliente asignado), y su dueño es AGS.
   */
  const duenoRemito = (r: Remito): string => {
    if (r.clienteNombre) return r.clienteNombre;
    const fichaIds = Array.from(new Set(
      (r.items ?? []).map(i => i.fichaId).filter((x): x is string => !!x),
    ));
    const nombres = Array.from(new Set(
      fichaIds.map(fid => clientePorFicha.get(fid)).filter((n): n is string => !!n),
    ));
    if (nombres.length === 1) return nombres[0];
    if (nombres.length > 1) return 'Varios clientes';
    return 'AGS';
  };

  // Subscribe to remitos with current filters
  useEffect(() => {
    unsubRef.current?.();
    // 'pendientes' y 'todos' son sentinels de UI: la query no filtra por estado
    // y el recorte se hace acá (URLs viejas con estado='' cuentan como pendientes).
    const estadoSel = filters.estado || 'pendientes';
    const esSentinel = estadoSel === 'pendientes' || estadoSel === 'todos';
    unsubRef.current = remitosService.subscribe(
      {
        estado: esSentinel ? undefined : estadoSel,
        tipo: filters.tipo || undefined,
      },
      (data) => {
        let filtered = filters.showAll ? data : data.filter(r => r.estado !== 'cancelado');
        if (estadoSel === 'pendientes') {
          // 'en_proveedor' cuenta como pendiente: la mercadería sigue afuera.
          filtered = filtered.filter(r => r.estado === 'borrador' || r.estado === 'confirmado'
            || r.estado === 'en_transito' || r.estado === 'en_proveedor');
        }
        setRemitos(filtered);
        setLoading(false);
      },
      (err) => { console.error('Error cargando remitos:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.estado, filters.tipo, filters.showAll]);

  const loadData = useCallback(() => {}, []);

  // Memoizado: identidad estable de options para el SearchableSelect.
  const clienteOpts = useMemo(
    () => [{ value: '', label: 'Todos los clientes' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))],
    [clientes],
  );

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar este remito borrador?')) return;
    try {
      await remitosService.delete(id);
      setRemitos(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error eliminando remito:', error);
      alert('Error al eliminar el remito');
    }
  };

  /** Numeración del talonario preimpreso: 0001-00017405. */
  const esTalonario = (r: Remito) => /^\d{4}-\d{8}$/.test(r.numero || '');

  const porTab = useMemo(
    () => remitos.filter(r => (filters.tab === 'internos' ? !esTalonario(r) : esTalonario(r))),
    [remitos, filters.tab],
  );
  const conteoTab = useMemo(() => ({
    talonario: remitos.filter(esTalonario).length,
    internos: remitos.filter(r => !esTalonario(r)).length,
  }), [remitos]);

  const sorted = useMemo(() => {
    let result = porTab;
    if (filters.clienteId) result = result.filter(r => r.clienteId === filters.clienteId);
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [porTab, filters.clienteId, filters.sortField, filters.sortDir]);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isInitialLoad = loading && remitos.length === 0;

  // Export Excel/PDF del array filtrado/ordenado que muestra la tabla.
  const exportRows = useMemo<RemitoExportRow[]>(
    () => sorted.map(r => ({ remito: r, dueno: duenoRemito(r) })),
    // duenoRemito depende de clientePorFicha (estado) — se recalcula con sorted.
    [sorted, clientePorFicha], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const filtrosExport = buildRemitosFiltrosExport(filters, clientes);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Remitos"
        subtitle="Gestionar remitos de stock"
        count={isInitialLoad ? undefined : sorted.length}
        actions={
          <div className="flex items-center gap-2">
            <ExportarButton
              columnas={REMITOS_EXPORT_COLUMNS}
              data={exportRows}
              titulo="Remitos"
              filename="remitos"
              filtrosAplicados={filtrosExport}
            />
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo remito</Button>
          </div>
        }
      >
        {/* Pestañas: talonario (numeración fiscal) vs internos REM- */}
        <div className="flex gap-2 mb-3">
          {([['talonario', 'Talonario'], ['internos', 'Internos (REM)']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter('tab', k)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${filters.tab === k ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label} ({conteoTab[k]})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filters.estado || 'pendientes'} onChange={e => setFilter('estado', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="pendientes">Pendientes (borrador + en tránsito)</option>
            <option value="todos">Todos los estados</option>
            {(Object.keys(ESTADO_LABELS) as EstadoRemito[]).map(k => (
              <option key={k} value={k}>{ESTADO_LABELS[k]}</option>
            ))}
          </select>
          <select value={filters.tipo} onChange={e => setFilter('tipo', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_LABELS) as TipoRemito[]).map(k => (
              <option key={k} value={k}>{TIPO_LABELS[k]}</option>
            ))}
          </select>
          <div className="min-w-[180px]">
            <SearchableSelect value={filters.clienteId} onChange={v => setFilter('clienteId', v)}
              options={clienteOpts}
              placeholder="Cliente..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
            <input type="checkbox" checked={filters.showAll} onChange={e => setFilter('showAll', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300" />
            Mostrar cancelados
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando remitos...</p></div>
        ) : sorted.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron remitos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
              <table ref={tableRef} className="tabla-compacta w-full table-fixed">
                {colWidths ? (
                  <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                ) : (
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
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
                      Cliente
                      <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(4)}`}>
                      <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                      Ingeniero
                      <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(5)}`}>
                      <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                      Items
                      <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <SortableHeader label="Fecha salida" field="fechaSalida" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(6)}`}>
                      <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                      <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </SortableHeader>
                    <th className={`px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider relative ${getAlignClass(7)}`}>
                      <ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />
                      OTs
                      <div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider relative">
                      Acciones
                      <div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map(r => (
                    <Fragment key={r.id}>
                    <tr
                      className="hover:bg-slate-50 cursor-pointer"
                      title={expandedId === r.id ? 'Ocultar artículos' : 'Ver artículos'}
                      // Un click en cualquier parte de la fila despliega los artículos;
                      // los botones/links de la fila no disparan el toggle.
                      onClick={e => {
                        if ((e.target as HTMLElement).closest('button, a, input, select')) return;
                        setExpandedId(expandedId === r.id ? null : r.id);
                      }}
                    >
                      <td className={`px-4 py-2 ${getAlignClass(0)}`}>
                        <span className="inline-flex items-center gap-1">
                          <span className={`text-slate-400 text-[10px] transition-transform ${expandedId === r.id ? 'rotate-90' : ''}`}>▶</span>
                          <span className="font-mono text-xs font-semibold text-teal-600">{r.numero}</span>
                        </span>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(1)}`}>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[r.tipo]}`}>
                          {TIPO_LABELS[r.tipo]}
                        </span>
                      </td>
                      <td className={`px-4 py-2 ${getAlignClass(2)}`}>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[r.estado]}`}>
                          {ESTADO_LABELS[r.estado]}
                        </span>
                        {r.impreso && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600">Impreso</span>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-700 truncate ${getAlignClass(3)}`}
                        title={`${duenoRemito(r)}${r.establecimientoNombre ? ` (${r.establecimientoNombre})` : ''}`}>
                        {duenoRemito(r)}
                        {r.establecimientoNombre && <span className="text-slate-400"> ({r.establecimientoNombre})</span>}
                      </td>
                      {/* Lo lleva un ingeniero o un transportista (2026-08-07). */}
                      <td className={`px-4 py-2 text-xs text-slate-900 ${getAlignClass(4)}`}>
                        {r.ingenieroNombre || (r.transportistaNombre
                          ? <>{r.transportistaNombre} <span className="text-slate-400">(transp.)</span></>
                          : '')}
                      </td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(5)}`}>{r.items?.length ?? 0}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(6)}`}>{formatDate(r.fechaSalida)}</td>
                      <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(7)}`}>
                        {r.otNumbers?.length ? r.otNumbers.join(', ') : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setVerRemito(r)} className="text-xs text-teal-600 hover:underline font-medium">Ver</button>
                          {/* Editable solo mientras sea borrador SIN imprimir (rework 2026-07-31) */}
                          {r.estado === 'borrador' && !r.impreso && (
                            <button onClick={() => setEditRemito(r)} className="text-xs text-slate-600 hover:underline font-medium">Editar</button>
                          )}
                          {r.items?.length > 0 && (
                            <button onClick={() => void handleImprimir(r)} disabled={imprimiendoId === r.id}
                              className="text-xs text-indigo-600 hover:underline font-medium disabled:opacity-40">
                              {imprimiendoId === r.id ? 'Imprimiendo…' : r.impreso ? 'Reimprimir' : 'Imprimir'}
                            </button>
                          )}
                          {/* Cambios de estado en la línea (2026-08-04): tránsito / descarga / completar */}
                          {r.estado === 'confirmado' && (
                            <button onClick={() => void handleEstado(r, 'en_transito')} disabled={actingId === r.id}
                              className="text-xs text-amber-600 hover:underline font-medium disabled:opacity-40">
                              Tránsito
                            </button>
                          )}
                          {esDescargable(r) && (
                            <button onClick={() => setDescargaRemito(r)} disabled={actingId === r.id}
                              className="text-xs text-orange-600 hover:underline font-medium disabled:opacity-40"
                              title="Consumos y devoluciones por item — cierra el remito al resolver todo">
                              Descargar
                            </button>
                          )}
                          {/* Entregado en el proveedor (2026-08-07): sale de
                              "en tránsito" y arranca el contador de días. */}
                          {r.tipo === 'derivacion_proveedor' && r.estado === 'en_transito' && (
                            <button onClick={() => void handleEntregado(r)}
                              disabled={actingId === r.id}
                              className="text-xs text-orange-600 hover:underline font-medium disabled:opacity-40"
                              title="La mercadería ya está en el proveedor externo">
                              Entregado
                            </button>
                          )}
                          {(r.estado === 'en_transito' || r.estado === 'en_proveedor' || r.estado === 'completado_parcial') && !esDescargable(r) && (
                            <button onClick={() => void handleCompletar(r)}
                              disabled={actingId === r.id}
                              className="text-xs text-green-600 hover:underline font-medium disabled:opacity-40">
                              Completar
                            </button>
                          )}
                          {r.estado === 'borrador' && (
                            <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline font-medium">Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={9} className="px-6 py-2 border-b border-slate-100">
                          <RemitoItemsInline remito={r} clientePorFicha={clientePorFicha} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>

      <RemitoFormModal
        open={showCreate || editRemito !== null}
        remito={editRemito}
        onClose={() => { setShowCreate(false); setEditRemito(null); }}
        onSaved={loadData}
      />
      {descargaRemito && (
        <RemitoDescargaModal
          open
          remito={descargaRemito}
          onClose={() => setDescargaRemito(null)}
        />
      )}
      {verRemito && (
        <RemitoVerModal remito={verRemito} onClose={() => setVerRemito(null)} clientePorFicha={clientePorFicha} />
      )}
    </div>
  );
};
