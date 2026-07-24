import { useEffect, useMemo, useState } from 'react';
import { modulosService } from '../services/firebaseService';
import type { ModuloSistema, WorkOrder } from '@ags/shared';

/**
 * Índice `sistemaId → términos buscables de sus módulos` (modelo ej. G1314A,
 * descripción, N° de serie) para el filtro de búsqueda del listado de OTs
 * (UAT 2026-07-17).
 *
 * Fuente principal: los módulos reales de todos los sistemas (una query
 * collectionGroup, cacheada). Complemento: lo denormalizado en las propias OTs,
 * que cubre datos legacy sin módulos cargados.
 *
 * Extraído de OTList para mantener la página dentro del presupuesto de 250 líneas.
 */
export function useModuloSearchTerms(ordenes: WorkOrder[]): Map<string, string> {
  const [modulosAll, setModulosAll] = useState<ModuloSistema[]>([]);

  useEffect(() => {
    modulosService.getAllGrouped()
      .then(setModulosAll)
      .catch(err => console.warn('[useModuloSearchTerms] no se pudieron cargar módulos para el filtro:', err));
  }, []);

  return useMemo(() => {
    const m = new Map<string, string>();
    const add = (sistemaId: string | null | undefined, ...parts: (string | null | undefined)[]) => {
      if (!sistemaId) return;
      const terms = parts.filter(Boolean).join(' ');
      if (!terms) return;
      const prev = m.get(sistemaId);
      if (!prev) m.set(sistemaId, terms);
      else if (!prev.includes(terms)) m.set(sistemaId, `${prev} ${terms}`);
    };
    for (const mod of modulosAll) add(mod.sistemaId, mod.nombre, mod.descripcion, mod.serie);
    for (const ot of ordenes) add(ot.sistemaId, ot.moduloModelo, ot.moduloDescripcion, ot.moduloSerie);
    return m;
  }, [modulosAll, ordenes]);
}
