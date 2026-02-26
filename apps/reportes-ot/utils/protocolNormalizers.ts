/**
 * Normalizadores de plantillas de protocolo (V2).
 * Aplican reglas por familia (HPLC, Checklist, etc.) para homogeneizar
 * layout, columnWidths y checkboxGroup en tablas convertidas desde Word.
 */

import type {
  ProtocolTemplateDoc,
  ProtocolSection,
  ProtocolTableSection,
  ProtocolTableRow,
  ProtocolTableCell,
  ProtocolTextSection,
} from '../types';

const COLUMN_WIDTHS_COMPOSITE = ['38%', '14%', '18%', '10%', '10%', '10%'] as const;

function isTableSection(s: ProtocolSection): s is ProtocolTableSection {
  return s.type === 'table';
}

function getCellText(cell: ProtocolTableCell): string {
  if (cell.type === 'text') return String(cell.value ?? '').trim();
  return '';
}

/**
 * Lee texto visible desde una celda (para detección de títulos/headers).
 * - text: value
 * - checkbox: checkboxLabel (para que "Ver especificación del cliente" matchee)
 * - input: value
 * Normaliza whitespace (\\s+ → espacio) para que "Ver especificación\\ndel cliente" matchee.
 */
function getCellTextLoose(cell: ProtocolTableCell): string {
  if (!cell) return '';
  if (cell.type === 'text') return String(cell.value ?? '').replace(/\s+/g, ' ').trim();
  if (cell.type === 'checkbox')
    return String((cell as { checkboxLabel?: string }).checkboxLabel ?? '').replace(/\s+/g, ' ').trim();
  if ((cell as { type?: string }).type === 'input')
    return String((cell as { value?: unknown }).value ?? '').replace(/\s+/g, ' ').trim();
  return String((cell as { value?: unknown }).value ?? '').replace(/\s+/g, ' ').trim();
}

/** Palabras que indican fila de header de tabla (Parámetro|Resultado|Conclusiones). No incluir "especificación" para no excluir "Ver especificación del cliente". */
const HEADER_WORDS_TITLE_RAW = ['parámetro', 'resultado', 'conclusiones'];

/** Fila cruda que es título de test (ej. "Test de Exactitud canal B", "Test de Holmio…"). No es header Parámetro/Resultado/… */
function isTitleRowRaw(row: ProtocolTableRow): boolean {
  const cells = row.cells ?? [];
  if (cells.length === 0) return false;
  const rowText = cells.map((c) => getCellTextLoose(c)).join(' ').trim().toLowerCase();
  if (!rowText || !rowText.includes('test de')) return false;
  if (HEADER_WORDS_TITLE_RAW.some((w) => rowText.includes(w))) return false;
  return true;
}

/** Extrae título de una fila título cruda; quita "Ver especificación del cliente". */
function extractTitleFromTitleRow(row: ProtocolTableRow): string {
  const cells = row.cells ?? [];
  const rowText = cells.map((c) => getCellTextLoose(c)).join(' ').trim();
  const cleaned = rowText
    .replace(/\s*ver\s+especificaci[oó]n(\s+del\s+cliente)?\s*/gi, '')
    .trim();
  return cleaned || 'Test';
}

/**
 * Para sec_19: fila que parece título de sección (igual formato que Tabla 20/21) pero sin exigir "test de".
 * Incluye: 1 celda header, o 2 celdas (título + checkbox). Excluye header 4 celdas, subheader 3 celdas y filas de datos.
 */
function isSectionTitleLikeRowSec19(row: ProtocolTableRow): boolean {
  const cells = row.cells ?? [];
  if (cells.length === 0) return false;
  const rowText = cells.map((c) => getCellTextLoose(c)).join(' ').trim().toLowerCase();
  if (HEADER_WORDS_TITLE_RAW.some((w) => rowText.includes(w))) return false;
  const first = cells[0] as { variant?: string; colSpan?: number };
  if (first?.variant !== 'header') return false;
  const colSpan = first?.colSpan ?? 1;
  if (cells.length === 1) return true;
  if (cells.length === 2 && colSpan >= 4) return true;
  if (cells.length === 4 && rowText.includes('conclusiones')) return false;
  if (cells.length === 3 && rowText.includes('no cumple') && rowText.includes('no aplica')) return false;
  if (cells.length >= 6 && cells.slice(-3).every((c) => c.type === 'checkbox')) return false;
  return cells.length <= 2;
}

const RE_VER_ESPECIFICACION = /ver\s+especificaci[oó]n(\s+del\s+cliente)?/i;
const verSpecPattern = /ver\s+especificaci[oó]n(\s+del\s+cliente)?/i;

/**
 * Detector de "title row" para sec_18/sec_19 (no basado solo en headers[]).
 * Detecta como título si:
 * A) 1 celda texto con colSpan >= 4 y value incluye "Test de"
 * B) 2 celdas donde la segunda (value o checkboxLabel) matchea /ver\s+especificaci[oó]n(\s+del\s+cliente)?/i
 * C) 2 celdas con cell0.variant === 'header', colSpan >= 4, y cell1 es checkbox o texto "Ver especificación..."
 */
function isTitleRowComposite(row: ProtocolTableRow): boolean {
  const cells = row.cells ?? [];
  if (cells.length === 0) return false;
  const n = cells.length;
  const texts = cells.map((c) => getCellTextLoose(c));
  const rowText = texts.join(' ').trim().toLowerCase();
  if (HEADER_WORDS_TITLE_RAW.some((w) => rowText.includes(w))) return false;
  if (n === 4 && rowText.includes('conclusiones')) return false;
  if (n === 3 && rowText.includes('no cumple') && rowText.includes('no aplica')) return false;
  if (n >= 6 && cells.slice(-3).every((c) => c.type === 'checkbox')) return false;

  const c0 = cells[0] as { type?: string; value?: unknown; variant?: string; colSpan?: number };
  const c1 = cells[1] as { type?: string; value?: unknown; checkboxLabel?: string } | undefined;
  const cell0ColSpan = c0?.colSpan ?? 1;
  const cell0Value = c0?.type === 'text' ? String(c0?.value ?? '').trim() : '';

  if (n === 1) {
    return c0?.type === 'text' && cell0ColSpan >= 4 && /test de/i.test(cell0Value);
  }
  if (n === 2) {
    const secondText = c1?.type === 'text'
      ? String(c1?.value ?? '').trim()
      : c1?.type === 'checkbox'
        ? String(c1?.checkboxLabel ?? '').trim()
        : '';
    if (RE_VER_ESPECIFICACION.test(secondText)) return true;
    if (c0?.variant === 'header' && cell0ColSpan >= 4 && (c1?.type === 'checkbox' || RE_VER_ESPECIFICACION.test(secondText)))
      return true;
  }
  return false;
}

/**
 * Tabla descriptiva de ensayos: 5 columnas INSTRUCTIVO APLICABLE, TEST, PARÁMETRO, ESPECIFICACIÓN, NUEVA ESPECIFICACIÓN.
 * No debe tratarse como tabla de resultados (sin conclusiones / Cumple–No cumple–No aplica).
 */
function isDescriptiveEnsayosTable(section: ProtocolTableSection): boolean {
  const headers = (section.headers ?? []).map((h) => String(h ?? '').toLowerCase());
  if (headers.length < 5) return false;
  const hasInstructivo = headers.some((h) => /instructivo\s+aplicable\s*\(\s*1\s*\)|instructivo\s+aplicable\s*1/i.test(h));
  const hasTest = headers.some((h) => /^\s*test\s*$/i.test(h.trim()));
  const hasParametro = headers.some((h) => /parámetro|parametro/i.test(h));
  const hasEspecificacion = headers.some((h) => /especificación|especificacion/i.test(h) && !/nueva\s+especificación|nueva\s+especificacion/i.test(h));
  const hasNuevaSpec = headers.some((h) => /nueva\s+especificación|nueva\s+especificacion/i.test(h));
  if (hasInstructivo && hasTest && hasParametro && (hasEspecificacion || hasNuevaSpec) && hasNuevaSpec)
    return true;
  if (section.id === 'sec_8' || section.id === 'sec_9' || section.id === 'sec_10') {
    const hasQi = (section.rows ?? []).some((r) =>
      (r.cells ?? []).some((c) => c.type === 'text' && /QI7\.05\d{2}/i.test(getCellText(c)))
    );
    if (hasQi) return true;
  }
  return false;
}

/**
 * Detecta si la tabla es "compuesta" tipo Resultados/Conclusiones: varios bloques con
 * fila gris de título, encabezado Parámetro/Resultado/Especificación/Conclusiones,
 * sub-encabezado Cumple/No cumple/No aplica y filas de datos (longitudes 2, 3, 4 y 6 celdas).
 *
 * Heurística: sec_18/sec_19 por id; o en headers/primera fila existe "Conclusiones" y
 * (No cumple + No aplica) o "Cumple", más fila 2 celdas "Ver especificación" o layout 6 columnas.
 * NO aplicamos a sec_8/sec_9/sec_10 ni a tablas descriptivas (5 cols INSTRUCTIVO/TEST/PARÁMETRO/ESPEC/NUEVA ESPEC)
 * porque esas son tablas de ensayos descriptivos sin conclusiones Cumple–No cumple–No aplica.
 */
