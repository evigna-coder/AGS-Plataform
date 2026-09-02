import { useCallback, useEffect, useState } from 'react';
import { reservasService, type ReservaVisibleCierre } from '../services/stockService';

export type { ReservaVisibleCierre };

/**
 * Reservas de stock de los presupuestos vinculados a la OT, para mostrarlas en
 * el bloque de materiales del cierre (2026-08-31).
 *
 * Desde el 2026-09-01 el cierre NO las consume solas: el recuadro es
 * informativo y ofrece liberarlas, así que hace falta poder refrescar la lista
 * después de soltar una.
 */
export function useReservasCierre(budgets?: string[]): {
  reservas: ReservaVisibleCierre[];
  refrescar: () => void;
} {
  const [reservas, setReservas] = useState<ReservaVisibleCierre[]>([]);
  const [nonce, setNonce] = useState(0);
  const key = (budgets ?? []).filter(Boolean).join('|');

  useEffect(() => {
    if (!key) { setReservas([]); return; }
    let cancelled = false;
    reservasService.reservadasPorNumeros(key.split('|'))
      .then(r => { if (!cancelled) setReservas(r); })
      .catch(err => {
        console.warn('[useReservasCierre] no se pudieron cargar las reservas:', err);
        if (!cancelled) setReservas([]);
      });
    return () => { cancelled = true; };
  }, [key, nonce]);

  const refrescar = useCallback(() => setNonce(n => n + 1), []);
  return { reservas, refrescar };
}
