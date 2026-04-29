import React from 'react';
import { Text } from '@react-pdf/renderer';
import Html from 'react-pdf-html';
import { PDFRichTextErrorBoundary } from './PDFRichTextErrorBoundary';

// execCommand('fontSize', null, '1..6') emits <font size="N"> in Firefox/Chromium.
// FONT_SIZES in RichTextEditor uses values '1'..'6' (px visual: 10/12/14/16/20/24)
// → mapped to pt for PDF. Base presupuesto text is ~7pt; we scale up modestly.
const FONT_SIZE_MAP: Record<string, number> = {
  '1': 7,   // 10px → 7pt
  '2': 8,   // 12px → 8pt
  '3': 9,   // 14px → 9pt
  '4': 10,  // 16px → 10pt
  '5': 12,  // 20px → 12pt
  '6': 14,  // 24px → 14pt
};

// Mirrors PresupuestoPDFEstandar S.condicionText baseline (fontSize 7, lineHeight 1.5).
const stylesheet = {
  p: { fontSize: 7, lineHeight: 1.5, marginBottom: 2 },
  div: { fontSize: 7, lineHeight: 1.5 },
  strong: { fontWeight: 'bold' as const },
  b: { fontWeight: 'bold' as const },
  i: { fontStyle: 'italic' as const },
  em: { fontStyle: 'italic' as const },
  u: { textDecoration: 'underline' as const },
  ul: { marginLeft: 10, marginBottom: 3 },
  ol: { marginLeft: 10, marginBottom: 3 },
  li: { fontSize: 7, lineHeight: 1.5, marginBottom: 1 },
};

// Custom renderer for <font size="N"> — emitted by execCommand('fontSize').
// Typed as React.FC<any> to avoid deep import of react-pdf-html internal types.
// The element prop carries { attributes: Record<string, string> } at runtime.
const FontRenderer: React.FC<{ element: { attributes: Record<string, string> }; children: React.ReactNode }> = ({ element, children }) => {
  const size = element.attributes?.size;
  const pt = size && FONT_SIZE_MAP[size] ? FONT_SIZE_MAP[size] : 7;
  return <Text style={{ fontSize: pt }}>{children}</Text>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderers = { font: FontRenderer } as any;

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

  // Compute the plain-text fallback once — used by BOTH the parse-time try/catch path
  // and the commit-time ErrorBoundary path so degradation is deterministic.
  const plain = stripHtml(html);
  const fallbackNode = <Text style={fallbackStyle}>{plain}</Text>;

  let htmlNode: JSX.Element;
  try {
    htmlNode = (
      <Html stylesheet={stylesheet} renderers={renderers} resetStyles>
        {html}
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
