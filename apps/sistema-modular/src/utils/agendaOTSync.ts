import type { AgendaEntry, EstadoAgenda, OTEstadoAdmin, WorkOrder } from '@ags/shared';
import { addDays, isWeekend } from 'date-fns';
import { sistemasService } from '../services/firebaseService';

/**
 * Mapping EstadoAgenda → OT estadoAdmin target.
 * - `cancelado` no tiene mapping (admin decide qué hacer con la OT).
 * - El update avanza siempre; regresa SOLO dentro de la banda de coordinación
 *   (ASIGNADA↔COORDINADA, ej. confirmado→tentativo — UAT 2026-07-30). Estados
 *   de trabajo (EN_CURSO+) nunca se regresan desde la agenda.
 */
export const AGENDA_TO_OT_ESTADO: Partial<Record<EstadoAgenda, OTEstadoAdmin>> = {
  pendiente: 'ASIGNADA',
  tentativo: 'ASIGNADA',
  tentativo_interior: 'ASIGNADA',
  confirmado: 'COORDINADA',
  confirmado_interior: 'COORDINADA',
  en_progreso: 'EN_CURSO',
  en_progreso_interior: 'EN_CURSO',
  completado: 'CIERRE_TECNICO',
  completado_interior: 'CIERRE_TECNICO',
};

/** Orden lineal del workflow de OT — usado para no regresar de estado. */
export const OT_ESTADO_ORDER: Record<OTEstadoAdmin, number> = {
  CREADA: 0, ASIGNADA: 1, COORDINADA: 2, EN_CURSO: 3,
  CIERRE_TECNICO: 4, CIERRE_ADMINISTRATIVO: 5, FINALIZADO: 6,
};

/** In-memory cache for sistemaId → id visible lookups within a session. */
const agsIdCache = new Map<string, string | null>();

/** ID visible del equipo para agenda: código interno del CLIENTE (pedido
 *  coordinación 2026-08-03 — es el id con el que ella identifica los equipos);
 *  fallback al agsVisibleId si el equipo no tiene código. Cacheado en memoria. */
export async function resolveEquipoAgsId(sistemaId: string | undefined | null): Promise<string | null> {
  if (!sistemaId) return null;
  if (agsIdCache.has(sistemaId)) return agsIdCache.get(sistemaId)!;
  try {
    const sistema = await sistemasService.getById(sistemaId);
    const agsId = sistema?.codigoInternoCliente || sistema?.agsVisibleId || null;
    agsIdCache.set(sistemaId, agsId);
    return agsId;
  } catch {
    return null;
  }
}

/** Avanza una fecha N días hábiles (saltea weekends). */
export function addWeekdays(date: Date, n: number): Date {
  let current = date;
  let remaining = n;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (!isWeekend(current)) remaining--;
  }
  return current;
}

/** What's stored in the agenda internal clipboard. */
export interface ClipboardData {
  type: 'entry' | 'pending' | 'cut';
  /** Copied from an existing entry */
  entry?: AgendaEntry;
  /** Copied from a pending OT */
  ot?: WorkOrder;
  /** Cortar (2026-07-31): entradas levantadas de una celda — se borran al cortar
   *  (las OTs vuelven solas a "para coordinar") y se recrean al pegar,
   *  preservando estado/notas/título. El corte pega UNA sola vez. */
  entries?: AgendaEntry[];
  /** Celda origen del corte — el comentario de celda viaja al pegar. */
  srcCell?: { ingenieroId: string; fecha: string; quarter: 1 | 2 | 3 | 4 };
}