function isCompositeConclusionesTable(section: ProtocolTableSection): boolean {
  if (section.id === 'sec_8' || section.id === 'sec_9' || section.id === 'sec_10') return false;
  if (isDescriptiveEnsayosTable(section)) return false;
  if (section.id === 'sec_18' || section.id === 'sec_19') return true;
  const rows = section.rows ?? [];
  let hasTwoCellTitle = false;
  let hasFourCellConclusiones = false;
  let hasThreeCellSubheader = false;
  let hasSixCellWithCheckboxes = false;

  for (const row of rows) {
    const cells = row.cells ?? [];
    const n = cells.length;
    const texts = cells.map(getCellText);
    const hasVerEspecificacion = texts.some((t) =>
      /ver especificación del cliente/i.test(t)
    );
    const hasConclusiones = texts.some((t) =>
      /conclusiones/i.test(t)
    );
    const hasNoCumpleNoAplica =
      texts.some((t) => /no cumple/i.test(t)) &&
      texts.some((t) => /no aplica/i.test(t));
    const lastThreeCheckboxes =
      n >= 6 &&
      cells.slice(-3).every((c) => c.type === 'checkbox');

    if (n === 2 && hasVerEspecificacion) hasTwoCellTitle = true;
    if (n === 4 && hasConclusiones) hasFourCellConclusiones = true;
    if (n === 3 && hasNoCumpleNoAplica) hasThreeCellSubheader = true;
    if (lastThreeCheckboxes) hasSixCellWithCheckboxes = true;
  }

  const headersStr = (section.headers ?? []).join(' ').toLowerCase();
  const headersAsTitle =
    section.headers?.length === 2 &&
    /ver especificación del cliente/i.test(section.headers[1] ?? '');

  return (
    (hasTwoCellTitle || headersAsTitle) &&
    hasFourCellConclusiones &&
    hasThreeCellSubheader &&
    hasSixCellWithCheckboxes
  );
}

/**
 * Schema fijo 6 columnas: 0=Parámetro, 1=Resultado, 2=Especificación, 3..5=Conclusiones (checkbox).
 * Estructura obligatoria: Conclusiones = siempre 3 columnas (Cumple | No cumple | No aplica).
 * Si en el origen falta "Cumple", se añade aquí como primera columna del grupo.
 */

function makeRowHeaderCells(): ProtocolTableCell[] {
  return [
    { type: 'text', value: 'Parámetro', variant: 'subheader' },
    { type: 'text', value: 'Resultado', variant: 'subheader' },
    { type: 'text', value: 'Especificación', variant: 'subheader' },
    { type: 'text', value: 'Conclusiones', colSpan: 3, variant: 'subheader' },
  ];
}

function makeRowConclusionesSubheader(): ProtocolTableCell[] {
  return [
    { type: 'text', value: '', variant: 'note' },
    { type: 'text', value: '', variant: 'note' },
    { type: 'text', value: '', variant: 'note' },
    { type: 'text', value: 'Cumple', variant: 'subheader' },
    { type: 'text', value: 'No cumple', variant: 'subheader' },
    { type: 'text', value: 'No aplica', variant: 'subheader' },
  ];
}

/*
 * Ejemplo de fila subheader cruda que debe corregirse a 6 textos (vacíos + Cumple + No cumple + No aplica):
 *   cells: [
 *     { type: 'checkbox', value: false },                    // sin checkboxLabel → getCellTextLoose '' 
 *     { type: 'checkbox', value: false, checkboxLabel: 'No cumple' },
 *     { type: 'checkbox', value: false, checkboxLabel: 'No aplica' },
 *   ]
 * Tras normalizar (o ensureCompositeConclusionesIntegrity), esa fila debe ser makeRowConclusionesSubheader().
 */

/** Headers reales para tablas resultado/conclusiones (6 columnas). "Conclusiones" es grupo visual colSpan=3 en thead. */
const HEADERS_RESULTADOS_6 = [
  'Parámetro',
  'Resultado',
  'Especificación',
  'Cumple',
  'No cumple',
  'No aplica',
] as const;

/**
 * Quita "Ver especificación del cliente" y los nombres de detectores (VWD/MWD/DAD/RID) del título
 * del header para evitar duplicados; esos elementos tienen su propia celda o fila.
 */
