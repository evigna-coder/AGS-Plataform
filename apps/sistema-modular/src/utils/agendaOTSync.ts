import type { AgendaEntry, EstadoAgenda, OTEstadoAdmin, WorkOrder } from '@ags/shared';
import { addDays, isWeekend, parseISO } from 'date-fns';
import { formatDateKey } from './agendaDateUtils';
import { sistemasService } from '../services/firebaseService';
import { ordenesTrabajoService } from '../services/otService';

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
  // Baja lateral: -1 para que ningún avance de agenda la 'supere' y la reviva.
  CANCELADA: -1,
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

/**
 * ¿El día destino CONTINÚA el rango de una entrada existente, o deja un hueco?
 *
 * Contiguo = cae dentro del rango, o es el día hábil inmediatamente anterior o
 * posterior. Con hueco de por medio es otra JORNADA y va como entrada separada
 * (2026-08-09).
 *
 * Antes, pegar o arrastrar una OT que ya tenía entrada SIEMPRE estiraba el
 * rango: una capacitación de lunes y miércoles obligaba a ocupar también el
 * martes, porque no había forma de representar dos jornadas sueltas de la misma
 * OT. El modelo sí las soporta —varias entradas por OT— pero la UI las fusionaba.
 */
export function continuaElRango(
  existing: { fechaInicio: string; fechaFin: string },
  fecha: string,
): boolean {
  if (fecha >= existing.fechaInicio && fecha <= existing.fechaFin) return true;
  // Día hábil siguiente al final del rango (viernes → lunes cuenta como contiguo).
  if (fecha === formatDateKey(addWeekdays(parseISO(existing.fechaFin), 1))) return true;
  // O el hábil anterior al inicio.
  if (formatDateKey(addWeekdays(parseISO(fecha), 1)) === existing.fechaInicio) return true;
  return false;
}

/**
 * Patch para EXTENDER una entrada hacia el destino, en la dirección que
 * corresponda (2026-08-11). El estirado solo movía `quarterEnd`: soltar la
 * misma OT en un cuarto ANTERIOR del mismo día dejaba quarterStart=3 →
 * quarterEnd=1 — rango invertido, que la grilla no dibuja (caso 30022.01,
 * "la OT desapareció de agenda"). Destino dentro del rango → sin cambios.
 */
export function extenderRangoHacia(
  existing: { fechaInicio: string; fechaFin: string; quarterStart: number; quarterEnd: number },
  fecha: string,
  quarter: number,
): Partial<{ fechaInicio: string; quarterStart: 1 | 2 | 3 | 4; fechaFin: string; quarterEnd: 1 | 2 | 3 | 4 }> {
  const antesDelInicio = fecha < existing.fechaInicio
    || (fecha === existing.fechaInicio && quarter < existing.quarterStart);
  const despuesDelFin = fecha > existing.fechaFin
    || (fecha === existing.fechaFin && quarter > existing.quarterEnd);
  if (antesDelInicio) return { fechaInicio: fecha, quarterStart: quarter as 1 | 2 | 3 | 4 };
  if (despuesDelFin) return { fechaFin: fecha, quarterEnd: quarter as 1 | 2 | 3 | 4 };
  return {};
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

/**
 * Estampa en la OT el ingeniero y la fecha de su entrada de agenda y, si estaba
 * en CREADA, la promueve a ASIGNADA. Es lo que hacen el drop desde la cola y
 * el pegado; el DESHACER lo usa para que recrear una entrada borrada (o volver
 * a mover una) deje la OT como estaba. Best-effort: no bloquea la agenda.
 *
 * Estado FRESCO de Firestore (el de la cola puede estar viejo) y
 * `skipAgendaSync` porque la entrada ya existe: sin el flag, el rebote
 * OT→agenda podía duplicarla.
 */
export function reasignarOTDesdeAgenda(
  otNumber: string,
  cambio: { ingenieroId: string; ingenieroNombre: string; fecha: string },
  origen = 'agenda',
): void {
  ordenesTrabajoService.getByOtNumber(otNumber).then(fresh => {
    const promover = !fresh?.estadoAdmin || fresh.estadoAdmin === 'CREADA';
    return ordenesTrabajoService.update(otNumber, {
      ingenieroAsignadoId: cambio.ingenieroId,
      ingenieroAsignadoNombre: cambio.ingenieroNombre,
      fechaServicioAprox: cambio.fecha,
      ...(promover ? { estadoAdmin: 'ASIGNADA' as OTEstadoAdmin, estadoAdminFecha: new Date().toISOString() } : {}),
    }, { skipAgendaSync: true });
  }).catch(err => console.error(`[${origen}] sync OT ${otNumber} falló:`, err));
}

/**
 * Propaga un estado de agenda a la OT linkeada. Avanza siempre; REGRESA solo
 * dentro de la banda que maneja la agenda (ASIGNADA↔COORDINADA): confirmado→
 * tentativo debe volver la OT a ASIGNADA (UAT 2026-07-30). Estados de trabajo
 * (EN_CURSO+) nunca se regresan desde acá. `cancelado` no propaga. Best-effort.
 */
export function propagarEstadoAgendaAOT(otNumber: string, estado: EstadoAgenda): void {
  const targetOT = AGENDA_TO_OT_ESTADO[estado];
  if (!targetOT) return;
  ordenesTrabajoService.getByOtNumber(otNumber).then(ot => {
    if (!ot) return;
    const current = (ot.estadoAdmin || 'CREADA') as OTEstadoAdmin;
    const BANDA_AGENDA: OTEstadoAdmin[] = ['ASIGNADA', 'COORDINADA'];
    const avanza = OT_ESTADO_ORDER[targetOT] > OT_ESTADO_ORDER[current];
    const regresa = OT_ESTADO_ORDER[targetOT] < OT_ESTADO_ORDER[current]
      && BANDA_AGENDA.includes(current) && BANDA_AGENDA.includes(targetOT);
    if (avanza || regresa) {
      return ordenesTrabajoService.update(otNumber, {
        estadoAdmin: targetOT,
        estadoAdminFecha: new Date().toISOString(),
      });
    }
  }).catch(err => console.error(`[agenda] propagar estadoAgenda a OT ${otNumber} falló:`, err));
}
