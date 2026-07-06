import { Text } from '@react-pdf/renderer';
import Html from 'react-pdf-html';
import { PDFRichTextErrorBoundary } from './PDFRichTextErrorBoundary';

// El editor emite <font size="N"> (N=1..6, labels px 10/12/14/16/20/24). Lo mapeamos a pt
// (~ px * 0.75) para el PDF. Base del presupuesto ~7pt.
const FONT_SIZE_MAP: Record<string, number> = {
  '1': 8,   // 10px
  '2': 9,   // 12px
  '3': 11,  // 14px
  '4': 12,  // 16px
  '5': 15,  // 20px
  '6': 18,  // 24px
};

/**
 * Convierte `<font size="N">` (del editor) a un `<span style="font-size:{pt}pt">` con el pt
 * del mapa. react-pdf-html aplica el font-size inline en pt de forma DETERMINISTA; el
 * renderer custom / el manejo nativo de `<font>` salía inconsistente (algunos gigantes).
 * Ojo: correr DESPUÉS de stripFontSizing (que borra el font-size inline pegado), para que
 * el pt que ponemos acá sea el que mande.
 */
function mapFontTagsToPt(html: string): string {
  return html
    .replace(/<font\b[^>]*\bsize\s*=\s*["']?([1-6])["']?[^>]*>/gi, (_m, n: string) => `<span style="font-size:${FONT_SIZE_MAP[n] ?? 9}pt">`)
    .replace(/<font\b[^>]*>/gi, '<span>')
    .replace(/<\/font>/gi, '</span>');
}

// Mirrors PresupuestoPDFEstandar S.condicionText baseline (fontSize 7, lineHeight 1.5,
// alineado a la IZQUIERDA — justificar a 7pt en columna angosta deja espacios desparejos).
const stylesheet = {
  p: { fontSize: 7, lineHeight: 1.5, marginBottom: 3, textAlign: 'left' as const },
  div: { fontSize: 7, lineHeight: 1.5, textAlign: 'left' as const },
  strong: { fontWeight: 'bold' as const },
  b: { fontWeight: 'bold' as const },
  i: { fontStyle: 'italic' as const },
  em: { fontStyle: 'italic' as const },
  u: { textDecoration: 'underline' as const },
  ul: { marginLeft: 10, marginBottom: 3 },
  ol: { marginLeft: 10, marginBottom: 3 },
  li: { fontSize: 7, lineHeight: 1.5, marginBottom: 1, textAlign: 'left' as const },
};

/**
 * Neutraliza SOLO el `font-size` inline (px/pt/keywords) del HTML pegado desde Word/web:
 * react-pdf-html lo aplica literal (p.ej. 20pt vs 7pt base) → texto GIGANTE, y al ser inline
 * le gana al `<font size>` del editor. Al quitarlo, el tamaño queda gobernado por el
 * `<font size>` del editor (que mapFontTagsToPt convierte a un pt controlado) o por la base.
 *
 * OJO: NO tocar el atributo `size` de `<font>` — ese ES el control de tamaño del editor;
 * lo convierte mapFontTagsToPt (que corre después). Si se stripeara acá, el tamaño del
 * editor dejaría de tener efecto.
 */
function stripFontSizing(html: string): string {
  return html.replace(/font-size\s*:\s*[^;"']+;?/gi, '');
}

/**
 * Preserva los saltos de línea del contenido PLANO (templates viejos con `\n`), que si no
 * react-pdf-html aplasta a un espacio (regla de whitespace de HTML) → todo un bloque corrido.
 * Si el contenido ya trae estructura HTML (<p>/<div>/<br>/listas), no se toca: sus `\n` son
 * whitespace insignificante y los saltos vienen dados por los tags.
 */
function preserveLineBreaks(html: string): string {
  if (/<(p|div|br|ul|ol|li)\b/i.test(html)) return html;
  return html.replace(/\r?\n/g, '<br>');
}

// Strip HTML tags to plain text — fallback when react-pdf-html fails to render.
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface PDFRichTextProps {
  html: string | null | undefined;
  fallbackStyle?: any;
}

/**
 * Renders a rich-HTML string (from RichTextEditor) inside a @react-pdf/renderer document.
 * Honors: bold/italic/underline, ul/ol lists, <font size="1..6">, inline `style="text-align"`.
 *
 * Two-layer error safety:
 *   1. Parse-time try/catch: if `<Html>` construction throws synchronously (e.g. css-tree
 *      chokes on the html string), we fall back to plain text immediately.
 *   2. Commit-time PDFRichTextErrorBoundary: if react-pdf throws during the commit phase
 *      (e.g. while walking the parsed tree to lay out text), the boundary catches it and
 *      renders the same plain-text fallback. Without this, a single bad section would
 *      crash the entire PDF document generation.
 *
 * Both fallbacks use stripHtml(html) so degradation is deterministic.
 */
export function PDFRichText({ html, fallbackStyle }: PDFRichTextProps) {
  if (!html || !html.trim()) return null;

  // 1) stripFontSizing: borra el font-size inline pegado (giant). 2) mapFontTagsToPt:
  // convierte el <font size> del editor a un pt controlado (determinista). 3) preserveLineBreaks.
  const safeHtml = preserveLineBreaks(mapFontTagsToPt(stripFontSizing(html)));

  // Compute the plain-text fallback once — used by BOTH the parse-time try/catch path
  // and the commit-time ErrorBoundary path so degradation is deterministic.
  const plain = stripHtml(safeHtml);
  const fallbackNode = <Text style={fallbackStyle}>{plain}</Text>;

  let htmlNode: JSX.Element;
  try {
    htmlNode = (
      <Html stylesheet={stylesheet} resetStyles>
        {safeHtml}
      </Html>
    );
  } catch (e) {
    // Parse-time error (synchronous, from render-call evaluation) — fall back immediately.
    console.warn('PDFRichText: failed to parse HTML at render time, falling back to plain text', e);
    return fallbackNode;
  }

  // Commit-time safety net: if react-pdf throws while walking the parsed tree during
  // commit/reconciliation, the boundary catches it and renders `fallbackNode` instead.
  // resetKey={html} ensures a new content string gets a fresh try (boundary doesn't stay
  // in error state across re-renders with different content).
  return (
    <PDFRichTextErrorBoundary fallback={fallbackNode} resetKey={html}>
      {htmlNode}
    </PDFRichTextErrorBoundary>
  );
}

// Hidden helper export for advanced consumers (e.g., tests). Not part of the official API.
export { stripHtml };

export default PDFRichText;
