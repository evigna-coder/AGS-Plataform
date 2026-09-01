import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fichasService, clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import { matchesSearch } from '../../utils/searchTerms';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CreateFichaModal } from '../../components/fichas/CreateFichaModal';
import { GenerarRemitoDevolucionModal } from '../../components/remitos/GenerarRemitoDevolucionModal';
import type { FichaPropiedad, EstadoFicha, Cliente } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS } from '@ags/shared';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { useEstablecimientoSuffix } from '../../hooks/useEstablecimientoSuffix';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { FICHAS_EXPORT_COLUMNS, estadoVisibleDeFicha, proveedorDerivadoLabel } from '../../utils/exports/exportFichas';
import { proximaAccionFicha } from '../../utils/proximaAccionFicha';
import { FichaProximaAccionButton } from '../../components/fichas/FichaProximaAccionButton';
import { filtrosAplicadosDesc } from '../../utils/exports/filtros';

/**
 * Resumen del problema reportado en la ficha — toma el descripcionProblema del
 * primer item. Si está vacío (ej. ficha recién creada desde el portal sin
 * completar todavía), cae al nombre del artículo o descripción libre del item
 * para que la columna no quede vacía.
 */
function summarizeItems(f: FichaPropiedad, catalogoModelos?: Map<string, string>): string {
  const items = f.items ?? [];
  if (items.length === 0) return '';
  const first = items[0];
  let desc = first.descripcionProblema
    || first.articuloDescripcion
    || first.descripcionLibre
    || first.subId
    || 'Item';
  // Ítem cargado solo con el CÓDIGO del módulo (módulo del cliente sin
  // descripción propia, 2026-08-26): se completa desde el catálogo de
  // categorías de módulo — "G2614A" → "G2614A — Válvula de inyección…".
  // Solo cuando el texto entero ES un código del catálogo: una descripción
  // real nunca matchea.
  const delCatalogo = catalogoModelos?.get(desc.trim().toUpperCase());
  if (delCatalogo) desc = `${desc.trim()} — ${delCatalogo}`;
  return items.length === 1 ? desc : `${desc} (+${items.length - 1})`;
}

/** Modelo del primer item — código del artículo del catálogo o descripción libre. */
function firstItemModelo(f: FichaPropiedad): string | null {
  const first = f.items?.[0];
  if (!first) return null;
  return first.articuloCodigo || first.articuloDescripcion || first.descripcionLibre || null;
}

/** Serie del primer item. */
function firstItemSerie(f: FichaPropiedad): string | null {
  return f.items?.[0]?.serie ?? null;
}

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

/**
 * Columnas cuyo valor NO es un campo plano de la ficha (se calculan al
 * renderizar). Sin esto, ordenar por Descripción/Modelo/Serie/Proveedor no
 * hacía nada — sortByField busca la propiedad por nombre y no existe.
 * `estado` ordena por el estado VISIBLE, que es el que se muestra.
 */
const SORT_ACCESSORS: Record<string, (f: FichaPropiedad) => string> = {
  descripcion: summarizeItems,
  modelo: f => firstItemModelo(f) ?? '',
  serie: f => firstItemSerie(f) ?? '',
  estado: f => ESTADO_FICHA_LABELS[estadoVisibleDeFicha(f)],
  proveedor: proveedorDerivadoLabel,
  otReferencia: f => f.otReferencia ?? '',
};