function cleanTitleHeader(titulo: string): string {
  if (!titulo || typeof titulo !== 'string') return titulo;
  let t = titulo
    .replace(/\s*:\s*ver\s+especificación\s+del\s+cliente\s*/gi, ':')
    .replace(/\s+ver\s+especificación\s+del\s+cliente\s*/gi, '')
    .replace(/\s*vwd\s*\/?\s*mwd\s*\/?\s*dad\s*\/?\s*rid\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/**
 * Indica si en esta sección debe insertarse la fila de detectores inline (VWD ☐ MWD ☐ DAD ☐ RID ☐).
 * Se basa en el contenido (headers + valores de celdas), no en el id de la sección.
 */
function shouldInsertDetectorsInline(section: ProtocolTableSection): boolean {
  const haystack = [
    ...(section.headers ?? []),
    ...(section.rows ?? []).flatMap((r) =>
      (r.cells ?? []).map((c) => (typeof c.value === 'string' ? c.value : ''))
    ),
  ]
    .join(' ')
    .toLowerCase();
  const hasDetectorPhrase = haystack.includes('detector con el que se realiza el test');
  const hasAllDetectors =
    haystack.includes('vwd') &&
    haystack.includes('mwd') &&
    haystack.includes('dad') &&
    haystack.includes('rid');
  return hasDetectorPhrase || hasAllDetectors;
}

/** Título en 2 líneas si contiene ":" (fidelidad Word). */
function formatTitleTwoLines(titulo: string): string {
  const cleaned = cleanTitleHeader(titulo);
  if (!cleaned || !cleaned.includes(':')) return cleaned;
  const [a, b] = cleaned.split(':');
  return `${(a ?? '').trim()}:\n${(b ?? '').trim()}`;
}

/**
 * Fila gris de título de bloque (sec_18/sec_19): 2 celdas — título (colSpan 4) + checkbox "Ver especificación del cliente" (colSpan 2).
 * Persistencia por (rowId, cellKey "1"). checkboxGroup por fila para que cada bloque tenga su propio checkbox.
 */
function makeGreyTitleRowCells(
  title: string,
  checked: boolean,
  rowId: string
): ProtocolTableCell[] {
  return [
    {
      type: 'text',
      value: formatTitleTwoLines(title.trim() || 'Test'),
      colSpan: 4,
      variant: 'header',
    },
    {
      type: 'checkbox',
      value: checked,
      checkboxLabel: 'Ver especificación\ndel cliente',
      variant: 'header',
      colSpan: 2,
      checkboxGroup: { groupId: `client_spec_${rowId}`, option: 'ver_especificacion' },
    },
  ];
}

function makeRowData(
  rowId: string,
  sectionId: string,
  param: string,
  resultado: string,
  espec: string,
  cumple: boolean,
  noCumple: boolean,
  noAplica: boolean
): ProtocolTableCell[] {
  const groupId = `${sectionId}_${rowId}_conclusiones`;
  const resultadoEmpty = !String(resultado ?? '').trim();
  return [
    { type: 'text', value: param ?? '', editable: false },
    {
      type: 'text',
      value: resultado ?? '',
      editable: resultadoEmpty,
      defaultValue: resultado ?? '',
    },
    {
      type: 'text',
      value: espec ?? '',
      readOnly: true,
      editable: false,
      defaultValue: espec ?? '',
    },
    { type: 'checkbox', value: cumple, checkboxGroup: { groupId, option: 'cumple' } },
    { type: 'checkbox', value: noCumple, checkboxGroup: { groupId, option: 'no_cumple' } },
    { type: 'checkbox', value: noAplica, checkboxGroup: { groupId, option: 'no_aplica' } },
  ];
}

/**
 * Repara una sección compuesta ya normalizada: asegura que toda fila subheader de conclusiones
 * (3 celdas con "No cumple" y "No aplica", detectadas con getCellTextLoose) se reemplace por
 * la fila de 6 celdas con textos "Cumple | No cumple | No aplica". No se aplica a tablas descriptivas.
 * Siempre fuerza headers: [].
 */
function ensureCompositeConclusionesIntegrity(
  section: ProtocolTableSection
): ProtocolTableSection {
  if (isDescriptiveEnsayosTable(section)) return section;
  const rows = section.rows ?? [];
  const out: ProtocolTableRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.cells ?? [];
    const n = cells.length;
    const textsLoose = cells.map(getCellTextLoose);
    const hasNoCumple = textsLoose.some((t) => /no cumple/i.test(t));
    const hasNoAplica = textsLoose.some((t) => /no aplica/i.test(t));

    // Fila gris de título: 1 celda de texto header que incluye "ver especificación" (o variantes mayúsculas/sin tilde) → 2 celdas (título sin sufijo + checkbox)
    const oneCell = cells[0];
    const oneCellValue = String((oneCell as { value?: string })?.value ?? '').trim();
    const hasVerEspecificacionInText = /ver\s+especificaci[oó]n(\s+del\s+cliente)?/i.test(oneCellValue);
    const isGreyTitleWithVerSpecInText =
      n === 1 &&
      oneCell?.type === 'text' &&
      oneCell?.variant === 'header' &&
      hasVerEspecificacionInText;
    if (isGreyTitleWithVerSpecInText) {
      const title =
        oneCellValue
          .replace(/\s*ver\s+especificaci[oó]n(\s+del\s+cliente)?\s*/gi, '')
          .trim() || 'Test';
      out.push({
        id: row.id,
        cells: makeGreyTitleRowCells(title, false, row.id),
      });
      continue;
    }

    // Fila gris de título con 1 sola celda (sin checkbox) → reconstruir con título + checkbox; quitar "ver especificación…" del título si viene en el texto.
    const isGreyTitleSingleCell =
      n === 1 &&
      (row.id?.includes('_grey') ||
        (cells[0].variant === 'header' && (cells[0].colSpan ?? 0) >= 4));
    if (isGreyTitleSingleCell) {
      let title =
        getCellTextLoose(cells[0]) ||
        String((cells[0] as { value?: string }).value ?? '').trim() ||
        'Test';
      title = title.replace(/\s*ver\s+especificaci[oó]n(\s+del\s+cliente)?\s*/gi, '').trim() || 'Test';
      out.push({
        id: row.id,
        cells: makeGreyTitleRowCells(title, false, row.id),
      });
      continue;
    }

    // Subheader candidata: 3 celdas con "No cumple" y "No aplica" (no exigimos "Cumple")
    if (n === 3 && hasNoCumple && hasNoAplica) {
      out.push({ id: row.id, cells: makeRowConclusionesSubheader() });
      continue;
    }

    // sec_19 header combinado raro: 6 celdas con Conclusiones + No cumple/No aplica pero sin 3 checkboxes al final
    const hasConclusiones = textsLoose.some((t) => /conclusiones/i.test(t));
    const lastThreeCheckboxes = n === 6 && cells.slice(-3).every((c) => c.type === 'checkbox');
    if (
      n === 6 &&
      hasConclusiones &&
      (hasNoCumple || hasNoAplica) &&
      !lastThreeCheckboxes
    ) {
      out.push({ id: `${row.id}_h`, cells: makeRowHeaderCells() });
      out.push({ id: `${row.id}_s`, cells: makeRowConclusionesSubheader() });
      continue;
    }

    out.push(row);
  }

  return {
    ...section,
    headers: [],
    rows: out,
  };
}

/**
 * Normalizador estructural para tablas compuestas tipo Resultados/Conclusiones (ej. sec_18, sec_19 = Tabla 20).
 * Arma la misma estructura en TBODY: fila gris (título + Ver especificación), encabezado Parámetro|Resultado|Especificación|Conclusiones,
 * subencabezado Cumple|No cumple|No aplica, filas de datos 6 columnas.
 * Para sec_19: headers = [] para que NO haya thead global; la estructura vive solo en el body (igual que Tabla 20).
 */
function normalizeCompositeConclusionesTable(
  section: ProtocolTableSection
): ProtocolTableSection {
  if (isAlreadyCompositeNormalized(section)) return ensureCompositeConclusionesIntegrity(section);
  const isSec19 = section.id === 'sec_19';
  const rows = section.rows ?? [];
  const newRows: ProtocolTableRow[] = [];
  let rowIndex = 0;
  const useMultiBlock = isSec19 || section.id === 'sec_18';

  // Modo multibloque (sec_19/sec_18): un bloque por cada título detectado; header/subheader normalizados; consumir crudos de Word.
  if (useMultiBlock) {
    const outRows: ProtocolTableRow[] = [];
    let blockIndex = -1;
    let startedBlock = false;
    let skipNextHeader = false;
    let skipNextSubheader = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.cells ?? [];
      const n = cells.length;
      const texts = cells.map(getCellTextLoose);

      const isTitleRow = isTitleRowComposite(row);

      if (isTitleRow) {
        blockIndex++;
        startedBlock = true;
        const title = extractTitleFromTitleRow(row);
        const greyId = `row_${blockIndex}_grey`;
        outRows.push({
          id: greyId,
          cells: makeGreyTitleRowCells(title, false, greyId),
        });
        outRows.push({ id: `row_${blockIndex}_h`, cells: makeRowHeaderCells() });
        outRows.push({ id: `row_${blockIndex}_s`, cells: makeRowConclusionesSubheader() });
        skipNextHeader = true;
        skipNextSubheader = true;
        continue;
      }
      const looksLikeHeaderRow =
        n === 4 && texts.some((t) => /conclusiones/i.test(t));
      const looksLikeHeaderRow6 =
        n === 6 &&
        texts.some((t) => /conclusiones/i.test(t)) &&
        texts.some((t) => /parámetro|parametro/i.test(t));
      if (skipNextHeader && (looksLikeHeaderRow || looksLikeHeaderRow6)) {
        skipNextHeader = false;
        continue;
      }
      if (
        skipNextSubheader &&
        n === 3 &&
        texts.some((t) => /no cumple/i.test(t)) &&
        texts.some((t) => /no aplica/i.test(t))
      ) {
        skipNextSubheader = false;
        continue;
      }
      if (!startedBlock) continue;

      const dataRowId = `row_${blockIndex}__${row.id}`;
      if (n >= 6 && cells.slice(-3).every((c) => c.type === 'checkbox')) {
        const param = getCellText(cells[0]);
        const resultado = getCellText(cells[1]);
        const espec = getCellText(cells[2]);
        const lastThree = cells.slice(-3);
        outRows.push({
          id: dataRowId,
          cells: makeRowData(
            dataRowId,
            section.id,
            param,
            resultado,
            espec,
            lastThree[0]?.value === true,
            lastThree[1]?.value === true,
            lastThree[2]?.value === true
          ),
        });
        continue;
      }
      if (n === 3 && !texts.some((t) => /no aplica/i.test(t))) {
        const param = getCellText(cells[0]);
        const resultado = getCellText(cells[1]);
        const espec = getCellText(cells[2]);
        outRows.push({
          id: dataRowId,
          cells: makeRowData(
            dataRowId,
            section.id,
            param,
            resultado,
            espec,
            false,
            false,
            false
          ),
        });
        continue;
      }
      if (n > 0 && n < 6) {
        const param = getCellText(cells[0]);
        const resultado = n > 1 ? getCellText(cells[1]) : '';
        const espec = n > 2 ? getCellText(cells[2]) : '';
        outRows.push({
          id: dataRowId,
          cells: makeRowData(
            dataRowId,
            section.id,
            param,
            resultado,
            espec,
            false,
            false,
            false
          ),
        });
      } else if (n >= 6) {
        const param = getCellText(cells[0]);
        const resultado = getCellText(cells[1]);
        const espec = getCellText(cells[2]);
        const c3 = cells[3];
        const c4 = cells[4];
        const c5 = cells[5];
        outRows.push({
          id: dataRowId,
          cells: makeRowData(
            dataRowId,
            section.id,
            param,
            resultado,
            espec,
            c3?.type === 'checkbox' ? c3.value === true : false,
            c4?.type === 'checkbox' ? c4.value === true : false,
            c5?.type === 'checkbox' ? c5.value === true : false
          ),
        });
      }
    }

    if (blockIndex >= 0) {
      if (shouldInsertDetectorsInline(section) && !outRows.some((r) => r.id === 'row_detectors_inline')) {
        const idx = outRows.findIndex((r) => r.id === 'row_0_grey');
        const insertAt = idx >= 0 ? idx + 1 : outRows.length;
        const detectorsRow: ProtocolTableRow = {
          id: 'row_detectors_inline',
          cells: [
            {
              type: 'text' as const,
              value: '',
              colSpan: 6,
              variant: 'subheader' as const,
              inline: [
                { kind: 'text' as const, text: 'VWD' },
                { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'vwd', label: '' },
                { kind: 'text' as const, text: 'MWD' },
                { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'mwd', label: '' },
                { kind: 'text' as const, text: 'DAD' },
                { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'dad', label: '' },
                { kind: 'text' as const, text: 'RID' },
                { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'rid', label: '' },
              ],
            },
          ],
        };
        outRows.splice(insertAt, 0, detectorsRow);
      }
      const isRowEmpty = (r: ProtocolTableRow): boolean => {
        const cells = r.cells ?? [];
        if (cells.some((c) => Array.isArray((c as { inline?: unknown[] }).inline) && (c as { inline: unknown[] }).inline.length > 0))
          return false;
        if (cells.some((c) => (c as { variant?: string }).variant === 'header'))
          return false;
        return cells.every((cell) => {
          if (cell.type === 'text') return !String(cell.value ?? '').trim();
          if (cell.type === 'checkbox') return cell.value !== true;
          return true;
        });
      };
      const rowsFiltered = outRows.filter((r) => !isRowEmpty(r));
      return {
        ...section,
        layout: 'fixed',
        columnWidths: [...COLUMN_WIDTHS_COMPOSITE],
        headers: [],
        rows: rowsFiltered,
      };
    }
  }

  // Comportamiento legacy: primera fila gris desde headers, luego bucle normal.
  let initialTitle = (section.headers ?? [])[0] ?? '';
  if (!initialTitle.trim()) {
    const firstTwoCell = rows.find((r) => {
      const c = r.cells ?? [];
      if (c.length !== 2) return false;
      return c.some((cell) =>
        /ver\s+especificaci[oó]n(\s+del\s+cliente)?/i.test(getCellTextLoose(cell))
      );
    });
    if (firstTwoCell?.cells?.[0])
      initialTitle = getCellTextLoose(firstTwoCell.cells[0]) || initialTitle;
  }
  const firstTwoCellRow = rows.find((r) => {
    const c = r.cells ?? [];
    if (c.length !== 2) return false;
    return c.some((cell) =>
      /ver\s+especificaci[oó]n(\s+del\s+cliente)?/i.test(getCellTextLoose(cell))
    );
  });
  const verSpecChecked =
    firstTwoCellRow?.cells?.[1]?.type === 'checkbox' &&
    firstTwoCellRow.cells[1].value === true;
  const firstGreyId = `row_${rowIndex++}_grey`;
  newRows.push({
    id: firstGreyId,
    cells: makeGreyTitleRowCells(initialTitle || 'Test', verSpecChecked, firstGreyId),
  });

  if (shouldInsertDetectorsInline(section)) {
    if (!newRows.some((r) => r.id === 'row_detectors_inline')) {
      const idx = newRows.findIndex((r) => r.id === 'row_0_grey');
      const insertAt = idx >= 0 ? idx + 1 : newRows.length;
      const detectorsRow: ProtocolTableRow = {
        id: 'row_detectors_inline',
        cells: [
          {
            type: 'text' as const,
            value: '',
            colSpan: 6,
            variant: 'subheader' as const,
            inline: [
              { kind: 'text' as const, text: 'VWD' },
              { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'vwd', label: '' },
              { kind: 'text' as const, text: 'MWD' },
              { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'mwd', label: '' },
              { kind: 'text' as const, text: 'DAD' },
              { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'dad', label: '' },
              { kind: 'text' as const, text: 'RID' },
              { kind: 'checkbox' as const, groupId: `${section.id}_detectors`, option: 'rid', label: '' },
            ],
          },
        ],
      };
      newRows.splice(insertAt, 0, detectorsRow);
    }
  }
  let initialGreyConsumed = false;
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const cells = row.cells ?? [];
    const n = cells.length;
    const texts = cells.map(getCellTextLoose);

    // Fila de título de bloque (1 celda con "ver especificación" en el valor) → fila gris 2 celdas; título sin "Ver especificación..."
    if (n === 1 && verSpecPattern.test(texts[0] ?? '')) {
      const full = (texts[0] ?? '').trim();
      const titleOnly = cleanTitleHeader(
        full
          .replace(/\s*:\s*ver\s+especificaci[oó]n(\s+del\s+cliente)?\s*/gi, ':')
          .replace(/\s+ver\s+especificaci[oó]n(\s+del\s+cliente)?\s*$/gi, '')
          .trim() || full
      );
      newRows.push({
        id: row.id,
        cells: makeGreyTitleRowCells(titleOnly || 'Test', false, row.id),
      });
      i++;
      continue;
    }

    // Fila de título de bloque (2 celdas) — título en una celda, "Ver especificación" en la otra; robusto por índice
    if (n === 2 && texts.some((t) => verSpecPattern.test(t))) {
      if (section.id === 'sec_19') {
        console.log('[SEC19 TITLE 2-CELL]', row.id, texts);
      }
      const idxVer = texts.findIndex((t) => verSpecPattern.test(t));
      const idxTitle = idxVer === 0 ? 1 : 0;
      const titleText = (texts[idxTitle] ?? '').trim();
      const verSpecChecked =
        cells[idxVer]?.type === 'checkbox' ? (cells[idxVer] as { value?: boolean }).value === true : false;
      if (!initialGreyConsumed && titleText === initialTitle.trim()) {
        initialGreyConsumed = true;
        i++;
        continue;
      }
      newRows.push({
        id: row.id,
        cells: makeGreyTitleRowCells(cleanTitleHeader(titleText || 'Test'), verSpecChecked, row.id),
      });
      i++;
      continue;
    }

    // Encabezado de bloque (4 celdas) → 6 celdas con makeRowHeaderCells
    if (n === 4 && texts.some((t) => /conclusiones/i.test(t))) {
      newRows.push({ id: row.id, cells: makeRowHeaderCells() });
      i++;
      continue;
    }

    // Sub-encabezado Cumple/No cumple/No aplica (3 celdas) → 6 celdas. Detección con getCellTextLoose para cubrir
    // fila cruda tipo [checkbox sin label, checkboxLabel:"No cumple", checkboxLabel:"No aplica"]; se normaliza a makeRowConclusionesSubheader().
    if (
      n === 3 &&
      texts.some((t) => /no cumple/i.test(t)) &&
      texts.some((t) => /no aplica/i.test(t))
    ) {
      newRows.push({
        id: row.id,
        cells: makeRowConclusionesSubheader(),
      });
      i++;
      continue;
    }

    // sec_19: fila "header combinado" rara (6 celdas con Conclusiones + No cumple/No aplica pero no 3 checkboxes al final) → normalizar a header + subheader
    if (
      isSec19 &&
      n === 6 &&
      texts.some((t) => /conclusiones/i.test(t)) &&
      (texts.some((t) => /no cumple/i.test(t)) || texts.some((t) => /no aplica/i.test(t))) &&
      !cells.slice(-3).every((c) => c.type === 'checkbox')
    ) {
      newRows.push({ id: `${row.id}_h`, cells: makeRowHeaderCells() });
      newRows.push({ id: `${row.id}_s`, cells: makeRowConclusionesSubheader() });
      i++;
      continue;
    }

    // Filas de datos: 6 celdas con últimas 3 checkboxes — (D) col 1 SIEMPRE text, 3..5 SIEMPRE checkbox
    if (n >= 6 && cells.slice(-3).every((c) => c.type === 'checkbox')) {
      const param = getCellText(cells[0]);
      const resultado = getCellText(cells[1]);
      const espec = getCellText(cells[2]);
      const lastThree = cells.slice(-3);
      newRows.push({
        id: row.id,
        cells: makeRowData(
          row.id,
          section.id,
          param,
          resultado,
          espec,
          lastThree[0]?.value === true,
          lastThree[1]?.value === true,
          lastThree[2]?.value === true
        ),
      });
      i++;
      continue;
    }

    // Filas de datos: 3 celdas (Parámetro, Resultado/Unidad, Especificación) → 6 celdas
    if (n === 3 && !texts.some((t) => /no aplica/i.test(t))) {
      const param = getCellText(cells[0]);
      const resultado = getCellText(cells[1]);
      const espec = getCellText(cells[2]);
      newRows.push({
        id: row.id,
        cells: makeRowData(
          row.id,
          section.id,
          param,
          resultado,
          espec,
          false,
          false,
          false
        ),
      });
      i++;
      continue;
    }

    // Filas con 1–5 celdas (ej. columna "Conclusiones" única o con inputs): expandir a 6; conclusiones = checkbox (descartar inputs).
    if (n > 0 && n < 6) {
      const param = getCellText(cells[0]);
      const resultado = n > 1 ? getCellText(cells[1]) : '';
      const espec = n > 2 ? getCellText(cells[2]) : '';
      newRows.push({
        id: row.id,
        cells: makeRowData(
          row.id,
          section.id,
          param,
          resultado,
          espec,
          false,
          false,
          false
        ),
      });
    } else if (n >= 6) {
      const param = getCellText(cells[0]);
      const resultado = getCellText(cells[1]);
      const espec = getCellText(cells[2]);
      const c3 = cells[3];
      const c4 = cells[4];
      const c5 = cells[5];
      const cumple =
        c3?.type === 'checkbox' ? c3.value === true : false;
      const noCumple =
        c4?.type === 'checkbox' ? c4.value === true : false;
      const noAplica =
        c5?.type === 'checkbox' ? c5.value === true : false;
      newRows.push({
        id: row.id,
        cells: makeRowData(
          row.id,
          section.id,
          param,
          resultado,
          espec,
          cumple,
          noCumple,
          noAplica
        ),
      });
    } else {
      newRows.push({
        id: row.id,
        cells: makeRowData(
          row.id,
          section.id,
          '',
          '',
          '',
          false,
          false,
          false
        ),
      });
    }
    i++;
  }

  const isRowEmpty = (row: ProtocolTableRow): boolean => {
    const cells = row.cells ?? [];
    if (cells.some((c) => Array.isArray((c as { inline?: unknown[] }).inline) && (c as { inline: unknown[] }).inline.length > 0))
      return false;
    if (cells.some((c) => (c as { variant?: string }).variant === 'header'))
      return false;
    return cells.every((cell) => {
      if (cell.type === 'text')
        return !String(cell.value ?? '').trim();
      if (cell.type === 'checkbox') return cell.value !== true;
      return true;
    });
  };
  const rowsFiltered = newRows.filter((row) => !isRowEmpty(row));

  const normalized: ProtocolTableSection = {
    ...section,
    layout: 'fixed',
    columnWidths: [...COLUMN_WIDTHS_COMPOSITE],
    headers: [], // Sin thead global; estructura (header + subheader) vive en el body (sec_18, sec_19).
    rows: rowsFiltered,
  };

  return normalized;
}

