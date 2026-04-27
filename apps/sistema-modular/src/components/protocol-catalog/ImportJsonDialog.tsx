import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TablePreview } from './TablePreview';
import { convertDocxToProtocolJson } from '../../utils/wordToProtocolJson';
import { mapSection } from '../../utils/tableCatalogJsonImport';
import type { TableCatalogEntry } from '@ags/shared';

const SYS_TYPES = ['HPLC', 'GC', 'MSD', 'HSS', 'UV', 'OSMOMETRO', 'POLARIMETRO', 'HTA', 'OTRO'];

interface Props {
  onClose: () => void;
  onImport: (tables: TableCatalogEntry[]) => void;
}

type ImportMode = 'word' | 'json';

export const ImportJsonDialog = ({ onClose, onImport }: Props) => {
  const [mode, setMode] = useState<ImportMode>('word');
  const [jsonText, setJsonText] = useState('');
  const [sysType, setSysType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TableCatalogEntry[] | null>(null);
  const [converting, setConverting] = useState(false);
  const [wordFileName, setWordFileName] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const wordInputRef = useRef<HTMLInputElement>(null);

  // ─── JSON handling ──────────────────────────────────────────────────────

  const handleParse = () => {
    if (!jsonText.trim()) { setError('Pegá el JSON del conversor'); return; }
    try {
      const raw = JSON.parse(jsonText);

      // Formato 1: array directo de TableCatalogEntry (exportado desde la app)
      if (Array.isArray(raw) && raw.length > 0 && raw[0].columns) {
        const tables = raw.map((t: any) => ({
          ...t,
          id: '',
          sysType: t.sysType || sysType,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })) as TableCatalogEntry[];
        setPreview(tables);
        setError(null);
        return;
      }

      // Formato 2: { template: { sections: [...] } } (conversor Word)
      if (!raw.template?.sections) { setError('JSON inválido: falta template.sections o array de tablas'); return; }
      const tables = (raw.template.sections as any[]).flatMap(s => mapSection(s, sysType));
      if (tables.length === 0) { setError('No se encontraron secciones válidas'); return; }
      setPreview(tables);
      setError(null);
    } catch {
      setError('JSON inválido. Revisá el formato y la sintaxis.');
    }
  };

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setJsonText((ev.target?.result as string) ?? ''); setPreview(null); };
    reader.readAsText(file);
  };

  // ─── Word handling ──────────────────────────────────────────────────────

  const processWordFile = async (file: File) => {
    setWordFileName(file.name);
    setError(null);
    setConverting(true);
    setDraggingOver(false);
    try {
      const buffer = await file.arrayBuffer();
      const result = await convertDocxToProtocolJson(buffer, file.name);
      if (!result.template?.sections?.length) {
        setError('No se encontraron secciones en el documento Word.');
        setConverting(false);
        return;
      }
      const tables = (result.template.sections as any[]).flatMap(s => mapSection(s, sysType));
      if (tables.length === 0) {
        setError('El documento no contiene tablas válidas para importar.');
        setConverting(false);
        return;
      }
      setPreview(tables);
    } catch (err) {
      setError(`Error al convertir el documento: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setConverting(false);
    }
  };

  const handleWordFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processWordFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Solo se aceptan archivos .docx');
      return;
    }
    processWordFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
  };

  const updatePreviewName = (idx: number, name: string) => {
    if (!preview) return;
    setPreview(preview.map((t, i) => i === idx ? { ...t, name } : t));
  };

  const resetToInput = () => {
    setPreview(null);
    setWordFileName(null);
    if (wordInputRef.current) wordInputRef.current.value = '';
  };

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider border-b-2 transition-colors ${
      active
        ? 'border-teal-600 text-teal-700'
        : 'border-transparent text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-slate-900 uppercase">
            Importar tablas
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 font-bold text-lg">✕</button>
        </div>

        {!preview ? (
          <div className="space-y-4">
            <div className="flex gap-1 border-b border-slate-200">
              <button className={tabCls(mode === 'word')} onClick={() => { setMode('word'); setError(null); }}>
                Desde Word (.docx)
              </button>
              <button className={tabCls(mode === 'json')} onClick={() => { setMode('json'); setError(null); }}>
                Desde JSON
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide">
                Tipo de sistema (se aplica a todas las tablas)
              </label>
              <select value={sysType} onChange={e => setSysType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {mode === 'word' ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  draggingOver
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-300 hover:border-teal-400'
                }`}
                onClick={() => wordInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={wordInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleWordFile}
                  className="hidden"
                />
                {converting ? (
                  <div className="space-y-2">
                    <div className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-600">Convirtiendo <strong>{wordFileName}</strong>...</p>
                    <p className="text-xs text-slate-400">Extrayendo tablas y estructura del documento</p>
                  </div>
                ) : wordFileName ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{wordFileName}</p>
                    <p className="text-xs text-slate-400">Click para cambiar archivo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-slate-600">
                      Arrastrá o hacé click para subir un archivo <strong>.docx</strong>
                    </p>
                    <p className="text-xs text-slate-400">
                      El protocolo se convierte automáticamente a tablas
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide">
                    Subir archivo .json
                  </label>
                  <input type="file" accept=".json" onChange={handleJsonFile} className="text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide">
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
              </>
            )}

            {error && <p className="text-red-600 text-sm font-bold">{error}</p>}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              {mode === 'json' && (
                <Button onClick={handleParse}>Extraer tablas →</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Se encontraron <strong>{preview.length}</strong> tabla(s). Revisá los nombres y la estructura antes de importar:
            </p>
            <div className="space-y-4">
              {preview.map((t, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-500 shrink-0">{i + 1}.</span>
                    <input type="text" value={t.name}
                      onChange={e => updatePreviewName(i, e.target.value)}
                      className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm font-bold" />
                    <span className="text-xs text-slate-400 shrink-0">
                      {t.tableType} · {t.columns.length} cols · {t.templateRows.length} filas
                    </span>
                  </div>
                  {t.columns.length > 0 && (
                    <div className="p-2 overflow-x-auto max-h-48 overflow-y-auto">
                      <TablePreview table={t} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <Button variant="outline" onClick={resetToInput}>← Volver</Button>
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
