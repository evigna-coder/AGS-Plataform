/**
 * Antigüedad y clasificación de OTs para el control semanal (2026-09-02).
 *
 * Vive fuera del hook para poder testearse: `useControlSemanal` importa los
 * servicios de Firestore, así que importarlo desde un test inicializaría
 * Firebase. Acá adentro no hay IO ni React — solo reglas.
 *
 * Tests: apps/sistema-modular/src/utils/__tests__/controlSemanalAntiguedad.test.ts
 * Run:   pnpm --filter @ags/sistema-modular test:control-antiguedad
 */
import type { OTEstadoAdmin, WorkOrder } from '@ags/shared';
import { hoyLocalISODate } from './formatFecha';

export type AgendaControlEstado = 'cerrada' | 'sin_cierre_admin' | 'sin_realizar' | 'ot_no_encontrada';

/**
 * TRABAJO hecho: cierre técnico en adelante. Es el criterio de la sección de
 * presupuestos —un ppto cuya OT quedó en cierre técnico tiene que figurar
 * igual, justamente porque el cierre admin puede estar olvidado (UAT
 * 2026-07-20)—. NO sirve para decir si una visita está cerrada: para eso está
 * `OT_CERRADA_ADMIN`, que es lo único que cuenta como cerrada de verdad.
 */
export const OT_TRABAJO_REALIZADO = new Set<OTEstadoAdmin>([
  'CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO',
]);

/** Para facturación cuenta el cierre ADMINISTRATIVO (ídem CierreFacturacionWizard). */
export const OT_CERRADA_ADMIN = new Set<OTEstadoAdmin>([
  'CIERRE_ADMINISTRATIVO', 'FINALIZADO',
]);

/**
 * Fecha en que la OT entró por ÚLTIMA vez a un estado.
 *
 * Sale de `estadoHistorial`, que registra cada transición con su fecha —
 * `otService.update` stripea `estadoAdmin` justamente para forzar que todo
 * cambio pase por el camino que lo escribe. Se toma la última ocurrencia: una
 * OT reabierta cuenta desde la reapertura, no desde el cierre original.
 *
 * Fallback para OTs previas al historial: si el estado buscado ES el actual,
 * `estadoAdminFecha` lo dice (mientras siga trabada ahí, nadie lo pisó).
 */
export function fechaEnEstado(ot: WorkOrder | null, estado: OTEstadoAdmin): string | null {
  if (!ot) return null;
  const hist = ot.estadoHistorial ?? [];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].estado === estado && hist[i].fecha) return hist[i].fecha;
  }
  if (ot.estadoAdmin === estado && ot.estadoAdminFecha) return ot.estadoAdminFecha;
  return null;
}

/** Días enteros transcurridos desde una fecha ISO. `null` si no hay fecha. */
export function diasDesdeISO(iso: string | null | undefined, ahora = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((ahora - t) / 86_400_000));
}

/**
 * En qué evento arranca el reloj de una OT según por qué está trabada
 * (definición del user, 2026-09-02):
 *   - sin realizar        → desde la FECHA AGENDADA del servicio
 *   - sin cierre admin    → desde el CIERRE TÉCNICO
 *
 * Una visita agendada para MÁS ADELANTE no está trabada: está esperando su
 * turno. Devuelve `null` y la columna queda vacía. Empieza a contar al día
 * siguiente de la fecha agendada.
 *
 * Al principio esto contaba desde la asignación y quedaba sin sentido: una OT
 * coordinada con un mes de anticipación mostraba "30 d" en rojo el día antes
 * de la visita. Eso no era demora, era el tiempo de coordinación.
 */
export function anclaAntiguedadOT(
  ot: WorkOrder | null,
  estado: AgendaControlEstado,
  fechaAgenda?: string | null,
  /** yyyy-mm-dd — inyectable para los tests. */
  hoy?: string,
): { fecha: string | null; que: string | null } {
  if (estado === 'sin_cierre_admin') {
    return { fecha: fechaEnEstado(ot, 'CIERRE_TECNICO'), que: 'cierre técnico' };
  }
  if (estado === 'sin_realizar') {
    // Sin agenda —la OT nunca se coordinó— se cae a la asignación, que es el
    // único momento conocido en que la OT quedó en manos de alguien.
    const ref = fechaAgenda ?? fechaEnEstado(ot, 'ASIGNADA') ?? ot?.fechaAsignacion ?? null;
    if (!ref) return { fecha: null, que: null };
    if (ref.slice(0, 10) > (hoy ?? hoyLocalISODate())) return { fecha: null, que: null };
    return { fecha: ref, que: fechaAgenda ? 'la fecha agendada' : 'asignada' };
  }
  return { fecha: null, que: null };
}

