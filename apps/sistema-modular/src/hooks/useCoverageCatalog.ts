import { useEffect, useState } from 'react';
import type { CategoriaEquipo } from '@ags/shared';
import { categoriasEquipoService } from '../services/equiposService';
import { tiposServicioService } from '../services/importacionesService';
import { SERVICIO_TYPES_FALLBACK } from '../utils/tableCatalogConstants';

export interface CatalogGroup { label: string; values: string[] }

/**
 * Opciones para los paneles de cobertura y el editor de la Biblioteca de Tablas:
 * - modelos: los de cada categoría de equipo (agrupados por categoría).
 * - servicios: los tipos de servicio activos con protocolo, unidos al piso fijo.
 */
export function useCoverageCatalog() {
  const [modelGroups, setModelGroups] = useState<CatalogGroup[]>([]);
  const [servicios, setServicios] = useState<string[]>(SERVICIO_TYPES_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    categoriasEquipoService.getAll().then((cats: CategoriaEquipo[]) => {
      if (cancelled) return;
      setModelGroups(cats
        .map(c => ({ label: c.nombre, values: [...new Set(c.modelos ?? [])].sort() }))
        .filter(g => g.values.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label)));
    }).catch(() => {});
    tiposServicioService.getAll().then(tipos => {
      if (cancelled) return;
      const conProtocolo = tipos.filter(t => t.activo !== false && t.requiresProtocol).map(t => t.nombre);
      setServicios([...new Set([...SERVICIO_TYPES_FALLBACK, ...conProtocolo])].sort((a, b) => a.localeCompare(b)));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return { modelGroups, servicios };
}
