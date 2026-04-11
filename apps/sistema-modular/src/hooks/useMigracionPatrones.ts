import { useState, useCallback } from 'react';
import { instrumentosService, patronesService } from '../services/firebaseService';
import type { Patron, PatronLote, InstrumentoPatron } from '@ags/shared';

/**
 * Migración de instrumentos con tipo='patron' de /instrumentos a /patrones.
 *
 * Reglas de agrupación:
 * - Instrumentos con el mismo nombre + modelo (código artículo) se fusionan en un único
 *   documento Patron con múltiples entradas en `lotes[]`.
 * - Cada lote conserva su propio código de lote, vencimiento y certificado.
 * - Los documentos originales en /instrumentos se desactivan (activo=false) luego de migrar
 *   opcionalmente. No se borran para preservar referencias en reportes antiguos.
 */

export interface MigracionPreviewItem {
  key: string;
  codigoArticulo: string;
  descripcion: string; // Nombre comercial del patrón (era `nombre` en /instrumentos)
  marca: string;
  categorias: string[];
  lotesCount: number;
  sourceIds: string[]; // IDs originales en /instrumentos
  lotes: PatronLote[];
}

export interface MigracionResult {
  totalSource: number;
  totalGrupos: number;
  creados: number;
  errores: Array<{ key: string; error: string }>;
}

/** Agrupa instrumentos con tipo='patron' por código de artículo (modelo).
 *  El `nombre` del instrumento legacy pasa a ser la `descripcion` del nuevo patrón. */
function agruparInstrumentos(items: InstrumentoPatron[]): MigracionPreviewItem[] {
  const mapa = new Map<string, MigracionPreviewItem>();

  for (const inst of items) {
    const nombreLegacy = (inst.nombre || '').trim();
    const modelo = (inst.modelo || '').trim();
    // Agrupar solo por código artículo. Si está vacío, usar el nombre como fallback.
    const key = (modelo || nombreLegacy).toLowerCase();

    if (!mapa.has(key)) {
      mapa.set(key, {
        key,
        codigoArticulo: modelo,
        descripcion: nombreLegacy, // nombre viejo → descripción nueva
        marca: inst.marca || '',
        categorias: Array.isArray(inst.categorias) ? [...inst.categorias] : [],
        lotesCount: 0,
        sourceIds: [],
        lotes: [],
      });
    }

    const grupo = mapa.get(key)!;

    // Merge categorías únicas
    for (const cat of (inst.categorias || [])) {
      if (!grupo.categorias.includes(cat)) grupo.categorias.push(cat);
    }

    // Agregar lote
    const lote: PatronLote = {
      lote: inst.lote || inst.serie || '',
      fechaVencimiento: inst.certificadoVencimiento || null,
      certificadoEmisor: inst.certificadoEmisor || null,
      certificadoUrl: inst.certificadoUrl || null,
      certificadoStoragePath: inst.certificadoStoragePath || null,
      certificadoNombre: inst.certificadoNombre || null,
      certificadoFechaEmision: inst.certificadoFechaEmision || null,
      notas: null,
    };
    grupo.lotes.push(lote);
    grupo.lotesCount = grupo.lotes.length;
    grupo.sourceIds.push(inst.id);
  }

  return Array.from(mapa.values()).sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
}

export function useMigracionPatrones() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MigracionPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigracionResult | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  /** Genera el preview agrupando los instrumentos tipo=patron sin escribir nada. */
  const generarPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const allPatrones = await instrumentosService.getAll({ tipo: 'patron' });
      const grupos = agruparInstrumentos(allPatrones);
      setPreview(grupos);
      return grupos;
    } catch (err: any) {
      console.error('Error generando preview de migración:', err);
      setError(err?.message || 'Error al leer instrumentos');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Ejecuta la migración creando documentos en /patrones y desactivando los originales.
   * @param desactivarOrigen Si true, marca activo=false en los instrumentos originales tras migrar.
   */
  const ejecutarMigracion = useCallback(async (grupos: MigracionPreviewItem[], desactivarOrigen: boolean) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({ current: 0, total: grupos.length });

    const errores: Array<{ key: string; error: string }> = [];
    let creados = 0;

    try {
      for (let i = 0; i < grupos.length; i++) {
        const grupo = grupos[i];
        setProgress({ current: i + 1, total: grupos.length });
        try {
          const data: Omit<Patron, 'id' | 'createdAt' | 'updatedAt'> = {
            codigoArticulo: grupo.codigoArticulo,
            descripcion: grupo.descripcion,
            marca: grupo.marca,
            categorias: grupo.categorias as any,
            lotes: grupo.lotes,
            activo: true,
          };
          await patronesService.create(data);
          creados++;

          if (desactivarOrigen) {
            for (const srcId of grupo.sourceIds) {
              try {
                await instrumentosService.deactivate(srcId);
              } catch (deactErr: any) {
                console.warn(`No se pudo desactivar instrumento ${srcId}:`, deactErr);
              }
            }
          }
        } catch (err: any) {
          console.error(`Error migrando grupo "${grupo.descripcion}":`, err);
          errores.push({ key: grupo.key, error: err?.message || 'Error desconocido' });
        }
      }

      const res: MigracionResult = {
        totalSource: grupos.reduce((sum, g) => sum + g.sourceIds.length, 0),
        totalGrupos: grupos.length,
        creados,
        errores,
      };
      setResult(res);
      return res;
    } catch (err: any) {
      console.error('Error ejecutando migración:', err);
      setError(err?.message || 'Error durante la migración');
      return null;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    loading,
    preview,
    result,
    error,
    progress,
    generarPreview,
    ejecutarMigracion,
    reset,
  };
}
