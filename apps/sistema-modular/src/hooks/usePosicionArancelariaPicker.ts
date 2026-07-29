import { useState, useEffect, useMemo, useCallback } from 'react';
import { posicionesArancelariasService } from '../services/importacionesService';
import type { PosicionArancelaria } from '@ags/shared';

/**
 * Picker de posición arancelaria CONTRA EL CATÁLOGO (pedido 2026-07-28): antes el
 * campo del artículo era texto libre y los tributos se tipeaban a mano en cada
 * artículo → typos (9027.90.99 vs .90) y gravámenes desincronizados del catálogo.
 * Expone opciones para un SearchableSelect creatable + lookup por código para
 * copiar el tratamiento al elegir. El creatable conserva la vía libre para
 * posiciones que aún no están en el catálogo (sin copia de tributos).
 */
export function usePosicionArancelariaPicker(enabled: boolean) {
  const [posiciones, setPosiciones] = useState<PosicionArancelaria[]>([]);

  useEffect(() => {
    if (!enabled) return;
    // getAll pasa por serviceCache (TTL 2 min) — barato aunque se abra seguido.
    posicionesArancelariasService.getAll()
      .then(setPosiciones)
      .catch(err => console.error('[usePosicionArancelariaPicker] error cargando catálogo:', err));
  }, [enabled]);

  const options = useMemo(
    () => posiciones.map(p => ({
      value: p.codigo,
      label: p.codigo,
      // linkedCode = código SIN puntos: el filtro del SearchableSelect lo incluye en el
      // haystack, así "90279090" tipeado corrido matchea "9027.90.90.900G".
      linkedCode: p.codigo.replace(/\./g, ''),
      subLabel: p.descripcion ? p.descripcion.slice(0, 70) : undefined,
    })),
    [posiciones],
  );

  const findByCodigo = useCallback(
    (codigo: string): PosicionArancelaria | undefined =>
      posiciones.find(p => p.codigo.trim().toUpperCase() === codigo.trim().toUpperCase()),
    [posiciones],
  );

  return { options, findByCodigo };
}
