import { useState, useEffect, useMemo } from 'react';
import { useColumnas } from '../../hooks/useColumnas';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateColumnaModal } from '../../components/columnas/CreateColumnaModal';
import { ColumnaRow } from './ColumnaRow';
import {
  CATEGORIA_PATRON_LABELS,
  type CategoriaPatron,
  type Columna,
} from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const CAT_OPTIONS = [
  { value: '', label: 'Todas' },
  ...(Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][]).map(([k, v]) => ({ value: k, label: v })),
];

const FILTER_SCHEMA = {
  categoria: { type: 'string' as const, default: '' },
  showInactive: { type: 'boolean' as const, default: false },
};

export const ColumnasList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('columnas-list');
  const { columnas, loading, error, listColumnas, deactivateColumna } = useColumnas();
  const [showCreate, setShowCreate] = useState(false);

  const [filters, setFilter, _setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const [sortField, setSortField] = useState('codigoArticulo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const reload = () => {
    listColumnas({
      categoria: (filters.categoria as CategoriaPatron) || undefined,
      activoOnly: !filters.showInactive,
    });
  };

  useEffect(() => { reload(); }, [filters.categoria, filters.showInactive]);

  const filtered = useMemo(() => sortByField(columnas, sortField, sortDir), [columnas, sortField, sortDir]);

  const handleDeactivate = async (c: Columna) => {
    if (!await confirm(`¿Desactivar "${c.codigoArticulo}"?`)) return;
    try {
      await deactivateColumna(c.id);
      reload();
    } catch {
      alert('Error al desactivar la columna');
    }
  };

  const isInitialLoad = loading && columnas.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Columnas cromatográficas"
        subtitle="Columnas GC/HPLC con unidades físicas por código de artículo"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nueva columna</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[160px]">
            <SearchableSelect value={filters.categoria}
              onChange={(v) => setFilter('categoria', v)}
              options={CAT_OPTIONS} placeholder="Categoría" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.showInactive}
              onChange={e => setFilter('showInactive', e.target.checked)}
              className="rounded border-slate-300" />
            Inactivas
          </label>
          <Button variant="ghost" size="sm"
            onClick={resetFilters}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando columnas...</p></div>
        ) : error ? (
          <Card><p className="text-red-600 text-sm">{error}</p></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay columnas cargadas</p>
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
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '110px' }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Código artículo" field="codigoArticulo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(0)}`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} relative ${getAlignClass(1)}`}>Descripción<ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} /><div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader label="Marca" field="marca" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} relative ${getAlignClass(2)}`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} relative ${getAlignClass(3)}`}>Categorías<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative ${getAlignClass(4)}`}>Series<ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} /><div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} relative text-center`}>Acciones<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <ColumnaRow
                    key={c.id}
                    columna={c}
                    getAlignClass={getAlignClass}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateColumnaModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
    </div>
  );
};
