import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TablePreview } from './TablePreview';
import type { TableCatalogEntry, TableCatalogColumn, TableCatalogRow, TableCatalogRule } from '@ags/shared';

const SYS_TYPES = ['HPLC', 'GC', 'UV', 'OSMOMETRO', 'OTRO'];

// ─── Helpers de acceso a la estructura {id, cells:[]} del conversor ─────────

function getRowCells(row: any): any[] {
  if (Array.isArray(row)) return row;
  if (row && Array.isArray(row.cells)) return row.cells;
  return [];
}

function getCellValue(cell: any): string | null {
  if (cell == null) return null;
  if (typeof cell === 'object') {
    if (cell.type === 'checkbox') return cell.value ? 'true' : '';
    const v = cell.value;
    if (v == null || v === '') return null;
    const s = String(v).trim();
    // Descartar valores que son solo símbolo/unidad sin contenido numérico ni alfabético
    // (ej. "%" pre-impreso en el Word como placeholder de una celda a rellenar)
    if (s.length > 0 && !/[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(s)) return null;
    return s || null;
  }
  const s = String(cell).trim();
  if (s.length > 0 && !/[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(s)) return null;
  return s === '' ? null : s;
}

// ─── Detectores de tipo de fila ──────────────────────────────────────────────

const COL_HEADER_RE = /par[aá]metro|resultado|especificaci|conclusiones|instructivo|m[oó]dulo|modelo|descripci/i;

/** Detecta la frase "Ver especificación del cliente" (o variantes) en un texto */
const VER_SPEC_RE = /ver\s+especificaci[oó]n\s+del\s+cliente/i;

/** Una fila es un encabezado de columnas si todas sus celdas son texto corto y tiene palabras clave típicas */
function looksLikeColumnHeader(cells: any[]): boolean {
  if (cells.length < 2) return false;
  if (!cells.every((c: any) => c?.type === 'text')) return false;
  // Column header names are short (≤3 words). Long phrases (e.g. "Ver especificación del cliente")
  // are section titles, not column names.
  return cells.some((c: any) => {
    const v = String(c?.value ?? '').trim();
    if (v.split(/\s+/).length > 3) return false;
    return COL_HEADER_RE.test(v);
  });
}

/** Una fila es un sub-encabezado de Conclusiones si es corta y arranca con checkbox o dice Cumple/No cumple */
function looksLikeSubHeader(cells: any[], headerLength: number): boolean {
  if (cells.length === 0 || cells.length >= headerLength) return false;
  return (
    cells[0]?.type === 'checkbox' ||
    cells.some((c: any) => /^(cumple|no cumple|no aplica)$/i.test(String(c?.value ?? '').trim()))
  );
}

/** Una fila es un título incrustado si tiene 1–2 celdas de texto y la siguiente es un encabezado de columna */
function looksLikeEmbeddedTitle(cells: any[], nextCells: any[]): boolean {
  if (cells.length === 0 || cells.length > 2) return false;
  if (!cells.every((c: any) => c?.type === 'text')) return false;
  return looksLikeColumnHeader(nextCells);
}

// ─── Construcción de columnas ────────────────────────────────────────────────

interface SubTableDef {
  title: string;
  headerCells: any[];       // celdas del encabezado de columnas
  subHeaderCells: any[] | null; // celdas de la fila Conclusiones (Cumple/No cumple/No aplica)
  dataRows: any[];          // filas de datos
  /** La sección tenía "Ver especificación del cliente" → el ingeniero puede sobreescribir la spec */
  allowClientSpec: boolean;
}

interface AutoRule {
  resultadoKey: string | null;
  especificacionKey: string | null;
  conclusionKey: string;
}

interface BuildResult {
  columns: TableCatalogColumn[];
  /** índice de la celda raw para cada columna; -1 = calculado (sin dato raw) */
  indices: number[];
  autoRule: AutoRule | null;
}

/**
 * Construye columnas a partir de una sub-tabla detectada.
 *
 * Cuando existe una columna "Conclusiones", en lugar de expandirla en múltiples
 * checkboxes (Cumple / No cumple / No aplica), se genera UNA sola columna
 * tipo pass_fail y se devuelve una AutoRule para calcularla automáticamente
 * comparando Resultado vs Especificación de cada fila.
 */
function buildColumnsFromSubTable(st: SubTableDef): BuildResult {
  const { headerCells, dataRows } = st;

  // Detectar columnas con checkboxes en los datos
  const checkboxCols = new Set<number>();
  for (const row of dataRows) {
    getRowCells(row).forEach((cell: any, idx: number) => {
      if (cell?.type === 'checkbox') checkboxCols.add(idx);
    });
  }

  // Posición de "Conclusiones" en el header
  const conclusionesIdx = headerCells.findIndex((c: any) =>
    /conclusiones/i.test(String(c?.value ?? ''))
  );
  const hasConclusiones = conclusionesIdx >= 0;

  const columns: TableCatalogColumn[] = [];
  const indices: number[] = [];
  let resultadoKey: string | null = null;
  let especificacionKey: string | null = null;
  let conclusionKey: string | null = null;

  headerCells.forEach((hCell: any, origIdx: number) => {
    const hText = String(hCell?.value ?? '').trim();
    if (!hText) return;

    if (hasConclusiones && origIdx === conclusionesIdx) {
      // Reemplazar columna Conclusiones (multi-checkbox) por una sola pass_fail calculada
      const key = 'conclusion';
      conclusionKey = key;
      columns.push({
        key,
        label: 'Conclusión',
        type: 'pass_fail',
        unit: null,
        required: false,
        expectedValue: null,
      });
      indices.push(-1); // sin dato raw: se calcula en runtime
    } else {
      const rawKey = hText.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30);
      const key = rawKey || `col_${Math.random().toString(36).slice(2, 6)}`;

      // Extraer unidad del label si está entre paréntesis: "Resultado (%)" → label="Resultado", unit="%"
      const unitInLabel = hText.match(/\(\s*([^)]{1,15})\s*\)\s*$/);
      const colUnit = unitInLabel ? unitInLabel[1].trim() : null;
      const colLabel = unitInLabel ? hText.slice(0, hText.lastIndexOf('(')).trim() : hText;

      // Registrar claves de resultado y especificación para la regla automática
      if (/resultado/i.test(hText)) resultadoKey = key;
      if (/especificaci/i.test(hText)) especificacionKey = key;

      columns.push({
        key,
        label: colLabel,
        type: checkboxCols.has(origIdx) ? 'checkbox' : 'text_input',
        unit: colUnit,
        required: false,
        expectedValue: null,
      });
      indices.push(origIdx);
    }
  });

  const autoRule: AutoRule | null =
    hasConclusiones && conclusionKey
      ? { resultadoKey, especificacionKey, conclusionKey }
      : null;

  return { columns, indices, autoRule };
}

