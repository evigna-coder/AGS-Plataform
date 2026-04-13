import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePatrones } from '../../hooks/usePatrones';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreatePatronModal } from '../../components/patrones/CreatePatronModal';
import { MigracionPatronesModal } from '../../components/patrones/MigracionPatronesModal';
import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaPatron,
  type Patron,
} from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

const CAT_OPTIONS = [
  { value: '', label: 'Todas' },
  ...CATS_PATRON.map(([k, v]) => ({ value: k, label: v })),
];

/** Calcula el estado global de un patrón basado en el lote más crítico. */
function estadoGlobal(patron: Patron): 'vigente' | 'por_vencer' | 'vencido' | 'sin_cert' {
  if (!patron.lotes.length) return 'sin_cert';
  const estados = patron.lotes.map(l => calcularEstadoCertificado(l.fechaVencimiento));
  if (estados.includes('vencido')) return 'vencido';
  if (estados.includes('por_vencer')) return 'por_vencer';
  if (estados.every(e => e === 'sin_certificado')) return 'sin_cert';
  return 'vigente';
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_cert: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

export const PatronesListPage = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('patrones-list');
  const { patrones, loading, error, listPatrones, deactivatePatron } = usePatrones();
  const [showCreate, setShowCreate] = useState(false);
  const [showMigracion, setShowMigracion] = useState(false);

  const [filters, setFilters] = useState({
    categoria: '',
    showInactive: false,
  });
  const [sortField, setSortField] = useState('codigoArticulo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const reload = () => {
    listPatrones({
      categoria: (filters.categoria as CategoriaPatron) || undefined,
      activoOnly: !filters.showInactive,
    });
  };

  useEffect(() => { reload(); }, [filters.categoria, filters.showInactive]);

  const filtered = useMemo(() => sortByField(patrones, sortField, sortDir), [patrones, sortField, sortDir]);

  const vencidos = patrones.filter(p => estadoGlobal(p) === 'vencido');
  const porVencer = patrones.filter(p => estadoGlobal(p) === 'por_vencer');

  const handleDeactivate = async (p: Patron) => {
    if (!await confirm(`¿Desactivar "${p.descripcion}"?`)) return;
    try {
      await deactivatePatron(p.id);
      reload();
    } catch {
      alert('Error al desactivar el patrón');
    }
  };

  const isInitialLoad = loading && patrones.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Patrones"
        subtitle="Estándares y materiales de referencia con lotes y certificados"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowMigracion(true)} title="Migrar patrones antiguos desde la colección instrumentos">
              Migrar desde instrumentos
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo patrón</Button>
          </div>
        }
      >
        <div className="space-y-2">
          {(vencidos.length > 0 || porVencer.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {vencidos.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <span className="text-red-700 text-[11px] font-medium">{vencidos.length} patron(es) con lote(s) vencido(s)</span>
                </div>
              )}
              {porVencer.length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <span className="text-amber-700 text-[11px] font-medium">{porVencer.length} por vencer (30d)</span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[160px]">
              <SearchableSelect value={filters.categoria}
                onChange={(v) => setFilters({ ...filters, categoria: v })}
                options={CAT_OPTIONS} placeholder="Categoría" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={filters.showInactive}
                onChange={e => setFilters({ ...filters, showInactive: e.target.checked })}
                className="rounded border-slate-300" />
              Inactivos
            </label>
            <Button variant="ghost" size="sm"
              onClick={() => setFilters({ categoria: '', showInactive: false })}>
              Limpiar
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando patrones...</p></div>
        ) : error ? (
          <Card><p className="text-red-600 text-sm">{error}</p></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay patrones cargados</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '110px' }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Código artículo" field="codigoArticulo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Descripción" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Marca" field="marca" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(3)} relative`}>Categorías<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(4)} relative`}>Lotes<ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} /><div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => {
                  const estado = estadoGlobal(p);
                  const badge = ESTADO_BADGE[estado];
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className={`px-3 py-2 text-xs font-semibold text-teal-600 font-mono truncate ${getAlignClass(0)}`} title={p.codigoArticulo}>{p.codigoArticulo || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={p.descripcion}>{p.descripcion || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`}>{p.marca || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(3)}`}>
                        <div className="flex gap-1 flex-wrap">
                          {p.categorias.map(c => (
                            <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                              {CATEGORIA_PATRON_LABELS[c] || c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-3 py-2 ${getAlignClass(4)}`}>
                        {p.lotes.length === 0 ? (
                          <span className="text-[10px] text-slate-300 italic">Sin lotes</span>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            {p.lotes.slice(0, 3).map((l, i) => (
                              <span key={i}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200"
                                title={l.fechaVencimiento ? `Vence: ${l.fechaVencimiento}` : undefined}>
                                {l.lote || '(vacío)'}
                              </span>
                            ))}
                            {p.lotes.length > 3 && (
                              <span className="text-[10px] text-slate-400">+{p.lotes.length - 3}</span>
                            )}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/patrones/${p.id}/editar`}
                            className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100">
                            Editar
                          </Link>
                          {p.activo && (
                            <button onClick={() => handleDeactivate(p)}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                              Desactivar
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

      <CreatePatronModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
      <MigracionPatronesModal open={showMigracion} onClose={() => setShowMigracion(false)} onCompleted={reload} />
    </div>
  );
};
