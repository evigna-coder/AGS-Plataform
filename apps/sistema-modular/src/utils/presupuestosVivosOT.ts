import type { Presupuesto, PresupuestoEstado, WorkOrder } from '@ags/shared';

/**
 * Único estado que NO se arrastra: el presupuesto anulado murió y no va a
 * facturarse nunca, arrastrarlo a los items nuevos es ruido.
 *
 * Un presupuesto YA FACTURADO ('finalizado') SÍ se arrastra (2026-08-08): la OT
 * tiene que referenciarlo siempre —el caso típico es el servicio completo con
 * pago adelantado, que se factura antes de abrir la primera OT y después
 * acompaña a todos los items del trabajo—. Que no vuelva a aparecer en el
 * control semanal lo resuelve el control por estado, no este filtro.
 */
const ESTADOS_CERRADOS: PresupuestoEstado[] = ['anulado'];

/**
 * Presupuestos que siguen "vivos" en un trabajo y por lo tanto tienen que
 * acompañar a los items nuevos (2026-08-08).
 *
 * El caso real: el presupuesto nace en el item .02 (el ingeniero pide partes
 * desde el portal), después se espera la importación, se instala, se prueba, y
 * el trabajo recién se factura siete items más adelante. Ese presupuesto tiene
 * que vivir a través de todos los cierres administrativos del camino, no morir
 * con el item donde nació ni tener que re-vincularse a mano en cada uno.
 *
 * El vínculo se MUEVE, no se copia (ver `otService.moverPresupuestosAlItem`): el
 * presupuesto vive en UNA sola OT a la vez —la última abierta— porque si queda
 * en varias, el control semanal lo ve simultáneamente como trabajo ya realizado
 * y como trabajo pendiente.
 *
 * @param hermanas items ya existentes del mismo padre (incluido el padre si aplica)
 * @param presupuestos catálogo para resolver el estado por número
 */
export function presupuestosVivosDeHermanas(
  hermanas: WorkOrder[],
  presupuestos: Presupuesto[],
): string[] {
  const estadoPorNumero = new Map(presupuestos.map(p => [p.numero, p.estado]));
  const vivos = new Set<string>();
  for (const ot of hermanas) {
    for (const numero of ot.budgets ?? []) {
      const n = (numero || '').trim();
      if (!n) continue;
      const estado = estadoPorNumero.get(n);
      // Sin estado conocido (ppto que no se pudo leer) se arrastra igual: es
      // peor perder el vínculo que arrastrar uno de más, que se saca a mano.
      if (estado && ESTADOS_CERRADOS.includes(estado)) continue;
      vivos.add(n);
    }
  }
  return Array.from(vivos);
}
