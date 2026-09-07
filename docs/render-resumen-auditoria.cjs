/**
 * Renderiza docs/informes/Resumen-Auditoria-Antes-Y-Despues-AGS.md a PDF (2 a 3 carillas).
 * Mismo patrón que los demás render-*.cjs: HTML → Chromium (Playwright) → PDF.
 * Editar el .md y volver a correr; nunca editar el PDF a mano.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('c:/Users/Evigna/Desktop/Ags plataform/apps/sistema-modular/node_modules/@playwright/test');

const SRC = path.resolve(__dirname, 'informes', 'Resumen-Auditoria-Antes-Y-Despues-AGS.md');
const OUT = path.resolve(__dirname, 'informes', 'Resumen-Auditoria-Antes-Y-Despues-AGS.pdf');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

/** Markdown acotado: encabezados, tablas, listas, citas, reglas y párrafos. */
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  const flushList = (tag, items) => out.push(`<${tag}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${tag}>`);

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // Tabla: | a | b |  seguida de | --- | --- |
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
      const cells = l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(
        '<table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>',
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let t = lines[i].replace(/^\s*[-*]\s+/, ''); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) { t += ' ' + lines[i].trim(); i++; }
        items.push(t);
      }
      flushList('ul', items); continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let t = lines[i].replace(/^\s*\d+\.\s+/, ''); i++;
        while (i < lines.length && /^\s{3,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) { t += ' ' + lines[i].trim(); i++; }
        items.push(t);
      }
      flushList('ol', items); continue;
    }

    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|\||>|---\s*$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    else i++;
  }
  return out.join('\n');
}

const CSS = `
  @page { size: A4; margin: 12mm 12mm 13mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, "Segoe UI", Arial, sans-serif; font-size: 8.7pt; line-height: 1.38;
         color: #1f2937; margin: 0; }
  h1 { font-family: Newsreader, Georgia, serif; font-size: 21pt; line-height: 1.2; color: #0f172a;
       margin: 0 0 2mm; font-weight: 600; }
  h2 { font-family: Newsreader, Georgia, serif; font-size: 14pt; color: #0D6E6E; font-weight: 600;
       margin: 4.5mm 0 2mm; padding-bottom: 1mm; border-bottom: 1.5px solid #0D6E6E;
       page-break-after: avoid; }
  h3 { font-size: 11pt; color: #0f172a; font-weight: 700; margin: 6mm 0 2mm; page-break-after: avoid; }
  h1 + h2 { margin-top: 4mm; }
  p { margin: 0 0 2.2mm; text-align: justify; }
  strong { color: #0f172a; }
  code { font-family: "JetBrains Mono", Consolas, monospace; font-size: 8.8pt;
         background: #f1f5f9; padding: 0.4mm 1.2mm; border-radius: 2px; color: #0f172a; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 4mm 0; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 0.9mm; }
  blockquote { margin: 3mm 0; padding: 2.5mm 4mm; border-left: 3px solid #0D6E6E;
               background: #f0fdfa; color: #334155; font-size: 9.8pt; }
  blockquote code { background: #ffffff; }
  table { width: 100%; border-collapse: collapse; margin: 1.8mm 0 2.5mm; font-size: 7.7pt; }
  tr { page-break-inside: avoid; }
  th { background: #e8f0ef; color: #0f172a; text-align: left; font-weight: 600;
       padding: 1.1mm 1.8mm; border: 1px solid #cbd5e1; }
  td { padding: 1mm 1.8mm; border: 1px solid #dbe2ea; vertical-align: top; }
  tbody tr:nth-child(even) { background: #fafbfc; }
`;

(async () => {
  const md = fs.readFileSync(SRC, 'utf8');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Newsreader:wght@500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
    <style>${CSS}</style></head><body>${mdToHtml(md)}</body></html>`;

  const tmp = path.join(require('os').tmpdir(), 'resumen-auditoria-ags.html');
  fs.writeFileSync(tmp, html, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%; font-size:7pt; color:#94a3b8; font-family:Consolas,monospace; padding:0 12mm; display:flex; justify-content:space-between;">
        <span>Antes y después — Auditoría ISO 9001:2015</span>
        <span>AGS Analítica · <span class="pageNumber"></span>/<span class="totalPages"></span></span>
      </div>`,
  });
  await browser.close();
  // KEEP_HTML=1 conserva el intermedio para inspeccionar el maquetado.
  if (!process.env.KEEP_HTML) fs.unlinkSync(tmp);
  else console.log('HTML intermedio:', tmp);
  console.log('PDF generado en:', OUT);
})().catch(e => { console.error(e); process.exit(1); });
