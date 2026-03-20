import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';
import type {
  ProtocolTemplateDoc,
  ProtocolSection,
  ProtocolTextSection,
  ProtocolChecklistSection,
  ProtocolTableSection,
  ProtocolSignaturesSection as ProtocolSignaturesSectionType,
  ProtocolData,
  ProtocolRenderMode,
  ProtocolViewMode,
} from '../types';
import {
  ProtocolPage,
  ProtocolSectionBlock,
  ProtocolTable,
  ProtocolChecklist,
  ProtocolSignaturesSection,
  ProtocolTextBlock,
} from './protocol';
import {
  normalizeProtocolTemplate,
  normalizeCompositeConclusionesSection,
} from '../utils/protocolNormalizers';

/** Re-export para quien use ProtocolView y necesite el tipo */
export type { ProtocolRenderMode, ProtocolViewMode } from '../types';

/** Notas al pie del protocolo técnico (series HPLC 1100/1120/1200/1220/1260). */
const PROTOCOL_FOOTNOTES = [
  'Los instructivos son aplicables al módulo correspondiente de cualquiera de las series 1100/1120/1200/1220/1260.',
  'Recomendados por el fabricante.',
  'Las especificaciones pueden ser modificadas por el Cliente de acuerdo a sus requerimientos analíticos.',
];

function ProtocolFootnotes() {
  return (
    <div className="protocol-footnotes mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
      {PROTOCOL_FOOTNOTES.map((text, i) => (
        <p key={i} className="leading-tight">
          <sup className="text-[9px] font-semibold text-slate-600 align-super">{['¹', '²', '³'][i]}</sup>{' '}
          {text}
        </p>
      ))}
    </div>
  );
}

/** Títulos de sección inyectados (Word: "Configuración", "Descripción de los ensayos") antes de sec_6 y sec_8 */
function ProtocolSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="protocol-inserted-heading mt-3 mb-1">
      <h3 className="text-[12px] sm:text-[14px] font-bold text-slate-800 leading-tight">
        {children}
      </h3>
    </div>
  );
}

interface ProtocolViewProps {
  template: ProtocolTemplateDoc;
  readOnly?: boolean;
  data?: ProtocolData;
  onChangeData?: (data: ProtocolData) => void;
  /** Si false, no se muestran guías de corte. Default true. */
  showGuides?: boolean;
  /**
   * Modo: 'edit' = scroll continuo, sin "Parte N", poco espacio; 'print' = preview/PDF, tablas no se parten (move-to-next-page).
   * Default 'edit'. Solo en 'print' se calcula autoBreak y header por página.
   */
  mode?: ProtocolViewMode;
  /**
   * @deprecated Usar mode. Si no se pasa mode, se deriva: edit→edit, preview|pdf→print.
   */
  renderMode?: ProtocolRenderMode;
}

function isTextSection(s: ProtocolSection): s is ProtocolTextSection {
  return s.type === 'text';
}
function isChecklistSection(s: ProtocolSection): s is ProtocolChecklistSection {
  return s.type === 'checklist';
}
function isTableSection(s: ProtocolSection): s is ProtocolTableSection {
  return s.type === 'table';
}

/** Tabla compuesta (sec_18/sec_19): encabezado y subencabezado van en el body; no debe mostrarse thead de 2 filas. */
function isCompositeConclusionesTableSection(section: ProtocolTableSection): boolean {
  if (section.id === 'sec_18' || section.id === 'sec_19') return true;
  const firstRow = section.rows?.[0];
  const firstCell = firstRow?.cells?.[0];
  return (
    firstCell != null &&
    (firstCell as { variant?: string }).variant === 'header' &&
    ((firstCell as { colSpan?: number }).colSpan ?? 0) >= 4
  );
}
function isSignaturesSection(s: ProtocolSection): s is ProtocolSignaturesSectionType {
  return s.type === 'signatures';
}

/** Alto útil por página (297mm - padding - header - footer) en px */
function getUsefulHeightPx(): number {
  if (typeof document === 'undefined') return 900;
  const ruler = document.createElement('div');
  ruler.style.cssText = 'position:absolute;left:-9999px;top:0;pointer-events:none;';
  document.body.appendChild(ruler);
  ruler.style.height = '297mm';
  const pageHeightPx = ruler.offsetHeight;
  ruler.style.height = '10mm';
  const paddingPx = ruler.offsetHeight;
  ruler.style.height = '18mm';
  const headerSpacePx = ruler.offsetHeight;
  ruler.style.height = '8mm';
  const footerSpacePx = ruler.offsetHeight;
  document.body.removeChild(ruler);
  return pageHeightPx - 2 * paddingPx - headerSpacePx - footerSpacePx;
}

