import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { FirebaseService } from '../services/firebaseService';
import { UseReportFormReturn } from './useReportForm';
import { SignaturePadHandle } from '../components/SignaturePad';
import { getPDFOptions } from '../utils/pdfOptions';

declare const html2pdf: any;

const nextFrame = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => res()));
const nextTwoFrames = async (): Promise<void> => {
  await nextFrame();
  await nextFrame();
};

function debugEl(el: HTMLElement): {
  id: string;
  rect: { w: number; h: number; x: number; y: number };
  scrollH: number;
  display: string;
  visibility: string;
  opacity: string;
  transform: string;
} {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    id: el.id,
    rect: { w: r.width, h: r.height, x: r.x, y: r.y },
    scrollH: el.scrollHeight,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    transform: cs.transform,
  };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Invalid data URL');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const A4_POINTS = { width: 595.28, height: 841.89 };

/**
 * Genera el PDF del anexo capturando cada .protocol-page por separado (html2canvas + pdf-lib).
 * Sin html2pdf; cada página es un contenedor A4 real.
 */
async function renderAnexoPdfFromPages(root: HTMLElement): Promise<Blob> {
  const pageEls = root.querySelectorAll<HTMLElement>('.protocol-page');
  const pdf = await PDFDocument.create();
  for (const pageEl of pageEls) {
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const jpgBytes = dataUrlToUint8Array(dataUrl);
    const jpg = await pdf.embedJpg(jpgBytes);
    const page = pdf.addPage([A4_POINTS.width, A4_POINTS.height]);
    page.drawImage(jpg, {
      x: 0,
      y: 0,
      width: A4_POINTS.width,
      height: A4_POINTS.height,
    });
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

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
  showAlert: (options: { title?: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; onConfirm?: () => void; confirmText?: string }) => void
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

    // Verificar si hay anexo (protocolo, tablas catálogo, instrumentos o fotos)
    const anexoElement = document.getElementById('pdf-container-anexo-pdf') as HTMLElement | null;
    if (!anexoElement || anexoElement.querySelectorAll('.protocol-page').length === 0) {
      console.log("Sin páginas de anexo, sólo Hoja 1");
      return blobHoja1;
    }

    document.body.classList.add('pdf-generating');

    try {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      // Pre-cargar imágenes del anexo (adjuntos fotográficos)
      const anexoImages = anexoElement.querySelectorAll('img');
      await Promise.all(Array.from(anexoImages).map(img =>
        new Promise(resolve => {
          if (img.complete) resolve(null);
          else { img.onload = () => resolve(null); img.onerror = () => resolve(null); }
        })
      ));

      const pageEls = anexoElement.querySelectorAll('.protocol-page');

      const rect = anexoElement.getBoundingClientRect();
      console.log('[PDF][ANEXO] rect=', rect.width, rect.height, 'scrollH=', anexoElement.scrollHeight, 'pages=', pageEls.length);

      if (rect.width < 10 || rect.height < 10) {
        throw new Error(`Anexo sin layout: w=${rect.width} h=${rect.height}`);
      }

      console.log("Generando anexo de protocolo (html2canvas por página)…");
      const blobAnexo = await renderAnexoPdfFromPages(anexoElement);

      const pdf1 = await PDFDocument.load(await blobHoja1.arrayBuffer());
      const pdf2 = await PDFDocument.load(await blobAnexo.arrayBuffer());
      const mergedPdf = await PDFDocument.create();
      const pages1 = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
      pages1.forEach((p) => mergedPdf.addPage(p));
      const pages2 = await mergedPdf.copyPages(pdf2, pdf2.getPageIndices());
      pages2.forEach((p) => mergedPdf.addPage(p));
      const mergedBytes = await mergedPdf.save();
      return new Blob([mergedBytes], { type: 'application/pdf' });
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
      
      // Activar modo preview para que el pdf-container esté disponible
      setIsPreviewMode(true);
      
      // Esperar a que React renderice el componente (Hoja 1 y anexo en DOM)
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 800));

        const filename = `${otNumber}_Reporte_AGS.pdf`;
        const generatedBlob = await generatePDFBlob();
        setPdfBlob(generatedBlob);

        const shared = await sharePDFMobile(generatedBlob, filename, otNumber);
        if (!shared) {
          downloadPDF(generatedBlob, filename);
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
        // Activar modo preview para que el pdf-container esté disponible en el DOM
        setIsPreviewMode(true);
        
        // Esperar a que React renderice el componente (Hoja 1 y anexo en DOM)
        await new Promise(resolve => setTimeout(resolve, 100));

        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 800));

        const filename = `${otNumber}_Reporte_AGS.pdf`;
        console.log("Generando PDF (Hoja 1 + anexo si hay protocolo)...");
        const generatedBlob = await generatePDFBlob();
        setPdfBlob(generatedBlob);

        const shared = await sharePDFMobile(generatedBlob, filename, otNumber);
        if (!shared) {
          downloadPDF(generatedBlob, filename);
        }

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