/**
 * Normaliza tablas tipo "Resultados" / "Conclusiones" (HPLC): layout fijo,
 * anchos estándar y refuerzo de checkboxGroup en columnas Cumple/No cumple/No aplica.
 */
function normalizeHplc(template: ProtocolTemplateDoc): ProtocolTemplateDoc {
  const sections = template.sections.map((sec) => {
    if (!isTableSection(sec)) return sec;
    let table = { ...sec };
    const titleLower = (sec.title ?? '').toLowerCase();
    if (
      titleLower.includes('resultado') ||
      titleLower.includes('conclusión') ||
      titleLower.includes('conclusiones')
    ) {
      if (!table.layout) table.layout = 'fixed';
      if (!table.columnWidths && table.headers.length > 0) {
        const n = table.headers.length;
        const pct = Math.floor(100 / n);
        table.columnWidths = table.headers.map((_, i) =>
          i === n - 1 ? `${100 - (n - 1) * pct}%` : `${pct}%`
        );
      }
      table = ensureConclusionesCheckboxGroup(table);
    }
    return table;
  });
  return { ...template, sections };
}

/**
 * Si la tabla tiene columnas tipo "Cumple" / "No cumple" / "No aplica" sin checkboxGroup,
 * les asigna groupId 'conclusiones' y option correspondiente.
 */