export function FichasList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const sufijoEstab = useEstablecimientoSuffix();
  // v3: columna Proveedor (2026-08-12) — bump invalida el cache localStorage
  // que guardaba widths/aligns para 9 columnas (ahora son 10).
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('fichas-list-v3');

  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    estado: { type: 'string' as const, default: '' },
    cliente: { type: 'string' as const, default: '' },
    showEntregadas: { type: 'boolean' as const, default: false },
    sortField: { type: 'string' as const, default: 'fechaIngreso' },
    sortDir: { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  // Buscador unificado (2026-09-01): texto local + push a la URL con debounce.
  const [busq, setBusq] = useDebouncedUrlText(filters.search, v => setFilter('search', v));

  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  /** codigo de modelo (upper) → descripción, del catálogo de categorías de módulo. */
  const [catalogoModelos, setCatalogoModelos] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  // Derivación a proveedor en lote (2026-08-06): un remito con items de fichas
  // de CUALQUIER cliente en una misma tanda al proveedor externo.
  const [showDerivacionLote, setShowDerivacionLote] = useState(false);
  const unsubFichasRef = useRef<(() => void) | null>(null);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  // Load reference data (clientes + catálogo de modelos de módulo) once
  useEffect(() => {
    clientesService.getAll().then(setClientes).catch(err => console.error('Error cargando clientes:', err));
    import('../../services/firebaseService').then(({ categoriasModuloService }) =>
      categoriasModuloService.getAll().then(cats => {
        const m = new Map<string, string>();
        for (const c of cats) for (const mod of c.modelos ?? []) {
          if (mod.codigo && mod.descripcion) m.set(mod.codigo.trim().toUpperCase(), mod.descripcion.trim());
        }
        setCatalogoModelos(m);
      }),
    ).catch(err => console.warn('Catálogo de modelos no disponible (descripciones sin enriquecer):', err));
  }, []);

  // Subscribe to fichas, re-subscribe when showEntregadas changes
  useEffect(() => {
    setLoading(true);
    unsubFichasRef.current?.();
    unsubFichasRef.current = fichasService.subscribe(
      { activasOnly: !filters.showEntregadas },
      (data) => { setFichas(data); setLoading(false); },
      (err) => { console.error('Fichas subscription error:', err); setLoading(false); },
    );
    return () => { unsubFichasRef.current?.(); };
  }, [filters.showEntregadas]);

  const clienteNombreById = useMemo(() => new Map(clientes.map(c => [c.id, c.razonSocial])), [clientes]);

  const filtered = useMemo(() => {
    let result = fichas.filter(f => {
      // El filtro de estado matchea contra el estado VISIBLE (2026-08-12): con
      // algo derivado la ficha se ve —y se filtra— como "Derivado a proveedor",
      // aunque el estado guardado sea esperando_repuesto.
      if (filters.estado && estadoVisibleDeFicha(f) !== filters.estado) return false;
      if (filters.cliente && f.clienteId !== filters.cliente) return false;
      return true;
    });
    // Buscador unificado: cliente, estado visible, proveedor derivado, OT de
    // referencia y TODOS los items (código/descripción/serie/problema).
    if (filters.search.trim()) {
      result = result.filter(f => matchesSearch(filters.search,
        clienteNombreById.get(f.clienteId),
        ESTADO_FICHA_LABELS[estadoVisibleDeFicha(f)],
        proveedorDerivadoLabel(f),
        f.otReferencia,
        summarizeItems(f, catalogoModelos),
        ...(f.items ?? []).flatMap(i => [
          i.articuloCodigo, i.articuloDescripcion, i.descripcionLibre,
          i.serie, i.descripcionProblema, i.subId,
        ]),
      ));
    }
    const accessor = SORT_ACCESSORS[filters.sortField];
    if (accessor) {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      return [...result].sort((a, b) => accessor(a).localeCompare(accessor(b)) * dir);
    }
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [fichas, filters.estado, filters.cliente, filters.search, filters.sortField, filters.sortDir, clienteNombreById, catalogoModelos]);

  // Memoizado: identidad estable de options para el SearchableSelect.
  const clienteOptions = useMemo(() => [{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))], [clientes]);

  const handleDelete = async (id: string) => {
    if (!await confirm('Eliminar esta ficha?')) return;
    await fichasService.delete(id);
    setFichas(prev => prev.filter(f => f.id !== id));
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '—'; }
  };

  const isInitialLoad = loading && fichas.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Fichas Propiedad del Cliente"
        subtitle="Módulos y equipos ingresados para reparación"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <div className="flex items-center gap-2">
            <ExportarButton
              columnas={FICHAS_EXPORT_COLUMNS}
              data={filtered}
              titulo="Fichas Propiedad del Cliente"
              filename="fichas"
              filtrosAplicados={filtrosAplicadosDesc({
                Búsqueda: filters.search,
                Cliente: clientes.find(c => c.id === filters.cliente)?.razonSocial,
                Estado: filters.estado ? (ESTADO_FICHA_LABELS[filters.estado as EstadoFicha] ?? filters.estado) : '',
                'Incluye entregadas': filters.showEntregadas,
              })}
            />
            <Button size="sm" variant="outline" onClick={() => setShowDerivacionLote(true)}>Derivar a proveedor</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva ficha</Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={busq}
            onChange={e => setBusq(e.target.value)}
            placeholder="Buscar por equipo, serie, cliente, proveedor, OT…"
            className="w-80 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="min-w-[160px]">
            <SearchableSelect value={filters.cliente} onChange={(v) => setFilter('cliente', v)}
              options={clienteOptions}
              placeholder="Cliente" />
          </div>
          <div className="min-w-[150px]">
            <SearchableSelect value={filters.estado}
              onChange={(v) => setFilter('estado', v)}
              options={[{ value: '', label: 'Todos' }, ...(Object.keys(ESTADO_FICHA_LABELS) as EstadoFicha[]).map(e => ({ value: e, label: ESTADO_FICHA_LABELS[e] }))]}
              placeholder="Estado" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showEntregadas}
              onChange={e => setFilter('showEntregadas', e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostrar entregadas
          </label>
          <Button size="sm" variant="ghost" onClick={() => resetFilters()}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando fichas...</p></div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay fichas registradas</p>
              <button onClick={() => setShowCreate(true)}
                className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primera ficha
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="tabla-compacta w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: 75 }} />
                  <col style={{ width: '15%' }} />
                  <col />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 78 }} />
                  <col style={{ width: 75 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Numero" field="numero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Descripcion" field="descripcion" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Modelo" field="modelo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(3)} relative`}>
                    <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                    <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Serie" field="serie" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(4)} relative`}>
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Estado" field="estado" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(5)} relative`}>
                    <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                    <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Proveedor" field="proveedor" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(6)} relative`}>
                    <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                    <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Ingreso" field="fechaIngreso" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(7)} relative`}>
                    <ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />
                    <div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="OT Ref" field="otReferencia" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(8)} relative`}>
                    <ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} />
                    <div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(9, e)} onDoubleClick={() => onAutoFit(9)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/fichas/${f.id}`)}>
                    <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                      <span className="font-semibold text-teal-600 text-xs">{f.numero}</span>
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={`${f.clienteNombre}${sufijoEstab(f.clienteId, f.establecimientoId)}`}>{f.clienteNombre}{sufijoEstab(f.clienteId, f.establecimientoId)}</td>
                    <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`} title={summarizeItems(f, catalogoModelos)}>
                      {summarizeItems(f, catalogoModelos) || <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(3)}`} title={firstItemModelo(f) ?? ''}>
                      {firstItemModelo(f) || <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-500 truncate font-mono ${getAlignClass(4)}`} title={firstItemSerie(f) ?? ''}>
                      {firstItemSerie(f) || <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(5)}`}>
                      {/* Estado VISIBLE (2026-08-12): con algo derivado se muestra
                          "Derivado a proveedor"; el estado guardado va al tooltip. */}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_FICHA_COLORS[estadoVisibleDeFicha(f)]}`}
                        title={estadoVisibleDeFicha(f) !== f.estado ? `Estado interno: ${ESTADO_FICHA_LABELS[f.estado]}` : undefined}
                      >
                        {ESTADO_FICHA_LABELS[estadoVisibleDeFicha(f)]}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(6)}`} title={proveedorDerivadoLabel(f)}>
                      {proveedorDerivadoLabel(f) || <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(7)}`}>{formatDate(f.fechaIngreso)}</td>
                    <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(8)}`}>
                      {f.otReferencia ? (
                        <Link to={`/ordenes-trabajo/${f.otReferencia}`} className="text-teal-600 hover:underline" onClick={e => e.stopPropagation()}>
                          {f.otReferencia}
                        </Link>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => navigate(`/fichas/${f.id}`)}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                          Ver
                        </button>
                        {/* El paso siguiente, cuando es inequívoco (2026-08-23):
                            antes había que entrar al detalle para mover una ficha. */}
                        <FichaProximaAccionButton
                          ficha={f}
                          accion={proximaAccionFicha(f)}
                          onDone={() => { /* la lista se refresca por la suscripción */ }}
                        />
                        {f.estado === 'recibido' && (
                          <button onClick={() => handleDelete(f.id)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
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

      <CreateFichaModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
      {/* Derivación a proveedor en lote — fichas de cualquier cliente en una tanda. */}
      {showDerivacionLote && (
        <GenerarRemitoDevolucionModal
          open={showDerivacionLote}
          onClose={() => setShowDerivacionLote(false)}
          ficha={null}
          onCreated={remitoId => navigate(`/stock/remitos/${remitoId}`)}
        />
      )}
    </div>
  );
}
