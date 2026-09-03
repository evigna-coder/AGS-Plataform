import type { OTEstadoAdmin } from '@ags/shared';

/**
 * Estados en los que la OT ya dejo de ser "una visita programada": el trabajo
 * arranco o termino. Se listan aca y no se derivan de `OT_ESTADO_ORDER` a
 * proposito — ese vive en `agendaOTSync`, que importa servicios de Firestore y
 * haria imposible testear esta regla sin levantar Firebase.
 */
const YA_PASO_ALGO = new Set<OTEstadoAdmin>([
  'EN_CURSO', 'CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO', 'CANCELADA',
]);

/**
 * ¿Borrar esta entrada de agenda tiene que revertir la OT (sacarle ingeniero,
 * fecha y bajarla de estado)? — 2026-09-02, caso 30234.02.
 *
 * Antes se revertia SIEMPRE. El estado tenia guard —no se retrocede desde
 * EN_CURSO o CIERRE_TECNICO—, pero el borrado de `ingenieroAsignado*` y
 * `fechaServicioAprox` no tenia ninguno. Consecuencias:
 *
 *  - Una OT ya trabajada perdia quien la hizo y cuando. En 30234.02 el trabajo
 *    estaba en CIERRE_TECNICO y quedo sin ingeniero ni fecha, con su entrada de
 *    agenda intacta: la lista la mostraba "sin asignar" para siempre.
 *  - MOVER una visita es borrar + crear. El revert del borrado, que es
 *    fire-and-forget, podia llegar DESPUES del alta nueva y limpiar la OT que
 *    se acababa de estampar.
 *
 * Dos guards: no se toca una OT que ya paso de COORDINADA (lo que ocurrio es un
 * hecho historico, no una programacion), ni una a la que le quedan otras
 * entradas de agenda (se movio, no se desprogramo).
 */
export function debeRevertirOTAlBorrarEntrada(
  estadoAdmin: OTEstadoAdmin | undefined | null,
  entradasRestantes: number,
): boolean {
  if (entradasRestantes > 0) return false;
  if (!estadoAdmin) return true;                  // sin estado: nada que preservar
  return !YA_PASO_ALGO.has(estadoAdmin);
}

