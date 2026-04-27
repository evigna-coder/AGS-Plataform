import type { AgendaEntry, EstadoAgenda, OTEstadoAdmin, WorkOrder } from '@ags/shared';
import { addDays, isWeekend } from 'date-fns';
import { sistemasService } from '../services/firebaseService';

/**
 * Mapping EstadoAgenda → OT estadoAdmin target.
 * - `cancelado` no tiene mapping (admin decide qué hacer con la OT).
 * - El update solo se aplica si la OT actual está en un estado anterior al
 *   target — nunca hace regresión.
 */
export const AGENDA_TO_OT_ESTADO: Partial<Record<EstadoAgenda, OTEstadoAdmin>> = {
  pendiente: 'ASIGNADA',
  tentativo: 'ASIGNADA',
  confirmado: 'COORDINADA',
  en_progreso: 'EN_CURSO',
  completado: 'CIERRE_TECNICO',
};

/** Orden lineal del workflow de OT — usado para no regresar de estado. */
export const OT_ESTADO_ORDER: Record<OTEstadoAdmin, number> = {
  CREADA: 0, ASIGNADA: 1, COORDINADA: 2, EN_CURSO: 3,
  CIERRE_TECNICO: 4, CIERRE_ADMINISTRATIVO: 5, FINALIZADO: 6,
};

/** In-memory cache for sistemaId → agsVisibleId lookups within a session. */
const agsIdCache = new Map<string, string | null>();

/** Resuelve el agsVisibleId del sistema (cacheado en memoria). */
export async function resolveEquipoAgsId(sistemaId: string | undefined | null): Promise<string | null> {
  if (!sistemaId) return null;
  if (agsIdCache.has(sistemaId)) return agsIdCache.get(sistemaId)!;
  try {
    const sistema = await sistemasService.getById(sistemaId);
    const agsId = sistema?.agsVisibleId ?? null;
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
  type: 'entry' | 'pending';
  /** Copied from an existing entry */
  entry?: AgendaEntry;
  /** Copied from a pending OT */
  ot?: WorkOrder;
}
