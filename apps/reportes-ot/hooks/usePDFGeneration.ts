import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { FirebaseService } from '../services/firebaseService';
import { UseReportFormReturn } from './useReportForm';
import { SignaturePadHandle } from '../components/SignaturePad';
import { getPDFOptions } from '../utils/pdfOptions';
import { enqueuePdfjs } from '../utils/pdfjsQueue';
import type { InstrumentoPatronOption, AdjuntoMeta, CertificadoIngeniero, PatronSeleccionado, ColumnaSeleccionada } from '../types/instrumentos';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

declare const html2pdf: any;

const nextFrame = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => res()));
const nextTwoFrames = async (): Promise<void> => {
  await nextFrame();
  await nextFrame();
};

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Invalid data URL');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const A4_POINTS = { width: 595.28, height: 841.89 };


interface GeneratedPDFs {
  reportBlob: Blob;
  reportFilename: string;
  protocolBlob: Blob | null;
  protocolFilename: string | null;
}

/** Sanitiza un string para uso como nombre de archivo */
function sanitizeFilename(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, '_').trim();
}

export interface UsePDFGenerationReturn {
  // Funciones
  generatePDFBlob: () => Promise<Blob>;
  generatePDFs: () => Promise<GeneratedPDFs>;
  handleFinalSubmit: () => Promise<void>;
  confirmClientAndFinalize: () => Promise<void>;

  // Estados
  isGenerating: boolean;
  generationStep: string;
  isPreviewMode: boolean;
  pdfBlob: Blob | null;

  // Setters para estados que necesitan ser controlados externamente
  setIsPreviewMode: (value: boolean) => void;
  setPdfBlob: (blob: Blob | null) => void;
}

