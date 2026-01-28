import { useState } from 'react';
import { FirebaseService } from '../services/firebaseService';
import { UseReportFormReturn } from './useReportForm';
import { SignaturePadHandle } from '../components/SignaturePad';
import { getPDFOptions } from '../utils/pdfOptions';

declare const html2pdf: any;

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
    signatureEngineer
  } = formState;

  const {
    setClientConfirmed,
    setSignatureClient,
    setSignatureEngineer,
    setStatus
  } = setters;

  // Función para generar PDF como Blob
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

    // Usar html2pdf para generar Blob
    const opt = getPDFOptions(otNumber, element, true); // includeBackgroundColor = true

    // Generar Blob usando html2pdf
    const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
    
    return pdfBlob;
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
      
      // Esperar a que React renderice el componente
      await new Promise(resolve => setTimeout(resolve, 100));

      // GENERACIÓN DE PDF con opciones seguras y fallback
      try {
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 800));
        const element = document.getElementById('pdf-container');
        if (!element) throw new Error("No se encontró el contenedor.");
        
        // Asegurar que el elemento esté visible y centrado antes de capturar
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
        
        const opt = getPDFOptions(otNumber, element, false); // includeBackgroundColor = false
        const filename = `${otNumber}_Reporte_AGS.pdf`;
        
        const pdfWorker = html2pdf().set(opt).from(element);
        
        // Siempre generar Blob primero para poder compartirlo después
        console.log("Generando PDF como Blob...");
        const generatedBlob = await pdfWorker.outputPdf('blob');
        // Guardar el Blob para compartir después
        setPdfBlob(generatedBlob);
        
        // En móviles, intentar compartir automáticamente con Web Share API
        const shared = await sharePDFMobile(generatedBlob, filename, otNumber);
        
        if (!shared) {
          // Si no se compartió (desktop o fallback), descargar
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
        
        // Esperar a que React renderice el componente
        await new Promise(resolve => setTimeout(resolve, 100));
        
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const element = document.getElementById('pdf-container');
        if (!element) {
          console.error("No se encontró el contenedor para PDF");
          showAlert({
            title: 'Advertencia',
            message: 'No se pudo generar el PDF, pero el reporte fue guardado correctamente.',
            type: 'warning'
          });
          setIsGenerating(false);
          return;
        }

        // Asegurar que el elemento esté visible y centrado antes de capturar
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

        const opt = getPDFOptions(otNumber, element, false); // includeBackgroundColor = false
        const filename = `${otNumber}_Reporte_AGS.pdf`;

        console.log("Iniciando generación de PDF con opciones:", opt);
        const pdfWorker = html2pdf().set(opt).from(element);
        
        // Siempre generar Blob primero para poder compartirlo después
        console.log("Generando PDF como Blob...");
        const generatedBlob = await pdfWorker.outputPdf('blob');
        // Guardar el Blob para compartir después
        setPdfBlob(generatedBlob);
        
        // En móviles, intentar compartir automáticamente con Web Share API
        const shared = await sharePDFMobile(generatedBlob, filename, otNumber);
        
        if (!shared) {
          // Si no se compartió (desktop o fallback), descargar
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
