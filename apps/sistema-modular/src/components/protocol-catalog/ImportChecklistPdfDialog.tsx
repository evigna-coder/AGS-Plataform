import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import type { ChecklistItem, ChecklistItemType } from '@ags/shared';
// Vite resuelve este import como asset URL en build y dev
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

interface Props {
  onClose: () => void;
  onImport: (items: ChecklistItem[]) => void;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const PASS_FAIL_OPTIONS = /^(cumple|no cumple|n\/a|no aplica)$/i;
const DEPTH3_RE = /^(\d+\.\d+\.[a-z])\s+(.+)/i;
const DEPTH2_RE = /^(\d+\.\d+)\s+(.+)/;
const DEPTH1_RE = /^(\d+)\.\s+(.+)/;
const VALUE_BLANK_RE = /_{2,}/;
const VALUE_COLON_END_RE = /:\s*$/;
const RESULT_LEAD_RE = /^resultado\s+del\s+test/i;
// Detecta "□ Esta sección No Aplica" tanto inline como standalone
const NA_RE = /[□☐]?\s*esta\s+secci[oó]n\s+no\s+aplica/i;

function detectType(label: string): ChecklistItemType {
  if (RESULT_LEAD_RE.test(label)) return 'pass_fail';
  if (VALUE_BLANK_RE.test(label) || VALUE_COLON_END_RE.test(label)) return 'value_input';
  return 'checkbox';
}

function extractUnit(label: string): { cleanLabel: string; unit: string | null } {
  const m = label.match(/___+\s*([a-zA-Z\/°%]+)$/);
  if (m) return { cleanLabel: label.slice(0, label.lastIndexOf('_')).replace(/:\s*$/, '').trim(), unit: m[1] };
  const m2 = label.match(/^(.+?):\s*_{2,}/);
  if (m2) return { cleanLabel: m2[1].trim(), unit: null };
  return { cleanLabel: label, unit: null };
}

function isPageHeader(line: string): boolean {
  if (/^(mantenimiento preventivo|hoja\s+\d+\s+de\s+\d+|archivo:|formulario:|marca:|modelo:|n[uú]mero de serie)/i.test(line)) return true;
  if (/^\d+$/.test(line.trim())) return true;
  return false;
}

export function parseChecklistText(rawText: string): ChecklistItem[] {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !isPageHeader(l));

  const items: ChecklistItem[] = [];
  let idx = 0;
  let skipPassFailOptions = false;

