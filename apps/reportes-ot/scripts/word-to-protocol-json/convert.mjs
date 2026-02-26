#!/usr/bin/env node
/**
 * Prototipo: convierte un .docx de protocolo a JSON estructurado (spec protocolTemplates).
 * Uso: node convert.mjs [ruta/documento.docx] [--out salida.json]
 *
 * Requiere: npm install (en esta carpeta)
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;
const fileArgs = outIndex >= 0 ? args.filter((_, i) => i !== outIndex && i !== outIndex + 1) : args;
const docxPath = fileArgs[0] || path.join(process.cwd(), 'sample-protocol.docx');

if (!fs.existsSync(docxPath)) {
  console.error('No se encontró el archivo:', docxPath);
  console.error('Uso: node convert.mjs [ruta/documento.docx] [--out salida.json]');
  process.exit(1);
}

const basename = path.basename(docxPath, '.docx');
const inferredId = basename.replace(/\s+/g, '_').slice(0, 50);

/**
 * Extrae de document.xml los merges por tabla (gridSpan → colSpan, vMerge → rowSpan).
 * Devuelve un array de tablas; cada tabla es un array de { colSpan, rowSpan } en orden lectura.
 */
async function getDocxTableMerges(buffer) {
  const tables = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) return tables;
    const tblRegex = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/gi;
    let tblMatch;
    while ((tblMatch = tblRegex.exec(docXml)) !== null) {
      const tblContent = tblMatch[1];
      const grid = [];
      const openMerge = {};
      let rowIdx = 0;
      const trRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(tblContent)) !== null) {
        const rowContent = trMatch[1];
        if (!grid[rowIdx]) grid[rowIdx] = [];
        let col = 0;
        const tcRegex = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/gi;
        let tcMatch;
        while ((tcMatch = tcRegex.exec(rowContent)) !== null) {
          const tcContent = tcMatch[1];
          while (grid[rowIdx][col] === 'covered') col++;
          const gs = tcContent.match(/<w:gridSpan\s+w:val="(\d+)"/);
          const vm = tcContent.match(/<w:vMerge(?:\s+w:val="(restart|continue)")?\s*\/?>/);
          const shd = /<w:shd\s/i.test(tcContent);
          const gridSpan = gs ? parseInt(gs[1], 10) : 1;
          const vMerge = vm ? (vm[1] || 'restart') : null;
          if (vMerge === 'continue') {
            const origin = openMerge[col];
            if (origin != null) {
              grid[origin.startRow][origin.startCol].rowSpan = (grid[origin.startRow][origin.startCol].rowSpan || 1) + 1;
            }
            grid[rowIdx][col] = 'covered';
            col++;
          } else {
            const cell = { colSpan: gridSpan, rowSpan: 1 };
            if (shd) cell.variant = rowIdx === 0 ? 'header' : 'subheader';
            grid[rowIdx][col] = cell;
            for (let k = 0; k < gridSpan; k++) openMerge[col + k] = { startRow: rowIdx, startCol: col };
            col += gridSpan;
          }
        }
        rowIdx++;
      }
      const flat = [];
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < (grid[r]?.length || 0); c++) {
          if (grid[r][c] !== 'covered' && grid[r][c] != null) flat.push(grid[r][c]);
        }
      }
      tables.push(flat);
    }
  } catch (e) {
    console.error('[DOCX merges]', e.message);
  }
  return tables;
}

