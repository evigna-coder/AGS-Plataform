/**
 * Estado de un remito de SERVICIO según las OT que respalda (2026-09-21).
 *
 * El remito de servicio es un comprobante: no mueve stock y no "vuelve". Su
 * vida la marcan las OT que lleva: se completa cuando la última cierra
 * administrativamente y se cancela si todas se cancelaron. Antes solo se
 * completaba al cerrar la OT, y quedaban colgados los emitidos contra una OT
 * ya cerrada (0001-00017505) y los de una OT que se cancela.
 *
 * Puro: sin Firebase, testeable con `test:remito-servicio`.
 */
export type EstadoOTParaRemito = 'abierta' | 'cerrada' | 'cancelada' | 'inexistente';

/** Clasifica una OT (o su ausencia) para decidir el remito de servicio. */
export function clasificarOTParaRemito(ot: { estadoAdmin?: string | null } | null | undefined): EstadoOTParaRemito {
  if (!ot) return 'inexistente';
  if (ot.estadoAdmin === 'CANCELADA') return 'cancelada';
  if (ot.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || ot.estadoAdmin === 'FINALIZADO') return 'cerrada';
  return 'abierta';
}

/**
 * Estado que le corresponde al remito, o `null` si sigue esperando: alguna OT
 * abierta, alguna que no existe (no se resuelve a ciegas) o ninguna OT.
 * Todas canceladas → cancelado; el resto (al menos una cerrada) → completado.
 */
export function estadoRemitoServicioSegunOTs(estados: EstadoOTParaRemito[]): 'completado' | 'cancelado' | null {
  if (estados.length === 0) return null;
  if (estados.some(e => e === 'abierta' || e === 'inexistente')) return null;
  return estados.every(e => e === 'cancelada') ? 'cancelado' : 'completado';
}
