// Protocol types (UI/rendering-specific, stay local)
export * from './types/protocol';

// Domain types re-exported from @ags/shared
export type {
  Part,
} from '@shared/types/index';

/**
 * Firma del cliente por lote (2026-09-21). En el reporte ANCLA (el que el
 * cliente firmó) queda `otsAutorizadas`; en cada reporte firmado por lote
 * queda `autorizadaDesdeOt`. `fecha` = momento de la firma.
 */
export interface FirmaLote {
  autorizadaDesdeOt?: string | null;
  otsAutorizadas?: string[] | null;
  fecha: string;
  aclaracionCliente?: string | null;
}