  while (idx < lines.length) {
    const rawLine = lines[idx++];

    if (skipPassFailOptions && PASS_FAIL_OPTIONS.test(rawLine)) continue;
    skipPassFailOptions = false;

    // Detectar y limpiar anotación "Esta sección No Aplica" del contenido de la línea
    const hasInlineNA = NA_RE.test(rawLine);
    const line = rawLine.replace(NA_RE, '').trim();

    // Standalone NA (línea que era solo la anotación): marcar el último item depth 1-2
    if (!line && hasInlineNA) {
      for (let j = items.length - 1; j >= 0; j--) {
        if (items[j].depth >= 1 && items[j].depth <= 2) {
          items[j] = { ...items[j], canBeNA: true };
          break;
        }
      }
      continue;
    }
    if (!line) continue;

    // ── Ítem de tarea (comienza con "o " o "✓ ") ─────────────────────────────
    const taskMatch = line.match(/^[oO✓•·]\s+(.+)/) || line.match(/^-\s+(.+)/);
    if (taskMatch) {
      const rawLabel = taskMatch[1].trim();
      const type = detectType(rawLabel);
      const { cleanLabel, unit } = type === 'value_input' ? extractUnit(rawLabel) : { cleanLabel: rawLabel, unit: null };
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: cleanLabel, itemType: type, depth: 3,
        unit: unit ?? null, canBeNA: false, numberPrefix: null,
      });
      if (type === 'pass_fail') skipPassFailOptions = true;
      continue;
    }

    // ── "Resultado del test:" standalone ─────────────────────────────────────
    if (RESULT_LEAD_RE.test(line)) {
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: line.replace(/:$/, '').trim(), itemType: 'pass_fail', depth: 3,
        unit: null, canBeNA: false, numberPrefix: null,
      });
      skipPassFailOptions = true;
      continue;
    }

    // ── Sub-sub-sección (3.2.a) ───────────────────────────────────────────────
    const d3 = line.match(DEPTH3_RE);
    if (d3) {
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: d3[2].trim(), itemType: 'checkbox', depth: 3,
        unit: null, canBeNA: hasInlineNA, numberPrefix: d3[1],
      });
      continue;
    }

    // ── Sub-sección (3.1) ─────────────────────────────────────────────────────
    const d2 = line.match(DEPTH2_RE);
    if (d2) {
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: d2[2].trim(), itemType: 'checkbox', depth: 2,
        unit: null, canBeNA: hasInlineNA, numberPrefix: d2[1],
      });
      continue;
    }

    // ── Sección principal (1.) ────────────────────────────────────────────────
    const d1 = line.match(DEPTH1_RE);
    if (d1) {
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: d1[2].trim(), itemType: 'checkbox', depth: 1,
        unit: null, canBeNA: hasInlineNA, numberPrefix: d1[1] + '.',
      });
      continue;
    }

    // ── Cabecera en mayúsculas ────────────────────────────────────────────────
    if (line.length >= 5 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚ]/.test(line)) {
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: line, itemType: 'checkbox', depth: 0,
        unit: null, canBeNA: false, numberPrefix: null,
      });
      continue;
    }

    // ── Valor inline con blank ────────────────────────────────────────────────
    if (VALUE_BLANK_RE.test(line)) {
      const { cleanLabel, unit } = extractUnit(line);
      items.push({
        itemId: `item_${String(items.length + 1).padStart(3, '0')}`,
        label: cleanLabel, itemType: 'value_input', depth: 3,
        unit: unit ?? null, canBeNA: false, numberPrefix: null,
      });
      continue;
    }
  }

  return items;
}

// ─── Extracción de texto desde PDF con soporte de 2 columnas ─────────────────

type RawItem = { str: string; x: number; y: number; w: number };

function buildColumnLines(items: RawItem[]): string[] {
  if (items.length === 0) return [];
  const lineMap = new Map<number, RawItem[]>();
  for (const item of items) {
    if (!lineMap.has(item.y)) lineMap.set(item.y, []);
    lineMap.get(item.y)!.push(item);
  }
  return [...lineMap.entries()]
    .sort(([ya], [yb]) => yb - ya)   // PDF Y es ascendente → Y mayor = más arriba
    .map(([, row]) => {
      const sorted = row.sort((a, b) => a.x - b.x);
      let line = sorted[0].str;
      for (let j = 1; j < sorted.length; j++) {
        const prev = sorted[j - 1];
        const cur = sorted[j];
        // Si el gap entre el final del item anterior y el inicio del siguiente
        // es > 1pt, hay un espacio real; de lo contrario es fragmentación tipográfica
        const gap = cur.x - (prev.x + prev.w);
        line += (gap > 1 ? ' ' : '') + cur.str;
      }
      return line.trim();
    })
    .filter(l => l.length > 0);
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const midX = viewport.width / 2;
    const leftItems: RawItem[] = [];
    const rightItems: RawItem[] = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const ti = item as { str: string; transform: number[]; width: number };
      if (!ti.str.trim()) continue;
      const x = ti.transform[4];
      const y = Math.round(ti.transform[5]);
      const entry: RawItem = { str: ti.str, x, y, w: ti.width };
      if (x < midX) leftItems.push(entry);
      else rightItems.push(entry);
    }

    // Si hay contenido significativo en ambas columnas → layout 2 col
    // Leer primero columna izquierda completa, luego columna derecha
    const hasRight = rightItems.some(it => it.str.trim().length > 3);
    const lines = hasRight
      ? [...buildColumnLines(leftItems), ...buildColumnLines(rightItems)]
      : buildColumnLines(leftItems);

    pageTexts.push(lines.join('\n'));
  }

  return pageTexts.join('\n');
}

