import { useEffect, useState } from 'react';
import { reservasService, type ReservaVisibleCierre } from '../services/stockService';

export type { ReservaVisibleCierre };

/**
 * Reservas de stock de los presupuestos vinculados a la OT, para mostrarlas en
 * el bloque de materiales del cierre (2026-08-31): el camino automático las
 * entrega sin selección manual, y el admin tiene que ver QUÉ va a salir y de
 * dónde antes de confirmar — no enterarse por el kardex.
 */
export function useReservasCierre(budgets?: string[]): ReservaVisibleCierre[] {
  const [reservas, setReservas] = useState<ReservaVisibleCierre[]>([]);
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
  }, [key]);

  return reservas;
}
