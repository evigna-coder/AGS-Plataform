import { Component } from 'react';
import type { ReactNode } from 'react';

interface PDFRichTextErrorBoundaryProps {
  /**
   * Children to render. Typically `<Html>...</Html>` from react-pdf-html.
   */
  children: ReactNode;
  /**
   * Fallback node rendered if `children` throws during render/commit.
   * Typically a plain-text `<Text>` with stripHtml(html) content.
   */
  fallback: ReactNode;
  /**
   * When this value changes (e.g. the html string), the boundary resets and
   * tries to render `children` again. Without this, once a section fails
   * the boundary stays in error state for the rest of the document.
   */
  resetKey?: string | number | null;
}

interface PDFRichTextErrorBoundaryState {
  hasError: boolean;
  resetKey: string | number | null | undefined;
}

/**
 * Class-based React Error Boundary specifically for the @react-pdf/renderer + react-pdf-html
 * pipeline. The try/catch inside PDFRichText only catches synchronous errors thrown during
 * the render-call evaluation. Errors that happen during React's commit phase (e.g. a
 * malformed HTML node that throws when react-pdf walks the tree) bypass try/catch.
 *
 * This boundary catches those and falls back to a plain-text rendering, so a single bad
 * section never crashes the entire PDF document generation.
 *
 * Hooks cannot be Error Boundaries in React — class component is REQUIRED.
 */
export class PDFRichTextErrorBoundary extends Component<
  PDFRichTextErrorBoundaryProps,
  PDFRichTextErrorBoundaryState
> {
  constructor(props: PDFRichTextErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(): Partial<PDFRichTextErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: PDFRichTextErrorBoundaryProps,
    state: PDFRichTextErrorBoundaryState,
  ): Partial<PDFRichTextErrorBoundaryState> | null {
    // If the html (resetKey) changed, reset error state so the new content gets a fresh try.
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error): void {
    console.warn(
      'PDFRichTextErrorBoundary: render-time error in <Html>, falling back to plain text',
      error,
    );
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default PDFRichTextErrorBoundary;