// ─── Extractor de sub-tablas ─────────────────────────────────────────────────

/**
 * Recibe una sección de tipo "table" y devuelve una lista de sub-tablas.
 *
 * Maneja dos casos:
 * 1. section.headers son los encabezados reales → una sola sub-tabla
 * 2. section.headers es la fila-título del Word → columnas están en rows[0],
 *    y puede haber múltiples sub-tablas embebidas en la misma sección
 */
function extractSubTables(section: any): SubTableDef[] {
  const rawHeaders: string[] = section.headers ?? [];
  const headerCellsFromHeaders = rawHeaders.map((h: string) => ({ type: 'text', value: h }));
  const allRows: any[] = section.rows ?? [];

  // CASO 1: section.headers ya son los encabezados de columna
  if (looksLikeColumnHeader(headerCellsFromHeaders)) {
    // "Ver especificación del cliente" podría aparecer mezclado con headers reales (poco probable)
    const allowClientSpec = rawHeaders.some(h => VER_SPEC_RE.test(h ?? ''));
    let subHeaderCells: any[] | null = null;
    let dataStart = 0;
    if (allRows.length > 0) {
      const firstCells = getRowCells(allRows[0]);
      if (looksLikeSubHeader(firstCells, headerCellsFromHeaders.length)) {
        subHeaderCells = firstCells;
        dataStart = 1;
      }
    }
    return [{
      title: section.title ?? 'Tabla',
      headerCells: headerCellsFromHeaders,
      subHeaderCells,
      dataRows: allRows.slice(dataStart),
      allowClientSpec,
    }];
  }

  // CASO 2: section.headers es la fila-título → extraer sub-tablas de las filas
  // "Ver especificación del cliente" aparece como 2.° header → detectar y filtrar del título
  const sectionAllowClientSpec = rawHeaders.some(h => VER_SPEC_RE.test(h ?? ''));
  const sectionTitle = rawHeaders
    .filter(h => h?.trim() && !VER_SPEC_RE.test(h))
    .join(' — ') || section.title || 'Tabla';

  const result: SubTableDef[] = [];
  let pos = 0;
  let currentTitle = sectionTitle;
  // Heredado por todas las sub-tablas de la sección; los títulos incrustados pueden reforzarlo
  let currentAllowClientSpec = sectionAllowClientSpec;

  while (pos < allRows.length) {
    const cells = getRowCells(allRows[pos]);
    const nextCells = pos + 1 < allRows.length ? getRowCells(allRows[pos + 1]) : [];

    if (looksLikeEmbeddedTitle(cells, nextCells)) {
      // Fila título incrustada: guardar título (sin la frase VER_SPEC) y avanzar
      const titleParts = cells
        .map((c: any) => String(c?.value ?? ''))
        .filter(Boolean);
      currentAllowClientSpec = sectionAllowClientSpec || titleParts.some(t => VER_SPEC_RE.test(t));
      currentTitle = titleParts.filter(t => !VER_SPEC_RE.test(t)).join(' — ') || 'Tabla';
      pos++;
    } else if (looksLikeColumnHeader(cells)) {
      // Encabezado de columnas → iniciar nueva sub-tabla
      const headerCells = cells;
      pos++;

      // ¿Hay sub-encabezado de Conclusiones?
      let subHeaderCells: any[] | null = null;
      if (pos < allRows.length) {
        const nextRowCells = getRowCells(allRows[pos]);
        if (looksLikeSubHeader(nextRowCells, headerCells.length)) {
          subHeaderCells = nextRowCells;
          pos++;
        }
      }

      // Recopilar filas de datos hasta la próxima frontera
      const dataRows: any[] = [];
      while (pos < allRows.length) {
        const rowCells = getRowCells(allRows[pos]);
        const nextNextCells = pos + 1 < allRows.length ? getRowCells(allRows[pos + 1]) : [];

        if (looksLikeColumnHeader(rowCells)) break;
        if (looksLikeEmbeddedTitle(rowCells, nextNextCells)) break;

        dataRows.push(allRows[pos]);
        pos++;
      }

      result.push({
        title: currentTitle,
        headerCells,
        subHeaderCells,
        dataRows,
        allowClientSpec: currentAllowClientSpec,
      });
      currentTitle = 'Tabla';
      currentAllowClientSpec = sectionAllowClientSpec; // reset al nivel de sección
    } else {
      // Fila no clasificable → saltar
      pos++;
    }
  }

  return result;
}