function ensureConclusionesCheckboxGroup(
  section: ProtocolTableSection
): ProtocolTableSection {
  const headers = section.headers.map((h) => (h ?? '').toLowerCase().trim());
  const cumpleIdx = headers.findIndex(
    (h) => h.includes('cumple') && !h.includes('no ')
  );
  const noCumpleIdx = headers.findIndex((h) => h.includes('no cumple'));
  const noAplicaIdx = headers.findIndex(
    (h) => h.includes('no aplica') || h === 'n/a'
  );
  const conclusionIndices = [cumpleIdx, noCumpleIdx, noAplicaIdx].filter(
    (i) => i >= 0
  );
  if (conclusionIndices.length === 0) return section;

  const rows = section.rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell, ci) => {
      if (cell.type !== 'checkbox') return cell;
      if (cell.checkboxGroup) return cell;
      if (cumpleIdx === ci)
        return { ...cell, checkboxGroup: { groupId: 'conclusiones', option: 'cumple' } };
      if (noCumpleIdx === ci)
        return { ...cell, checkboxGroup: { groupId: 'conclusiones', option: 'no_cumple' } };
      if (noAplicaIdx === ci)
        return { ...cell, checkboxGroup: { groupId: 'conclusiones', option: 'no_aplica' } };
      return cell;
    }),
  }));
  return { ...section, rows };
}

/**
 * Detecta si la sección es una tabla tipo Resultados/Conclusiones (composite resultados).
 * Heurística determinística:
 * - En headers o en la primera(s) fila(s) existe "Conclusiones" (case-insensitive), Y
 * - Existen indicadores: "No cumple" y "No aplica", o aparece "Cumple", o layout tipo resultados
 *   (bloques "Test de …" + header "Ver especificación del cliente").
 * NO activa para tablas descriptivas (sec_8/sec_9/sec_10) ni isDescriptiveEnsayosTable.
 */
function isResultadosConclusionesTable(sec: ProtocolTableSection): boolean {
  if (sec.id === 'sec_8' || sec.id === 'sec_9' || sec.id === 'sec_10') return false;
  if (isDescriptiveEnsayosTable(sec)) return false;

  const headersStr = (sec.headers ?? []).join(' ').toLowerCase();
  const titleLower = (sec.title ?? '').toLowerCase();
  const hasConclusionesInHeaders = headersStr.includes('conclusiones');
  const hasVerEspecificacionInHeaders =
    sec.headers?.length === 2 && /ver especificación del cliente/i.test(String(sec.headers[1] ?? ''));

  const rows = sec.rows ?? [];
  let hasConclusionesInRows = false;
  let hasNoCumple = false;
  let hasNoAplica = false;
  let hasCumple = false;
  for (const row of rows.slice(0, 5)) {
    const texts = (row.cells ?? []).map(getCellText);
    const rowStr = texts.join(' ').toLowerCase();
    if (/conclusiones/.test(rowStr)) hasConclusionesInRows = true;
    if (texts.some((t) => /no cumple/i.test(t))) hasNoCumple = true;
    if (texts.some((t) => /no aplica/i.test(t))) hasNoAplica = true;
    if (texts.some((t) => /^cumple$/i.test(t.trim()))) hasCumple = true;
  }

  const hasConclusiones = hasConclusionesInHeaders || hasConclusionesInRows;
  const hasConclusionesIndicators =
    (hasNoCumple && hasNoAplica) || hasCumple || hasVerEspecificacionInHeaders;

  if (hasConclusiones && hasConclusionesIndicators) return true;
  if (
    titleLower.includes('test de precisión') ||
    titleLower.includes('test de ruido') ||
    headersStr.includes('test de precisión') ||
    headersStr.includes('test de ruido')
  )
    return true;
  return false;
}

/** Total de columnas lógicas (suma de colSpan) en la primera fila. */
function getTotalColsFromFirstRow(section: ProtocolTableSection): number {
  const first = section.rows[0];
  if (!first) return 6;
  return first.cells.reduce((s, c) => s + (c.colSpan ?? 1), 0);
}

/**
 * Normaliza tablas "Test de Precisión / Carry Over" y similares:
 * - Fila gris superior en una sola celda (colSpan = totalCols, variant = header).
 * - columnWidths fijos para 6 columnas (Parámetro, Resultado, Especificación, Cumple, No cumple, No aplica).
 * - checkboxGroup en columnas Conclusiones.
 */
function normalizeResultadosConclusionesTable(
  section: ProtocolTableSection
): ProtocolTableSection {
  const totalCols = Math.max(6, getTotalColsFromFirstRow(section));
  const columnWidthsSix = ['28%', '14%', '14%', '15%', '15%', '14%'];
  const headersSix = [
    'Parámetro',
    'Resultado',
    'Especificación',
    'Cumple',
    'No cumple',
    'No aplica',
  ];

  const defaultWidths =
    totalCols === 6
      ? columnWidthsSix
      : Array.from(
          { length: totalCols },
          (_, i) =>
            i === totalCols - 1
              ? `${100 - Math.floor(100 / totalCols) * (totalCols - 1)}%`
              : `${Math.floor(100 / totalCols)}%`
        );
  let sec: ProtocolTableSection = {
    ...section,
    layout: 'fixed',
    columnWidths:
      section.columnWidths?.length === totalCols
        ? section.columnWidths
        : defaultWidths,
  };

  const firstHeader = (sec.headers ?? [])[0] ?? '';
  const isFlattenedGreyRow =
    sec.headers?.length === 1 &&
    (firstHeader.length > 50 ||
      /test de precisión|carry over|test de ruido/i.test(firstHeader));

  if (isFlattenedGreyRow) {
    const greyCell = {
      type: 'text' as const,
      value: firstHeader,
      colSpan: totalCols,
      variant: 'header' as const,
    };
    const headerLabels =
      totalCols === 6
        ? headersSix
        : [...headersSix, ...Array(Math.max(0, totalCols - 6)).fill('')];
    sec = {
      ...sec,
      headers: headerLabels.slice(0, totalCols),
      rows: [
        { id: 'row_0_header', cells: [greyCell] },
        ...sec.rows,
      ],
    };
  }

  return ensureConclusionesCheckboxGroup(sec);
}

/**
 * Indices de columnas "Cumple / No cumple / No aplica" a partir de headers (no convertir a texto).
 */
function getConclusionesColumnIndices(section: ProtocolTableSection): number[] {
  const headers = (section.headers ?? []).map((h) => String(h ?? '').toLowerCase());
  const out: number[] = [];
  headers.forEach((h, i) => {
    if ((h.includes('cumple') && !h.includes('no cumple')) || h.includes('no cumple') || h.includes('no aplica') || h === 'n/a')
      out.push(i);
  });
  return out;
}

