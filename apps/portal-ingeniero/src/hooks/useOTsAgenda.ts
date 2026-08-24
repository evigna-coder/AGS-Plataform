import { useState, useEffect, useMemo } from 'react';
import { esOTCerradaTecnicamente } from '@ags/shared';
import { otService, type EnviadoPorEmail, type EnvioManual } from '../services/firebaseService';

/**
 * Estado de cierre y de envío al cliente, por número de OT (2026-08-23).
 *
 * La agenda por sí sola NO sabe si la orden está cerrada: `estadoAgenda`
 * (pendiente/tentativo/confirmado/…) es estado de COORDINACIÓN, se marca a mano
 * y no se sincroniza con el cierre real — el control semanal existe justamente
 * porque los dos no coinciden. Así que el dato hay que traerlo de la OT.
 *
 * Se cruza en el portal en vez de denormalizarlo en la entrada de agenda porque
 * `enviadoPorEmail` lo escribe reportes-ot en la colección `reportes`, no en
 * `ordenes_trabajo`: estamparlo en la agenda obligaría a tocar la app de campo,
 * que es superficie congelada. `otService.subscribe` ya devuelve las dos
 * colecciones mergeadas, que es exactamente lo que necesita esta vista.
 */
export interface OTInfoAgenda {
  cerrada: boolean;
  envio?: EnviadoPorEmail | null;
  envioManual?: EnvioManual | null;
}

/**
 * @param ingenieroId  mismo filtro que usa la agenda: el id cuando se ve "mis
 *                     OTs", `null` cuando un admin mira la de todos.
 * @param activo       evita la suscripción hasta que la agenda resolvió a quién
 *                     mira; sin esto se dispara una lectura de TODAS las OTs
 *                     durante el primer render.
 */
export function useOTsAgenda(ingenieroId: string | null, activo: boolean) {
  const [porOtNumber, setPorOtNumber] = useState<Map<string, OTInfoAgenda>>(new Map());

  useEffect(() => {
    if (!activo) return;
    const unsub = otService.subscribe(
      ingenieroId ? { ingenieroId } : undefined,
      (ots) => {
        const mapa = new Map<string, OTInfoAgenda>();
        for (const ot of ots) {
          if (!ot.otNumber) continue;
          mapa.set(ot.otNumber, {
            cerrada: esOTCerradaTecnicamente(ot),
            envio: ot.enviadoPorEmail ?? null,
            envioManual: ot.envioManual ?? null,
          });
        }
        setPorOtNumber(mapa);
      },
      (err) => console.warn('[useOTsAgenda] no se pudo leer el estado de las OTs:', err),
    );
    return unsub;
  }, [ingenieroId, activo]);

  return useMemo(() => ({
    /** `undefined` = todavía no cargó, o la OT no está en el alcance del filtro. */
    infoDe: (otNumber: string | null | undefined): OTInfoAgenda | undefined =>
      otNumber ? porOtNumber.get(otNumber) : undefined,
  }), [porOtNumber]);
}
