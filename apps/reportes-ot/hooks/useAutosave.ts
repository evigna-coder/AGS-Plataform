import { useEffect, useState, RefObject } from 'react';
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

/** Texto para el usuario cuando un autosave es rechazado (2026-09-11). */
function mensajeDeError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'reportes-ot/pdf-protected') {
    return 'Este reporte tiene el PDF definitivo generado y no acepta cambios en borrador. '
      + 'Para corregirlo hay que reabrirlo desde el sistema o el portal (Reabrir reporte).';
  }
  const msg = error instanceof Error ? error.message : '';
  return `No se pudo guardar el último cambio${msg ? ` (${msg})` : ''}. `
    + 'Lo que edites NO queda guardado hasta que esto se resuelva: revisá la conexión y volvé a tocar algo para reintentar.';
}

/**
 * Hook para manejar el autosave automático del reporte
 * Guarda automáticamente cuando el usuario modifica campos, con debounce
 *
 * Devuelve `autosaveError` con el último fallo (2026-09-11): antes el error
 * solo iba a consola y se podía trabajar una hora sobre un reporte que no
 * guardaba nada, enterándose al recargar. Se limpia con el próximo guardado OK.
 *
 * @param options - Opciones de configuración del autosave
 */
export const useAutosave = (options: UseAutosaveOptions): { autosaveError: string | null } => {
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
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
        setAutosaveError(null);
      } catch (error: any) {
        console.error("❌ Error en autosave:", error);
        // Sin alert (no interrumpe), pero VISIBLE: banner fijo arriba del reporte.
        setAutosaveError(mensajeDeError(error));
      }
    }, debounceMs); // debounce configurable, default 700ms

    return () => {
      clearTimeout(timeout);
    };
  }, [reportState, otNumber, status, isModoFirma, isPreviewMode, firebase, hasInitialized, hasUserInteracted, debounceMs]);

  return { autosaveError };
};
