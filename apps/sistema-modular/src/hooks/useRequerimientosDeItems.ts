import { useEffect, useState } from 'react';
import type { ItemOC, RequerimientoCompra } from '@ags/shared';
import { requerimientosService } from '../services/firebaseService';
import { requerimientosDeItem } from '../utils/conciliarRequerimientosOC';

/**
 * Requerimientos vinculados a los ítems de una OC, por id (2026-09-30). Antes
 * el detalle de la OC no mostraba qué requerimiento cubre cada ítem y el
 * comprador concluía que "no se creó" (caso 19723 / REQ-0052 en XRW219).
 * Son pocos por OC: una lectura por id, sin listeners.
 */
export function useRequerimientosDeItems(items: ItemOC[] | null | undefined): Map<string, RequerimientoCompra> {
  const [reqs, setReqs] = useState<Map<string, RequerimientoCompra>>(new Map());
  const ids = [...new Set((items ?? []).flatMap(requerimientosDeItem))].sort();
  const clave = ids.join('|');
  useEffect(() => {
    if (!clave) { setReqs(new Map()); return; }
    let vivo = true;
    Promise.all(clave.split('|').map(id => requerimientosService.getById(id).catch(() => null)))
      .then(list => {
        if (!vivo) return;
        setReqs(new Map(list.filter((r): r is RequerimientoCompra => !!r).map(r => [r.id, r])));
      });
    return () => { vivo = false; };
  }, [clave]);
  return reqs;
}