// ─── Convertidor principal ───────────────────────────────────────────────────

function subTableToEntry(st: SubTableDef, sysType: string): TableCatalogEntry {
  const { columns, indices, autoRule } = buildColumnsFromSubTable(st);

  const templateRows: TableCatalogRow[] = st.dataRows.map((row: any, i: number) => {
    const cells = getRowCells(row);
    return {
      rowId: row?.id ?? `row_${i}`,
      cells: Object.fromEntries(
        columns.map((col, j) => [
          col.key,
          // índice -1 = columna calculada (sin valor raw); la rellena el runtime
          indices[j] === -1 ? null : getCellValue(cells[indices[j]]),
        ])
      ),
    };
  });

  // Regla automática: si hay Conclusiones, comparar Resultado vs Especificación
  const validationRules: TableCatalogRule[] = [];
  if (autoRule && autoRule.resultadoKey && autoRule.especificacionKey) {
    validationRules.push({
      ruleId: `rule_${Math.random().toString(36).slice(2, 10)}`,
      description: 'Auto: compara Resultado vs Especificación del template → Conclusión',
      sourceColumn: autoRule.resultadoKey,
      operator: 'vs_spec',
      factoryThreshold: autoRule.especificacionKey, // referencia legible; el runtime usa specColumn
      specColumn: autoRule.especificacionKey,
      unit: null,
      targetColumn: autoRule.conclusionKey,
      valueIfPass: 'Cumple',
      valueIfFail: 'No cumple',
    });
  }

  return {
    id: '',
    name: st.title,
    description: null,
    sysType,
    isDefault: false,
    tableType: autoRule ? 'validation' : 'informational',
    columns,
    templateRows,
    validationRules,
    allowClientSpec: st.allowClientSpec || undefined,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  };
}

