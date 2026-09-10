import type { EstadoImportacion, Importacion } from '@ags/shared';
import { proximaConfirmacion } from '../../components/stock/ImportacionAccionCell';

/** Constantes y predicados puros del listado de importaciones (extraídos 2026-09-10). */

export const ESTADOS: EstadoImportacion[] = [
  'preparacion', 'en_origen', 'embarcado', 'en_transito', 'en_aduana', 'despachado', 'recibido', 'cancelado',
];

export const FILTER_SCHEMA = {
  estado: { type: 'string' as const, default: '' },
  /** Mostrar tambien las que ya no tienen nada pendiente (2026-09-10). */
  verFinalizadas: { type: 'boolean' as const, default: false },
  sortField: { type: 'string' as const, default: 'fechaEstimadaArribo' },
  sortDir: { type: 'string' as const, default: 'desc' },
};

/**
 * Finalizada (2026-09-10): mercadería recibida (o impo cancelada) y sin
 * confirmaciones pendientes — el giro ya se pagó. No hay nada más que hacer
 * con ella, así que sale del listado por defecto. Una recibida con el giro sin
 * confirmar, o una oficializada sin ingresar a stock, sigue a la vista.
 */
export const isFinalizada = (imp: Importacion): boolean =>
  (imp.estado === 'recibido' || imp.estado === 'cancelado') && proximaConfirmacion(imp) === null;

export const isEtaVencida = (imp: Importacion): boolean => {
  if (!imp.fechaEstimadaArribo) return false;
  if (imp.estado === 'recibido' || imp.estado === 'cancelado') return false;
  return new Date(imp.fechaEstimadaArribo) < new Date();
};

export const thClass = 'text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4';
