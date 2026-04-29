import { useState } from 'react';
import { tiposEquipoService } from '../services/tiposEquipoService';
import { sistemasService, modulosService } from '../services/equiposService';
import { buildAnexosFromPresupuesto } from '../components/presupuestos/pdf';
import type {
  AnexoBuildResult,
  AnexoBuildWarning,
  GeneratePDFParams,
} from '../components/presupuestos/pdf';
import type { Sistema, ModuloSistema } from '@ags/shared';

/**
 * Hook que pre-carga catálogos (plantillas + sistemas + módulos) y construye los
 * anexos de consumibles del presupuesto vía `buildAnexosFromPresupuesto`.
 *
 * Plan 04-05 split: extraído de `useEnviarPresupuesto` para mantener ese hook
 * orquestador por debajo del budget de 280 líneas (regla components.md ergonómica
 * para hooks). El state machine de envío sigue en `useEnviarPresupuesto`.
 */
export function useEnviarAnexos(pdfParams: GeneratePDFParams) {
  const [anexos, setAnexos] = useState<AnexoBuildResult[]>([]);
  const [warnings, setWarnings] = useState<AnexoBuildWarning[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Pre-carga catálogos e inicializa `anexos` + `warnings`. Idempotente:
   * si falla, registra warning sintético y deja `anexos=[]` (UI puede mostrar
   * banner pero no bloquea el envío principal).
   */
  const loadAnexos = async (): Promise<void> => {
    setLoading(true);
    try {
      const presupuesto = pdfParams.presupuesto;
      const cliente = pdfParams.cliente;

      // Sistemas únicos referenciados por items[]
      const sistemaIds = [
        ...new Set(presupuesto.items.map((i) => i.sistemaId).filter(Boolean)),
      ] as string[];

      // Pre-carga en paralelo: plantillas + sistemas + módulos por sistema
      const [plantillas, sistemasArr, modulosArr] = await Promise.all([
        tiposEquipoService.getAll(),
        Promise.all(
          sistemaIds.map((sid) =>
            sistemasService.getById(sid).catch(() => null),
          ),
        ),
        Promise.all(
          sistemaIds.map((sid) =>
            modulosService.getBySistema(sid).catch(() => [] as ModuloSistema[]),
          ),
        ),
      ]);

      const sistemas: Record<string, Sistema | null> = {};
      const modulosBySistema: Record<string, ModuloSistema[]> = {};
      sistemaIds.forEach((sid, idx) => {
        sistemas[sid] = sistemasArr[idx];
        modulosBySistema[sid] = modulosArr[idx];
      });

      const result = await buildAnexosFromPresupuesto({
        presupuesto,
        cliente,
        sistemas,
        modulosBySistema,
        plantillas,
      });
      setAnexos(result.anexos);
      setWarnings(result.warnings);
    } catch (err) {
      console.error('Error pre-cargando anexos:', err);
      setAnexos([]);
      setWarnings([
        {
          tipo: 'sistema_sin_modulos_ni_plantilla',
          itemId: '_',
          sistemaNombre: null,
          detalle:
            'No se pudo cargar el catálogo de consumibles. Se enviará sin anexos.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return { anexos, warnings, loading, loadAnexos };
}
