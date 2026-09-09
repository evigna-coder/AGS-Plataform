import { useCallback, useState } from 'react';
import type { CierreSemanal } from '@ags/shared';
import { useAuth } from '../contexts/AuthContext';
import { cierreSemanalService } from '../services/cierreSemanalService';
import { adminConfigService } from '../services/adminConfigService';
import { armarCierreSemanal, type EntradasCierreSemanal } from '../utils/cierreSemanalDatos';
import { generarPdfCierreSemanal, guardarCopiaLocalCierre, nombreArchivoCierre } from '../utils/cierreSemanalPdf';
import { notify } from '../utils/notify';

/**
 * Congelar una semana del control (2026-09-09): arma la foto con los datos
 * ya cargados en pantalla, genera el PDF, lo guarda en el sistema y deja una
 * copia en la carpeta configurada (Dropbox de esa PC) si hay.
 */
export function useCierreSemanal() {
  const { usuario } = useAuth();
  const [generando, setGenerando] = useState(false);

  const congelar = useCallback(async (
    semanaInicio: string, semanaFin: string, entradas: EntradasCierreSemanal, opts?: { reemplazar?: boolean; silencioso?: boolean },
  ): Promise<CierreSemanal | null> => {
    setGenerando(true);
    try {
      const { datos, resumen } = armarCierreSemanal(entradas);
      const borrador: CierreSemanal = {
        id: semanaInicio, semanaInicio, semanaFin,
        generadoAt: new Date().toISOString(),
        generadoPor: usuario?.id ?? null, generadoPorNombre: usuario?.displayName ?? null,
        pdfPath: '', pdfUrl: '', resumen, datos,
      };
      const pdf = await generarPdfCierreSemanal(borrador);
      const { cierre, yaExistia } = await cierreSemanalService.guardar({
        semanaInicio, semanaFin, datos, resumen, pdf,
        actor: usuario ? { uid: usuario.id, nombre: usuario.displayName } : null,
        reemplazar: opts?.reemplazar ?? false,
      });
      if (yaExistia) {
        if (!opts?.silencioso) notify.info(`La semana del ${semanaInicio.split('-').reverse().join('/')} ya estaba congelada.`);
        return cierre;
      }
      let copia: string | null = null;
      let motivoCopia: string | null = null;
      try {
        const cfg = await adminConfigService.getWithDefaults();
        const r = await guardarCopiaLocalCierre(pdf, nombreArchivoCierre(semanaInicio), cfg.carpetaCierresSemanales);
        copia = r.path; motivoCopia = r.motivo;
      } catch (err) {
        console.warn('[useCierreSemanal] copia local falló (no bloquea):', err);
        motivoCopia = err instanceof Error ? err.message : String(err);
      }
      if (!opts?.silencioso) notify.success(`Cierre semanal guardado${copia ? ` y copiado a ${copia}` : ''}.`);
      if (motivoCopia) notify.warning(`El cierre quedó en el sistema, pero la copia local no se pudo hacer: ${motivoCopia}`);
      return cierre;
    } catch (err) {
      console.error('[useCierreSemanal] congelar:', err);
      if (!opts?.silencioso) notify.error(err instanceof Error ? err.message : 'No se pudo generar el cierre semanal');
      return null;
    } finally {
      setGenerando(false);
    }
  }, [usuario]);

  return { congelar, generando };
}
