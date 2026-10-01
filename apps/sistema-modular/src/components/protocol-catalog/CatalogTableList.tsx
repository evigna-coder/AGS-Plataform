import { useState } from 'react';
import type { TableCatalogEntry } from '@ags/shared';
import { CatalogTableRow, type RowActions } from './CatalogTableRow';
import { groupByRole, ROLE_LABELS, type RoleGroup } from '../../utils/tableCatalogCoverage';
import { sortByField, toggleSort, type SortDir } from '../ui/SortableHeader';

interface Props extends RowActions {
  tables: TableCatalogEntry[];
  /** true = proyecto activo: agrupa por rol en el protocolo (encabezado / ensayos / cierre). */
  grouped: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  refModelos: string[];
  refServicios: string[];
  /** Solo en la vista sin proyecto: id → nombre del proyecto, para mostrarlo bajo el nombre. */
  projectNames?: Map<string, string>;
}

const th = 'px-2 py-2 text-[10px] font-mono font-medium uppercase tracking-wide text-slate-400 select-none';
const COLS: { key: string; label: string; className?: string }[] = [
  { key: 'orden', label: '#', className: 'w-10' }, { key: 'name', label: 'Nombre' }, { key: 'tableType', label: 'Tipo', className: 'w-28' },
  { key: 'modelos.length', label: 'Modelos', className: 'text-center w-24' },
  { key: 'tipoServicio.length', label: 'Servicios', className: 'text-center w-56' }, { key: 'status', label: 'Estado', className: 'w-24' },
];

/**
 * Lista compacta de tablas. Con un proyecto activo y orden por "#", agrupa en
 * bloques plegables según el rol de cada tabla en el protocolo.
 */
export function CatalogTableList({ tables, grouped, selectedIds, setSelectedIds, refModelos, refServicios, projectNames, ...actions }: Props) {
  const [sortField, setSortField] = useState('orden');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [collapsed, setCollapsed] = useState<Set<RoleGroup>>(new Set());

  // "#" numérico: sin orden asignado va al final (como en reportes-ot), nunca comparado como texto.
  const sorted = sortField === 'orden'
    ? [...tables].sort((a, b) => ((a.orden || 999) - (b.orden || 999)) * (sortDir === 'asc' ? 1 : -1))
    : sortByField(tables, sortField, sortDir);
  const useGroups = grouped && sortField === 'orden' && sortDir === 'asc';
  const groups = useGroups ? groupByRole(sorted) : [{ group: null as RoleGroup | null, tables: sorted }];

  const toggleIds = (ids: string[], on: boolean) => {
    const next = new Set(selectedIds);
    ids.forEach(id => on ? next.add(id) : next.delete(id));
    setSelectedIds(next);
  };
  const allIds = tables.map(t => t.id);
  const allOn = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const sort = (k: string) => { const s = toggleSort(k, sortField, sortDir); setSortField(s.field); setSortDir(s.dir); };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-[1]">
          <tr>
            <th className="pl-3 pr-1 py-2 w-8">
              <input type="checkbox" checked={allOn} onChange={() => toggleIds(allIds, !allOn)} className="w-3.5 h-3.5 accent-teal-600 cursor-pointer" />
            </th>
            {COLS.map(c => (
              <th key={c.key} onClick={() => sort(c.key)} className={`${th} cursor-pointer hover:text-slate-600 text-left ${c.className ?? ''}`}>
                {c.label}{sortField === c.key && <span className="text-teal-600 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
            <th className={`${th} text-right pr-3 w-64`}>Acciones</th>
          </tr>
        </thead>
        {groups.map(g => {
          const ids = g.tables.map(t => t.id);
          const isCollapsed = g.group ? collapsed.has(g.group) : false;
          const groupOn = ids.every(id => selectedIds.has(id));
          return (
            <tbody key={g.group ?? 'all'} className="divide-y divide-slate-100">
              {g.group && (
                <tr className="bg-slate-50/80 border-y border-slate-200">
                  <td className="pl-3 pr-1 py-1.5">
                    <input type="checkbox" checked={groupOn} onChange={() => toggleIds(ids, !groupOn)} className="w-3.5 h-3.5 accent-teal-600 cursor-pointer" />
                  </td>
                  <td colSpan={COLS.length + 1} className="px-2 py-1.5">
                    <button
                      onClick={() => { const n = new Set(collapsed); isCollapsed ? n.delete(g.group!) : n.add(g.group!); setCollapsed(n); }}
                      className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                      <span className={`inline-block transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
                      {ROLE_LABELS[g.group]}
                      <span className="font-mono font-normal text-slate-400">{g.tables.length}</span>
                      {g.tables.some(t => t.status === 'draft') && (
                        <span className="font-normal text-amber-700">· {g.tables.filter(t => t.status === 'draft').length} en borrador</span>
                      )}
                    </button>
                  </td>
                </tr>
              )}
              {!isCollapsed && g.tables.map(t => (
                <CatalogTableRow key={t.id} table={t} selected={selectedIds.has(t.id)}
                  onToggle={() => toggleIds([t.id], !selectedIds.has(t.id))}
                  refModelos={refModelos} refServicios={refServicios}
                  projectName={projectNames ? (t.projectId ? projectNames.get(t.projectId) ?? null : null) : undefined}
                  {...actions} />
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
