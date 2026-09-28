/**
 * Primer número de OT de la numeración nueva (go-live 2026-07). Las consultas
 * "en vivo" de la agenda y de la cola de pendientes se recortan a partir de acá
 * (rango por `documentId()` en `reportes`, rango por `otNumber` en
 * `agendaEntries`): lo anterior es histórico y no se coordina.
 */
export const OT_NUMERACION_GO_LIVE = '29779';
