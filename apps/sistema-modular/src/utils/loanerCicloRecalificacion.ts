import type { Loaner, LoanerDerivacion, PrestamoLoaner } from '@ags/shared';

/**
 * Lógica PURA del ciclo de recalificación de un loaner (2026-09-18). Sin
 * Firestore: la comparten `utils/loanerRecalificacion` (creación de OT y
 * sweeps) y `loanersService` (liberación), que no pueden importarse entre sí.
 *
 * Un loaner entra en recalificación por dos caminos:
 *  - vuelve de un PRÉSTAMO al cliente → OT interna NUEVA (padre + .01);
 *  - vuelve de una DERIVACIÓN a proveedor externo → siguiente ÍTEM de la OT
 *    del trabajo (30255.01 banco, 30255.02 ELS, 30255.03 RQ), o OT nueva si el
 *    módulo salió sin OT.
 * En los dos casos el origen guarda `requiereRecalificacion` y
 * `otRecalificacionNumber`; el ciclo vigente es el origen más reciente.
 */

/** Sentinel del guard anti-duplicado: "reclamado" por una sesión que está creando la OT. */
export const OT_RECALIFICACION_CLAIM = 'PENDIENTE';

export type OrigenRecalificacion =
  | { tipo: 'prestamo'; prestamo: PrestamoLoaner }
  | { tipo: 'derivacion'; derivacion: LoanerDerivacion };

export function idDeOrigen(o: OrigenRecalificacion): string {
  return o.tipo === 'prestamo' ? o.prestamo.id : o.derivacion.id;
}

function fechaDeOrigen(o: OrigenRecalificacion): number {
  const f = o.tipo === 'prestamo' ? o.prestamo.fechaRetornoReal : o.derivacion.fechaRetorno;
  const ms = f ? new Date(f).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function otDeOrigen(o: OrigenRecalificacion): string | null | undefined {
  return o.tipo === 'prestamo' ? o.prestamo.otRecalificacionNumber : o.derivacion.otRecalificacionNumber;
}

function requiereDeOrigen(o: OrigenRecalificacion): boolean {
  return o.tipo === 'prestamo' ? !!o.prestamo.requiereRecalificacion : !!o.derivacion.requiereRecalificacion;
}

/** Último préstamo devuelto y última derivación retornada, como orígenes. */
function ultimosOrigenes(loaner: Loaner): OrigenRecalificacion[] {
  const out: OrigenRecalificacion[] = [];
  const prestamos = loaner.prestamos ?? [];
  for (let i = prestamos.length - 1; i >= 0; i--) {
    if (prestamos[i].estado !== 'devuelto') continue;
    out.push({ tipo: 'prestamo', prestamo: prestamos[i] });
    break;
  }
  // Las derivaciones cuentan con cualquier alcance (2026-09-18, LNR-0013): la
  // parte reparada afuera vuelve a un módulo que hay que rearmar y recalificar.
  const derivaciones = loaner.derivaciones ?? [];
  for (let i = derivaciones.length - 1; i >= 0; i--) {
    const d = derivaciones[i];
    if (!d.fechaRetorno) continue;
    out.push({ tipo: 'derivacion', derivacion: d });
    break;
  }
  // Más reciente primero. Empate (mismo día sin hora): la derivación, que es
  // el evento que se registra al final del circuito.
  return out.sort((a, b) => fechaDeOrigen(b) - fechaDeOrigen(a) || (a.tipo === 'derivacion' ? -1 : 1));
}

/**
 * Origen que quedó pendiente de OT: requiere recalificación y no tiene OT
 * anotada ni claim. Caso de la devolución desde el portal o de un fallo
 * post-commit en el retorno de proveedor; lo completa el sweep del back-office.
 */
export function origenPendienteDeRecalificacion(loaner: Loaner): OrigenRecalificacion | null {
  const o = ultimosOrigenes(loaner)[0];
  if (!o) return null;
  return requiereDeOrigen(o) && !otDeOrigen(o) ? o : null;
}

/** OT (real, no el claim) del ciclo de recalificación vigente del loaner. */
export function otRecalificacionVigente(loaner: Loaner): string | null {
  for (const o of ultimosOrigenes(loaner)) {
    const num = otDeOrigen(o);
    if (num && num !== OT_RECALIFICACION_CLAIM) return num;
  }
  return null;
}

/**
 * ¿El cierre técnico de `otCerrada` libera el loaner? Con el ciclo anclado a
 * un ÍTEM (30255.03) solo ese ítem libera: el .02 del proveedor externo, que
 * también lleva `loanerId`, se cierra después de la vuelta y NO debe soltar el
 * módulo sin recalificar. Con el ciclo anclado a un padre, cualquiera de sus
 * hijas cuenta (el sweep verifica que hayan cerrado todas). Sin ciclo anotado
 * (data legacy) se mantiene el comportamiento histórico: libera.
 */
export function otCierraElCiclo(loaner: Loaner, otCerrada: string): boolean {
  const ciclo = otRecalificacionVigente(loaner);
  if (!ciclo) return true;
  if (ciclo.includes('.')) return otCerrada === ciclo;
  return otCerrada.split('.')[0] === ciclo;
}

/**
 * Patch del loaner al volver del proveedor: cierra la derivación del remito
 * (fechaRetorno) y deja el módulo EN RECALIFICACIÓN con la derivación marcada
 * para que se cree la OT. Vale también para una PARTE (2026-09-18, LNR-0013):
 * a diferencia de la parte prestada a un cliente, la reparada afuera vuelve a
 * un módulo que hay que rearmar y recalificar.
 */
export function patchRetornoProveedor(
  loaner: Pick<Loaner, 'estado' | 'derivaciones' | 'enProveedor'>,
  remitoId: string,
  now: string,
): { estado: Loaner['estado']; enProveedor: null; derivaciones: LoanerDerivacion[] } {
  const derivaciones = (loaner.derivaciones ?? []).map(d =>
    d.remitoId === remitoId && !d.fechaRetorno ? { ...d, fechaRetorno: now, requiereRecalificacion: true } : d,
  );
  return { estado: 'en_recalificacion', enProveedor: null, derivaciones };
}
