import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { TableCatalogEntry, TableCatalogColumn, TableCatalogRow } from '@ags/shared';

const SYS_TYPES = ['HPLC', 'GC', 'UV', 'OSMOMETRO', 'OTRO'];

function mapSection(section: any, sysType: string): TableCatalogEntry | null {
  if (section.type === 'signatures') return null;

  const tableType: TableCatalogEntry['tableType'] =
    section.type === 'checklist' ? 'informational' :
    section.type === 'table' ? 'validation' :
    'informational';

  let columns: TableCatalogColumn[] = [];
  if (section.type === 'table' && Array.isArray(section.headers)) {
    columns = section.headers.map((h: string) => ({
      key: h.toLowerCase().replace(/\s+/g, '_').slice(0, 30),
      label: h,
      type: 'text_input' as const,
      unit: null,
      required: false,
      expectedValue: null,
    }));
  } else if (section.type === 'checklist') {
    columns = [
      { key: 'item', label: 'Ítem', type: 'text_input' as const, required: false, unit: null, expectedValue: null },
      { key: 'estado', label: 'Estado', type: 'pass_fail' as const, required: true, unit: null, expectedValue: null },
    ];
  } else {
    columns = [
      { key: 'contenido', label: 'Contenido', type: 'text_input' as const, required: false, unit: null, expectedValue: null },
    ];
  }

  const templateRows: TableCatalogRow[] =
    section.type === 'table' && Array.isArray(section.rows)
      ? section.rows.map((row: any[], i: number) => ({
          rowId: `row_${i}`,
          cells: Object.fromEntries(columns.map((col, j) => [col.key, row[j] ?? null])),
        }))
      : section.type === 'checklist' && Array.isArray(section.items)
      ? section.items.map((item: string, i: number) => ({
          rowId: `item_${i}`,
          cells: { item, estado: null },
        }))
      : [];

  return {
    id: '',
    name: section.title ?? `Tabla importada`,
    description: section.type === 'text' ? (section.content ?? null) : null,
    sysType,
    isDefault: false,
    tableType,
    columns,
    templateRows,
    validationRules: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  };
}

interface Props {
  onClose: () => void;
  onImport: (tables: TableCatalogEntry[]) => void;
}

export const ImportJsonDialog = ({ onClose, onImport }: Props) => {
  const [jsonText, setJsonText] = useState('');
  const [sysType, setSysType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TableCatalogEntry[] | null>(null);

  const handleParse = () => {
    if (!jsonText.trim()) { setError('Pegá el JSON del conversor'); return; }
    try {
      const raw = JSON.parse(jsonText);
      if (!raw.template?.sections) { setError('JSON inválido: falta template.sections'); return; }
      const tables = (raw.template.sections as any[])
        .map(s => mapSection(s, sysType))
        .filter((t): t is TableCatalogEntry => t !== null);
      if (tables.length === 0) { setError('No se encontraron secciones válidas'); return; }
      setPreview(tables);
      setError(null);
    } catch {
      setError('JSON inválido. Revisá el formato y la sintaxis.');
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setJsonText((ev.target?.result as string) ?? ''); setPreview(null); };
    reader.readAsText(file);
  };

  const updatePreviewName = (idx: number, name: string) => {
    if (!preview) return;
    setPreview(preview.map((t, i) => i === idx ? { ...t, name } : t));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900 uppercase">
            Importar tablas desde JSON
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 font-bold text-lg">✕</button>
        </div>

        {!preview ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Tipo de sistema (se aplica a todas las tablas)
              </label>
              <select value={sysType} onChange={e => setSysType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Subir archivo .json
              </label>
              <input type="file" accept=".json" onChange={handleFile} className="text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                O pegar JSON directamente
              </label>
              <textarea
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setError(null); setPreview(null); }}
                rows={10}
                placeholder={'{\n  "name": "...",\n  "template": { "sections": [] }\n}'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-none"
              />
            </div>

            {error && <p className="text-red-600 text-sm font-bold">{error}</p>}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleParse}>Extraer tablas →</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Se encontraron <strong>{preview.length}</strong> tabla(s). Revisá los nombres antes de importar:
            </p>
            <div className="space-y-2">
              {preview.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg">
                  <span className="text-xs font-bold text-slate-500 w-6">{i + 1}.</span>
                  <input type="text" value={t.name}
                    onChange={e => updatePreviewName(i, e.target.value)}
                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" />
                  <span className="text-xs text-slate-400 shrink-0">
                    {t.tableType} · {t.columns.length} cols · {t.templateRows.length} filas
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <Button variant="outline" onClick={() => setPreview(null)}>← Volver</Button>
              <Button onClick={() => onImport(preview)}>
                Importar {preview.length} tabla(s)
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
