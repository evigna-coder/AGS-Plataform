import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CatalogTableView } from './CatalogTableView';
import { CatalogTextView } from './CatalogTextView';
import { CatalogChecklistView } from './CatalogChecklistView';
import { CatalogSignaturesView } from './CatalogSignaturesView';

/* ── Constantes A4 ── */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_PADDING = { top: 6, right: 10, bottom: 10, left: 10 }; // mm
const HEADER_HEIGHT_MM = 14;
const FOOTER_HEIGHT_MM = 14;
const HEADER_CONTENT_GAP_MM = 8;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PAGE_PADDING.top - PAGE_PADDING.bottom - HEADER_HEIGHT_MM - HEADER_CONTENT_GAP_MM - FOOTER_HEIGHT_MM;
const MM_TO_PX = 3.7795;
const CONTENT_HEIGHT_PX = CONTENT_HEIGHT_MM * MM_TO_PX;

const SERVICE_LABELS: Record<string, string> = {
  calificacion_instalacion: 'Calificación de Instalación (IQ)',
  calificacion_operacion: 'Calificación de Operación (OQ)',
  calificacion_desempeno: 'Calificación de Desempeño (PQ)',
  mantenimiento_preventivo: 'Mantenimiento Preventivo',
  mantenimiento_correctivo: 'Mantenimiento Correctivo',
  verificacion: 'Verificación',
  calibracion: 'Calibración',
};

/* ── Types ── */
interface ProtocolMeta {
  otNumber: string;
  razonSocial: string;
  sistema: string;
  moduloSerie: string;
  fechaInicio: string;
  tipoServicio: string;
  logoSrc: string;
  isoLogoSrc: string;
}

interface ContentItem {
  key: string;
  node: React.ReactNode;
  glueWithPrev?: boolean;
  measuredHeight?: number;
  sliceOffset?: number;
  /** Título del protocolo (viene del tableSnapshot.headerTitle) */
  headerTitle?: string | null;
  /** Número QF del protocolo (viene del tableSnapshot.footerQF) */
  footerQF?: string | null;
}

interface PageDef {
  items: ContentItem[];
}

interface Props {
  protocolSelections: any[];
  instrumentosSeleccionados: any[];
  meta: ProtocolMeta;
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  fechaInicio: string;
  fechaFin: string;
  /** Tablas vivas del catálogo para buscar headerTitle/footerQF actualizados (fallback si el snapshot no los tiene) */
  catalogTables?: { id: string; projectId?: string | null; headerTitle?: string | null; footerQF?: string | null }[];
  /** Proyectos del catálogo para resolver headerTitle/footerQF a nivel proyecto */
  catalogProjects?: { id: string; headerTitle?: string | null; footerQF?: string | null }[];
}

/** Obtiene headerTitle de la primera selection de la página */
const getPageHeaderTitle = (page: PageDef, fallback: string): string => {
  for (const item of page.items) {
    if (item.headerTitle) return item.headerTitle;
  }
  return fallback;
};

/** Obtiene footerQF de la primera selection de la página */
const getPageFooterQF = (page: PageDef): string => {
  for (const item of page.items) {
    if (item.footerQF) return item.footerQF;
  }
  return '';
};

