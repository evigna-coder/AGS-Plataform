import { useEffect, useRef, useState } from 'react';
import type { Articulo, Importacion } from '@ags/shared';
import { articulosService } from '../services/stockService';

/**
 * Artículos para el costeo del panel de ítems de la lista de importaciones:
 * solo los de las filas DESPLEGADAS, pedidos una vez por sesión (2026-09-25).
 * Antes la lista bajaba el catálogo entero (~4.000 docs) en cada montaje para
 * servir a un panel que casi nunca se abre.
 */
export function useArticulosImportacionesExpandidas(importaciones: Importacion[], expandidas: Set<string>) {
  const [articulosById, setArticulosById] = useState<Map<string, Articulo>>(new Map());
  const pedidos = useRef<Set<string>>(new Set());
  useEffect(() => {
    const faltan = new Set<string>();
    for (const imp of importaciones) {
      if (!expandidas.has(imp.id)) continue;
      for (const it of imp.items ?? []) {
        if (it.articuloId && !pedidos.current.has(it.articuloId)) faltan.add(it.articuloId);
      }
    }
    if (faltan.size === 0) return;
    for (const id of faltan) pedidos.current.add(id);
    let cancelled = false;
    Promise.all([...faltan].map(id => articulosService.getById(id).catch(() => null)))
      .then(arts => {
        if (cancelled) return;
        setArticulosById(prev => {
          const next = new Map(prev);
          for (const a of arts) if (a) next.set(a.id, a);
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [expandidas, importaciones]);
  return articulosById;
}