const ProtocolView: React.FC<ProtocolViewProps> = ({
  template,
  readOnly = false,
  data,
  onChangeData,
  showGuides = true,
  mode: modeProp,
  renderMode = 'edit',
}) => {
  const mode: ProtocolViewMode =
    modeProp ??
    (renderMode === 'edit' ? 'edit' : 'print');

  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const [printState, setPrintState] = useState<{
    sectionHeights: number[];
    autoBreak: Record<string, boolean>;
    pageDistribution: number[][];
  } | null>(null);

  /** Siempre usar template normalizado (sec_18/sec_19 con fila gris + checkbox y subencabezado Cumple|No cumple|No aplica). */
  const templateToUse = normalizeProtocolTemplate(template);
  const sectionsToRender = templateToUse.sections;

  useLayoutEffect(() => {
    if (mode !== 'print') return;
    const container = sectionsContainerRef.current;
    if (!container) return;

    const sectionEls = container.querySelectorAll<HTMLElement>('[data-protocol-section-id]');
    if (sectionEls.length !== templateToUse.sections.length) return;

    const heights = Array.from(sectionEls).map((el) =>
      el.getBoundingClientRect?.()?.height ?? (el as HTMLElement).offsetHeight
    );
    const usefulHeightPx = getUsefulHeightPx();

    const pages: number[][] = [];
    let currentPage: number[] = [];
    let remaining = usefulHeightPx;
    for (let i = 0; i < templateToUse.sections.length; i++) {
      const section = templateToUse.sections[i];
      const h = heights[i] ?? 0;
      if (section.type === 'table' && h > usefulHeightPx) {
        console.warn(
          `[ProtocolView] Tabla "${section.id}" supera el alto de una hoja A4 (${Math.round(h)}px > ${Math.round(usefulHeightPx)}px). Puede verse partida en PDF.`
        );
      }
      const explicitBreak = 'pageBreakBefore' in section && section.pageBreakBefore;
      const tableDoesNotFit = section.type === 'table' && h > remaining && currentPage.length > 0;
      const anyDoesNotFit = h > remaining && currentPage.length > 0;

      if (explicitBreak && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        remaining = usefulHeightPx;
      }
      if (tableDoesNotFit || (anyDoesNotFit && !explicitBreak)) {
        pages.push(currentPage);
        currentPage = [];
        remaining = usefulHeightPx;
      }
      currentPage.push(i);
      remaining -= h;
    }
    if (currentPage.length > 0) pages.push(currentPage);

    const autoBreakFromPages: Record<string, boolean> = {};
    for (let p = 1; p < pages.length; p++) {
      const firstIdx = pages[p][0];
      if (firstIdx !== undefined) {
        const sec = templateToUse.sections[firstIdx];
        if (sec) autoBreakFromPages[sec.id] = true;
      }
    }

    setPrintState({ sectionHeights: heights, autoBreak: autoBreakFromPages, pageDistribution: pages });
  }, [mode, templateToUse.sections, templateToUse.id]);

  const autoBreak = printState?.autoBreak ?? {};
  const renderModeForBlock: ProtocolRenderMode = mode === 'edit' ? 'edit' : 'preview';

  const renderSectionWithOptionalHeading = (section: ProtocolSection, sectionIndex: number, options?: { hidePageBreakVisual?: boolean; effectivePageBreakBefore?: boolean }) => {
    if (import.meta.env.DEV) {
      console.log('SECTION RENDER', {
        idx: sectionIndex,
        id: section.id,
        type: section.type,
        headersLen: (section as { headers?: unknown[] }).headers?.length ?? null,
        rowsLen: (section as { rows?: unknown[] }).rows?.length ?? null,
      });
    }
    if (import.meta.env.DEV && section.type === 'table') {
      console.log('TABLE SECTION', section.id, {
        idx: sectionIndex,
        headers: (section as { headers?: unknown[] }).headers,
        rowsCount: (section as { rows?: unknown[] }).rows?.length,
      });
    }
    const nodes: React.ReactNode[] = [];
    if (section.id === 'sec_6') nodes.push(<ProtocolSectionHeading key="heading-sec_6">Configuración</ProtocolSectionHeading>);
    if (section.id === 'sec_8') nodes.push(<ProtocolSectionHeading key="heading-sec_8">Descripción de los ensayos</ProtocolSectionHeading>);
    nodes.push(renderSection(section, sectionIndex, options));
    return nodes;
  };

  const renderSection = (
    section: ProtocolSection,
    sectionIndex: number,
    options?: { hidePageBreakVisual?: boolean; effectivePageBreakBefore?: boolean }
  ) => {
    const sectionTitle = section.title || `Sección ${sectionIndex}`;
    const dataSectionId = section.id;
    const pageBreakBefore = options?.hidePageBreakVisual
      ? false
      : (options?.effectivePageBreakBefore ?? ('pageBreakBefore' in section && section.pageBreakBefore) ?? false);

    const isPrintMode = mode === 'print';
    const tableSectionBlockClass =
      isPrintMode && isTableSection(section) ? 'print-block print-table-block' : undefined;

    return (
      <div
        key={section.id}
        data-protocol-section-id={section.id}
        className={tableSectionBlockClass}
      >
        <ProtocolSectionBlock
          index={sectionIndex}
          title={sectionTitle}
          pageBreakBefore={pageBreakBefore}
          renderMode={renderModeForBlock}
        >
          {isTextSection(section) && <ProtocolTextBlock content={section.content} />}
          {isChecklistSection(section) && (() => {
            const sectionData = data?.sections?.[dataSectionId];
            const checkedItemIds: string[] =
              sectionData && 'checkedItemIds' in sectionData ? sectionData.checkedItemIds : [];
            return (
              <ProtocolChecklist
                items={section.items}
                checkedIds={checkedItemIds}
                readOnly={readOnly}
                onChange={(newIds) => {
                  if (!readOnly && onChangeData && data) {
                    onChangeData({
                      ...data,
                      sections: {
                        ...data.sections,
                        [dataSectionId]: { checkedItemIds: newIds },
                      },
                    });
                  }
                }}
              />
            );
          })()}
          {isTableSection(section) && (() => {
            const isComposite = isCompositeConclusionesTableSection(section) || sectionIndex === 19;
            const sectionData = data?.sections?.[dataSectionId];
            const rowsData = (sectionData && 'rows' in sectionData ? sectionData.rows : {}) as Record<
              string,
              Record<string, string>
            >;
            const resolvedSection =
              isComposite
                ? normalizeCompositeConclusionesSection(section as ProtocolTableSection)
                : section;
            let rowsToPass: typeof resolvedSection.rows = resolvedSection.rows ?? [];
            if (isComposite && rowsToPass.length > 0) {
              const firstCell = rowsToPass[0].cells?.[0] as { variant?: string; colSpan?: number } | undefined;
              const hasGreyRow =
                firstCell?.variant === 'header' && (firstCell.colSpan ?? 0) >= 4;
              if (!hasGreyRow) {
                const title = (section as ProtocolTableSection).headers?.[0] ?? (section.rows?.[0]?.cells?.[0] as { value?: string } | undefined)?.value ?? 'Test';
                const greyRow = {
                  id: 'row_0_grey_injected',
                  cells: [
                    { type: 'text' as const, value: String(title), colSpan: 4, variant: 'header' as const },
                    { type: 'checkbox' as const, value: false, checkboxLabel: 'Ver especificación\ndel cliente', variant: 'header' as const, colSpan: 2 },
                  ],
                };
                rowsToPass = [greyRow, ...rowsToPass];
              }
            }
            console.log('[TABLA DEBUG]', {
              visibleSectionIndex: sectionIndex,
              id: section.id,
              isComposite,
              headersLen: (resolvedSection.headers ?? []).length,
              passedHeadersLen: isComposite ? 0 : (resolvedSection.headers ?? []).length,
              firstRow: rowsToPass?.[0]?.id,
              firstCell: rowsToPass?.[0]?.cells?.[0],
              rowsCount: rowsToPass?.length,
            });
            return (
              <div
                className={`protocol-section protocol-table-wrapper${isPrintMode ? ' print-avoid-break avoid-page-break' : ''}`}
              >
              <div data-debug-table={`${section.id}|${sectionIndex}|${isComposite ? 'composite' : 'plain'}`}>
              <ProtocolTable
                headers={isComposite ? [] : (resolvedSection.headers ?? [])}
                rows={rowsToPass}
                editable={!readOnly}
                layout={resolvedSection.layout ?? section.layout}
                columnWidths={resolvedSection.columnWidths ?? section.columnWidths}
                caption={section.caption}
                sectionId={section.id}
                sectionIndex={sectionIndex}
                compositeTitleRowTitle={
                  (section.id === 'sec_19' || section.id === 'sec_18' || sectionIndex === 19) && isTableSection(section)
                    ? ((section as ProtocolTableSection).headers?.[0] ??
                       (section.rows?.[0]?.cells?.[0] as { value?: string } | undefined)?.value ??
                       'Test')
                    : undefined
                }
                getCellValue={(rowId, cellKey) => {
                  const row = rowsData[rowId] ?? {};
                  const v = row[cellKey];
                  if (v !== undefined && v !== '') return v;
                  const rowDef = rowsToPass.find((r) => r.id === rowId);
                  const cellIndex = parseInt(cellKey, 10);
                  const cell = rowDef?.cells?.[cellIndex];
                  if (cell == null) return '';
                  if (cell.defaultValue !== undefined && cell.defaultValue !== '')
                    return String(cell.defaultValue);
                  return String(cell.value ?? '');
                }}
                onChangeCell={(rowId, cellKey, value) => {
                  if (!readOnly && onChangeData && data) {
                    let newRows = {
                      ...rowsData,
                      [rowId]: { ...(rowsData[rowId] ?? {}), [cellKey]: value },
                    };
                    if (dataSectionId === 'sec_15') {
                      if (rowId === 'row_yes_no_1' && cellKey === '1' && value === 'true') {
                        newRows = {
                          ...newRows,
                          row_yes_no_2: { ...(newRows.row_yes_no_2 ?? {}), '0': 'false' },
                        };
                      } else if (rowId === 'row_yes_no_2' && cellKey === '0' && value === 'true') {
                        newRows = {
                          ...newRows,
                          row_yes_no_1: { ...(newRows.row_yes_no_1 ?? {}), '1': 'false' },
                        };
                      }
                    }
                    onChangeData({
                      ...data,
                      sections: {
                        ...data.sections,
                        [dataSectionId]: { rows: newRows },
                      },
                    });
                  }
                }}
              />
              </div>
              </div>
            );
          })()}
          {isSignaturesSection(section) && (
            <ProtocolSignaturesSection signatures={section.signatures} />
          )}
        </ProtocolSectionBlock>
      </div>
    );
  };

  const sectionsSpacingClass = mode === 'edit' ? 'space-y-2' : 'space-y-5';

  // Modo edit: una sola columna, sin header spacer, poco espacio
  if (mode === 'edit') {
    return (
      <div
        ref={sectionsContainerRef}
        style={{
          width: '210mm',
          padding: '10mm',
          boxSizing: 'border-box',
          background: 'white',
        }}
      >
        <div className={sectionsSpacingClass}>
          {sectionsToRender.flatMap((section, idx) => renderSectionWithOptionalHeading(section, idx + 1))}
        </div>
        <ProtocolFootnotes />
      </div>
    );
  }

  // Modo print: fase medición (aún sin pageDistribution)
  if (printState === null) {
    return (
      <div
        ref={sectionsContainerRef}
        style={{
          width: '210mm',
          padding: '10mm',
          boxSizing: 'border-box',
          background: 'white',
        }}
      >
        <div className="protocol-page-header-space" aria-hidden />
        <div className={sectionsSpacingClass}>
          {sectionsToRender.flatMap((section, idx) => renderSectionWithOptionalHeading(section, idx + 1))}
        </div>
        <ProtocolFootnotes />
      </div>
    );
  }

  // Modo print: fase paginada (tablas no partidas; move-to-next-page)
  const { pageDistribution } = printState;
  return (
    <div id="protocol-pages-root">
      {pageDistribution.map((sectionIndices, pageIdx) => {
        const isLastPage = pageIdx === pageDistribution.length - 1;
        return (
          <ProtocolPage key={pageIdx}>
            <div className="protocol-page-header-space" style={{ minHeight: '18mm' }} aria-hidden />
            {sectionIndices.flatMap((secIdx) => {
              const section = sectionsToRender[secIdx];
              const effectiveBreak =
                ('pageBreakBefore' in section && section.pageBreakBefore) || autoBreak[section.id];
              return renderSectionWithOptionalHeading(section, secIdx + 1, {
                hidePageBreakVisual: true,
                effectivePageBreakBefore: effectiveBreak,
              });
            })}
            {isLastPage && <ProtocolFootnotes />}
            <div className="protocol-page-footer-space" aria-hidden />
          </ProtocolPage>
        );
      })}
    </div>
  );
};

export default ProtocolView;
