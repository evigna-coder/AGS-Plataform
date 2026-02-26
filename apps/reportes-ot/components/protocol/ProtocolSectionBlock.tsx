import React from 'react';
import type { ProtocolRenderMode } from '../../types';

export interface ProtocolSectionBlockProps {
  index: number;
  title: string;
  children: React.ReactNode;
  /** Si true, fuerza salto de página antes de esta sección (html2pdf). */
  pageBreakBefore?: boolean;
  /** En 'edit' no se muestra el separador visual de salto; en 'pdf' sí. */
  renderMode?: ProtocolRenderMode;
}

/**
 * Sección numerada del protocolo tipo informe: poco padding, número en badge pequeño,
 * título en uppercase. Solo para anexo de protocolo (estilo Stitch).
 * Si pageBreakBefore es true, renderiza un separador visual (franja gris) en pantalla
 * y aplica clase/estilo para que html2pdf corte ahí (solo si renderMode !== 'edit').
 */
export const ProtocolSectionBlock: React.FC<ProtocolSectionBlockProps> = ({
  index,
  title,
  children,
  pageBreakBefore,
  renderMode = 'edit',
}) => {
  const showBreakVisual = renderMode !== 'edit' && pageBreakBefore;
  const isEdit = renderMode === 'edit';

  return (
    <>
      {pageBreakBefore && (
        <>
          <div className="html2pdf__page-break break-before-page" style={{ height: 0, breakBefore: 'page', pageBreakBefore: 'always' }} aria-hidden />
          <div className="protocol-page-header-space" aria-hidden />
          {showBreakVisual && (
            <div
              className="visual-page-break-indicator w-full h-12 bg-slate-200 border-y border-dashed border-slate-300 print:hidden"
              style={{ minHeight: '2rem' }}
              aria-hidden
            />
          )}
        </>
      )}
      <section className={`protocol-section-block flex gap-2 ${isEdit ? 'my-2' : 'my-4'}`}>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-[13px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 leading-snug py-[1px] ${isEdit ? 'mb-1' : 'mb-2'}`}
          >
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-black shrink-0"
              aria-hidden
            >
              {index}
            </span>
            {title}
          </h3>
          <div className={isEdit ? 'space-y-1 pl-0' : 'space-y-2 pl-0'}>
            {children}
          </div>
        </div>
      </section>
    </>
  );
};