// ─── Componente Dialog ────────────────────────────────────────────────────────

export const ImportChecklistPdfDialog = ({ onClose, onImport }: Props) => {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ChecklistItem[] | null>(null);
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = () => {
    const items = parseChecklistText(rawText);
    setParsed(items);
    const labels: Record<string, string> = {};
    items.forEach(it => { labels[it.itemId] = it.label; });
    setEditLabels(labels);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractError(null);
    setExtracting(true);
    try {
      const text = await extractTextFromPdf(file);
      setRawText(text);
      const items = parseChecklistText(text);
      setParsed(items);
      const labels: Record<string, string> = {};
      items.forEach(it => { labels[it.itemId] = it.label; });
      setEditLabels(labels);
    } catch (err) {
      setExtractError('No se pudo leer el PDF. Intentá pegar el texto manualmente.');
      console.error(err);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    if (!parsed) return;
    onImport(parsed.map(it => ({ ...it, label: editLabels[it.itemId] ?? it.label })));
  };

  const updateItemType = (itemId: string, type: ChecklistItemType) => {
    setParsed(prev => prev?.map(it => it.itemId === itemId ? { ...it, itemType: type } : it) ?? null);
  };

  const TYPE_LABELS: Record<ChecklistItemType, string> = {
    checkbox: '☑ Checkbox', value_input: '✏ Valor', pass_fail: '✓✗ Cumple/NC',
  };
  const DEPTH_BG: Record<number, string> = {
    0: 'bg-slate-800 text-white', 1: 'bg-blue-100 text-blue-800',
    2: 'bg-slate-100 text-slate-600', 3: 'bg-white text-slate-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Importar checklist desde PDF</h2>
            <p className="text-xs text-slate-500 mt-0.5">Seleccioná un archivo PDF o pegá el texto manualmente.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!parsed ? (
            <>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
                  className="hidden" onChange={handleFileChange} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
                  {extracting ? 'Leyendo PDF...' : '📄 Seleccionar PDF'}
                </Button>
                <span className="text-xs text-slate-400">o pegá el texto abajo</span>
              </div>

              {extractError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{extractError}</p>
              )}

              <textarea
                className="w-full h-64 border border-slate-300 rounded-lg p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Pegá aquí el texto extraído del PDF..."
                value={rawText}
                onChange={e => setRawText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleParse} disabled={rawText.trim().length < 20}>Analizar texto</Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {parsed.length} ítems detectados — revisá y corregí si hace falta
                </p>
                <button onClick={() => setParsed(null)} className="text-xs text-blue-600 hover:underline">
                  ← Volver a editar texto
                </button>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {parsed.map(item => (
                  <div key={item.itemId}
                    className={`flex items-center gap-2 p-1.5 rounded ${DEPTH_BG[item.depth]}`}
                    style={{ paddingLeft: `${(item.depth + 1) * 10}px` }}
                  >
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 w-8">{item.numberPrefix ?? ''}</span>
                    <input
                      className="flex-1 text-xs bg-transparent border-b border-transparent focus:border-blue-400 outline-none"
                      value={editLabels[item.itemId] ?? item.label}
                      onChange={e => setEditLabels(prev => ({ ...prev, [item.itemId]: e.target.value }))}
                    />
                    <select value={item.itemType}
                      onChange={e => updateItemType(item.itemId, e.target.value as ChecklistItemType)}
                      className="text-[10px] bg-transparent border border-slate-200 rounded px-1 py-0.5 shrink-0"
                    >
                      {(Object.keys(TYPE_LABELS) as ChecklistItemType[]).map(t => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    {item.unit && <span className="text-[10px] text-blue-500 shrink-0">{item.unit}</span>}
                    {item.canBeNA && <span className="text-[10px] text-amber-600 shrink-0">N/A</span>}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={parsed.length === 0}>
                  Importar {parsed.length} ítems
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