function isEmptyCell(cell: ProtocolTableCell): boolean {
  if (cell.type === 'text') return !String(cell.value ?? '').trim();
  if (cell.type === 'checkbox') return cell.value !== true;
  return true;
}

/** Tabla tipo formulario: alguna fila tiene >= 50% celdas vacías y no es bloque Conclusiones. */
function isFormLikeTable(section: ProtocolTableSection): boolean {
  if (isAlreadyCompositeNormalized(section) || isCompositeConclusionesTable(section)) return false;
  const rows = section.rows ?? [];
  for (const row of rows) {
    const cells = row.cells ?? [];
    if (cells.length === 0) continue;
    const emptyCount = cells.filter(isEmptyCell).length;
    if (emptyCount / cells.length >= 0.5) return true;
  }
  return false;
}

/**
 * Regla escalable: en tablas tipo formulario, celdas vacías = texto editable.
 * Convierte checkbox -> text cuando no tienen checkboxGroup, no están en columnas
 * Cumple/No cumple/No aplica, y value es false/empty. Mantiene checkboxes en
 * conclusiones y en filas explícitas (ej. "Ver especificación del cliente").
 */
function normalizeFormTable(section: ProtocolTableSection): ProtocolTableSection {
  const conclusionesIndices = getConclusionesColumnIndices(section);
  const rows = section.rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell, ci) => {
      const inConclusiones = conclusionesIndices.includes(ci);
      if (cell.type === 'checkbox') {
        if (cell.checkboxGroup || cell.checkboxLabel) return cell;
        if (inConclusiones) return cell;
        const empty = cell.value === false || cell.value === '' || cell.value === undefined;
        if (empty)
          return {
            type: 'text' as const,
            value: '',
            editable: true,
            colSpan: cell.colSpan,
            rowSpan: cell.rowSpan,
          };
        return cell;
      }
      if (cell.type === 'text' && cell.readOnly !== true) {
        const empty = !String(cell.value ?? '').trim();
        if (empty) return { ...cell, editable: true };
      }
      return cell;
    }),
  }));
  return { ...section, rows };
}

function normalizeFormTables(template: ProtocolTemplateDoc): ProtocolTemplateDoc {
  const sections = template.sections.map((sec) => {
    if (!isTableSection(sec)) return sec;
    if (!isFormLikeTable(sec)) return sec;
    return normalizeFormTable(sec);
  });
  return { ...template, sections };
}

/** Total de columnas lógicas: máximo de (suma de colSpan) en cualquier fila. Así filas título de 1 celda no fijan totalCols=1. */
function getTotalColsFromRows(section: ProtocolTableSection): number {
  const rows = section.rows ?? [];
  if (rows.length === 0) return 6;
  const fromFirst = rows[0].cells.reduce((s, c) => s + (c.colSpan ?? 1), 0);
  const maxFromRows = Math.max(
    fromFirst,
    ...rows.map((r) => r.cells.reduce((s, c) => s + (c.colSpan ?? 1), 0))
  );
  return Math.max(maxFromRows, 1);
}

/**
 * Headers efectivos para mapeo columna → texto: section.headers o primera fila si es toda text.
 */
function getEffectiveHeaders(section: ProtocolTableSection): string[] {
  const headers = section.headers ?? [];
  if (headers.length > 0) return headers.map((h) => String(h ?? '').toLowerCase());
  const first = section.rows?.[0];
  if (!first?.cells?.length) return [];
  const allText = first.cells.every((c) => c.type === 'text');
  if (!allText) return [];
  return first.cells.map((c) => getCellText(c).toLowerCase());
}

/** Palabras típicas de checkbox (no convertir a text cuando el label las contiene). */
const CHECKBOX_LABEL_WORDS = /cumple|no cumple|no aplica|adjunto|sí|si\b|no\b|n\/a|ver especificación/i;

/** Headers que indican "campo a completar" (input), no checkbox. Adjunto se queda checkbox. */
const INPUT_HEADER_WORDS =
  /nueva especificación|marca|modelo|número de serie|número de lote|nº de serie|nº de lote|firmware|\bid\b|ubicación|dirección|localidad|sector|contacto|fecha|última calibración|vigencia|vencimiento/i;

/**
 * Normalizador genérico: convierte checkbox → text (cuadro de texto) cuando la columna
 * es "campo a completar" por header o por heurística 2 columnas (label + checkbox con label no típico).
 */
function normalizeCheckboxesToTextInputs(section: ProtocolTableSection): ProtocolTableSection {
  const effectiveHeaders = getEffectiveHeaders(section);
  const totalCols = getTotalColsFromRows(section);

  const rows = section.rows.map((row) => {
    const cells = row.cells ?? [];
    return {
      ...row,
      cells: cells.map((cell, colIndex) => {
        if (cell.type !== 'checkbox') return cell;
        if (cell.checkboxGroup) return cell;
        if (cell.checkboxLabel) return cell;
        if (row.id === 'row_detectors_inline') return cell;
        if (SECTIONS_KEEP_CHECKBOX.has(section.id)) return cell;

        let shouldConvert = false;
        const header = effectiveHeaders[colIndex] ?? '';

        if (header && /adjunto/i.test(header)) return cell;
        if (header && INPUT_HEADER_WORDS.test(header)) {
          shouldConvert = true;
        }
        if (header && /nueva especificación/i.test(header)) {
          shouldConvert = true;
        }

        if (!shouldConvert && totalCols === 2 && cells.length === 2) {
          const firstCell = cells[0];
          const secondCell = cells[1];
          if (
            firstCell?.type === 'text' &&
            secondCell?.type === 'checkbox' &&
            !secondCell.checkboxGroup &&
            !secondCell.checkboxLabel
          ) {
            const label = getCellText(firstCell);
            if (label && !CHECKBOX_LABEL_WORDS.test(label)) shouldConvert = true;
          }
        }

        if (!shouldConvert) return cell;
        return {
          type: 'text' as const,
          value: '',
          editable: true,
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
          variant: cell.variant,
        };
      }),
    };
  });
  return { ...section, rows };
}

/**
 * Detecta si una fila es "continuación" estándar (col 0 y 1 vacías, col 2 con texto).
 */
function isDescriptiveContinuationRow(cells: ProtocolTableCell[]): boolean {
  if (cells.length < 3) return false;
  const isEmptyOrFalse = (c: ProtocolTableCell): boolean => {
    if (c.type === 'checkbox') return c.value === false || c.value === undefined;
    if (c.type === 'text' || c.type === 'input') return !String(c.value ?? '').trim();
    return true;
  };
  const hasMeaningfulText = (c: ProtocolTableCell): boolean =>
    getCellText(c).trim().length >= 2;
  return (
    isEmptyOrFalse(cells[0]) &&
    isEmptyOrFalse(cells[1]) &&
    hasMeaningfulText(cells[2])
  );
}

/**
 * Detecta fila "desplazada": el parámetro está en col 0 y la especificación en col 1
 * (deberían estar en col 2 y 3). Ej: "Estabilidad de Temperatura (derecho)" en col 0,
 * "≤ 1.00°C" en col 1. Así la fila se trata como subfila y se reubica a 3 celdas.
 */
function isMisalignedContinuationRow(cells: ProtocolTableCell[]): boolean {
  if (cells.length < 4) return false;
  const t0 = getCellText(cells[0]).trim();
  const t1 = getCellText(cells[1]).trim();
  if (t0.length < 3) return false;
  const looksLikeParam =
    /estabilidad|temperatura|izquierdo|derecho|ruido|wander|deriva/i.test(t0) &&
    !/^QI7\.\d+/i.test(t0);
  const looksLikeSpec = /≤|≥|°C|nRIU|%\s*$|\d+\.\d+/.test(t1) || (t1.length >= 2 && /^\d/.test(t1));
  return looksLikeParam && looksLikeSpec;
}

/**
 * Devuelve las 3 celdas (PARÁMETRO, ESPECIFICACIÓN, NUEVA ESPEC) para una fila de continuación,
 * ya sea estándar (vacío,vacío,texto en 2) o desplazada (texto en 0, texto en 1, última = input).
 */
function getContinuationRowCells(cells: ProtocolTableCell[]): ProtocolTableCell[] {
  if (isMisalignedContinuationRow(cells)) {
    const last = cells[cells.length - 1];
    return [
      cells[0].type === 'text' ? cells[0] : { type: 'text' as const, value: getCellText(cells[0]) },
      cells[1].type === 'text' ? cells[1] : { type: 'text' as const, value: getCellText(cells[1]), readOnly: cells[1].readOnly, defaultValue: cells[1].defaultValue },
      last,
    ];
  }
  return cells.slice(2);
}

function isAnyContinuationRow(cells: ProtocolTableCell[]): boolean {
  return isDescriptiveContinuationRow(cells) || isMisalignedContinuationRow(cells);
}

