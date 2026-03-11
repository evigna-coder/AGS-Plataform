import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { FirebaseService } from '../services/firebaseService';
import { UseReportFormReturn } from './useReportForm';
import { SignaturePadHandle } from '../components/SignaturePad';
import { getPDFOptions } from '../utils/pdfOptions';
import type { InstrumentoPatronOption, AdjuntoMeta } from '../types/instrumentos';

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


export interface UsePDFGenerationReturn {
  // Funciones
  generatePDFBlob: () => Promise<Blob>;
  handleFinalSubmit: () => Promise<void>;
  confirmClientAndFinalize: () => Promise<void>;
  
  // Estados
  isGenerating: boolean;
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
  adjuntos: AdjuntoMeta[] = [],
): UsePDFGenerationReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Función para generar PDF como Blob (Hoja 1 + anexo protocolo si existe)
  const generatePDFBlob = async (): Promise<Blob> => {
    const element = document.getElementById('pdf-container');
    if (!element) {
      // Si estamos en modo móvil, redirigir primero a la vista principal
      if (isModoFirma) {
        const url = new URL(window.location.href);
        url.searchParams.delete('modo');
        window.location.href = url.toString();
        throw new Error("Redirigiendo a la vista principal para generar el PDF...");
      }
      throw new Error("No se encontró el contenedor para PDF. Por favor, recargue la página.");
    }

    // Asegurar que el elemento esté visible
    element.style.display = 'block';
    element.style.margin = '0 auto';
    element.style.width = '210mm';
    
    // Pre-cargar imágenes (especialmente el logo) para mejor calidad
    const images = element.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      return new Promise((resolve) => {
        if (img.complete) {
          resolve(null);
        } else {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null); // Continuar aunque falle
        }
      });
    }));

    const opt = getPDFOptions(otNumber, element, true); // includeBackgroundColor = true
    console.log("Generando PDF Hoja 1…");
    const blobHoja1 = await html2pdf().set(opt).from(element).outputPdf('blob');

    // ── Anexos: tablas/protocolos + fotos ──
    const tablasPdf = document.getElementById('pdf-container-tablas-pdf');
    const fotosPdf = document.getElementById('pdf-container-fotos-pdf');

    // Precargar imágenes de los contenedores ocultos
    const preloadFromContainer = (container: HTMLElement | null) => {
      if (!container) return Promise.resolve();
      return Promise.all(Array.from(container.querySelectorAll('img')).map(img =>
        new Promise(resolve => {
          if (img.complete) resolve(null);
          else { img.onload = () => resolve(null); img.onerror = () => resolve(null); }
        })
      ));
    };

    const hasTablas = tablasPdf && tablasPdf.children.length > 0;
    const fotoPages = fotosPdf
      ? Array.from(fotosPdf.querySelectorAll<HTMLElement>('.protocol-page'))
      : [];

    if (!hasTablas && fotoPages.length === 0) {
      console.log("Sin páginas de anexo, sólo Hoja 1");
      return blobHoja1;
    }

    document.body.classList.add('pdf-generating');

    try {
      await nextTwoFrames();
      await Promise.all([preloadFromContainer(tablasPdf), preloadFromContainer(fotosPdf)]);

      const pdfParts: Blob[] = [blobHoja1];

      // ── Tablas/Protocolos: captura per-page de ProtocolPaginatedPreview ──
      if (hasTablas) {
        console.log("[PDF][TABLAS] Generando PDF de protocolos…");

        // Buscar páginas A4 individuales renderizadas por ProtocolPaginatedPreview
        const protocolPages = document.querySelectorAll<HTMLElement>('[data-protocol-page]');

        if (protocolPages.length > 0) {
          // Ocultar divs de medición para que no interfieran con la captura
          const measureDivs = document.querySelectorAll<HTMLElement>('[data-measurement-div]');
          measureDivs.forEach(div => { div.style.display = 'none'; });

          window.scrollTo(0, 0);
          await nextTwoFrames();
          await preloadFromContainer(document.getElementById('pdf-preview-tablas'));

          const protocolPdfDoc = await PDFDocument.create();

          for (const pageEl of Array.from(protocolPages)) {
            // Clone page into body at (0,0) for accurate html2canvas capture.
            // This avoids scroll offset, parent flex gap, and overflow clipping
            // bugs that occur when capturing elements deep in the DOM tree.
            const clone = pageEl.cloneNode(true) as HTMLElement;
            clone.style.position = 'fixed';
            clone.style.top = '0';
            clone.style.left = '-9999px';
            clone.style.zIndex = '99999';
            clone.style.margin = '0';

            // Fix html2canvas clipping: remove overflow:hidden from card
            // containers and truncated text. html2canvas mis-renders the
            // clip region when overflow:hidden + border-radius are combined,
            // cutting ~2 px off the top of title bars.
            clone.querySelectorAll('.overflow-hidden, .truncate').forEach(el => {
              (el as HTMLElement).style.setProperty('overflow', 'visible', 'important');
            });

            document.body.appendChild(clone);
            await nextFrame();

            try {
              const canvas = await html2canvas(clone, {
                scale: Math.max(window.devicePixelRatio * 2, 5),
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

          // Restaurar measurement divs
          measureDivs.forEach(div => { div.style.display = ''; });

          pdfParts.push(new Blob([await protocolPdfDoc.save()], { type: 'application/pdf' }));
          console.log(`[PDF][TABLAS] ${protocolPages.length} página(s) de protocolo generadas OK`);

        } else {
          // Fallback: html2pdf sobre contenedor oculto (sin ProtocolPaginatedPreview)
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
            const blobTablas: Blob = await html2pdf().set(optTablas).from(tablasTarget).outputPdf('blob');
            pdfParts.push(blobTablas);
          } finally {
            tablasTarget.setAttribute('style', savedStyleTablas);
          }
        }
      }

      // ── Helper: renderizar un PDF externo (posiblemente encriptado) a páginas A4 JPEG ──
      // Usa pdfjs-dist (motor de Firefox) que maneja cualquier PDF incluyendo encriptados.
      // Renderiza cada página a canvas, la comprime como JPEG y la embebe en A4 via pdf-lib.
      const renderExternalPdfToPages = async (pdfBytes: ArrayBuffer, label: string): Promise<void> => {
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

            // Forzar A4 y escalar la imagen para que quepa manteniendo proporción
            const page = externalDoc.addPage([A4_POINTS.width, A4_POINTS.height]);
            const imgAspect = canvas.width / canvas.height;
            const pageAspect = A4_POINTS.width / A4_POINTS.height;
            let drawW: number, drawH: number, drawX: number, drawY: number;
            if (imgAspect > pageAspect) {
              // Imagen más ancha que A4 → ajustar por ancho
              drawW = A4_POINTS.width;
              drawH = A4_POINTS.width / imgAspect;
              drawX = 0;
              drawY = A4_POINTS.height - drawH; // Alinear arriba
            } else {
              // Imagen más alta que A4 → ajustar por alto
              drawH = A4_POINTS.height;
              drawW = A4_POINTS.height * imgAspect;
              drawX = (A4_POINTS.width - drawW) / 2; // Centrar horizontalmente
              drawY = 0;
            }
            page.drawImage(jpg, { x: drawX, y: drawY, width: drawW, height: drawH });
          }

          pdfDoc.destroy();
          pdfParts.push(new Blob([await externalDoc.save()], { type: 'application/pdf' }));
          console.log(`[PDF][${label}] ${pdfDoc.numPages} página(s) renderizadas OK`);
        } catch (err) {
          console.warn(`[PDF][${label}] Error renderizando PDF:`, err);
        }
      };

      // ── Certificados: descargar y renderizar PDFs de instrumentos ──
      const certUrls = instrumentosSeleccionados
        .map(i => i.certificadoUrl)
        .filter((url): url is string => !!url);

      if (certUrls.length > 0) {
        console.log(`[PDF][CERTS] Descargando ${certUrls.length} certificado(s)…`);
        for (const url of certUrls) {
          try {
            const blob = await firebase.downloadStorageBlob(url);
            await renderExternalPdfToPages(await blob.arrayBuffer(), 'CERTS');
          } catch (err) {
            console.warn('[PDF][CERTS] Error descargando certificado:', err);
          }
        }
      }

      // ── Adjuntos PDF: descargar y renderizar archivos adjuntos PDF ──
      const pdfAdjuntos = adjuntos.filter(a => a.mimeType === 'application/pdf');
      if (pdfAdjuntos.length > 0) {
        console.log(`[PDF][ADJUNTOS] Descargando ${pdfAdjuntos.length} adjunto(s) PDF…`);
        for (const adj of pdfAdjuntos) {
          try {
            const blob = await firebase.downloadStorageBlob(adj.url);
            await renderExternalPdfToPages(await blob.arrayBuffer(), 'ADJUNTOS');
          } catch (err) {
            console.warn(`[PDF][ADJUNTOS] Error descargando ${adj.fileName}:`, err);
          }
        }
      }

      // ── Fotos: html2canvas directo sobre el contenedor original ──
      if (fotoPages.length > 0 && fotosPdf) {
        console.log(`[PDF][FOTOS] ${fotoPages.length} página(s) de fotos`);

        const savedStyleFotos = fotosPdf.getAttribute('style') || '';
        Object.assign(fotosPdf.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '210mm',
          transform: 'none',
          zIndex: '99999',
          opacity: '1',
          pointerEvents: 'none',
          background: 'white',
        });

        await nextTwoFrames();
        await preloadFromContainer(fotosPdf);

        try {
          const fotosPdfDoc = await PDFDocument.create();
          for (const pageEl of fotoPages) {
            const canvas = await html2canvas(pageEl, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false,
            });
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const jpgBytes = dataUrlToUint8Array(dataUrl);
            const jpg = await fotosPdfDoc.embedJpg(jpgBytes);
            const page = fotosPdfDoc.addPage([A4_POINTS.width, A4_POINTS.height]);
            page.drawImage(jpg, { x: 0, y: 0, width: A4_POINTS.width, height: A4_POINTS.height });
          }
          pdfParts.push(new Blob([await fotosPdfDoc.save()], { type: 'application/pdf' }));
          console.log("[PDF][FOTOS] PDF de fotos generado OK");
        } finally {
          fotosPdf.setAttribute('style', savedStyleFotos);
        }
      }

      // ── Merge: Hoja 1 + Protocolos + Certificados + Adjuntos PDF + Fotos ──
      const mergedPdf = await PDFDocument.create();
      for (const partBlob of pdfParts) {
        try {
          const partDoc = await PDFDocument.load(await partBlob.arrayBuffer());
          const pages = await mergedPdf.copyPages(partDoc, partDoc.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        } catch (err) {
          console.warn('[PDF][MERGE] Error cargando parte del PDF, omitiendo:', err);
        }
      }
      return new Blob([await mergedPdf.save()], { type: 'application/pdf' });
    } finally {
      document.body.classList.remove('pdf-generating');
    }
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
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 800));

        const filename = `${otNumber}_Reporte_AGS.pdf`;
        const generatedBlob = await generatePDFBlob();
        setPdfBlob(generatedBlob);

        downloadPDF(generatedBlob, filename);
      } catch (pdfError) {
        console.error("Error al generar PDF:", pdfError);
        showAlert({
          title: 'Advertencia',
          message: 'No se pudo generar PDF. El reporte fue guardado en Firebase.',
          type: 'warning'
        });
      } finally {
        setIsGenerating(false);
      }
    } catch (e) {
      setIsGenerating(false);
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
        await new Promise(resolve => setTimeout(resolve, 100));

        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 800));

        const filename = `${otNumber}_Reporte_AGS.pdf`;
        console.log("Generando PDF (Hoja 1 + anexo si hay protocolo)...");
        const generatedBlob = await generatePDFBlob();
        setPdfBlob(generatedBlob);

        downloadPDF(generatedBlob, filename);

        console.log("PDF generado exitosamente");
        
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
      }
    }
  };

  return {
    generatePDFBlob,
    handleFinalSubmit,
    confirmClientAndFinalize,
    isGenerating,
    isPreviewMode,
    pdfBlob,
    setIsPreviewMode,
    setPdfBlob
  };
};
