import { useEffect, useMemo, useState } from 'react';
import type { TableCatalogEntry } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { validateForPublish } from '../../utils/tableCatalogValidation';
import { TABLE_TYPE_LABELS } from '../../utils/tableCatalogConstants';
import { tableLabel } from '../../utils/tableCatalogCoverage';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Tablas candidatas (las que todavía no están publicadas). */
  tables: TableCatalogEntry[];
  subtitle?: string;
  onPublish: (ids: string[]) => Promise<void>;
}

/**
 * Publicar varias tablas de una vez. Corre la misma validación que el editor:
 * las que pasan quedan tildadas; las que tienen advertencias quedan destildadas
 * con el detalle a la vista, y se pueden publicar igual tildándolas.
 */
export function PublishBatchModal({ open, onClose, tables, subtitle, onPublish }: Props) {
  const checks = useMemo(
    () => [...tables].sort((a, b) => (a.orden || 999) - (b.orden || 999)).map(t => ({ table: t, warnings: validateForPublish(t) })),
    [tables],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set(checks.filter(c => c.warnings.length === 0).map(c => c.table.id)));
  }, [open, checks]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const conAdvertencias = checks.filter(c => c.warnings.length > 0).length;

  const publicar = async () => {
    setSaving(true);
    try { await onPublish([...selected]); onClose(); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Publicar tablas" subtitle={subtitle} maxWidth="lg"
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={publicar} disabled={saving || selected.size === 0} estado={saving ? 'guardando' : 'idle'}>
          {`Publicar ${selected.size}`}
        </Button>
      </>}>
      {checks.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">Todas las tablas ya están publicadas.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {checks.length} tabla(s) sin publicar.
            {conAdvertencias > 0
              ? ` ${conAdvertencias} con advertencias quedaron sin tildar: revisalas o tildalas para publicarlas igual.`
              : ' Todas pasan la validación.'}
          </p>
          <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {checks.map(({ table, warnings }) => (
              <label key={table.id} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selected.has(table.id)} onChange={() => toggle(table.id)}
                  className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-800">
                    {table.name?.trim()
                      ? <><span className="font-mono text-slate-400 mr-1.5">{table.orden || '—'}</span>{table.name}</>
                      : <span className="italic text-slate-500">{tableLabel(table)}</span>}
                  </span>
                  <span className="ml-2 text-[10px] text-slate-400">{TABLE_TYPE_LABELS[table.tableType] ?? table.tableType}</span>
                  {warnings.length > 0 && (
                    <span className="block mt-0.5 text-[11px] text-amber-700">{warnings.join(' · ')}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
