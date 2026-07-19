import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QFDocumento, QFEstado } from '@ags/shared';
import { qfDocumentosService } from '../../services/qfDocumentosService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { matchesSearch } from '../../utils/searchTerms';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColMenu, type ColMenuHandle } from '../../components/ui/ColMenu';
import { toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NuevoQFModal } from '../../components/qf-documentos/NuevoQFModal';
import { NuevaVersionModal } from '../../components/qf-documentos/NuevaVersionModal';
import { EditarQFModal } from '../../components/qf-documentos/EditarQFModal';
import { HistorialDrawer } from '../../components/qf-documentos/HistorialDrawer';
import { QFFilterBar } from '../../components/qf-documentos/QFFilterBar';

const FILTER_SCHEMA = {
  search: { type: 'string', default: '' },
  tipo: { type: 'string', default: '' },
  familia: { type: 'string', default: '' },
  mostrarObsoletos: { type: 'boolean', default: false },
  sortField: { type: 'string', default: 'fechaUltimaActualizacion' },
  sortDir: { type: 'string', default: 'desc' },
} as const;

const ESTADO_BADGE: Record<QFEstado, string> = {
  vigente: 'bg-teal-50 text-teal-700 border border-teal-200',
  obsoleto: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const thBase = 'px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 relative select-none';

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
}

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
  active ? (
    <svg className="w-3 h-3 text-teal-500 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-slate-300 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

export function QFDocumentosList() {
  const [docs, setDocs] = useState<QFDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);

  const [showCreate, setShowCreate] = useState(false);
  const [versionTarget, setVersionTarget] = useState<QFDocumento | null>(null);
  const [editTarget, setEditTarget] = useState<QFDocumento | null>(null);
  const [historialTarget, setHistorialTarget] = useState<QFDocumento | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const {
    tableRef, colWidths, colAligns,
    onResizeStart, onAutoFit, setAlign, getAlignClass,
    isHidden, hideCol, showAllCols, hiddenCols,
  } = useResizableColumns('qf-documentos');

  const colMenuRefs = useRef(new Map<number, ColMenuHandle>());
  const openColMenuAt = useCallback((i: number, e: React.MouseEvent) => {
    e.preventDefault();
    colMenuRefs.current.get(i)?.openAt(e.clientX, e.clientY);
  }, []);
  const setColMenuRef = useCallback((i: number) => (handle: ColMenuHandle | null) => {
    if (handle) colMenuRefs.current.set(i, handle);
    else colMenuRefs.current.delete(i);
  }, []);

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = qfDocumentosService.subscribe(
      (data) => { setDocs(data); setLoading(false); setError(null); },
      (err) => { console.error('Error QF:', err); setError(err.message); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const familias = useMemo(() => {
    const set = new Set<number>();
    docs.forEach(d => set.add(d.familia));
    return Array.from(set).sort((a, b) => a - b);
  }, [docs]);

  const filtered = useMemo(() => {
    let result = docs;
    if (!filters.mostrarObsoletos) {
      result = result.filter(d => d.estado === 'vigente');
    }
    if (filters.tipo) result = result.filter(d => d.tipo === filters.tipo);
    if (filters.familia) result = result.filter(d => String(d.familia) === filters.familia);
    if (filters.search.trim()) {
      result = result.filter(d => matchesSearch(filters.search, d.numeroCompleto, d.nombre, d.descripcion));
    }
    return result;
  }, [docs, filters]);

  const sorted = useMemo(() => {
    const field = filters.sortField;
    const dir = filters.sortDir as SortDir;
    // Comparator self-contained — no field.split / reduce / synthetic field.
    // El patrón anterior con sortByField + objeto extendido tiraba "Cannot access X
    // before initialization" en algunos builds minificados (TDZ tras tree-shaking).
    const getValue = (d: QFDocumento): string => {
      if (field === '__ultimaRevisionCambios') {
        const h = d.historial;
        return (h && h.length > 0 ? h[h.length - 1].cambios : '') ?? '';
      }
      const v = (d as unknown as Record<string, unknown>)[field];
      if (v == null) return '';
      return typeof v === 'string' ? v : String(v);
    };
    const items = [...filtered];
    items.sort((a, b) => {
      const cmp = getValue(a).localeCompare(getValue(b));
      return dir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [filtered, filters.sortField, filters.sortDir]);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field);
    setFilter('sortDir', s.dir);
  };

  // Render a sortable + resizable + alignable + hideable header.
  const renderTh = (i: number, sortKey: string, label: string) => {
    if (isHidden(i)) return null;
    const active = filters.sortField === sortKey;
    return (
      <th
        className={`${thBase} cursor-pointer hover:text-slate-600 ${getAlignClass(i)}`}
        onClick={() => handleSort(sortKey)}
        onContextMenu={(e) => openColMenuAt(i, e)}
      >
        <ColMenu
          ref={setColMenuRef(i)}
          align={colAligns?.[i] ?? 'left'}
          onAlign={(a) => setAlign(i, a)}
          onHide={() => hideCol(i)}
        />
        {label}<SortIcon active={active} dir={filters.sortDir as SortDir} />
        <div
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(i, e); }}
          onDoubleClick={() => onAutoFit(i)}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40"
        />
      </th>
    );
  };

  const tdAlign = (i: number) => getAlignClass(i);

  // Default widths in % (must sum ~ 100% considering hidden ones)
  const defaultPct = ['11%', '20%', '8%', '22%', '10%', '14%', '15%'];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Documentos QF"
        count={filtered.length}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo QF</Button>}
      >
        <QFFilterBar
          search={filters.search}
          tipo={filters.tipo}
          familia={filters.familia}
          mostrarObsoletos={filters.mostrarObsoletos}
          familias={familias}
          onChange={{
            search: (v) => setFilter('search', v),
            tipo: (v) => setFilter('tipo', v),
            familia: (v) => setFilter('familia', v),
            mostrarObsoletos: (v) => setFilter('mostrarObsoletos', v),
          }}
        />
        {hiddenCols.length > 0 && (
          <button
            onClick={showAllCols}
            className="text-[10px] text-slate-500 hover:text-teal-700 mt-1 underline"
          >
            Mostrar {hiddenCols.length} columna{hiddenCols.length > 1 ? 's' : ''} oculta{hiddenCols.length > 1 ? 's' : ''}
          </button>
        )}
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4 pt-3">
        {error && (
          <Card><p className="text-sm text-red-600 text-center py-4">{error}</p></Card>
        )}
        {loading && docs.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Cargando QFs…</p>
        ) : sorted.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">
                No hay documentos QF {filters.search || filters.tipo || filters.familia ? 'que coincidan con los filtros.' : 'registrados aún.'}
              </p>
              <button onClick={() => setShowCreate(true)} className="text-teal-700 hover:underline mt-2 inline-block text-xs">
                Crear primer QF
              </button>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed min-w-[920px]">
              <colgroup>
                {(colWidths || defaultPct).map((w, i) =>
                  isHidden(i) ? null : <col key={i} style={{ width: w }} />
                )}
              </colgroup>
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  {renderTh(0, 'numeroCompleto', 'Número')}
                  {renderTh(1, 'nombre', 'Nombre')}
                  {renderTh(2, 'estado', 'Estado')}
                  {renderTh(3, '__ultimaRevisionCambios', 'Última revisión')}
                  {renderTh(4, 'fechaUltimaActualizacion', 'Actualizado')}
                  {renderTh(5, 'ultimoUsuarioNombre', 'Usuario')}
                  <th className={`${thBase} text-right text-slate-400`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(d => {
                  const h = d.historial;
                  const ultimaRevision = (h && h.length > 0 ? h[h.length - 1].cambios : '') ?? '';
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      {!isHidden(0) && (
                        <td className={`px-3 py-2 font-mono text-xs font-semibold text-teal-700 truncate ${tdAlign(0)}`} title={`${d.numeroCompleto}.${d.versionActual}`}>
                          {d.numeroCompleto}.{d.versionActual}
                        </td>
                      )}
                      {!isHidden(1) && (
                        <td className={`px-3 py-2 text-xs text-slate-800 min-w-0 ${tdAlign(1)}`}>
                          <div className="font-medium truncate" title={d.nombre}>{d.nombre}</div>
                          {d.descripcion && <div className="text-[10px] text-slate-400 truncate" title={d.descripcion}>{d.descripcion}</div>}
                        </td>
                      )}
                      {!isHidden(2) && (
                        <td className={`px-3 py-2 ${tdAlign(2)}`}>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                            {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
                          </span>
                        </td>
                      )}
                      {!isHidden(3) && (
                        <td className={`px-3 py-2 text-xs text-slate-500 truncate ${tdAlign(3)}`} title={ultimaRevision}>
                          {ultimaRevision || <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {!isHidden(4) && (
                        <td className={`px-3 py-2 text-xs text-slate-500 truncate whitespace-nowrap ${tdAlign(4)}`}>
                          {formatFecha(d.fechaUltimaActualizacion)}
                        </td>
                      )}
                      {!isHidden(5) && (
                        <td className={`px-3 py-2 text-xs text-slate-500 truncate ${tdAlign(5)}`} title={d.ultimoUsuarioEmail}>
                          {d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}
                        </td>
                      )}
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setVersionTarget(d)} className="text-[10px] font-medium text-teal-700 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 mr-1">Nueva versión</button>
                        <button onClick={() => setHistorialTarget(d)} className="text-[10px] font-medium text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 mr-1">Historial</button>
                        <button onClick={() => setEditTarget(d)} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <NuevoQFModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
      {versionTarget && (
        <NuevaVersionModal
          qf={versionTarget}
          onClose={() => setVersionTarget(null)}
          onSuccess={() => setVersionTarget(null)}
        />
      )}
      {editTarget && (
        <EditarQFModal
          qf={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => setEditTarget(null)}
        />
      )}
      {historialTarget && (
        <HistorialDrawer qf={historialTarget} onClose={() => setHistorialTarget(null)} />
      )}
    </div>
  );
}