/**
 * Clasifica una OT SIN mirar su entrada de agenda — las que arrastran de
 * semanas anteriores no la tienen cargada (la suscripción trae solo la semana
 * visible). `classifyEntry` del hook agrega los diagnósticos que dependen de la
 * agenda (visita cancelada, etc.).
 */
export function classifyOT(ot: WorkOrder): { estado: AgendaControlEstado; motivos: string[] } {
  if (ot.estadoAdmin && OT_CERRADA_ADMIN.has(ot.estadoAdmin)) return { estado: 'cerrada', motivos: [] };
  if (ot.estadoAdmin === 'CIERRE_TECNICO' || ot.status === 'FINALIZADO') {
    return { estado: 'sin_cierre_admin', motivos: ['Finalizada por el técnico — falta cierre administrativo'] };
  }
  const motivos: string[] = [];
  if (!ot.ingenieroAsignadoId) motivos.push('Sin IST asignado');
  else motivos.push(ot.fechaInicio ? 'Reporte iniciado, sin finalizar' : 'Reporte sin finalizar');
  return { estado: 'sin_realizar', motivos };
}

/**
 * Fecha (yyyy-mm-dd) que ubica a la OT en una semana del control.
 *
 * La agenda manda: si la visita se coordino, esa es su semana. Sin agenda, lo
 * unico que ubica a la OT es el TRABAJO YA HECHO (cierre tecnico en adelante):
 * paso algo, en una fecha conocida, y falta cerrarlo.
 *
 * NO se usa la asignacion como respaldo (2026-09-02). El historial de estados
 * solo registra los avances: una OT que fue ASIGNADA y despues volvio a CREADA
 * —le sacaron el ingeniero— conserva la entrada vieja de ASIGNADA aunque hoy no
 * este asignada ni agendada. Tomando esa fecha, seis OTs sin coordinar (29999.01,
 * 30022.02, 30014.02, 28149.02, 30021.02, 29087.08) entraban al arrastre como si
 * fueran visitas vencidas. Una OT sin agenda y sin trabajo hecho no pertenece a
 * ninguna semana: esta abierta, no atrasada.
 */
export function fechaReferenciaOT(ot: WorkOrder | null, fechaAgenda: string | null): string | null {
  if (fechaAgenda) return fechaAgenda.slice(0, 10);
  const trabajoHecho = !!ot?.estadoAdmin && OT_TRABAJO_REALIZADO.has(ot.estadoAdmin);
  if (!trabajoHecho) return null;
  const cruda = fechaEnEstado(ot, 'CIERRE_TECNICO') ?? ot?.fechaCierre ?? null;
  return cruda ? cruda.slice(0, 10) : null;
}

/**
 * ¿Esta OT arrastra de una semana anterior? Entra la que YA tendría que estar
 * cerrada al empezar la semana visible. Lo agendado a futuro no arrastra
 * —todavía no vence—, y nada aparece en semanas ANTERIORES a la suya.
 */
export function arrastraDeSemanaAnterior(
  ot: WorkOrder,
  fechaAgenda: string | null,
  weekStart: string,
): boolean {
  if (ot.estadoAdmin === 'CANCELADA') return false;
  if (ot.estadoAdmin && OT_CERRADA_ADMIN.has(ot.estadoAdmin)) return false;
  if ((ot.controlSemanalExcluidoSemanas ?? []).includes(weekStart)) return false;
  // Arrastra hacia ADELANTE, nunca hacia atras (mismo criterio que el backlog
  // de facturacion, 2026-08-09). Antes bastaba con que el trabajo estuviera
  // hecho, sin mirar CUANDO: una OT de agosto aparecia tambien en el control
  // de julio, donde todavia no existia.
  const referencia = fechaReferenciaOT(ot, fechaAgenda);
  return !!referencia && referencia < weekStart;
}
