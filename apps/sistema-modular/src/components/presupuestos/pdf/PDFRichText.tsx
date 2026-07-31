import { Text } from '@react-pdf/renderer';
import Html from 'react-pdf-html';
import { PDFRichTextErrorBoundary } from './PDFRichTextErrorBoundary';

/**
 * TAMAÑO ÚNICO (UAT 2026-07-31, "todo el texto igual, no puedo seguir perdiendo
 * tiempo"): el PDF IGNORA todo tamaño marcado en el contenido — <font size> del
 * editor incluido — y renderiza las condiciones al baseline (7pt). Tres intentos
 * de honrar tamaños por fragmento (mapa px*0.75, luego anclado px/2) terminaron
 * siempre en mezcla: execCommand no logra envolver fragmentos con formato legacy
 * anidado, y cualquier resto queda de otro tamaño. El selector de la toolbar
 * sigue afectando la VISTA del editor; al PDF sale todo parejo.
 */
function mapFontTagsToPt(html: string): string {
  return html
    .replace(/<font\b[^>]*>/gi, '<span>')
    .replace(/<\/font>/gi, '</span>');
}

// TAMAÑO ÚNICO de todo el texto rico del presupuesto (condiciones, contrato).
// 8pt: 7 quedaba corto ("de hecho peor") y 9 empujaba notas técnicas largas a
// una tercera hoja (UAT 2026-07-31). Para cambiar el tamaño de TODAS las
// condiciones, tocar solo esta constante.
const BASE = 8;
const stylesheet = {
  p: { fontSize: BASE, lineHeight: 1.5, marginBottom: 3, textAlign: 'left' as const },
  div: { fontSize: BASE, lineHeight: 1.5, textAlign: 'left' as const },
  strong: { fontWeight: 'bold' as const },
  b: { fontWeight: 'bold' as const },
  i: { fontStyle: 'italic' as const },
  em: { fontStyle: 'italic' as const },
  u: { textDecoration: 'underline' as const },
  // Tags de tamaño relativo que puede traer contenido pegado (guardado antes del
  // sanitizador): forzarlos al tamaño único.
  small: { fontSize: BASE, lineHeight: 1.5 },
  big: { fontSize: BASE, lineHeight: 1.5 },
  h1: { fontSize: BASE, lineHeight: 1.5, fontWeight: 'bold' as const },
  h2: { fontSize: BASE, lineHeight: 1.5, fontWeight: 'bold' as const },
  h3: { fontSize: BASE, lineHeight: 1.5, fontWeight: 'bold' as const },
  h4: { fontSize: BASE, lineHeight: 1.5, fontWeight: 'bold' as const },
  h5: { fontSize: BASE, lineHeight: 1.5, fontWeight: 'bold' as const },
  h6: { fontSize: BASE, lineHeight: 1.5, fontWeight: 'bold' as const },
};

/**
 * Neutraliza el estilado inline del HTML pegado desde Word/web/PDF: `font-size`
 * (react-pdf-html lo aplica literal, p.ej. 20pt vs 7pt base → texto GIGANTE y le gana
 * al `<font size>` del editor), y también `font-family` / `color` / `background`
 * (UAT 2026-07-29: notas administrativas pegadas salían con color y letra del origen,
 * y el tamaño elegido en la toolbar no tenía efecto porque el inline pisaba todo).
 * Al quitarlos, el formato queda gobernado por el editor (negrita/cursiva/listas y el
 * `<font size>` que mapFontTagsToPt convierte a un pt controlado) o por la base.
 * Esto limpia también el contenido VIEJO ya guardado con estilos pegados, sin re-pegar.
 *
 * OJO: NO tocar el atributo `size` de `<font>` — ese ES el control de tamaño del editor;
 * lo convierte mapFontTagsToPt (que corre después). Si se stripeara acá, el tamaño del
 * editor dejaría de tener efecto.
 */
function stripFontSizing(html: string): string {
  return html
    .replace(/font-size\s*:\s*[^;"']+;?/gi, '')
    .replace(/font-family\s*:\s*[^;"']+;?/gi, '')
    .replace(/(?:^|;|\s)color\s*:\s*[^;"']+;?/gi, '')
    .replace(/background(?:-color)?\s*:\s*[^;"']+;?/gi, '')
    // Sangrías pegadas (UAT 2026-07-31: un párrafo copiado salía "apartado del
    // borde, como si fuese lista"): fuera margin/padding/text-indent inline.
    .replace(/(?:margin|padding)(?:-(?:left|right|top|bottom))?\s*:\s*[^;"']+;?/gi, '')
    .replace(/text-indent\s*:\s*[^;"']+;?/gi, '')
    // <blockquote> pegado → div plano (era otra fuente de sangría).
    .replace(/<blockquote\b[^>]*>/gi, '<div>')
    .replace(/<\/blockquote>/gi, '</div>')
    // Listas → líneas planas (UAT 2026-07-31: un párrafo pegado venía como
    // <ul>/<li> y salía sangrado "como si fuese lista", con el marcador pisando
    // la primera letra). En las condiciones no se usan viñetas; todo texto plano.
    .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '<div>')
    .replace(/<\/li>/gi, '</div>')
    // <font color="..."> / <font face="..."> del contenido viejo: fuera los atributos
    // de color/tipografía, conservando `size` (lo procesa mapFontTagsToPt). Dos pasadas:
    // una sola no alcanza si el mismo tag trae color Y face (el scan sigue tras el reemplazo).
    .replace(/(<font\b[^>]*?)\s(?:color|face)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '$1')
    .replace(/(<font\b[^>]*?)\s(?:color|face)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '$1');
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
  // 4) Wrapper <div> raíz: los text nodes SUELTOS (sin <p>/<div>) no matchean ningún
  //    selector del stylesheet y react-pdf les aplica su default (18pt) → texto gigante
  //    (UAT 2026-07-29, notas técnicas pegadas). Adentro de un div heredan los 7pt base;
  //    los <span style="font-size">, del editor, le siguen ganando al div.
  const safeHtml = `<div>${preserveLineBreaks(mapFontTagsToPt(stripFontSizing(html)))}</div>`;

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