export const usePDFGeneration = (
  reportForm: UseReportFormReturn,
  firebase: FirebaseService,
  otNumber: string,
  isModoFirma: boolean,
  clientPadRef: React.RefObject<SignaturePadHandle>,
  engineerPadRef: React.RefObject<SignaturePadHandle>,
  validateBeforeClientConfirm: () => boolean,
  showAlert: (options: { title?: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; onConfirm?: () => void; confirmText?: string }) => void,
  instrumentosSeleccionados: InstrumentoPatronOption[] = [],
  certificadosIngenieroSeleccionados: CertificadoIngeniero[] = [],
  adjuntos: AdjuntoMeta[] = [],
  setAdjuntos?: (adjuntos: AdjuntoMeta[]) => void,
  assetCache?: Map<string, ArrayBuffer>,
  patronesSeleccionados: PatronSeleccionado[] = [],
  columnasSeleccionadas: ColumnaSeleccionada[] = [],
  clienteRequiereTrazabilidad: boolean = false,
): UsePDFGenerationReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const {
    formState,
    setters,
    reportState
  } = reportForm;

  const {
    signatureClient,
    signatureEngineer,
    protocolTemplateId
  } = formState;

  const {
    setClientConfirmed,
    setSignatureClient,
    setSignatureEngineer,
    setStatus
  } = setters;

  // ── Helper: precargar imágenes dentro de un contenedor ──
  const preloadFromContainer = (container: HTMLElement | null) => {
    if (!container) return Promise.resolve();
    return Promise.all(Array.from(container.querySelectorAll('img')).map(img =>
      new Promise(resolve => {
        if (img.complete) resolve(null);
        else { img.onload = () => resolve(null); img.onerror = () => resolve(null); }
      })
    ));
  };

  // ── Helper: renderizar un PDF externo a páginas A4 JPEG ──
  const renderExternalPdfToBlob = async (pdfBytes: ArrayBuffer, label: string): Promise<Blob | null> => {
    try {
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      const externalDoc = await PDFDocument.create();

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const pdfPage = await pdfDoc.getPage(i);
        const viewport = pdfPage.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const jpgBytes = dataUrlToUint8Array(jpgDataUrl);
        const jpg = await externalDoc.embedJpg(jpgBytes);

        const page = externalDoc.addPage([A4_POINTS.width, A4_POINTS.height]);
        const imgAspect = canvas.width / canvas.height;
        const pageAspect = A4_POINTS.width / A4_POINTS.height;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgAspect > pageAspect) {
          drawW = A4_POINTS.width;
          drawH = A4_POINTS.width / imgAspect;
          drawX = 0;
          drawY = A4_POINTS.height - drawH;
        } else {
          drawH = A4_POINTS.height;
          drawW = A4_POINTS.height * imgAspect;
          drawX = (A4_POINTS.width - drawW) / 2;
          drawY = 0;
        }
        page.drawImage(jpg, { x: drawX, y: drawY, width: drawW, height: drawH });
      }

      const numPagesRendered = pdfDoc.numPages;
      pdfDoc.destroy();
      console.log(`[PDF][${label}] ${numPagesRendered} página(s) renderizadas OK`);
      return new Blob([await externalDoc.save()], { type: 'application/pdf' });
    } catch (err) {
      console.warn(`[PDF][${label}] Error renderizando PDF:`, err);
      return null;
    }
  };

  // ── Merge helper: combina array de blobs en un solo PDF ──
  const mergePdfBlobs = async (blobs: Blob[]): Promise<Blob> => {
    const mergedPdf = await PDFDocument.create();
    for (const partBlob of blobs) {
      try {
        const partDoc = await PDFDocument.load(await partBlob.arrayBuffer());
        const pages = await mergedPdf.copyPages(partDoc, partDoc.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      } catch (err) {
        console.warn('[PDF][MERGE] Error cargando parte del PDF, omitiendo:', err);
      }
    }
    return new Blob([await mergedPdf.save()], { type: 'application/pdf' });
  };

  // ── Generar Hoja 1 (reporte de servicio) como Blob ──
  const generateReportBlob = async (): Promise<Blob> => {
    const element = document.getElementById('pdf-container');
    if (!element) {
      if (isModoFirma) {
        const url = new URL(window.location.href);
        url.searchParams.delete('modo');
        window.location.href = url.toString();
        throw new Error("Redirigiendo a la vista principal para generar el PDF...");
      }
      throw new Error("No se encontró el contenedor para PDF. Por favor, recargue la página.");
    }

    element.style.display = 'block';
    element.style.margin = '0 auto';
    element.style.width = '210mm';

    const images = element.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img =>
      new Promise(resolve => {
        if (img.complete) resolve(null);
        else { img.onload = () => resolve(null); img.onerror = () => resolve(null); }
      })
    ));

    const opt = getPDFOptions(otNumber, element, true);
    console.log("Generando PDF Hoja 1…");
    return await html2pdf().set(opt).from(element).outputPdf('blob');
  };

  // ── Generar páginas de protocolo como Blob ──
  const generateProtocolPagesBlob = async (): Promise<Blob | null> => {
    const tablasPdf = document.getElementById('pdf-container-tablas-pdf');
    const hasTablas = tablasPdf && tablasPdf.children.length > 0;
    if (!hasTablas) return null;

    console.log("[PDF][TABLAS] Generando PDF de protocolos…");

    // Esperar a que las páginas del protocolo existan y tengan dimensiones reales.
    // ProtocolPaginatedPreview usa un setTimeout(300ms) para medir + otro render.
    let protocolPages: HTMLElement[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const pages = document.querySelectorAll<HTMLElement>('[data-protocol-page]');
      if (pages.length > 0 && Array.from(pages).every(p => p.offsetWidth > 0 && p.offsetHeight > 0)) {
        protocolPages = Array.from(pages);
        break;
      }
      console.log(`[PDF][TABLAS] Esperando páginas de protocolo… intento ${attempt + 1}/20`);
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (protocolPages.length > 0) {
      const measureDivs = document.querySelectorAll<HTMLElement>('[data-measurement-div]');
      measureDivs.forEach(div => { div.style.display = 'none'; });

      window.scrollTo(0, 0);
      await nextTwoFrames();
      await preloadFromContainer(document.getElementById('pdf-preview-tablas'));

      const protocolPdfDoc = await PDFDocument.create();

      for (const pageEl of Array.from(protocolPages)) {
        // Capturar valores de inputs/selects ANTES de clonar (cloneNode no copia .value)
        const origInputs = pageEl.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"], input[type="date"]');
        const origSelects = pageEl.querySelectorAll<HTMLSelectElement>('select');
        const inputValues = Array.from(origInputs).map(el => ({
          value: el.value,
          fontSize: window.getComputedStyle(el).fontSize,
          fontFamily: window.getComputedStyle(el).fontFamily,
          color: window.getComputedStyle(el).color,
          textAlign: window.getComputedStyle(el).textAlign,
        }));
        const selectValues = Array.from(origSelects).map(el => ({
          text: el.options[el.selectedIndex]?.text || el.value || '',
          fontSize: window.getComputedStyle(el).fontSize,
          fontFamily: window.getComputedStyle(el).fontFamily,
          color: window.getComputedStyle(el).color,
        }));

        const clone = pageEl.cloneNode(true) as HTMLElement;
        clone.style.position = 'fixed';
        clone.style.top = '0';
        clone.style.left = '-9999px';
        clone.style.zIndex = '99999';
        clone.style.margin = '0';

        clone.querySelectorAll('.overflow-hidden, .truncate').forEach(el => {
          (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
        });

        // Reemplazar inputs clonados por spans con los valores reales del original
        const clonedInputs = clone.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"], input[type="date"]');
        clonedInputs.forEach((el, idx) => {
          const data = inputValues[idx];
          if (!data) return;
          const span = document.createElement('span');
          span.textContent = data.value;
          span.style.fontSize = data.fontSize;
          span.style.fontFamily = data.fontFamily;
          span.style.color = data.color;
          span.style.textAlign = data.textAlign;
          span.style.display = 'inline-block';
          span.style.width = '100%';
          el.replaceWith(span);
        });
        const clonedSelects = clone.querySelectorAll<HTMLSelectElement>('select');
        clonedSelects.forEach((el, idx) => {
          const data = selectValues[idx];
          if (!data) return;
          const span = document.createElement('span');
          span.textContent = data.text;
          span.style.fontSize = data.fontSize;
          span.style.fontFamily = data.fontFamily;
          span.style.color = data.color;
          el.replaceWith(span);
        });

        document.body.appendChild(clone);
        await nextFrame();

        try {
          const canvas = await html2canvas(clone, {
            scale: Math.max(window.devicePixelRatio, 3),
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
          });

          const pngData = canvas.toDataURL('image/png');
          const pngBytes = dataUrlToUint8Array(pngData);
          const png = await protocolPdfDoc.embedPng(pngBytes);
          const page = protocolPdfDoc.addPage([A4_POINTS.width, A4_POINTS.height]);
          page.drawImage(png, { x: 0, y: 0, width: A4_POINTS.width, height: A4_POINTS.height });
        } finally {
          clone.remove();
        }
      }

      measureDivs.forEach(div => { div.style.display = ''; });

      console.log(`[PDF][TABLAS] ${protocolPages.length} página(s) de protocolo generadas OK`);
      return new Blob([await protocolPdfDoc.save()], { type: 'application/pdf' });

    } else {
      console.warn("[PDF][TABLAS] No se encontraron [data-protocol-page], usando fallback html2pdf");
      const tablasTarget = tablasPdf!;
      const savedStyleTablas = tablasTarget.getAttribute('style') || '';
      Object.assign(tablasTarget.style, {
        position: 'absolute', top: '0', left: '0',
        width: '210mm', transform: 'none', zIndex: '99999',
        opacity: '1', pointerEvents: 'none', background: 'white',
      });

      await nextTwoFrames();
      await preloadFromContainer(tablasTarget);

      try {
        const optTablas = getPDFOptions(otNumber, tablasTarget, true, true);
        return await html2pdf().set(optTablas).from(tablasTarget).outputPdf('blob');
      } finally {
        tablasTarget.setAttribute('style', savedStyleTablas);
      }
    }
  };

  // ── Generar páginas de fotos como Blob ──
  const generateFotoPagesBlob = async (): Promise<Blob | null> => {
    const fotosPdf = document.getElementById('pdf-container-fotos-pdf');
    const fotoPages = fotosPdf
      ? Array.from(fotosPdf.querySelectorAll<HTMLElement>('.protocol-page'))
      : [];
    if (fotoPages.length === 0 || !fotosPdf) return null;

    console.log(`[PDF][FOTOS] ${fotoPages.length} página(s) de fotos`);

    const savedStyleFotos = fotosPdf.getAttribute('style') || '';
    Object.assign(fotosPdf.style, {
      position: 'absolute', top: '0', left: '0',
      width: '210mm', transform: 'none', zIndex: '99999',
      opacity: '1', pointerEvents: 'none', background: 'white',
    });

    await nextTwoFrames();
    await preloadFromContainer(fotosPdf);

    try {
      const fotosPdfDoc = await PDFDocument.create();
      for (const pageEl of fotoPages) {
        const canvas = await html2canvas(pageEl, {
          scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const jpgBytes = dataUrlToUint8Array(dataUrl);
        const jpg = await fotosPdfDoc.embedJpg(jpgBytes);
        const page = fotosPdfDoc.addPage([A4_POINTS.width, A4_POINTS.height]);
        page.drawImage(jpg, { x: 0, y: 0, width: A4_POINTS.width, height: A4_POINTS.height });
      }
      console.log("[PDF][FOTOS] PDF de fotos generado OK");
      return new Blob([await fotosPdfDoc.save()], { type: 'application/pdf' });
    } finally {
      fotosPdf.setAttribute('style', savedStyleFotos);
    }
  };

  // ── Helper: obtener ArrayBuffer de una URL (cache → descarga con retry) ──
  const getAssetBuffer = async (url: string): Promise<ArrayBuffer> => {
    // Buscar en cache primero (clonar para evitar detached ArrayBuffer)
    const cached = assetCache?.get(url);
    if (cached && cached.byteLength > 0) {
      console.log(`[PDF] Cache hit para asset (${cached.byteLength} bytes)`);
      return cached.slice(0);
    }
    // Descargar con 1 retry
    const download = async (retries = 1): Promise<Blob> => {
      try {
        return await firebase.downloadStorageBlob(url);
      } catch (err) {
        if (retries > 0) {
          console.log(`[PDF] Reintentando descarga…`);
          await new Promise(r => setTimeout(r, 1000));
          return download(retries - 1);
        }
        throw err;
      }
    };
    const blob = await download();
    return blob.arrayBuffer();
  };

  // ── Helper: descargar PDFs en paralelo y renderizar secuencialmente ──
  // IMPORTANTE: pdfjs-dist usa un Web Worker compartido que NO es thread-safe.
  // Si renderizamos múltiples PDFs en paralelo, aparecen errores "Invalid page request".
  // Por eso descargamos en paralelo (rápido, limitado por red) pero renderizamos en serie.
  const downloadAndRenderCerts = async (urls: string[], label: string): Promise<Blob[]> => {
    if (urls.length === 0) {
      console.log(`[PDF][${label}] Sin URLs de certificados para descargar`);
      return [];
    }
    console.log(`[PDF][${label}] Descargando ${urls.length} certificado(s) en paralelo…`);

    // Paso 1: descargar todos en paralelo
    const buffers = await Promise.all(
      urls.map(async (url) => {
        try {
          const buffer = await getAssetBuffer(url);
          console.log(`[PDF][${label}] Asset listo: ${buffer.byteLength} bytes`);
          return buffer;
        } catch (err) {
          console.warn(`[PDF][${label}] Error descargando:`, err);
          return null;
        }
      })
    );

    // Paso 2: renderizar a través de la cola global pdfjs (serializa entre todos
    // los grupos, no solo dentro de este)
    const results: Blob[] = [];
    for (const buffer of buffers) {
      if (!buffer) continue;
      try {
        const rendered = await enqueuePdfjs(() => renderExternalPdfToBlob(buffer, label));
        if (rendered) {
          results.push(rendered);
        } else {
          console.warn(`[PDF][${label}] renderExternalPdfToBlob retornó null — ¿el archivo no es PDF?`);
        }
      } catch (err) {
        console.warn(`[PDF][${label}] Error renderizando:`, err);
      }
    }
    return results;
  };

  // ── Generar blobs de adjuntos PDF (paralelo) ──
  const generateAdjuntosBlobs = async (): Promise<Blob[]> => {
    // Detectar PDFs por mimeType O por extensión del nombre (algunos dispositivos
    // no setean mimeType correctamente y queda como application/octet-stream o vacío)
    const pdfAdjuntos = adjuntos.filter(a => {
      const mime = (a.mimeType || '').toLowerCase();
      const name = (a.fileName || '').toLowerCase();
      const isImage = mime.startsWith('image/');
      if (isImage) return false; // Las imágenes van por AdjuntosPDFSection
      return mime === 'application/pdf'
          || mime === 'application/x-pdf'
          || name.endsWith('.pdf');
    });
    console.log(`[PDF][ADJUNTOS] Detectados ${pdfAdjuntos.length} adjunto(s) PDF:`, pdfAdjuntos.map(a => `${a.fileName} (${a.mimeType || 'sin mime'})`));
    return downloadAndRenderCerts(pdfAdjuntos.map(a => a.url), 'ADJUNTOS');
  };

  // ── Generar blobs de certificados de ingeniero (paralelo) ──
  const generateCertIngBlobs = async (): Promise<Blob[]> => {
    const certIngUrls = certificadosIngenieroSeleccionados
      .map(c => c.certificadoUrl)
      .filter((url): url is string => !!url);
    return downloadAndRenderCerts(certIngUrls, 'CERT-ING');
  };

  // ── Generar blobs de certificados de instrumentos (paralelo) ──
  // Si el cliente requiere trazabilidad, se intercala trazab_i inmediatamente después
  // del cert_i del mismo instrumento (orden final: cert1, trazab1, cert2, trazab2, …).
  const generateCertInstBlobs = async (): Promise<Blob[]> => {
    console.log(`[PDF][CERT-INST] instrumentosSeleccionados total: ${instrumentosSeleccionados.length}`);
    const instrumentos = instrumentosSeleccionados.filter(i => i.tipo === 'instrumento');
    console.log(`[PDF][CERT-INST] Instrumentos (tipo=instrumento): ${instrumentos.length}`);

    if (instrumentos.length === 0) return [];

    // Descarga + render por instrumento en paralelo; cada instrumento produce [cert?, trazab?]
    const pairs = await Promise.all(
      instrumentos.map(async (inst) => {
        const certUrl = inst.certificadoUrl || null;
        // Fallback: si el snapshot del reporte es viejo (sin trazabilidadUrl),
        // re-consultar /instrumentos/{id} para obtener la URL actual.
        let trazabUrl: string | null = null;
        if (clienteRequiereTrazabilidad) {
          trazabUrl = inst.trazabilidadUrl
            ?? await firebase.getInstrumentoTrazabilidadUrl(inst.id);
        }
        const [certBlobs, trazabBlobs] = await Promise.all([
          certUrl ? downloadAndRenderCerts([certUrl], 'CERT-INST') : Promise.resolve([]),
          trazabUrl ? downloadAndRenderCerts([trazabUrl], 'TRAZAB-INST') : Promise.resolve([]),
        ]);
        return [...certBlobs, ...trazabBlobs];
      })
    );

    return pairs.flat();
  };

  // ── Generar blobs de certificados de patrones (paralelo) ──
  // Une patrones legacy (tipo='patron' en /instrumentos) + patrones nuevos (/patrones por lote)
  const generateCertPatronBlobs = async (): Promise<Blob[]> => {
    const legacy = instrumentosSeleccionados.filter(i => i.tipo === 'patron');
    const legacyUrls = legacy.map(i => i.certificadoUrl).filter((u): u is string => !!u);
    const nuevosUrls = patronesSeleccionados.map(p => p.certificadoUrl).filter((u): u is string => !!u);
    const allUrls = [...legacyUrls, ...nuevosUrls];
    console.log(`[PDF][CERT-PATRON] legacy=${legacy.length} nuevos=${patronesSeleccionados.length} → ${allUrls.length} certificado(s)`);
    return downloadAndRenderCerts(allUrls, 'CERT-PATRON');
  };

  // ── Generar blobs de certificados de columnas (paralelo) ──
  const generateCertColumnasBlobs = async (): Promise<Blob[]> => {
    const certUrls = columnasSeleccionadas
      .map(c => c.certificadoUrl)
      .filter((u): u is string => !!u);
    console.log(`[PDF][CERT-COLUMNAS] Columnas=${columnasSeleccionadas.length} → ${certUrls.length} certificado(s)`);
    return downloadAndRenderCerts(certUrls, 'CERT-COLUMNAS');
  };

  /**
   * Genera 1 o 2 PDFs según haya protocolo o no.
   * - Sin protocolo: 1 PDF con todo (Hoja 1 + fotos + adjuntos + certs)
   * - Con protocolo: 2 PDFs separados (reporte solo + protocolo con anexos)
   */
  const generatePDFs = async (): Promise<GeneratedPDFs> => {
    const { sistema, codigoInternoCliente, protocolSelections } = formState;
    const hasProtocol = protocolSelections && protocolSelections.length > 0;

    document.body.classList.add('pdf-generating');

    try {
      await nextTwoFrames();
      await document.fonts.ready;
      await Promise.all([
        preloadFromContainer(document.getElementById('pdf-container-tablas-pdf')),
        preloadFromContainer(document.getElementById('pdf-container-fotos-pdf')),
      ]);

      // Siempre generar Hoja 1 primero (necesita DOM limpio)
      setGenerationStep('Generando reporte…');
      const reportBlob = await generateReportBlob();

      // Rendering DOM (secuencial) + descargas (paralelo) corren simultáneamente
      setGenerationStep('Renderizando protocolos y descargando certificados…');
      const [domResults, adjuntosBlobs, certIngBlobs, certInstBlobs, certPatronBlobs, certColumnasBlobs] =
        await Promise.all([
          // Grupo DOM: secuencial entre sí (html2canvas no soporta concurrencia)
          (async () => {
            const protocolBlob = await generateProtocolPagesBlob();
            const fotosBlob = await generateFotoPagesBlob();
            return { protocolBlob, fotosBlob };
          })(),
          // Grupo descargas: paralelo entre sí y con el grupo DOM
          generateAdjuntosBlobs(),
          generateCertIngBlobs(),
          generateCertInstBlobs(),
          generateCertPatronBlobs(),
          generateCertColumnasBlobs(),
        ]);

      const { protocolBlob, fotosBlob } = domResults;

      // Colectar todos los anexos en orden
      const annexParts: Blob[] = [];
      if (protocolBlob) annexParts.push(protocolBlob);
      if (fotosBlob) annexParts.push(fotosBlob);
      annexParts.push(...adjuntosBlobs);
      annexParts.push(...certInstBlobs);
      annexParts.push(...certPatronBlobs);
      annexParts.push(...certColumnasBlobs);
      annexParts.push(...certIngBlobs);

      const idPart = codigoInternoCliente ? ` ID ${sanitizeFilename(codigoInternoCliente)}` : '';
      const sysPart = sistema ? ` - ${sanitizeFilename(sistema)}` : '';

      setGenerationStep('Armando PDF final…');

      if (hasProtocol && protocolBlob) {
        // 2 archivos separados
        const reportFilename = `Reporte de servicio N° ${sanitizeFilename(otNumber)}${idPart}${sysPart}.pdf`;
        const protocolFilename = `Protocolo de servicio N° ${sanitizeFilename(otNumber)}${idPart}${sysPart}.pdf`;

        // Protocolo: protocolo + fotos + adjuntos + certs (sin Hoja 1)
        const protocolMerged = await mergePdfBlobs(annexParts);

        console.log(`[PDF] Generados 2 archivos: "${reportFilename}" + "${protocolFilename}"`);
        return {
          reportBlob,
          reportFilename,
          protocolBlob: protocolMerged,
          protocolFilename,
        };
      } else {
        // 1 solo archivo con todo
        const filename = `Reporte de servicio N° ${sanitizeFilename(otNumber)}${idPart}${sysPart}.pdf`;
        if (annexParts.length > 0) {
          const allParts = [reportBlob, ...annexParts];
          const merged = await mergePdfBlobs(allParts);
          console.log(`[PDF] Generado 1 archivo: "${filename}"`);
          return { reportBlob: merged, reportFilename: filename, protocolBlob: null, protocolFilename: null };
        }
        console.log(`[PDF] Generado 1 archivo (solo Hoja 1): "${filename}"`);
        return { reportBlob, reportFilename: filename, protocolBlob: null, protocolFilename: null };
      }
    } finally {
      document.body.classList.remove('pdf-generating');
    }
  };

  // Backward-compatible: genera un solo blob con todo mergeado
  const generatePDFBlob = async (): Promise<Blob> => {
    const result = await generatePDFs();
    if (result.protocolBlob) {
      return await mergePdfBlobs([result.reportBlob, result.protocolBlob]);
    }
    return result.reportBlob;
  };

  // Helper para detectar si es móvil
  const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Helper para descargar PDF
  const downloadPDF = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Helper para compartir PDF en móvil
  const sharePDFMobile = async (blob: Blob, filename: string, ot: string): Promise<boolean> => {
    if (!isMobileDevice() || !navigator.share || !navigator.canShare) {
      return false;
    }

    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      
      if (navigator.canShare({ files: [file] })) {
        console.log("Compartiendo PDF con Web Share API...");
        await navigator.share({
          files: [file],
          title: `Reporte ${ot}`,
          text: `Reporte OT ${ot}`
        });
        console.log("PDF compartido exitosamente");
        return true;
      }
    } catch (shareError: any) {
      if (shareError.name === 'AbortError') {
        console.log("Usuario canceló el compartir");
      } else {
        console.error("Error al compartir:", shareError);
      }
    }
    return false;
  };

  // Finalizar y descargar PDF
  const handleFinalSubmit = async () => {
    if (!validateBeforeClientConfirm()) {
      return;
    }

    const clientSignature = signatureClient || clientPadRef.current?.getSignature();
    const engineerSignature = signatureEngineer || engineerPadRef.current?.getSignature();

    if (!engineerSignature || !clientSignature) {
      showAlert({
        title: 'Error',
        message: 'Se requieren ambas firmas (Técnico y Cliente) para emitir el reporte final.',
        type: 'error'
      });
      return;
    }

    setIsGenerating(true);
    try {
      // DATOS FINALIZADOS
      const finalizedData = {
        ...reportState,
        signatureClient: clientSignature,
        signatureEngineer: engineerSignature,
        status: 'FINALIZADO',
        updatedAt: new Date().toISOString()
      };

      // OBLIGATORIO: Guardar en Firestore antes de generar PDF
      console.log("Guardando en Firestore", finalizedData);
      console.log("Guardando reporte en Firestore...");
      
      await firebase.saveReport(otNumber, finalizedData);
      
      console.log("Guardado OK");
      console.log("Reporte guardado correctamente");

      // Crear ticket interno si las acciones son solo para AGS (solo en primera finalización, no al regenerar)
      const wasAlreadyFinalized = formState.status === 'FINALIZADO';
      if (!wasAlreadyFinalized && finalizedData.accionesTomar?.trim()) {
        try {
          await firebase.createTicketFromAcciones({
            otNumber,
            razonSocial: finalizedData.razonSocial || '',
            contacto: finalizedData.contacto || '',
            sistema: finalizedData.sistema || '',
            moduloModelo: finalizedData.moduloModelo || '',
            codigoInternoCliente: finalizedData.codigoInternoCliente || '',
            accionesTomar: finalizedData.accionesTomar,
          });
          console.log("✅ Ticket interno creado desde acciones a tomar");
        } catch (e) {
          console.warn("⚠️ No se pudo crear ticket interno:", e);
        }
      }

      // Marcar bloqueo de edición (igual que en confirmClientAndFinalize)
      setClientConfirmed(true);
      setSignatureClient(clientSignature);
      setSignatureEngineer(engineerSignature);
      setStatus('FINALIZADO');
      
      // Forzar ciclo off→on para que React re-monte con datos frescos
      // (evita servir un PDF cacheado si ya estaba en preview mode)
      setPdfBlob(null);
      setIsPreviewMode(false);
      await new Promise(resolve => setTimeout(resolve, 50));
      setIsPreviewMode(true);

      // Esperar a que React renderice el componente (Hoja 1 y anexo en DOM)
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 200));

        setGenerationStep('Generando PDF…');
        const result = await generatePDFs();
        setPdfBlob(result.reportBlob);

        // Subir PDF(s) a Firebase Storage
        setGenerationStep('Subiendo a la nube…');
        try {
          const pdfUrl = await firebase.uploadReportBlob(otNumber, result.reportBlob, result.reportFilename);
          const storageData: Record<string, string> = { pdfUrl, pdfGeneratedAt: new Date().toISOString() };

          if (result.protocolBlob && result.protocolFilename) {
            const protocolPdfUrl = await firebase.uploadReportBlob(otNumber, result.protocolBlob, result.protocolFilename);
            storageData.protocolPdfUrl = protocolPdfUrl;
            console.log('✅ Protocolo PDF subido a Storage:', protocolPdfUrl);
          }

          await firebase.saveReport(otNumber, storageData);
          console.log('✅ PDF(s) subido(s) a Storage');
        } catch (uploadErr) {
          console.warn('⚠️ No se pudo subir PDF a Storage:', uploadErr);
        }

        // Descargar archivo(s)
        setGenerationStep('Descargando archivo(s)…');
        downloadPDF(result.reportBlob, result.reportFilename);
        if (result.protocolBlob && result.protocolFilename) {
          await new Promise(resolve => setTimeout(resolve, 300));
          downloadPDF(result.protocolBlob, result.protocolFilename);
        }
      } catch (pdfError) {
        console.error("Error al generar PDF:", pdfError);
        showAlert({
          title: 'Advertencia',
          message: 'No se pudo generar PDF. El reporte fue guardado en Firebase.',
          type: 'warning'
        });
      } finally {
        setIsGenerating(false);
        setGenerationStep('');
      }
    } catch (e) {
      setIsGenerating(false);
      setGenerationStep('');
      console.error("Error al guardar en Firestore:", e);
      showAlert({
        title: 'Error Crítico',
        message: 'No se pudo guardar el reporte en la base de datos.',
        type: 'error'
      });
    }
  };

  // Confirmar firma del cliente, finalizar reporte y generar PDF
  const confirmClientAndFinalize = async () => {
    if (!validateBeforeClientConfirm()) {
      return;
    }

    const clientSig = signatureClient || clientPadRef.current?.getSignature();
    const engineerSig = signatureEngineer || engineerPadRef.current?.getSignature();

    if (!clientSig || !engineerSig) {
      showAlert({
        title: 'Error',
        message: 'Se requieren ambas firmas (Cliente y Especialista) antes de confirmar.',
        type: 'error'
      });
      return;
    }

    setIsGenerating(true);

    // Paso 0: Re-fetchear adjuntos por si se subieron desde otro dispositivo
    if (setAdjuntos && otNumber) {
      setGenerationStep('Sincronizando adjuntos…');
      try {
        const freshAdjuntos = await firebase.getAdjuntosByOT(otNumber);
        setAdjuntos(freshAdjuntos);
      } catch (err) {
        console.warn('[PDF] Error refrescando adjuntos:', err);
      }
    }

    setGenerationStep('Guardando reporte…');

    // Paso 1: Guardar en Firestore
    let saveSuccess = false;
    try {
      const finalizedData = {
        ...reportState,
        signatureClient: clientSig,
        signatureEngineer: engineerSig,
        status: 'FINALIZADO',
        updatedAt: new Date().toISOString()
      };

      console.log("Guardando reporte FINALIZADO", finalizedData);
      await firebase.saveReport(otNumber, finalizedData);
      saveSuccess = true;
      console.log("Reporte guardado exitosamente en Firestore");

      // Crear ticket interno si las acciones son solo para AGS (solo en primera finalización, no al regenerar)
      const wasAlreadyFinalized = formState.status === 'FINALIZADO';
      if (!wasAlreadyFinalized && finalizedData.accionesTomar?.trim()) {
        try {
          await firebase.createTicketFromAcciones({
            otNumber,
            razonSocial: finalizedData.razonSocial || '',
            contacto: finalizedData.contacto || '',
            sistema: finalizedData.sistema || '',
            moduloModelo: finalizedData.moduloModelo || '',
            codigoInternoCliente: finalizedData.codigoInternoCliente || '',
            accionesTomar: finalizedData.accionesTomar,
          });
          console.log("✅ Ticket interno creado desde acciones a tomar");
        } catch (e) {
          console.warn("⚠️ No se pudo crear ticket interno:", e);
        }
      }

      // Marcar bloqueo de edición solo si el guardado fue exitoso
      setClientConfirmed(true);
      setSignatureClient(clientSig);
      setSignatureEngineer(engineerSig);
      setStatus('FINALIZADO');
    } catch (saveError) {
      console.error("Error guardando FINALIZADO:", saveError);
      showAlert({
        title: 'Error',
        message: 'Error guardando el reporte. Intente nuevamente.',
        type: 'error'
      });
      setIsGenerating(false);
      return; // Salir temprano si falla el guardado
    }

    // Paso 2: Generar PDF solo si el guardado fue exitoso
    if (saveSuccess) {
      try {
        // Forzar ciclo off→on para que React re-monte con datos frescos
        setPdfBlob(null);
        setIsPreviewMode(false);
        await new Promise(resolve => setTimeout(resolve, 50));
        setIsPreviewMode(true);

        // Esperar a que React renderice el componente (Hoja 1 y anexo en DOM)
        await new Promise(resolve => setTimeout(resolve, 50));

        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 200));

        setGenerationStep('Generando PDF…');
        console.log("Generando PDF(s)...");
        const result = await generatePDFs();
        setPdfBlob(result.reportBlob);

        // Subir PDF(s) a Firebase Storage
        setGenerationStep('Subiendo a la nube…');
        try {
          const pdfUrl = await firebase.uploadReportBlob(otNumber, result.reportBlob, result.reportFilename);
          const storageData: Record<string, string> = { pdfUrl, pdfGeneratedAt: new Date().toISOString() };

          if (result.protocolBlob && result.protocolFilename) {
            const protocolPdfUrl = await firebase.uploadReportBlob(otNumber, result.protocolBlob, result.protocolFilename);
            storageData.protocolPdfUrl = protocolPdfUrl;
            console.log('✅ Protocolo PDF subido a Storage:', protocolPdfUrl);
          }

          await firebase.saveReport(otNumber, storageData);
          console.log('✅ PDF(s) subido(s) a Storage');
        } catch (uploadErr) {
          console.warn('⚠️ No se pudo subir PDF a Storage:', uploadErr);
        }

        // Descargar archivo(s)
        setGenerationStep('Descargando archivo(s)…');
        downloadPDF(result.reportBlob, result.reportFilename);
        if (result.protocolBlob && result.protocolFilename) {
          await new Promise(resolve => setTimeout(resolve, 300));
          downloadPDF(result.protocolBlob, result.protocolFilename);
        }

        console.log("PDF(s) generado(s) exitosamente");

        showAlert({
          title: 'Éxito',
          message: 'Reporte finalizado y PDF generado correctamente.',
          type: 'success'
        });
      } catch (pdfErr) {
        console.error("Error generando PDF:", pdfErr);
        console.error("Detalles del error:", pdfErr.message, pdfErr.stack);

        showAlert({
          title: 'Advertencia',
          message: 'No se pudo generar el PDF, pero el reporte fue guardado correctamente.',
          type: 'warning'
        });
      } finally {
        setIsGenerating(false);
        setGenerationStep('');
      }
    }
  };

  return {
    generatePDFBlob,
    generatePDFs,
    handleFinalSubmit,
    confirmClientAndFinalize,
    isGenerating,
    generationStep,
    isPreviewMode,
    pdfBlob,
    setIsPreviewMode,
    setPdfBlob
  };
};
