import type { Lead, TicketArea } from '@ags/shared';

/**
 * Tickets OPERATIVOS: avisos de reserva física y compras/importación que
 * linkean el mismo presupuesto pero NO son la oportunidad comercial (sin este
 * filtro, los gates comerciales agarraban el aviso de materiales — UAT
 * 2026-07-16). Hasta 2026-08-05 se identificaban por ÁREA ('materiales' /
 * 'compras'); con la regla de áreas nueva viven en 'admin_soporte', así que el
 * criterio pasa a ser área legacy O acción operativa conocida.
 */
const AREAS_OPERATIVAS_LEGACY: TicketArea[] = ['materiales', 'compras'];
const ACCIONES_OPERATIVAS = [
  'Reservar stock físicamente',
  'Comprar/importar los materiales del presupuesto aceptado',
];

export function esTicketOperativo(t: Pick<Lead, 'areaActual' | 'accionPendiente'>): boolean {
  if (AREAS_OPERATIVAS_LEGACY.includes(t.areaActual as TicketArea)) return true;
  return ACCIONES_OPERATIVAS.includes(t.accionPendiente ?? '');
}