/** Devuelve una lista de TableCatalogEntry (puede ser más de una por sección si hay sub-tablas) */
function mapSection(section: any, sysType: string): TableCatalogEntry[] {
  if (section.type === 'signatures') return [];

  if (section.type === 'text') {
    return [{
      id: '',
      name: section.title ?? 'Texto',
      description: section.content ?? null,
      sysType,
      isDefault: false,
      tableType: 'informational',
      columns: [{ key: 'contenido', label: 'Contenido', type: 'text_input', required: false, unit: null, expectedValue: null }],
      templateRows: [],
      validationRules: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
    }];
  }

  if (section.type === 'checklist') {
    const items: any[] = Array.isArray(section.items) ? section.items : [];
    return [{
      id: '',
      name: section.title ?? 'Checklist',
      description: null,
      sysType,
      isDefault: false,
      tableType: 'informational',
      columns: [
        { key: 'item', label: 'Ítem', type: 'text_input', required: false, unit: null, expectedValue: null },
        { key: 'estado', label: 'Estado', type: 'pass_fail', required: true, unit: null, expectedValue: null },
      ],
      templateRows: items.map((item: any, i: number) => ({
        rowId: item?.id ?? `item_${i}`,
        cells: {
          item: typeof item === 'string' ? item : (item?.label ?? item?.value ?? ''),
          estado: null,
        },
      })),
      validationRules: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
    }];
  }

  if (section.type === 'table') {
    const subTables = extractSubTables(section);
    return subTables
      .filter(st => st.headerCells.length > 0)
      .map(st => subTableToEntry(st, sysType))
      .filter(e => e.columns.length > 0);
  }

  return [];
}

// ─── Componente ──────────────────────────────────────────────────────────────

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
      // flatMap porque mapSection puede devolver múltiples entradas por sección
      const tables = (raw.template.sections as any[]).flatMap(s => mapSection(s, sysType));
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
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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
              Se encontraron <strong>{preview.length}</strong> tabla(s). Revisá los nombres y la estructura antes de importar:
            </p>
            <div className="space-y-4">
              {preview.map((t, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Nombre editable */}
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-500 shrink-0">{i + 1}.</span>
                    <input type="text" value={t.name}
                      onChange={e => updatePreviewName(i, e.target.value)}
                      className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm font-bold" />
                    <span className="text-xs text-slate-400 shrink-0">
                      {t.tableType} · {t.columns.length} cols · {t.templateRows.length} filas
                    </span>
                  </div>
                  {/* Mini-preview de la tabla */}
                  {t.columns.length > 0 && (
                    <div className="p-2 overflow-x-auto max-h-48 overflow-y-auto">
                      <TablePreview table={t} />
                    </div>
                  )}
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