/* ━━━━━━━━━━━━━━━━━━━━ PAGE HEADER ━━━━━━━━━━━━━━━━━━━━ */
const PageHeader: React.FC<{ meta: ProtocolMeta; protocolTitle?: string }> = ({ meta, protocolTitle }) => {
  const otNum = meta.otNumber.startsWith('OT-') ? meta.otNumber.substring(3) : meta.otNumber;
  const serviceLabel = SERVICE_LABELS[meta.tipoServicio] || 'Protocolo de Servicio';
  const title = protocolTitle || serviceLabel;

  return (
    <div style={{ height: `${HEADER_HEIGHT_MM}mm`, flexShrink: 0 }}>
      <div className="flex items-start justify-between">
        <img src={meta.logoSrc} alt="AGS Analítica" style={{ width: '100px', height: 'auto', display: 'block', flexShrink: 0 }} />
        <div className="flex-1 flex justify-center items-center px-4" style={{ minHeight: '32px' }}>
          <p className="text-[10px] text-slate-700 font-semibold tracking-tight leading-snug text-center" style={{ maxWidth: '340px' }}>{title}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] text-slate-400 font-medium leading-none">Reporte de servicio</p>
          <p className="text-[13px] font-bold text-indigo-700 leading-tight">N° {otNum}</p>
        </div>
      </div>
      <div className="h-[2px] bg-indigo-600 mt-2" />
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━ PAGE FOOTER ━━━━━━━━━━━━━━━━━━━━ */
const PageFooter: React.FC<{ meta: ProtocolMeta; pageNum: number; totalPages: number; qfNumber?: string }> = ({ meta, pageNum, totalPages, qfNumber }) => {
  const otNum = meta.otNumber.startsWith('OT-') ? meta.otNumber.substring(3) : meta.otNumber;
  return (
    <div style={{ height: `${FOOTER_HEIGHT_MM}mm`, flexShrink: 0 }}>
      <div className="border-t border-slate-200 text-[9px] text-slate-500" style={{ paddingTop: '1mm' }}>
        <div className="relative flex items-end justify-between">
          <div className="flex items-end">
            <img src={meta.isoLogoSrc} alt="Certificación ISO 9001" className="h-[12mm] w-auto" style={{ maxHeight: '12mm' }} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-end">
            <span className="whitespace-nowrap">{qfNumber || 'QF-PRO-001 Rev.01'}</span>
          </div>
          <div className="flex items-end whitespace-nowrap">
            Página {pageNum} de {totalPages} | Reporte N° {otNum}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━ INSTRUMENTOS TABLE ━━━━━━━━━━━━━━━━━━━━ */
const InstrumentosTable: React.FC<{ instrumentos: any[] }> = ({ instrumentos }) => (
  <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
    <div className="flex items-center px-3 py-1.5 bg-slate-50 border-b border-slate-200">
      <p className="font-semibold text-xs text-slate-900">Instrumentos y Patrones Utilizados</p>
    </div>
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-100 border-b border-slate-200">
          {['Identificación', 'Tipo', 'Marca', 'Modelo', 'Nº Serie', 'Certificado', 'Vencimiento'].map(h => (
            <th key={h} className="px-2 py-1 text-[10px] font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {instrumentos.map((inst: any, idx: number) => (
          <tr key={inst.id} className={idx % 2 ? 'bg-slate-50/50' : ''}>
            <td className="px-2 py-1 text-[10px] border-r border-slate-100">{inst.nombre}</td>
            <td className="px-2 py-1 text-[10px] border-r border-slate-100">
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${inst.tipo === 'patron' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {inst.tipo === 'patron' ? 'Patrón' : 'Instrumento'}
              </span>
            </td>
            <td className="px-2 py-1 text-[10px] border-r border-slate-100">{inst.marca || '—'}</td>
            <td className="px-2 py-1 text-[10px] border-r border-slate-100">{inst.modelo || '—'}</td>
            <td className="px-2 py-1 text-[10px] font-mono border-r border-slate-100">{inst.serie || '—'}</td>
            <td className="px-2 py-1 text-[10px] border-r border-slate-100">{inst.certificadoEmisor || '—'}</td>
            <td className="px-2 py-1 text-[10px]">
              {inst.certificadoVencimiento
                ? new Date(inst.certificadoVencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ━━━━━━━━━━━━━━━━━━━━ MAIN PAGINATED COMPONENT ━━━━━━━━━━━━━━━━━━━━ */
export const ProtocolPaginatedPreview: React.FC<Props> = ({
  protocolSelections, instrumentosSeleccionados, meta,
  signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
  fechaInicio, fechaFin, catalogTables, catalogProjects,
}) => {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageDef[]>([]);

  const sortedSelections = [...protocolSelections].sort((a, b) => (a.tableSnapshot.orden || 999) - (b.tableSnapshot.orden || 999));

  const buildContentItems = useCallback((): ContentItem[] => {
    const items: ContentItem[] = [];

    for (let idx = 0; idx < sortedSelections.length; idx++) {
      const sel = sortedSelections[idx];
      const prevHasAttachToNext = idx > 0 && (sortedSelections[idx - 1].tableSnapshot.attachToNext ?? false);
      const glue = (sel.tableSnapshot.attachToPrevious ?? false) || prevHasAttachToNext;

      const node = sel.tableSnapshot.tableType === 'signatures' ? (
        <CatalogSignaturesView
          selection={sel} readOnly
          signatureClient={signatureClient} signatureEngineer={signatureEngineer}
          aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
          fechaInicio={fechaInicio} fechaFin={fechaFin}
        />
      ) : sel.tableSnapshot.tableType === 'text' ? (
        <CatalogTextView selection={sel} readOnly />
      ) : sel.tableSnapshot.tableType === 'checklist' ? (
        <CatalogChecklistView selection={sel} readOnly onChangeData={() => {}} />
      ) : (
        <CatalogTableView selection={sel} readOnly onChangeData={() => {}} />
      );

      // Buscar headerTitle/footerQF: snapshot → catálogo vivo → proyecto
      const live = catalogTables?.find(t => t.id === sel.tableId);
      const projectId = sel.tableSnapshot.projectId || live?.projectId;
      const project = projectId ? catalogProjects?.find(p => p.id === projectId) : null;
      const headerTitle = sel.tableSnapshot.headerTitle || live?.headerTitle || project?.headerTitle || null;
      const footerQF = sel.tableSnapshot.footerQF || live?.footerQF || project?.footerQF || null;

      items.push({
        key: sel.tableId,
        node,
        glueWithPrev: glue && items.length > 0,
        headerTitle,
        footerQF,
      });
    }

    if (instrumentosSeleccionados.length > 0) {
      items.push({
        key: '__instrumentos__',
        node: <InstrumentosTable instrumentos={instrumentosSeleccionados} />,
      });
    }

    return items;
  }, [sortedSelections, instrumentosSeleccionados]);

  const contentItems = buildContentItems();

  // Phase 1: measure heights of each item and distribute across pages
  useEffect(() => {
    if (!measureRef.current || contentItems.length === 0) return;
    const timer = setTimeout(() => {
      const container = measureRef.current;
      if (!container) return;
      const children = Array.from(container.children) as HTMLElement[];
      const heights: number[] = children.map(child => child.offsetHeight + 16);

      const pagesResult: PageDef[] = [];
      let currentPageItems: ContentItem[] = [];
      let currentHeight = 0;

      for (let i = 0; i < contentItems.length; i++) {
        const item = contentItems[i];
        const itemHeight = heights[i] || 200;

        if (item.glueWithPrev && currentPageItems.length > 0) {
          if (currentHeight + itemHeight <= CONTENT_HEIGHT_PX) {
            // Fits on current page — keep glued
            currentPageItems.push({ ...item, measuredHeight: itemHeight });
            currentHeight += itemHeight;
          } else {
            // Doesn't fit: pull prev item to new page to keep the pair together
            const prevItem = currentPageItems.pop()!;
            const prevHeight = prevItem.measuredHeight || 0;
            currentHeight -= prevHeight;

            if (currentPageItems.length > 0) {
              pagesResult.push({ items: [...currentPageItems] });
            }

            if (prevHeight + itemHeight <= CONTENT_HEIGHT_PX) {
              // Pair fits on a fresh page
              currentPageItems = [prevItem, { ...item, measuredHeight: itemHeight }];
              currentHeight = prevHeight + itemHeight;
            } else {
              // Pair too tall even for a fresh page: break glue
              pagesResult.push({ items: [prevItem] });
              currentPageItems = [{ ...item, measuredHeight: itemHeight, glueWithPrev: false }];
              currentHeight = itemHeight;
            }
          }
        } else if (itemHeight > CONTENT_HEIGHT_PX) {
          if (currentPageItems.length > 0) {
            pagesResult.push({ items: [...currentPageItems] });
            currentPageItems = [];
            currentHeight = 0;
          }
          let offset = 0;
          let sliceIdx = 0;
          while (offset < itemHeight) {
            pagesResult.push({
              items: [{
                ...item,
                key: `${item.key}__slice${sliceIdx}`,
                measuredHeight: Math.min(CONTENT_HEIGHT_PX, itemHeight - offset),
                sliceOffset: offset,
              }],
            });
            offset += CONTENT_HEIGHT_PX;
            sliceIdx++;
          }
        } else {
          if (currentHeight + itemHeight > CONTENT_HEIGHT_PX && currentPageItems.length > 0) {
            pagesResult.push({ items: [...currentPageItems] });
            currentPageItems = [];
            currentHeight = 0;
          }
          currentPageItems.push({ ...item, measuredHeight: itemHeight });
          currentHeight += itemHeight;
        }
      }

      if (currentPageItems.length > 0) {
        pagesResult.push({ items: currentPageItems });
      }

      // Glue fix: if first item on a page has glueWithPrev, pull from previous page
      let changed = true;
      while (changed) {
        changed = false;
        for (let p = 1; p < pagesResult.length; p++) {
          const page = pagesResult[p];
          if (page.items.length > 0 && page.items[0].glueWithPrev) {
            const prevPage = pagesResult[p - 1];
            if (prevPage.items.length > 0) {
              const movedItem = prevPage.items.pop()!;
              page.items.unshift(movedItem);
              changed = true;
            }
          }
        }
      }
      const cleanedPages = pagesResult.filter(p => p.items.length > 0);

      if (cleanedPages.length === 0) {
        cleanedPages.push({ items: contentItems });
      }

      setPages(cleanedPages);
    }, 300);

    return () => clearTimeout(timer);
  }, [contentItems.length, protocolSelections, instrumentosSeleccionados]);

  const serviceLabel = SERVICE_LABELS[meta.tipoServicio] || 'Protocolo de Servicio';

  // Protocol-wide fallback: si alguna tabla del protocolo tiene headerTitle/footerQF, se aplica a todas las páginas
  const protocolWideTitle = contentItems.find(i => i.headerTitle)?.headerTitle || serviceLabel;
  const protocolWideQF = contentItems.find(i => i.footerQF)?.footerQF || '';

  return (
    <>
      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        data-measurement-div="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${A4_WIDTH_MM - PAGE_PADDING.left - PAGE_PADDING.right}mm`,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {contentItems.map(item => (
          <div key={item.key} style={{ marginBottom: '16px' }}>
            {item.node}
          </div>
        ))}
      </div>

      {/* Paginated A4 pages */}
      {pages.length > 0 && pages.map((page, pageIdx) => {
        const pageTitle = getPageHeaderTitle(page, protocolWideTitle);
        const pageQF = getPageFooterQF(page) || protocolWideQF;

        return (
          <div
            key={pageIdx}
            data-protocol-page
            className="bg-white shadow-lg shrink-0 flex flex-col"
            style={{
              width: `${A4_WIDTH_MM}mm`,
              height: `${A4_HEIGHT_MM}mm`,
              padding: `${PAGE_PADDING.top}mm ${PAGE_PADDING.right}mm ${PAGE_PADDING.bottom}mm ${PAGE_PADDING.left}mm`,
              boxSizing: 'border-box',
              overflow: 'hidden',
              pageBreakAfter: 'always',
              breakAfter: 'page',
            }}
          >
            <PageHeader meta={meta} protocolTitle={pageTitle} />
            <div style={{ height: `${HEADER_CONTENT_GAP_MM}mm`, flexShrink: 0 }} />

            <div className="flex-1">
              {page.items.map((item) => {
                const isSlice = item.sliceOffset !== undefined;
                const offset = item.sliceOffset ?? 0;
                return (
                  <div
                    key={item.key}
                    className={isSlice ? 'protocol-slice-container' : undefined}
                    data-slice-offset={isSlice ? item.sliceOffset : undefined}
                    style={isSlice ? {
                      height: `${CONTENT_HEIGHT_PX}px`,
                      overflow: 'hidden',
                    } : {
                      marginBottom: item.glueWithPrev ? '0px' : '12px',
                      marginTop: item.glueWithPrev ? '-4px' : undefined,
                    }}
                  >
                    {isSlice && offset > 0 ? (
                      <div style={{ transform: `translateY(-${offset}px)` }}>
                        {item.node}
                      </div>
                    ) : item.node}
                  </div>
                );
              })}
            </div>

            <PageFooter meta={meta} pageNum={pageIdx + 1} totalPages={pages.length} qfNumber={pageQF} />
          </div>
        );
      })}

      {/* Loading state while measuring */}
      {pages.length === 0 && contentItems.length > 0 && (
        <div className="bg-white shadow-lg shrink-0 flex items-center justify-center"
          style={{ width: `${A4_WIDTH_MM}mm`, height: `${A4_HEIGHT_MM}mm` }}>
          <p className="text-sm text-slate-400">Preparando páginas...</p>
        </div>
      )}
    </>
  );
};