/**
 * Fila "ancla" de grupo: tiene en col 0 un código tipo QI7.05xx (instructivo aplicable).
 * Sirve para agrupar subfilas bajo el mismo rowSpan.
 */
function isGroupStartRow(cells: ProtocolTableCell[]): boolean {
  if (!cells?.length) return false;
  const t0 = getCellText(cells[0]).trim();
  return /^QI7\.\d+/i.test(t0);
}

/**
 * Índice de la fila que inicia el grupo (QI7.05xx en col 0), buscando hacia atrás desde beforeIndex.
 */
function findGroupStartRowIndex(rows: ProtocolTableRow[], beforeIndex: number): number {
  for (let j = beforeIndex; j >= 0; j--) {
    const cells = rows[j].cells ?? [];
    if (isGroupStartRow(cells)) return j;
  }
  return -1;
}

/**
 * Normaliza "filas huérfanas" en tablas descriptivas: filas con placeholders en col 0/1 y texto
 * de subfila (ej. "Estabilidad de Temperatura (derecho)") se convierten en 3 celdas y se
 * agrupan bajo el rowSpan de la fila ancla del grupo (QI7.05xx). No usa solo la fila anterior
 * como ancla: busca la fila que inicia el grupo (col0 = QI7.05xx) para fijar rowSpan correcto.
 */
function normalizeOrphanSubrowsInDescriptiveTable(
  section: ProtocolTableSection
): ProtocolTableSection {
  if (!isDescriptiveEnsayosTable(section)) return section;
  const rows = [...section.rows];
  let i = 0;
  while (i < rows.length) {
    const cells = rows[i].cells ?? [];
    if (!isAnyContinuationRow(cells)) {
      i++;
      continue;
    }
    let k = 0;
    while (i + k < rows.length && isAnyContinuationRow(rows[i + k].cells ?? [])) {
      k++;
    }
    const anchorIdx = findGroupStartRowIndex(rows, i - 1);
    if (anchorIdx < 0) {
      i += k;
      continue;
    }
    const spanCount = i - anchorIdx + k;
    const anchorRow = rows[anchorIdx];
    const anchorCells = anchorRow.cells ?? [];
    if (anchorCells.length >= 2 && isGroupStartRow(anchorCells)) {
      const c0 = { ...anchorCells[0], rowSpan: spanCount };
      const c1 = { ...anchorCells[1], rowSpan: spanCount };
      rows[anchorIdx] = {
        ...anchorRow,
        cells: [c0, c1, ...anchorCells.slice(2)],
      };
    }
    for (let j = 0; j < k; j++) {
      const row = rows[i + j];
      const orig = row.cells ?? [];
      rows[i + j] = { ...row, cells: getContinuationRowCells(orig) };
    }
    i += k;
  }
  return { ...section, rows };
}

/**
 * En tablas descriptivas: filas de "continuación" (estándar o desplazada) se convierten en 3 celdas
 * (PARÁMETRO, ESPECIFICACIÓN, NUEVA ESPEC) y la fila ancla del grupo (QI7.05xx) recibe rowSpan.
 */
function normalizeDescriptiveContinuationRows(
  section: ProtocolTableSection
): ProtocolTableSection {
  return normalizeOrphanSubrowsInDescriptiveTable(section);
}

/**
 * Convierte la última columna a type 'input' cuando el header de esa columna contiene "NUEVA ESPECIFICACIÓN".
 * Hotfix para Tabla 8, 11, 13: última columna = cuadro de texto.
 */
function coerceLastColumnToInput(
  sectionId: string,
  headerTexts: string[],
  rows: ProtocolTableRow[]
): ProtocolTableRow[] {
  const lastIdx = headerTexts.length - 1;
  const lastHeader = (headerTexts[lastIdx] ?? '').toUpperCase();
  if (!lastHeader.includes('NUEVA ESPECIFICACIÓN')) return rows;

  return rows.map((r) => ({
    ...r,
    cells: r.cells.map((c, idx) => {
      const isLast = idx === r.cells.length - 1;
      if (!isLast) return c;
      if (c.type === 'checkbox') {
        return { ...c, type: 'input' as const, value: '' };
      }
      return c;
    }),
  }));
}

/**
 * Tabla "Se incluyen en el reporte…": forzar 2 columnas, fila 1 = texto (rowSpan 2) + SI ☐, fila 2 = NO ☐.
 * Se detecta por section.id === 'sec_15' o por contenido del header/celdas.
 */
function isSeIncluyenEnElReporteTable(section: ProtocolTableSection): boolean {
  const headers = section.headers ?? [];
  const firstHeader = String(headers[0] ?? '').trim();
  if (/se incluyen en el reporte/i.test(firstHeader)) return true;
  if (
    /se incluyen en el reporte de calificación.*detalle.*métodos ejecutados/i.test(firstHeader) ||
    /se incluyen en el reporte.*documentos indicados/i.test(firstHeader)
  )
    return true;
  const inRows = section.rows?.some((r) =>
    (r.cells ?? []).some((c) => c.type === 'text' && /se incluyen en el reporte/i.test(getCellText(c)))
  );
  return !!inRows;
}

function normalizeSec15SiNoTable(section: ProtocolTableSection): ProtocolTableSection {
  const isSeIncluyen =
    section.id === 'sec_15' || isSeIncluyenEnElReporteTable(section);
  if (!isSeIncluyen) return section;
  const headers = section.headers ?? [];
  const firstHeader = String(headers[0] ?? '').trim();

  const labelText =
    firstHeader ||
    'Se incluyen en el reporte de calificación el detalle de los métodos ejecutados en cada test';

  const newRows: ProtocolTableRow[] = [
    {
      id: 'row_yes_no_1',
      cells: [
        {
          type: 'text',
          value: labelText,
          rowSpan: 2,
          variant: 'subheader',
        },
        {
          type: 'checkbox',
          value: false,
          checkboxLabel: 'SI',
        },
      ],
    },
    {
      id: 'row_yes_no_2',
      cells: [
        {
          type: 'checkbox',
          value: false,
          checkboxLabel: 'NO',
        },
      ],
    },
  ];

  return {
    ...section,
    headers: [labelText, ''],
    rows: newRows,
  };
}

/**
 * C1) Fila título (header/subheader) con texto largo: forzar colSpan = totalCols (o totalCols-1 si hay checkbox "Ver especificación").
 * Evita título de sección cortado visualmente.
 */
function normalizeTitleRowColSpan(section: ProtocolTableSection): ProtocolTableSection {
  if (isAlreadyCompositeNormalized(section)) return section;
  const totalCols = getTotalColsFromRows(section);
  const rows = section.rows.map((row) => {
    const cells = row.cells ?? [];
    if (cells.length === 0) return row;
    const first = cells[0];
    if (first.type !== 'text' || (first.variant !== 'header' && first.variant !== 'subheader'))
      return row;
    const currentSpan = first.colSpan ?? 1;
    if (currentSpan >= totalCols) return row;
    const hasVerSpecRight =
      cells.length === 2 &&
      cells[1].type === 'checkbox' &&
      /ver especificación del cliente/i.test(String(cells[1].checkboxLabel ?? ''));
    const textLen = getCellText(first).length;
    const expandForLongTitle = textLen >= 35;
    const expandSingleCell = cells.length === 1;
    if (!expandForLongTitle && !expandSingleCell) return row;
    const newSpan = hasVerSpecRight ? totalCols - 2 : totalCols;
    return {
      ...row,
      cells: cells.map((c, i) =>
        i === 0 ? { ...c, colSpan: newSpan } : c
      ),
    };
  });
  return { ...section, rows };
}

/**
 * C2) Columna "NUEVA ESPECIFICACIÓN" → renderAs 'input' (cuadro de texto). Mantiene type en JSON.
 * Otras columnas tipo especificación quedan readOnly.
 */
function normalizeNuevaEspecificacionColumn(section: ProtocolTableSection): ProtocolTableSection {
  const headers = (section.headers ?? []).map((h) => String(h ?? '').toLowerCase());
  const nuevaSpecIdx = headers.findIndex(
    (h) => h.includes('nueva especificación')
  );
  const especIndices = headers
    .map((h, i) => (h.includes('especificación') && !h.includes('nueva especificación') ? i : -1))
    .filter((i) => i >= 0);

  if (nuevaSpecIdx < 0) return section;

  const rows = section.rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell, ci) => {
      if (ci === nuevaSpecIdx) {
        return {
          ...cell,
          type: cell.type === 'text' ? 'text' : ('checkbox' as const),
          value: cell.type === 'text' ? (cell.value ?? '') : '',
          renderAs: 'input' as const,
          placeholder: cell.placeholder,
        };
      }
      if (especIndices.includes(ci) && cell.type === 'text') {
        return { ...cell, readOnly: true, editable: false };
      }
      return cell;
    }),
  }));
  return { ...section, rows };
}

