import { useEffect, useState } from 'react';
import type { Asignacion, InstrumentoPatron, UnidadStock } from '@ags/shared';
import { misOTService } from '../services/misOTService';
import { useIngenieroDocId } from './useIngenieroDocId';

export interface KitItem {
  /** Nombre visible (ej: "Flujímetro", "Minikit HPLC"). */
  nombre: string;
  /** Identificador chico (serie, código, lote). */
  codigo: string | null;
  /** URL del certificado (instrumentos/patrones) — habilita "Ver certificado ↗". */
  certificadoUrl: string | null;
  tipo: 'instrumento' | 'patron' | 'minikit' | 'articulo' | 'dispositivo';
}

/**
 * "Asignado al ingeniero": todo lo que el ingeniero asignado a la OT lleva consigo.
 * Fuentes (decisión documentada — no hay una colección única):
 *  1. `instrumentos` con asignadoAId == ingeniero (traen certificadoUrl directo)
 *  2. `asignaciones` activas del ingeniero: minikits, patrones (cert resuelto
 *     desde `patrones`), dispositivos y artículos no devueltos
 *  3. `unidades` con ubicacion.tipo=='ingeniero' (stock físico en su poder)
 */
export function useKitIngeniero(ingenieroUsuarioId: string | null | undefined) {
  const { ingenieroDocId, loaded } = useIngenieroDocId(ingenieroUsuarioId);
  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ingenieroUsuarioId || !loaded) { setItems([]); return; }
    const ids = [ingenieroUsuarioId, ingenieroDocId].filter((x): x is string => !!x);
    let active = true;
    setLoading(true);
    (async () => {
      const [instrumentos, asignaciones, unidades] = await Promise.all([
        misOTService.getInstrumentosDeIngeniero(ids).catch(() => [] as InstrumentoPatron[]),
        misOTService.getAsignacionesActivas(ids).catch(() => [] as Asignacion[]),
        misOTService.getUnidadesDeIngeniero(ids).catch(() => [] as UnidadStock[]),
      ]);

      const out: KitItem[] = [];
      const seenInstrumentos = new Set<string>();

      for (const inst of instrumentos) {
        seenInstrumentos.add(inst.id);
        out.push({
          nombre: [inst.nombre, inst.modelo].filter(Boolean).join(' '),
          codigo: inst.serie || null,
          certificadoUrl: inst.certificadoUrl ?? null,
          tipo: inst.tipo === 'patron' ? 'patron' : 'instrumento',
        });
      }

      for (const asg of asignaciones) {
        for (const item of asg.items) {
          if (item.estado === 'devuelto' || item.estado === 'consumido') continue;
          if (item.minikitId) {
            out.push({ nombre: item.articuloDescripcion || 'Minikit', codigo: item.minikitCodigo ?? null, certificadoUrl: null, tipo: 'minikit' });
          } else if (item.instrumentoId) {
            if (seenInstrumentos.has(item.instrumentoId)) continue;
            seenInstrumentos.add(item.instrumentoId);
            const cert = item.instrumentoTipo === 'patron'
              ? await misOTService.getPatronCertificadoUrl(item.instrumentoId).catch(() => null)
              : null;
            out.push({
              nombre: item.instrumentoNombre || 'Instrumento',
              codigo: item.articuloCodigo ?? null,
              certificadoUrl: cert,
              tipo: item.instrumentoTipo === 'patron' ? 'patron' : 'instrumento',
            });
          } else if (item.dispositivoId) {
            out.push({ nombre: item.dispositivoDescripcion || 'Dispositivo', codigo: null, certificadoUrl: null, tipo: 'dispositivo' });
          } else if (item.articuloId && !item.unidadId) {
            // Unidades puntuales ya salen de la query de `unidades`; acá solo artículos por cantidad.
            out.push({ nombre: item.articuloDescripcion || 'Artículo', codigo: item.articuloCodigo ?? null, certificadoUrl: null, tipo: 'articulo' });
          }
        }
      }

      for (const u of unidades) {
        out.push({
          nombre: u.articuloDescripcion,
          codigo: u.nroSerie || u.nroLote || u.articuloCodigo || null,
          certificadoUrl: null,
          tipo: 'articulo',
        });
      }

      if (active) setItems(out);
    })().catch(err => {
      console.warn('[useKitIngeniero] failed:', err);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ingenieroUsuarioId, ingenieroDocId, loaded]);

  return { items, loading };
}
