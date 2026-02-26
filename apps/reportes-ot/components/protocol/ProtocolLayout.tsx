import React, { useRef, useState, useLayoutEffect } from 'react';
import { PageBreakGuides } from './PageBreakGuides';
import type { ProtocolRenderMode, ProtocolViewMode } from '../../types';

export interface ProtocolLayoutProps {
  title: string;
  subtitle?: string;
  codeOrDate?: string;
  children: React.ReactNode;
  /** Si false, no se renderizan las guías de corte (p. ej. en el root exclusivo para PDF). Default true. */
  showGuides?: boolean;
  /** En 'edit' menos padding/espacio y sin header spacer; en 'print' (preview/pdf) se mantiene. */
  mode?: ProtocolViewMode;
  /** @deprecated Usar mode. */
  renderMode?: ProtocolRenderMode;
}

/**
 * Contenedor tipo hoja A4 para el protocolo: fondo gris suave, hoja blanca 210mm,
 * header tipo informe (título, subtítulo, código/versión). Solo para anexo (no Hoja 1).
 * En pantalla pequeña aplica scale para que quepa (desactivado durante generación PDF).
 */
export const ProtocolLayout: React.FC<ProtocolLayoutProps> = ({
  title,
  subtitle,
  codeOrDate,
  children,
  showGuides = true,
  mode: modeProp,
  renderMode = 'edit',
}) => {
  const mode: ProtocolViewMode = modeProp ?? (renderMode === 'edit' ? 'edit' : 'print');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const isPrint = mode === 'print';

  useLayoutEffect(() => {
    if (isPrint) return;
    const wrapper = wrapperRef.current;
    const paper = paperRef.current;
    if (!wrapper || !paper) return;
    const updateScale = () => {
      const wrapperWidth = wrapper.getBoundingClientRect().width;
      const paperWidthPx = paper.offsetWidth;
      if (paperWidthPx <= 0) return;
      const newScale = wrapperWidth < paperWidthPx ? Math.min(1, wrapperWidth / paperWidthPx) : 1;
      setScale((s) => (Math.abs(s - newScale) < 0.01 ? s : newScale));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [isPrint]);

  const contentSpacing = mode === 'edit' ? 'space-y-2' : 'space-y-5';
  const contentPaddingY = mode === 'edit' ? 'py-[3mm]' : 'py-[5mm]';

  return (
    <div ref={wrapperRef} className="protocol-screen-wrapper w-full overflow-x-auto">
      <div
        ref={paperRef}
        className="protocol-layout-paper relative bg-white shadow-md rounded-sm overflow-visible"
        style={{
          width: '210mm',
          minHeight: '297mm',
          boxSizing: 'border-box',
          transform: isPrint ? undefined : scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center',
        }}
      >
      {showGuides && <PageBreakGuides />}
      {/* Header del protocolo — jerarquía tipo informe */}
      <header
        className="relative border-b border-slate-200 bg-white px-[10mm] pt-[6mm] pb-[4mm]"
        style={{ boxSizing: 'border-box' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1"
              aria-hidden
            >
              Protocolo técnico
            </p>
            <h2
              className="text-[18px] font-extrabold text-slate-800 leading-tight"
              style={{ fontSize: '18px' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] font-semibold text-slate-600 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {codeOrDate && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Código / Revisión
              </p>
              <span className="text-[11px] font-mono text-slate-500">
                {codeOrDate}
              </span>
            </div>
          )}
        </div>
      </header>

      <div
        className={`relative px-[10mm] ${contentPaddingY} ${contentSpacing}`}
        style={{ boxSizing: 'border-box' }}
      >
        {mode === 'print' && <div className="protocol-page-header-space" aria-hidden />}
        {children}
      </div>
      </div>
    </div>
  );
}
