import { useEffect, RefObject } from 'react';
import { FirebaseService } from '../services/firebaseService';
import { ReportState } from './useReportForm';

export interface UseAutosaveOptions {
  reportState: ReportState;
  otNumber: string;
  status: 'BORRADOR' | 'FINALIZADO';
  firebase: FirebaseService;
  hasInitialized: RefObject<boolean>;
  hasUserInteracted: RefObject<boolean>;
  isModoFirma: boolean;
  isPreviewMode: boolean;
  /** Si true, skipea el autosave entero (modo "Protocolo en blanco" no persiste). */
  blankPreviewMode?: boolean;
  debounceMs?: number;
}

/**
 * Hook para manejar el autosave automático del reporte
 * Guarda automáticamente cuando el usuario modifica campos, con debounce
 * 
 * @param options - Opciones de configuración del autosave
 */
export const useAutosave = (options: UseAutosaveOptions): void => {
  const {
    reportState,
    otNumber,
    status,
    firebase,
    hasInitialized,
    hasUserInteracted,
    isModoFirma,
    isPreviewMode,
    blankPreviewMode = false,
    debounceMs = 700
  } = options;

  useEffect(() => {
    // Validar formato de OT antes de guardar: 5 dígitos, opcional .NN
    const otRegex = /^\d{5}(?:\.\d{2})?$/;
    const isValidOt = otNumber && otRegex.test(otNumber);

    if (
      !hasInitialized.current ||        // ⛔ todavía cargando desde Firebase
      !hasUserInteracted.current ||      // ⛔ el usuario no tocó nada
      !isValidOt ||                      // ⛔ OT no tiene formato válido (5 dígitos + opcional .NN)
      isModoFirma ||
      isPreviewMode ||
      blankPreviewMode ||                // ⛔ vista previa en blanco: no se persiste
      status === 'FINALIZADO'           // ⛔ reporte ya finalizado, no sobrescribir
    ) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const dataToSave = {
        ...reportState,
        status: 'BORRADOR',
        updatedAt: new Date().toISOString()
      };

      console.log("📝 Autosave BORRADOR", otNumber);
      try {
        await firebase.saveReport(otNumber, dataToSave);
      } catch (error: any) {
        console.error("❌ Error en autosave:", error);
        // No mostrar alert en autosave para no interrumpir al usuario
        // Los errores se verán en la consola
      }
    }, debounceMs); // debounce configurable, default 700ms

    return () => {
      clearTimeout(timeout);
    };
  }, [reportState, otNumber, status, isModoFirma, isPreviewMode, firebase, hasInitialized, hasUserInteracted, debounceMs]);
};
