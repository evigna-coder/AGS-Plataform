import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CatalogTableView } from './CatalogTableView';
import { CatalogTextView } from './CatalogTextView';
import { CatalogChecklistView } from './CatalogChecklistView';
import { CatalogSignaturesView } from './CatalogSignaturesView';
import { CatalogCoverView } from './CatalogCoverView';

/* ── Constantes A4 ── */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_PADDING = { top: 6, right: 10, bottom: 10, left: 10 }; // mm
const HEADER_HEIGHT_MM = 14;
const FOOTER_HEIGHT_MM = 18;
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

/* ── Helper: split checklist items by depth-0 headers AND embedded_tables ── */
function splitChecklistByHeaders(items: any[]): any[][] {
  if (!items || items.length === 0) return [items || []];
  const hasHeaders = items.some((it: any) => it.depth === 0);
  const hasEmbeddedTables = items.some((it: any) => it.itemType === 'embedded_table');
  if (!hasHeaders && !hasEmbeddedTables) return [items];

  const groups: any[][] = [];
  let current: any[] = [];

  for (const item of items) {
    // Split at depth-0 headers
    if (item.depth === 0 && current.length > 0) {
      groups.push(current);
      current = [];
    }
    // Split before embedded_table so it becomes its own group (won't be cut across pages)
    if (item.itemType === 'embedded_table' && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(item);
    // Split after embedded_table too — table is its own atomic group
    if (item.itemType === 'embedded_table') {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/* ── AGS company constants ── */
const AGS_VARIABLES: Record<string, string> = {
  'ags.empresa': 'AGS ANALITICA S.A.',
  'ags.direccion': 'Arenales 605 Piso 15, Vicente López (B1638BRG), Prov. de Buenos Aires',
  'ags.telefono': 'Tel: (011) 45247 247',
  'ags.email': 'info@agsanalitica.com',
  'ags.web': 'www.agsanalitica.com',
};

/* ── Types ── */
interface ProtocolMeta {
  otNumber: string;
  razonSocial: string;
  clienteContacto: string;
  clienteDireccion: string;
  clienteSector: string;
  sistema: string;
  moduloMarca?: string;
  moduloSerie: string;
  codigoInternoCliente: string;
  fechaInicio: string;
  tipoServicio: string;
  logoSrc: string;
  isoLogoSrc: string;
  ingenieroNombre: string;
}

interface ContentItem {
  key: string;
  node: React.ReactNode;
  glueWithPrev?: boolean;
  measuredHeight?: number;
  sliceOffset?: number;
  /** Alto visible de este slice — permite cortes exactos a límite de fila en vez de cortes por píxeles fijos. */
  sliceHeight?: number;
  /** Si es una carátula (página completa sin header/footer) */
  isCover?: boolean;
  /** Título del protocolo (viene del tableSnapshot.headerTitle) */
  headerTitle?: string | null;
  /** Número QF del protocolo (viene del tableSnapshot.footerQF) */
  footerQF?: string | null;
}

interface PageDef {
  items: ContentItem[];
  isCover?: boolean;
}

interface Props {
  protocolSelections: any[];
  instrumentosSeleccionados: any[];
  /** Patrones seleccionados desde la nueva colección /patrones (por lote) */
  patronesSeleccionados?: any[];
  /** Columnas cromatográficas seleccionadas desde la nueva colección /columnas (por serie) */
  columnasSeleccionadas?: any[];
  meta: ProtocolMeta;
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  fechaInicio: string;
  fechaFin: string;
  /** Tablas vivas del catálogo para buscar headerTitle/footerQF actualizados y resolver variables en snapshots obsoletos */
  catalogTables?: { id: string; projectId?: string | null; headerTitle?: string | null; footerQF?: string | null; templateRows?: import('@ags/shared').TableCatalogRow[] }[];
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


/* ━━━━━━━━━━━━━━━━━━━━ PAGE HEADER ━━━━━━━━━━━━━━━━━━━━ */
const PageHeader: React.FC<{ meta: ProtocolMeta; protocolTitle?: string }> = ({ meta, protocolTitle }) => {
  const serviceLabel = SERVICE_LABELS[meta.tipoServicio] || 'Protocolo de Servicio';
  const title = protocolTitle || serviceLabel;

  return (
    <div style={{ height: `${HEADER_HEIGHT_MM}mm`, flexShrink: 0 }}>
      <div className="flex items-center justify-between">
        <img src={meta.logoSrc} alt="AGS Analítica" style={{ width: '100px', height: 'auto', display: 'block', flexShrink: 0 }} />
        <div className="flex-1 flex justify-center items-center px-4">
          <p className="text-[15px] text-slate-700 font-semibold tracking-tight leading-snug text-center" style={{ maxWidth: '400px' }}>{title}</p>
        </div>
      </div>
      <div className="mt-2" style={{ height: '0.5px', backgroundColor: '#1e3a8a' }} />
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━ PAGE FOOTER ━━━━━━━━━━━━━━━━━━━━ */
const PageFooter: React.FC<{ meta: ProtocolMeta; pageNum: number; totalPages: number }> = ({ meta, pageNum, totalPages }) => {
  return (
    <div style={{ height: `${FOOTER_HEIGHT_MM}mm`, flexShrink: 0 }}>
      <div className="border-t border-slate-200 text-[9px] text-slate-500" style={{ paddingTop: '1mm' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '1.5mm' }}>
          <div className="flex items-center">
            <img src={meta.isoLogoSrc} alt="Certificación ISO 9001" className="h-[10mm] w-auto" style={{ maxHeight: '10mm' }} />
          </div>
          <div className="flex items-center whitespace-nowrap">
            Página {pageNum} de {totalPages}
          </div>
        </div>
        <div className="text-center text-[8px] text-slate-400 border-t border-slate-100" style={{ paddingTop: '1mm' }}>
          {AGS_VARIABLES['ags.empresa']} &nbsp;|&nbsp; {AGS_VARIABLES['ags.direccion']} &nbsp;|&nbsp; {AGS_VARIABLES['ags.telefono']} &nbsp;|&nbsp; {AGS_VARIABLES['ags.email']}
        </div>
      </div>
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━ INSTRUMENTOS / PATRONES / COLUMNAS TABLE ━━━━━━━━━━━━━━━━━━━━ */
const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const cellCls = 'px-2 py-1 text-[10px] border-r border-slate-100';

/** Bloque único de tabla con header slate-50 y thead slate-100 */
const TableBlock: React.FC<{ title: string; headers: string[]; children: React.ReactNode }> = ({ title, headers, children }) => (
  <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
    <div className="flex items-center px-3 py-1.5 bg-slate-50 border-b border-slate-200">
      <p className="font-semibold text-xs text-slate-900">{title}</p>
    </div>
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-100 border-b border-slate-200">
          {headers.map(h => (
            <th key={h} className="px-2 py-1 text-[10px] font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const InstrumentosTable: React.FC<{
  instrumentos: any[];
  patrones?: any[];
  columnas?: any[];
}> = ({ instrumentos, patrones = [], columnas = [] }) => {
  // Soporte legacy: si `instrumentos` incluye items con tipo='patron', separarlos
  const insts = instrumentos.filter((i: any) => i.tipo !== 'patron');
  const legacyPatrones = instrumentos.filter((i: any) => i.tipo === 'patron');
  const hasAnyPatron = patrones.length > 0 || legacyPatrones.length > 0;

  return (
    <div className="space-y-3">
      {insts.length > 0 && (
        <TableBlock title="Instrumentos Utilizados" headers={['Identificación', 'Marca', 'Modelo', 'Nº Serie', 'Certificado', 'Vencimiento']}>
          {insts.map((inst: any, idx: number) => (
            <tr key={inst.id} className={idx % 2 ? 'bg-slate-50/50' : ''}>
              <td className={cellCls}>{inst.nombre}</td>
              <td className={cellCls}>{inst.marca || '—'}</td>
              <td className={cellCls}>{inst.modelo || '—'}</td>
              <td className={`${cellCls} font-mono`}>{inst.serie || '—'}</td>
              <td className={cellCls}>{inst.certificadoEmisor || '—'}</td>
              <td className="px-2 py-1 text-[10px]">{fmtDate(inst.certificadoVencimiento)}</td>
            </tr>
          ))}
        </TableBlock>
      )}
      {hasAnyPatron && (
        <TableBlock title="Patrones Utilizados" headers={['Artículo', 'Marca', 'Descripción', 'Lote', 'Certificado', 'Vencimiento']}>
          {/* Patrones nuevos (colección /patrones) */}
          {patrones.map((p: any, idx: number) => (
            <tr key={`p-${p.patronId}-${p.lote}-${idx}`} className={idx % 2 ? 'bg-slate-50/50' : ''}>
              <td className={`${cellCls} font-mono`}>{p.codigoArticulo || '—'}</td>
              <td className={cellCls}>{p.marca || '—'}</td>
              <td className={cellCls}>{p.descripcion || '—'}</td>
              <td className={`${cellCls} font-mono`}>{p.lote || '—'}</td>
              <td className={cellCls}>{p.certificadoEmisor || '—'}</td>
              <td className="px-2 py-1 text-[10px]">{fmtDate(p.fechaVencimiento)}</td>
            </tr>
          ))}
          {/* Patrones legacy (tipo='patron' en colección /instrumentos) */}
          {legacyPatrones.map((inst: any, idx: number) => (
            <tr key={`lp-${inst.id}`} className={(patrones.length + idx) % 2 ? 'bg-slate-50/50' : ''}>
              <td className={`${cellCls} font-mono`}>{inst.modelo || '—'}</td>
              <td className={cellCls}>{inst.marca || '—'}</td>
              <td className={cellCls}>{inst.nombre}</td>
              <td className={`${cellCls} font-mono`}>{inst.lote || '—'}</td>
              <td className={cellCls}>{inst.certificadoEmisor || '—'}</td>
              <td className="px-2 py-1 text-[10px]">{fmtDate(inst.certificadoVencimiento)}</td>
            </tr>
          ))}
        </TableBlock>
      )}
      {columnas.length > 0 && (
        <TableBlock title="Columnas Utilizadas" headers={['Artículo', 'Marca', 'Descripción', 'Nº Serie', 'Certificado', 'Vencimiento']}>
          {columnas.map((c: any, idx: number) => (
            <tr key={`c-${c.columnaId}-${c.serie}-${idx}`} className={idx % 2 ? 'bg-slate-50/50' : ''}>
              <td className={`${cellCls} font-mono`}>{c.codigoArticulo || '—'}</td>
              <td className={cellCls}>{c.marca || '—'}</td>
              <td className={cellCls}>{c.descripcion || '—'}</td>
              <td className={`${cellCls} font-mono`}>{c.serie || '—'}</td>
              <td className={cellCls}>{c.certificadoEmisor || '—'}</td>
              <td className="px-2 py-1 text-[10px]">{fmtDate(c.fechaVencimiento)}</td>
            </tr>
          ))}
        </TableBlock>
      )}
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━ MAIN PAGINATED COMPONENT ━━━━━━━━━━━━━━━━━━━━ */
export const ProtocolPaginatedPreview: React.FC<Props> = ({
  protocolSelections, instrumentosSeleccionados,
  patronesSeleccionados = [], columnasSeleccionadas = [],
  meta,
  signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
  fechaInicio, fechaFin, catalogTables, catalogProjects,
}) => {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageDef[]>([]);

  /** Variables del reporte disponibles para auto-rellenar filas con variable binding */
  const protocolVariables: Record<string, string> = {
    'cliente.razonSocial': meta.razonSocial ?? '',
    'cliente.direccionCompleta': meta.clienteDireccion ?? '',
    'cliente.contacto': meta.clienteContacto ?? '',
    'cliente.sector': meta.clienteSector ?? '',
    'ot.numero': meta.otNumber ?? '',
    'ingeniero.nombre': meta.ingenieroNombre ?? '',
    'equipo.modelo': meta.sistema ?? '',
    'equipo.marca': meta.moduloMarca ?? '',
    'equipo.serie': meta.moduloSerie ?? '',
    'equipo.id': meta.codigoInternoCliente ?? '',
    ...AGS_VARIABLES,
  };

  const sortedSelections = [...protocolSelections].sort((a, b) => (a.tableSnapshot.orden || 999) - (b.tableSnapshot.orden || 999));

  const buildContentItems = useCallback((): ContentItem[] => {
    const items: ContentItem[] = [];

    for (let idx = 0; idx < sortedSelections.length; idx++) {
      const sel = sortedSelections[idx];
      const prevHasAttachToNext = idx > 0 && (sortedSelections[idx - 1].tableSnapshot.attachToNext ?? false);
      const glue = (sel.tableSnapshot.attachToPrevious ?? false) || prevHasAttachToNext;

      // Buscar headerTitle/footerQF: snapshot → catálogo vivo → proyecto
      const live = catalogTables?.find(t => t.id === sel.tableId);
      const projectId = sel.tableSnapshot.projectId || live?.projectId;
      const project = projectId ? catalogProjects?.find(p => p.id === projectId) : null;
      const headerTitle = sel.tableSnapshot.headerTitle || live?.headerTitle || project?.headerTitle || null;
      const footerQF = sel.tableSnapshot.footerQF || live?.footerQF || project?.footerQF || null;

      // Carátulas: página completa sin header/footer
      if (sel.tableSnapshot.tableType === 'cover') {
        const node = <CatalogCoverView
          selection={sel} isPrint
          otNumber={meta.otNumber}
          fechaInicio={meta.fechaInicio}
          sistemaNombre={meta.sistema}
          moduloMarca={meta.moduloMarca}
          agsVisibleId={meta.codigoInternoCliente}
          numeroSerie={meta.moduloSerie}
          ingenieroNombre={meta.ingenieroNombre || aclaracionEspecialista}
          logoSrc={meta.logoSrc}
        />;
        items.push({ key: sel.tableId, node, isCover: true, headerTitle, footerQF });
        continue;
      }

      if (sel.tableSnapshot.tableType === 'checklist') {
        // Dividir checklist por cabeceras (depth 0) para page-break inteligente
        const checklistItems = sel.tableSnapshot.checklistItems ?? [];
        const groups = splitChecklistByHeaders(checklistItems);

        for (let g = 0; g < groups.length; g++) {
          const isFirst = g === 0;
          const isLast = g === groups.length - 1;
          const groupSel = {
            ...sel,
            tableSnapshot: {
              ...sel.tableSnapshot,
              checklistItems: groups[g],
              name: sel.tableSnapshot.name,
              // Solo mostrar título en el primer grupo; continuaciones lo ocultan
              ...(!isFirst ? { showTitle: false } : {}),
            },
            // Observaciones solo en el último grupo
            observaciones: isLast ? sel.observaciones : undefined,
          };

          const node = <CatalogChecklistView selection={groupSel} readOnly isPrint onChangeData={() => {}}
            signatureClient={signatureClient} signatureEngineer={signatureEngineer}
            aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
            fechaInicio={fechaInicio} fechaFin={fechaFin}
          />;
          items.push({
            key: groups.length > 1 ? `${sel.tableId}__g${g}` : sel.tableId,
            node,
            glueWithPrev: isFirst ? (glue && items.length > 0) : false,
            headerTitle,
            footerQF,
          });
        }
      } else {
        const node = sel.tableSnapshot.tableType === 'signatures' ? (
          <CatalogSignaturesView
            selection={sel} readOnly
            signatureClient={signatureClient} signatureEngineer={signatureEngineer}
            aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
            fechaInicio={fechaInicio} fechaFin={fechaFin}
          />
        ) : sel.tableSnapshot.tableType === 'text' ? (
          <CatalogTextView selection={sel} readOnly />
        ) : (
          <CatalogTableView selection={sel} readOnly isPrint onChangeData={() => {}} variables={protocolVariables} liveTemplateRows={catalogTables?.find(t => t.id === sel.tableId)?.templateRows} siblingSelections={sortedSelections} />
        );

        items.push({
          key: sel.tableId,
          node,
          glueWithPrev: glue && items.length > 0,
          headerTitle,
          footerQF,
        });
      }
    }

    const hasAnyInventario =
      instrumentosSeleccionados.length > 0 ||
      patronesSeleccionados.length > 0 ||
      columnasSeleccionadas.length > 0;
    if (hasAnyInventario) {
      items.push({
        key: '__instrumentos__',
        node: <InstrumentosTable
          instrumentos={instrumentosSeleccionados}
          patrones={patronesSeleccionados}
          columnas={columnasSeleccionadas}
        />,
      });
    }

    return items;
  }, [sortedSelections, instrumentosSeleccionados, patronesSeleccionados, columnasSeleccionadas]);

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

        // Covers get their own full page (no header/footer)
        if (item.isCover) {
          if (currentPageItems.length > 0) {
            pagesResult.push({ items: [...currentPageItems] });
            currentPageItems = [];
            currentHeight = 0;
          }
          pagesResult.push({ items: [item], isCover: true });
          continue;
        }

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

          // Intento corte alineado a filas: si el nodo contiene una <table>, cortamos
          // sólo DESPUÉS de una fila de <tbody> (nunca después del <thead> — evita que
          // el header quede huérfano al pie de la página). Si no hay tabla o no hay
          // cortes válidos, fallback al corte por píxeles (comportamiento viejo).
          const childEl = children[i];
          const tableEl = childEl?.querySelector('table') as HTMLTableElement | null;
          const bodyRowEls = tableEl
            ? Array.from(tableEl.querySelectorAll('tbody > tr'))
            : [];
          const cutPoints: number[] = []; // offsets (en px desde el top del item) donde se puede cortar
          if (tableEl && bodyRowEls.length > 0) {
            const itemTop = childEl.getBoundingClientRect().top;
            for (const tr of bodyRowEls) {
              const rect = tr.getBoundingClientRect();
              const bottomRel = rect.bottom - itemTop;
              // Candidato válido: después de una fila de datos (bottom de tbody > tr).
              if (bottomRel > 0 && !cutPoints.includes(bottomRel)) cutPoints.push(bottomRel);
            }
            cutPoints.sort((a, b) => a - b);
          }

          let offset = 0;
          let sliceIdx = 0;
          while (offset < itemHeight) {
            const remaining = itemHeight - offset;
            let sliceHeight: number;
            if (cutPoints.length > 0 && remaining > CONTENT_HEIGHT_PX) {
              // Elegir el corte válido más grande que entre en una página.
              const target = offset + CONTENT_HEIGHT_PX;
              let chosen = -1;
              for (const cp of cutPoints) {
                if (cp <= target && cp > offset) chosen = cp;
                if (cp > target) break;
              }
              sliceHeight = chosen > offset ? chosen - offset : CONTENT_HEIGHT_PX;
            } else {
              sliceHeight = Math.min(CONTENT_HEIGHT_PX, remaining);
            }
            pagesResult.push({
              items: [{
                ...item,
                key: `${item.key}__slice${sliceIdx}`,
                measuredHeight: sliceHeight,
                sliceOffset: offset,
                sliceHeight,
              }],
            });
            offset += sliceHeight;
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

      // Glue fix: if first item on a page has glueWithPrev, pull from previous page.
      // IMPORTANTE: no mover slices (una porción de una tabla grande no puede
      // "pegarse" a nada; mover un slice arruina la paginación). Si el item a mover
      // es un slice, se omite — se rompe el glue en ese borde.
      let changed = true;
      while (changed) {
        changed = false;
        for (let p = 1; p < pagesResult.length; p++) {
          const page = pagesResult[p];
          if (page.items.length > 0 && page.items[0].glueWithPrev) {
            const prevPage = pagesResult[p - 1];
            if (prevPage.items.length > 0) {
              const candidate = prevPage.items[prevPage.items.length - 1];
              if (candidate.sliceOffset !== undefined) {
                // Slice: no mover. Romper glue para que este borde no intente pegarse.
                page.items[0] = { ...page.items[0], glueWithPrev: false };
                continue;
              }
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
  }, [contentItems.length, protocolSelections, instrumentosSeleccionados, patronesSeleccionados, columnasSeleccionadas]);

  const serviceLabel = SERVICE_LABELS[meta.tipoServicio] || 'Protocolo de Servicio';

  // Protocol-wide fallback: si alguna tabla del protocolo tiene headerTitle, se aplica a todas las páginas
  const protocolWideTitle = contentItems.find(i => i.headerTitle)?.headerTitle || serviceLabel;

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
        // Cover pages: full page, no header/footer
        if (page.isCover) {
          return (
            <div
              key={pageIdx}
              data-protocol-page
              data-cover-page
              className="bg-white shadow-lg shrink-0 flex flex-col mx-auto"
              style={{
                width: `${A4_WIDTH_MM}mm`,
                height: `${A4_HEIGHT_MM}mm`,
                boxSizing: 'border-box',
                overflow: 'hidden',
                pageBreakAfter: 'always',
                breakAfter: 'page',
              }}
            >
              {page.items[0]?.node}
            </div>
          );
        }

        // Calculate page number excluding cover pages
        const contentPageIdx = pages.slice(0, pageIdx).filter(p => !p.isCover).length + 1;
        const totalContentPages = pages.filter(p => !p.isCover).length;

        return (
          <div
            key={pageIdx}
            data-protocol-page
            className="bg-white shadow-lg shrink-0 flex flex-col mx-auto"
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
                      height: `${item.sliceHeight ?? CONTENT_HEIGHT_PX}px`,
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

            <PageFooter meta={meta} pageNum={contentPageIdx} totalPages={totalContentPages} />
          </div>
        );
      })}

      {/* Loading state while measuring */}
      {pages.length === 0 && contentItems.length > 0 && (
        <div className="bg-white shadow-lg shrink-0 flex items-center justify-center mx-auto"
          style={{ width: `${A4_WIDTH_MM}mm`, height: `${A4_HEIGHT_MM}mm` }}>
          <p className="text-sm text-slate-400">Preparando páginas...</p>
        </div>
      )}
    </>
  );
};
