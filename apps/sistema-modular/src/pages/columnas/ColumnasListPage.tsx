import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useColumnas } from '../../hooks/useColumnas';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateColumnaModal } from '../../components/columnas/CreateColumnaModal';
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

export const ColumnasListPage = () => {
  const confirm = useConfirm();
  const { columnas, loading, error, listColumnas, deactivateColumna } = useColumnas();
  const [showCreate, setShowCreate] = useState(false);

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
              onChange={(v) => setFilters({ ...filters, categoria: v })}
              options={CAT_OPTIONS} placeholder="Categoría" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.showInactive}
              onChange={e => setFilters({ ...filters, showInactive: e.target.checked })}
              className="rounded border-slate-300" />
            Inactivas
          </label>
          <Button variant="ghost" size="sm"
            onClick={() => setFilters({ categoria: '', showInactive: false })}>
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
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '44%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Código artículo" field="codigoArticulo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Descripción</th>
                  <SortableHeader label="Marca" field="marca" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Categorías</th>
                  <th className={thClass}>Series</th>
                  <th className={`${thClass} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-xs font-semibold text-teal-600 font-mono truncate" title={c.codigoArticulo}>{c.codigoArticulo}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate" title={c.descripcion}>{c.descripcion || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate">{c.marca || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1 flex-wrap">
                        {c.categorias.map(cat => (
                          <span key={cat} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                            {CATEGORIA_PATRON_LABELS[cat] || cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-slate-600 font-mono">{c.series.length}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/columnas/${c.id}/editar`}
                          className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100">
                          Editar
                        </Link>
                        {c.activo && (
                          <button onClick={() => handleDeactivate(c)}
                            className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                            Desactivar
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

      <CreateColumnaModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
    </div>
  );
};
