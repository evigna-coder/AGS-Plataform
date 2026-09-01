import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CreateLoanerModal } from '../../components/loaners/CreateLoanerModal';
import { GenerarRemitoDevolucionModal } from '../../components/remitos/GenerarRemitoDevolucionModal';
import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS, loanerEstaIncompleto, loanerPartesFaltantes } from '@ags/shared';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import { matchesSearch } from '../../utils/searchTerms';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { liberarLoanersRecalificados, procesarRecalificacionesPendientes } from '../../utils/loanerRecalificacion';
import { useEstablecimientoSuffix } from '../../hooks/useEstablecimientoSuffix';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { LoanersFiltersBar, parseEstados } from '../../components/loaners/LoanersFiltersBar';
import { buildLoanerResumenItems } from '../../components/loaners/loanerResumenExport';
import { LOANERS_EXPORT_COLUMNS, buildLoanerExportRows } from '../../utils/exports/exportLoaners';
import { filtrosAplicadosDesc } from '../../utils/exports/filtros';
import { diasDesde, semaforoPrestamoCls, semaforoProveedorCls } from '../../utils/loanerSemaforo';

const FILTER_SCHEMA = {
  search: { type: 'string' as const, default: '' },
  /** CSV de estados (2026-09-01): antes era uno solo y no se podía exportar
   *  "en base + en recalificación" de una. Vacío = todos. */
  estados: { type: 'string' as const, default: '' },
  /** Excluye los INCOMPLETO. Con estados='en_base' es el atajo "Disponibles". */
  soloCompletos: { type: 'boolean' as const, default: false },
  showInactivos: { type: 'boolean' as const, default: false },
};

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export function LoanersList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const sufijoEstab = useEstablecimientoSuffix();
  // 'v2': al agregar la columna "Modelo modulo" (8 cols), los anchos persistidos de la
  // versión de 7 columnas empujaban "Acciones" fuera de la tabla. La key nueva descarta
  // esos anchos viejos (mismo patrón que importaciones-list-v2).
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('loaners-list-v2');
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  // Derivación a proveedor en lote (2026-08-06): varios loaners (o partes) en un remito.
  const [showDerivacion, setShowDerivacion] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const [filters, setFilter, _setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);
  // Buscador unificado (2026-09-01): texto local + push a la URL con debounce.
  const [busq, setBusq] = useDebouncedUrlText(filters.search, v => setFilter('search', v));
  const [sortField, setSortField] = useState('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = loanersService.subscribe(
      { activoOnly: !filters.showInactivos },
      (data) => { setLoaners(data); setLoading(false); },
      (err) => { console.error('Loaners subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.showInactivos]);

  // Sweep de recalificación (una pasada por montaje, mismo patrón que
  // patronesDescartesVencidos), en dos fases secuenciales:
  //  1. procesarRecalificacionesPendientes — devoluciones registradas desde
  //     portal-ingeniero (sin OT/ticket) → crea la OT interna + ticket, con
  //     guard anti-duplicado transaccional (dos PCs pueden abrir Loaners a la vez).
  //  2. liberarLoanersRecalificados — loaners cuya OT ya cerró técnicamente
  //     — ej. cierre escrito por la app de campo — vuelven a 'en_base'.
  // La suscripción refresca la lista sola si algo cambió.
  const sweepDoneRef = useRef(false);
  useEffect(() => {
    if (sweepDoneRef.current || loaners.length === 0) return;
    if (!loaners.some(l => l.estado === 'en_recalificacion')) return;
    sweepDoneRef.current = true;
    void (async () => {
      await procesarRecalificacionesPendientes(loaners).catch(err =>
        console.warn('[LoanersList] sweep de OTs de recalificación pendientes falló:', err));
      await liberarLoanersRecalificados(loaners).catch(err =>
        console.warn('[LoanersList] sweep de recalificación falló:', err));
    })();
  }, [loaners]);

  const filtered = useMemo(() => {
    let result = loaners;
    const estadosSel = parseEstados(filters.estados);
    if (estadosSel.length > 0) result = result.filter(l => estadosSel.includes(l.estado));
    if (filters.soloCompletos) result = result.filter(l => !loanerEstaIncompleto(l));
    // Buscador unificado: código, descripción, categoría, tipo/modelo de módulo,
    // serie, estado, cliente del préstamo activo y proveedor de la derivación.
    if (filters.search.trim()) {
      result = result.filter(l => {
        const prestamo = l.prestamos.find(p => p.estado === 'activo');
        return matchesSearch(filters.search,
          l.codigo, l.descripcion, l.categoriaEquipo, l.categoriaModuloNombre,
          l.moduloCodigo, l.moduloDescripcion, l.serie,
          ESTADO_LOANER_LABELS[l.estado],
          prestamo?.clienteNombre,
          l.enProveedor?.proveedorNombre, l.enProveedor?.remitoNumero,
        );
      });
    }
    return sortByField(result, sortField, sortDir);
  }, [loaners, filters.estados, filters.soloCompletos, filters.search, sortField, sortDir]);

  const handleDelete = async (id: string) => {
    if (!await confirm('Eliminar este loaner?')) return;
    await loanersService.delete(id);
    setLoaners(prev => prev.filter(l => l.id !== id));
  };

  const getPrestamoActivo = (l: Loaner) => l.prestamos.find(p => p.estado === 'activo');

  const isInitialLoad = loading && loaners.length === 0;

  // Export Excel/PDF del array filtrado que muestra la tabla.
  const exportRows = useMemo(() => buildLoanerExportRows(filtered, sufijoEstab), [filtered, sufijoEstab]);
  const filtrosExport = filtrosAplicadosDesc({
    Búsqueda: filters.search,
    Estado: parseEstados(filters.estados).map(e => ESTADO_LOANER_LABELS[e]).join(', '),
    'Solo completos': filters.soloCompletos,
    'Incluye inactivos': filters.showInactivos,
  });

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Loaners"
        subtitle="Equipos de la empresa para prestamo y venta"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <div className="flex items-center gap-2">
            <ExportarButton
              columnas={LOANERS_EXPORT_COLUMNS}
              data={exportRows}
              titulo="Loaners"
              filename="loaners"
              filtrosAplicados={filtrosExport}
              itemsExtra={buildLoanerResumenItems({ rows: exportRows, filtrosAplicados: filtrosExport })}
            />
            <Button size="sm" variant="outline" onClick={() => setShowDerivacion(true)}>Derivar a proveedor</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo loaner</Button>
          </div>
        }
      >
        <LoanersFiltersBar
          busq={busq}
          onBusqChange={setBusq}
          estados={filters.estados}
          soloCompletos={filters.soloCompletos}
          showInactivos={filters.showInactivos}
          setFilter={setFilter as (key: string, value: string | boolean) => void}
          onReset={resetFilters}
        />
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando loaners...</p></div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay loaners registrados</p>
              <button onClick={() => setShowCreate(true)}
                className="text-teal-600 hover:underline mt-2 inline-block text-xs">
                Crear primer loaner
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
            <table ref={tableRef} className="tabla-compacta w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: 75 }} />
                  <col />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: 110 }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Codigo" field="codigo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Descripcion" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Categoria" field="categoriaEquipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  {/* Qué ES el módulo — inyector, detector, degasser (2026-08-24).
                      La columna "Categoria" dice HPLC o GC, que es el equipo; sin
                      esta había que abrir el loaner para saber qué pieza era. */}
                  <SortableHeader label="Tipo de modulo" field="categoriaModuloNombre" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(3)} relative`}>
                    <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                    <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Modelo modulo" field="moduloCodigo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(4)} relative`}>
                    <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                    <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(5)} relative`}>Serie<ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} /><div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader label="Estado" field="estado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(6)} relative`}>
                    <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                    <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(7)} relative`}>Ubicacion actual<ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} /><div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(l => {
                  const prestamo = getPrestamoActivo(l);
                  // Semáforo de días SIEMPRE visible (2026-08-27, mismo espíritu
                  // que tickets): préstamo ≤14 verde / 15-25 naranja / >25 rojo;
                  // proveedor ≤10 verde / 11-20 naranja / >20 rojo.
                  const diasFuera = prestamo ? diasDesde(prestamo.fechaSalida) : null;
                  const diasProveedor = l.enProveedor ? diasDesde(l.enProveedor.fechaEnvio) : null;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/loaners/${l.id}`)}>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                        <span className="font-semibold text-teal-600 text-xs">{l.codigo}</span>
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={l.descripcion}>{l.descripcion}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(2)}`}>{l.categoriaEquipo || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(3)}`}>{l.categoriaModuloNombre || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(4)}`} title={l.moduloDescripcion ?? undefined}>{l.moduloCodigo || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(5)}`}>{l.serie || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(6)}`}>
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_LOANER_COLORS[l.estado]}`}>
                          {ESTADO_LOANER_LABELS[l.estado]}
                        </span>
                        {diasFuera != null && (
                          <span className={`ml-1.5 text-[10px] font-bold ${semaforoPrestamoCls(diasFuera)}`} title={`${diasFuera} día(s) en cliente`}>
                            {diasFuera}d
                          </span>
                        )}
                        {diasProveedor != null && (
                          <span className={`ml-1.5 text-[10px] font-bold ${semaforoProveedorCls(diasProveedor)}`} title={`${diasProveedor} día(s) en proveedor externo`}>
                            {diasProveedor}d
                          </span>
                        )}
                        {/* Incompleto (2026-08-20): el estado dice DONDE esta, esto dice
                            si sirve. Un loaner desarmado se veia "En base" en verde. */}
                        {loanerEstaIncompleto(l) && (
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800"
                            title={`Falta reponer: ${loanerPartesFaltantes(l)}`}>
                            INCOMPLETO
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(7)}`}
                        title={l.enProveedor ? `${l.enProveedor.proveedorNombre ?? 'Proveedor'} · Remito ${l.enProveedor.remitoNumero}${l.enProveedor.alcance === 'parte' ? ` — parte: ${l.enProveedor.parteDescripcion ?? ''}` : ''}` : undefined}>
                        {/* En proveedor (2026-08-12): muestra QUIÉN lo tiene y el remito;
                            si viajó solo una parte, el módulo sigue en base y se aclara. */}
                        {l.enProveedor
                          ? `${l.enProveedor.proveedorNombre ?? 'Proveedor'} · ${l.enProveedor.remitoNumero}${l.enProveedor.alcance === 'parte' ? ' (parte)' : ''}`
                          : prestamo ? `${prestamo.clienteNombre}${sufijoEstab(prestamo.clienteId, prestamo.establecimientoId)}` : l.estado === 'en_base' ? 'AGS Base' : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Fila entera navega al detalle (one-click); no hace falta botón "Ver". */}
                          {l.estado === 'en_base' && (
                            <button onClick={() => handleDelete(l.id)}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateLoanerModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
      {showDerivacion && (
        <GenerarRemitoDevolucionModal
          open={showDerivacion}
          onClose={() => setShowDerivacion(false)}
          ficha={null}
        />
      )}
    </div>
  );
}
