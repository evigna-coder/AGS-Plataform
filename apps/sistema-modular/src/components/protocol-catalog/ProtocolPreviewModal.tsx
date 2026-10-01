import { useMemo } from 'react';
import type { TableCatalogEntry, TableProject } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { TablePreview } from './TablePreview';

interface Props {
  open: boolean;
  onClose: () => void;
  project: TableProject | null;
  tables: TableCatalogEntry[];
}

/**
 * El texto de las tablas tipo "texto" es HTML cargado por el staff con el editor.
 * Para la vista previa se quita lo ejecutable (scripts, handlers, javascript:).
 */
function safeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed').forEach(n => n.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

function Bloque({ table }: { table: TableCatalogEntry }) {
  const titulo = table.showTitle !== false && table.name
    ? <h4 className="text-sm font-semibold text-slate-800 mb-1">{table.name}</h4> : null;

  switch (table.tableType) {
    case 'cover':
      return (
        <div className="border border-slate-300 rounded-lg p-6 text-center bg-white">
          <p className="font-serif text-xl text-slate-900 leading-snug">{table.name}</p>
          {table.description && <p className="text-xs text-slate-500 mt-1">{table.description}</p>}
          <p className="mt-4 text-[11px] font-mono text-slate-400">
            {[table.coverQF, table.coverRevision, table.coverFecha].filter(Boolean).join(' · ') || 'Sin QF'}
          </p>
          {(table.coverExtraFields ?? []).length > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">Campos extra: {(table.coverExtraFields ?? []).map(f => f.label).join(', ')}</p>
          )}
        </div>
      );
    case 'text':
      return (
        <div className={table.textDisplayMode === 'inline' ? '' : 'border border-slate-200 rounded-lg p-3 bg-white'}>
          {titulo}
          <div className="text-xs text-slate-700 prose-sm max-w-none" style={{ textAlign: table.textAlign ?? 'justify' }}
            dangerouslySetInnerHTML={{ __html: safeHtml(table.textContent ?? '') }} />
        </div>
      );
    case 'signatures':
      return (
        <div className="border border-dashed border-slate-300 rounded-lg p-4 grid grid-cols-2 gap-6 text-center text-[11px] text-slate-400">
          {(table.signatureMode ?? 'both') !== 'client' && <div className="border-t border-slate-300 pt-1">Firma ingeniero</div>}
          {(table.signatureMode ?? 'both') !== 'engineer' && <div className="border-t border-slate-300 pt-1">Firma cliente</div>}
        </div>
      );
    case 'checklist':
      return (
        <div className="border border-slate-200 rounded-lg p-3 bg-white">
          {titulo}
          <ul className="text-xs text-slate-700 space-y-0.5">
            {(table.checklistItems ?? []).map(it => (
              <li key={it.itemId} style={{ paddingLeft: `${(it.depth ?? 0) * 12}px` }} className={it.depth === 0 ? 'font-semibold mt-1' : ''}>
                {it.depth > 0 && <span className="text-slate-300 mr-1">☐</span>}{it.numberPrefix ? `${it.numberPrefix} ` : ''}{it.label}
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return <TablePreview table={table} />;
  }
}

/**
 * Vista previa del protocolo completo de un proyecto: todas las tablas no
 * archivadas en el orden en que las va a ver el técnico. Aproximada: el render
 * definitivo y la paginación del PDF son los de reportes-ot.
 */
export function ProtocolPreviewModal({ open, onClose, project, tables }: Props) {
  const ordenadas = useMemo(
    () => tables.filter(t => t.status !== 'archived').sort((a, b) => (a.orden || 999) - (b.orden || 999)),
    [tables],
  );
  return (
    <Modal open={open} onClose={onClose} title="Vista previa del protocolo" subtitle={project?.name} maxWidth="2xl">
      <div className="space-y-4 bg-slate-50 -m-1 p-1">
        <p className="text-[11px] text-slate-400">
          {ordenadas.length} bloques en orden. Los borradores se muestran con borde ámbar. El PDF final lo arma reportes-ot.
        </p>
        {ordenadas.map(t => (
          <div key={t.id} className={`rounded-lg ${t.status === 'draft' ? 'ring-2 ring-amber-300 ring-offset-2' : ''}`}>
            <p className="text-[10px] font-mono text-slate-400 mb-1">#{t.orden || '—'}{t.status === 'draft' ? ' · borrador' : ''}</p>
            <Bloque table={t} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
