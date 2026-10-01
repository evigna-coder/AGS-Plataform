import { Link } from 'react-router-dom';
import type { TableCatalogEntry } from '@ags/shared';
import { tableDiff, tableLabel } from '../../utils/tableCatalogCoverage';
import { STATUS_COLORS, STATUS_LABELS, TABLE_TYPE_LABELS } from '../../utils/tableCatalogConstants';

export interface RowActions {
  onClone: (t: TableCatalogEntry) => void;
  onPublish: (t: TableCatalogEntry) => void;
  onArchive: (t: TableCatalogEntry) => void;
  onDelete: (t: TableCatalogEntry) => void;
}

interface Props extends RowActions {
  table: TableCatalogEntry;
  selected: boolean;
  onToggle: () => void;
  refModelos: string[];
  refServicios: string[];
  /** Nombre del proyecto (solo en la vista "Todas las tablas"). */
  projectName?: string | null;
}

function ListaCell({ values, empty }: { values?: string[]; empty: string }) {
  const n = values?.length ?? 0;
  if (n === 0) return <span className="text-slate-300">{empty}</span>;
  return <span title={values!.join('\n')} className="cursor-help">{n === 1 ? values![0] : `${n}`}</span>;
}

function DiffBadge({ label, diff }: { label: string; diff: { faltan: string[]; sobran: string[] } }) {
  if (!diff.faltan.length && !diff.sobran.length) return null;
  const tip = [
    diff.faltan.length ? `Le faltan: ${diff.faltan.join(', ')}` : '',
    diff.sobran.length ? `Tiene de más: ${diff.sobran.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  return (
    <span title={tip} className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100 rounded px-1.5 py-px cursor-help">
      ≠ {label}
    </span>
  );
}

/** Fila compacta de una tabla de la biblioteca (una línea). */
export function CatalogTableRow({ table: t, selected, onToggle, refModelos, refServicios, projectName, onClone, onPublish, onArchive, onDelete }: Props) {
  const dm = tableDiff(t, 'modelos', refModelos);
  const ds = tableDiff(t, 'tipoServicio', refServicios);
  return (
    <tr className={`group text-xs ${selected ? 'bg-teal-50/60' : 'hover:bg-slate-50'} ${t.status === 'archived' ? 'opacity-60' : ''}`}>
      <td className="pl-3 pr-1 py-1.5 w-8">
        <input type="checkbox" checked={selected} onChange={onToggle} className="w-3.5 h-3.5 accent-teal-600 cursor-pointer" />
      </td>
      <td className="px-2 py-1.5 w-10 text-slate-400 font-mono tabular-nums">{t.orden || '—'}</td>
      <td className="px-2 py-1.5 min-w-0">
        <Link to={`/table-catalog/${t.id}/edit`} className="font-medium text-slate-800 hover:text-teal-700 hover:underline">
          {t.name?.trim() ? t.name : <span className="text-slate-400 italic">{tableLabel(t).replace(/^#\S+ /, '')}</span>}
        </Link>
        <DiffBadge label="modelos" diff={dm} />
        <DiffBadge label="servicios" diff={ds} />
        {projectName !== undefined && (
          <span className="block text-[10px] text-slate-400 truncate">{projectName ?? 'Sin proyecto'}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{TABLE_TYPE_LABELS[t.tableType] ?? t.tableType}</td>
      <td className="px-2 py-1.5 text-slate-500 text-center tabular-nums"><ListaCell values={t.modelos} empty="Todos" /></td>
      <td className="px-2 py-1.5 text-slate-500 text-center tabular-nums"><ListaCell values={t.tipoServicio} empty="Todos" /></td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[t.status] ?? ''}`}>
          {STATUS_LABELS[t.status] ?? t.status}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap">
        <span className="inline-flex gap-2.5 opacity-70 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onClone(t)} className="text-slate-600 hover:text-slate-900 font-medium">Clonar</button>
          {t.status !== 'published' && <button onClick={() => onPublish(t)} className="text-emerald-700 hover:underline font-medium">Publicar</button>}
          {t.status !== 'archived' && <button onClick={() => onArchive(t)} className="text-amber-700 hover:underline font-medium">Archivar</button>}
          <button onClick={() => onDelete(t)} className="text-red-600 hover:underline font-medium">Eliminar</button>
        </span>
      </td>
    </tr>
  );
}