/** Secciones que NUNCA se convierten (Conclusiones, Ver especificación, detectores, SI/NO). */
const SECTIONS_KEEP_CHECKBOX = new Set([
  'sec_16',
  'sec_17',
  'sec_18',
  'sec_19',
  'sec_21',
  'sec_23',
]);

/**
 * Indica si una celda checkbox debe mostrarse como input (cuadro de texto) según sección/columna.
 * NO convertir: Conclusiones (checkboxGroup), Ver especificación (checkboxLabel), fila detectores, SI/NO.
 */
function shouldConvertCheckboxToInput(
  sectionId: string,
  colIndex: number,
  cell: ProtocolTableCell,
  _row: ProtocolTableRow,
  section: ProtocolTableSection
): boolean {
  if (cell.type !== 'checkbox') return false;
  if (cell.checkboxGroup) return false;
  if (cell.checkboxLabel) return false;
  if (SECTIONS_KEEP_CHECKBOX.has(sectionId)) return false;
  if (_row.id === 'row_detectors_inline') return false;

  const headers = (section.headers ?? []).map((h) => String(h ?? '').toLowerCase());
  const headerAt = (i: number) => headers[i] ?? '';

  switch (sectionId) {
    case 'sec_3':
    case 'sec_4':
    case 'sec_5':
      return true;
    case 'sec_6':
      return /modelo|nº?\s*serie|firmware|id/i.test(headerAt(colIndex));
    case 'sec_7':
      return true;
    case 'sec_8':
    case 'sec_10':
    case 'sec_11':
      if (headerAt(colIndex).includes('nueva especificación')) return true;
      if (sectionId === 'sec_11') return /marca|número de lote/i.test(headerAt(colIndex));
      return sectionId !== 'sec_8' && sectionId !== 'sec_10';
    case 'sec_12':
      return /marca|modelo|número de serie|última calibración|vigencia/i.test(headerAt(colIndex));
    case 'sec_13':
      return /número de lote|vencimiento/i.test(headerAt(colIndex));
    case 'sec_15':
      return false;
    default:
      return false;
  }
}

/**
 * Marca renderAs: 'input' en celdas que deben ser cuadros de texto (sin cambiar type en JSON).
 */
function normalizeCheckboxesToInputs(section: ProtocolTableSection): ProtocolTableSection {
  const rows = section.rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell, ci) => {
      if (cell.type !== 'checkbox') return cell;
      if (!shouldConvertCheckboxToInput(section.id, ci, cell, row, section)) return cell;
      return { ...cell, renderAs: 'input' as const };
    }),
  }));
  return { ...section, rows };
}

function normalizeTableFidelity(template: ProtocolTemplateDoc): ProtocolTemplateDoc {
  const sections = template.sections.map((sec) => {
    if (!isTableSection(sec)) return sec;
    let table = normalizeSec15SiNoTable(sec);
    table = normalizeTitleRowColSpan(table);
    table = normalizeNuevaEspecificacionColumn(table);
    table = normalizeCheckboxesToInputs(table);
    table = normalizeCheckboxesToTextInputs(table);
    const headerTexts = table.headers ?? [];
    table = { ...table, rows: coerceLastColumnToInput(table.id, headerTexts, table.rows) };
    table = normalizeDescriptiveContinuationRows(table);
    return table;
  });
  return { ...template, sections };
}

/** Contenido estándar de notas al pie bajo tablas tipo "INSTRUCTIVO APLICABLE / NUEVA ESPECIFICACIÓN". */
const FOOTNOTES_123 =
  '¹ Los instructivos son aplicables al módulo correspondiente de cualquiera de las series 1100/1120/1200/1220/1260.\n² Recomendados por el fabricante.\n³ Las especificaciones pueden ser modificadas por el Cliente de acuerdo a sus requerimientos analíticos.';

function hasFootnotesContent(section: ProtocolSection): boolean {
  if (section.type !== 'text') return false;
  const c = (section as ProtocolTextSection).content ?? '';
  return (
    /instructivos.*series\s+1100/i.test(c) &&
    /recomendados por el fabricante/i.test(c) &&
    /especificaciones pueden ser modificadas/i.test(c)
  );
}

/**
 * C3) Tras tablas con "INSTRUCTIVO APLICABLE" y "NUEVA ESPECIFICACIÓN", asegurar bloque de texto ¹²³.
 * Si la siguiente sección no es ya ese bloque, se inserta una ProtocolTextSection con las notas.
 */
function normalizeFootnotesAfterTable(template: ProtocolTemplateDoc): ProtocolTemplateDoc {
  const sections: ProtocolSection[] = [];
  for (let i = 0; i < template.sections.length; i++) {
    sections.push(template.sections[i]);
    const sec = template.sections[i];
    if (!isTableSection(sec)) continue;
    const headersStr = (sec.headers ?? []).join(' ').toLowerCase();
    if (
      !headersStr.includes('instructivo aplicable') ||
      !headersStr.includes('nueva especificación')
    )
      continue;
    const next = template.sections[i + 1];
    if (next && hasFootnotesContent(next)) continue;
    const footnoteSection: ProtocolTextSection = {
      id: `${sec.id}_footnotes`,
      type: 'text',
      content: FOOTNOTES_123,
    };
    sections.push(footnoteSection);
  }
  return { ...template, sections };
}

/**
 * Normaliza secciones tipo checklist (por título o por tipo de sección).
 * Por ahora solo pasa; se puede extender con reglas específicas.
 */
function normalizeChecklist(template: ProtocolTemplateDoc): ProtocolTemplateDoc {
  return template;
}

/**
 * Primera pasada: tablas compuestas tipo Resultados/Conclusiones (ej. sec_18, sec_19).
 * Se aplica antes que el resto para no ser sobrescrito por otros normalizadores.
 * sec_19 usa la misma normalización; dentro de normalizeCompositeConclusionesTable se omiten las 2 filas
 * de encabezado en el body y se asignan headers de 6 columnas (thead 2 niveles en UI).
 */
function normalizeCompositeConclusionesFirst(
  template: ProtocolTemplateDoc
): ProtocolTemplateDoc {
  const sections = template.sections.map((sec) => {
    if (!isTableSection(sec)) return sec;
    if (isDescriptiveEnsayosTable(sec)) return sec;
    const isComposite = isCompositeConclusionesTable(sec);
    if (shouldInsertDetectorsInline(sec) || isComposite)
      return normalizeCompositeConclusionesTable(sec);
    return sec;
  });
  return { ...template, sections };
}

/**
 * Aplica todos los normalizadores por familia.
 * Usar al cargar/obtener una plantilla para homogeneizar V1/V2.
 * Orden: primero tablas compuestas (sec_18 tipo), luego HPLC/Resultados, luego checklist.
 */
export function normalizeProtocolTemplate(
  template: ProtocolTemplateDoc
): ProtocolTemplateDoc {
  let t = template;
  t = normalizeCompositeConclusionesFirst(t);
  t = normalizeHplc(t);
  t = normalizeResultadosConclusiones(t);
  t = normalizeFormTables(t);
  t = normalizeTableFidelity(t);
  t = normalizeFootnotesAfterTable(t);
  t = normalizeChecklist(t);
  return t;
}

/**
 * Normaliza una sola sección de tabla tipo compuesta (sec_18, sec_19).
 * Usar en la vista para garantizar que siempre se renderice con fila gris + checkbox y subencabezado "Cumple|No cumple|No aplica".
 */
export function normalizeCompositeConclusionesSection(
  section: ProtocolTableSection
): ProtocolTableSection {
  if (isDescriptiveEnsayosTable(section)) return section;
  if (isCompositeConclusionesTable(section))
    return normalizeCompositeConclusionesTable(section);
  return section;
}

/** Detecta si la tabla ya fue normalizada como compuesta (no volver a aplicar Resultados/Conclusiones). */
function isAlreadyCompositeNormalized(sec: ProtocolTableSection): boolean {
  if (sec.layout !== 'fixed' || (sec.columnWidths?.length ?? 0) !== 6) return false;
  if ((sec.headers?.length ?? 0) > 0) return false;
  const rows = sec.rows ?? [];
  return rows.some((r) =>
    (r.cells ?? []).some(
      (c) => (c.colSpan ?? 0) >= 4 && c.variant === 'header'
    )
  );
}

/**
 * Aplica normalizeResultadosConclusionesTable a secciones que coincidan.
 * No se aplica a tablas ya normalizadas como compuestas (sec_18 tipo).
 */
function normalizeResultadosConclusiones(
  template: ProtocolTemplateDoc
): ProtocolTemplateDoc {
  const sections = template.sections.map((sec) => {
    if (!isTableSection(sec)) return sec;
    const isAlready = isAlreadyCompositeNormalized(sec);
    if (isAlready) return sec;
    if (isDescriptiveEnsayosTable(sec)) return sec;
    if (!isResultadosConclusionesTable(sec)) return sec;
    return normalizeResultadosConclusionesTable(sec);
  });
  return { ...template, sections };
}