async function main() {
  const buffer = fs.readFileSync(docxPath);
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;
  const docxTableMerges = await getDocxTableMerges(buffer);

  const template = htmlToTemplate(html, inferredId, docxTableMerges);
  const doc = {
    id: inferredId,
    name: basename,
    serviceType: inferServiceType(basename),
    equipmentType: inferEquipmentType(basename),
    template,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(doc, null, 2);
  if (outFile) {
    fs.writeFileSync(outFile, json, 'utf8');
    console.error('Escrito:', outFile);
  } else {
    console.log(json);
  }
}

function inferServiceType(basename) {
  const b = basename.toLowerCase();
  if (b.includes('calif') && b.includes('operacion')) return 'Calificación de operación';
  if (b.includes('recalif')) return 'Recalificación';
  if (b.includes('mp ') || b.includes('mantenimiento')) return 'Mantenimiento preventivo';
  return 'Protocolo';
}

function inferEquipmentType(basename) {
  const match = basename.match(/1100[- ]?1200[- ]?1260|1100[- ]?1200[- ]?1220[- ]?1260[- ]?1290|HPLC|MP\s+\d+/i);
  return match ? match[0].replace(/\s+/g, ' ') : 'Equipo';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitiza texto: elimina caracteres de línea (box drawing / combining underline) y espacios raros heredados de Word.
 */
function sanitizeText(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\u00A0/g, ' ')
    .replace(/\u0332/g, '')
    .replace(/[\u2500-\u257F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttrInt(tagStr, name) {
  const re = new RegExp(name + '\\s*=\\s*["\']?(\\d+)', 'i');
  const m = tagStr.match(re);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Parsea tabla con soporte V2: colSpan, rowSpan desde HTML; variant y checkboxGroup se aplican después. */
function parseTable(tableHtml) {
  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRegex = /<t(d|h)([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const tagStr = cellMatch[2];
      const raw = sanitizeText(stripHtml(cellMatch[3]));
      const lower = raw.toLowerCase();
      const looksLikeCheck = /^(sí|si|no|x|□|☑|☐|cumple|ok|✓|n\/a|\-)$/i.test(lower) || (raw.length <= 4 && /^[sSnNxXoOkK\-]*$/.test(raw));
      const colSpan = parseAttrInt(tagStr, 'colspan');
      const rowSpan = parseAttrInt(tagStr, 'rowspan');
      const cell = { type: looksLikeCheck ? 'checkbox' : 'text', value: looksLikeCheck ? false : raw };
      if (colSpan && colSpan > 1) cell.colSpan = colSpan;
      if (rowSpan && rowSpan > 1) cell.rowSpan = rowSpan;
      cells.push(cell);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** Detecta índices de columnas "Cumple" / "No cumple" / "No aplica" en headers (V2). */
function getConclusionesColumnIndices(headers) {
  const h = headers.map((x) => (x || '').toLowerCase().trim());
  const cumple = h.findIndex((x) => x.includes('cumple') && !x.includes('no cumple') && !x.includes('no aplica'));
  const noCumple = h.findIndex((x) => x.includes('no cumple'));
  const noAplica = h.findIndex((x) => x.includes('no aplica') || x === 'n/a');
  return { cumple: cumple >= 0 ? cumple : null, noCumple: noCumple >= 0 ? noCumple : null, noAplica: noAplica >= 0 ? noAplica : null };
}

/** Añade variant (header/subheader) y checkboxGroup (conclusiones) por columna lógica. */
function enrichTableRows(rows, headers, totalCols) {
  const conclusiones = getConclusionesColumnIndices(headers);
  return rows.map((row, rowIdx) => {
    const isFullRowSingleCell = row.length === 1 && (row[0].colSpan || 1) >= totalCols;
    let logicalCol = 0;
    return row.map((c) => {
      const cell = { ...c };
      if (isFullRowSingleCell && c.type === 'text') cell.variant = rowIdx === 0 ? 'header' : 'subheader';
      if (c.type === 'checkbox') {
        if (logicalCol === conclusiones.cumple) cell.checkboxGroup = { groupId: 'conclusiones', option: 'cumple' };
        if (logicalCol === conclusiones.noCumple) cell.checkboxGroup = { groupId: 'conclusiones', option: 'no_cumple' };
        if (logicalCol === conclusiones.noAplica) cell.checkboxGroup = { groupId: 'conclusiones', option: 'no_aplica' };
      }
      logicalCol += c.colSpan || 1;
      return cell;
    });
  });
}

function applyDocxMerges(cellsFlat, mergeInfo) {
  if (!mergeInfo || mergeInfo.length === 0) return;
  let idx = 0;
  for (const cell of cellsFlat) {
    const info = mergeInfo[idx];
    if (info) {
      if (info.colSpan) cell.colSpan = info.colSpan;
      if (info.rowSpan) cell.rowSpan = info.rowSpan;
      if (info.variant) cell.variant = info.variant;
    }
    idx++;
  }
}

function htmlToTemplate(html, docId, docxTableMerges = []) {
  const sections = [];
  let sectionId = 0;
  let tableIndex = 0;

  const blocks = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRegex.exec(html)) !== null) {
    blocks.push({ type: 'heading', index: m.index, level: parseInt(m[1], 10), text: sanitizeText(stripHtml(m[2])) });
  }

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  while ((m = tableRegex.exec(html)) !== null) {
    const rows = parseTable(m[1]);
    blocks.push({ type: 'table', index: m.index, rows });
  }

  blocks.sort((a, b) => a.index - b.index);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'heading') {
      const next = blocks[i + 1];
      const start = block.index + 1;
      const end = next ? next.index : html.length;
      const between = html.slice(start, end);
      const textBetween = stripHtml(between);
      if (next?.type === 'table') {
        const t = next.rows;
        if (t.length > 0) {
          sectionId++;
          const headers = t[0].map((c) => (c.type === 'text' ? c.value : ''));
          const totalCols = Math.max(
            headers.length,
            (t[0] || []).reduce((s, c) => s + (c.colSpan || 1), 0)
          );
          const n = totalCols;
          const pct = Math.floor(100 / n);
          const columnWidths = Array.from({ length: n }, (_, i) => (i === n - 1 ? `${100 - (n - 1) * pct}%` : `${pct}%`));
          const enrichedData = enrichTableRows(t.slice(1), headers, totalCols);
          const cellsFlat = enrichedData.flat();
          const mergeInfo = docxTableMerges[tableIndex];
          if (mergeInfo) {
            const headerCells = (t[0] || []).reduce((s, c) => s + (c.colSpan || 1), 0);
            applyDocxMerges(cellsFlat, mergeInfo.slice(headerCells));
          }
          tableIndex++;
          sections.push({
            id: `sec_${sectionId}`,
            title: block.text,
            type: 'table',
            headers,
            layout: 'fixed',
            columnWidths,
            rows: enrichedData.map((r, ri) => ({
              id: `row_${ri + 1}`,
              cells: r.map((c) => {
                const base = c.type === 'checkbox' ? { type: 'checkbox', value: false } : { type: 'text', value: c.value || '' };
                if (c.colSpan) base.colSpan = c.colSpan;
                if (c.rowSpan) base.rowSpan = c.rowSpan;
                if (c.variant) base.variant = c.variant;
                if (c.checkboxGroup) base.checkboxGroup = c.checkboxGroup;
                return base;
              }),
            })),
          });
        }
        i++;
      } else if (textBetween.length > 30) {
        sectionId++;
        sections.push({ id: `sec_${sectionId}`, title: block.text, type: 'text', content: textBetween });
      }
    } else if (block.type === 'table' && block.rows.length > 0) {
      sectionId++;
      const t = block.rows;
      const headers = t[0].map((c) => (c.type === 'text' ? c.value : ''));
      const totalCols = Math.max(
        headers.length,
        (t[0] || []).reduce((s, c) => s + (c.colSpan || 1), 0)
      );
      const n = totalCols;
      const pct = Math.floor(100 / n);
      const columnWidths = Array.from({ length: n }, (_, i) => (i === n - 1 ? `${100 - (n - 1) * pct}%` : `${pct}%`));
      const enrichedData = enrichTableRows(t.slice(1), headers, totalCols);
      const cellsFlat = enrichedData.flat();
      const mergeInfo = docxTableMerges[tableIndex];
      if (mergeInfo) {
        const headerCells = (t[0] || []).reduce((s, c) => s + (c.colSpan || 1), 0);
        applyDocxMerges(cellsFlat, mergeInfo.slice(headerCells));
      }
      tableIndex++;
      sections.push({
        id: `sec_${sectionId}`,
        title: 'Tabla',
        type: 'table',
        headers,
        layout: 'fixed',
        columnWidths,
        rows: enrichedData.map((r, ri) => ({
          id: `row_${ri + 1}`,
          cells: r.map((c) => {
            const base = c.type === 'checkbox' ? { type: 'checkbox', value: false } : { type: 'text', value: c.value || '' };
            if (c.colSpan) base.colSpan = c.colSpan;
            if (c.rowSpan) base.rowSpan = c.rowSpan;
            if (c.variant) base.variant = c.variant;
            if (c.checkboxGroup) base.checkboxGroup = c.checkboxGroup;
            return base;
          }),
        })),
      });
    }
  }

  if (sections.length === 0) {
    sections.push({ id: 'sec_1', title: 'Contenido', type: 'text', content: stripHtml(html).slice(0, 3000) });
  }

  return { sections };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
