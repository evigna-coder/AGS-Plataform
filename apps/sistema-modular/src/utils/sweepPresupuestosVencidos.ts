import { presupuestosService } from '../services/presupuestosService';
import { getDaysUntilExpiry, validezAplica } from './presupuestoHelpers';
import type { Presupuesto } from '@ags/shared';

// Guard de sesión: como máximo una corrida cada N minutos por pestaña (mismo
// patrón que sweepStockMinimoRequerimientos). Dos PCs a la vez pueden pisarse,
// pero anular es idempotente — el segundo update no cambia nada.
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;
let lastSweep = 0;

/**
 * Días de gracia después del vencimiento antes de anular. Evita anular algo que
 * vence hoy y el vendedor está por renovar en el momento.
 */
const DIAS_GRACIA = 1;

/**
 * True si el presupuesto está vencido y todavía en la etapa de OFERTA
 * (`ESTADOS_VALIDEZ_APLICA`), es decir antes de que el cliente lo acepte.
 * Los aceptados en adelante nunca vencen.
 */
export function debeAutoAnularse(p: Presupuesto, gracia = DIAS_GRACIA): boolean {
  if (!validezAplica(p)) return false;
  // Un borrador que nunca se envió no tiene oferta vigente que vencer, salvo
  // que alguien le haya puesto una fecha de validez explícita.
  if (p.estado === 'borrador' && !p.validUntil) return false;
  const dias = getDaysUntilExpiry(p.validUntil, p.fechaEnvio, p.validezDias);
  return dias !== null && dias < -gracia;
}

/**
 * Auto-anulación de presupuestos VENCIDOS (2026-08-06, pedido del user).
 *
 * Anula los que pasaron su validez y siguen en etapa de oferta (borrador con
 * fecha explícita, enviado, pendiente de OC). Al pasar por
 * `presupuestosService.update({ estado: 'anulado' })` se disparan solos los
 * side-effects ya existentes: el ticket de origen pasa a `no_concretado`, se
 * cancelan los requerimientos condicionales abiertos y se liberan las reservas
 * de stock.
 *
 * Deja `motivoAnulacion` explícito para que se distinga de una anulación
 * manual y sea reversible (basta cambiarle el estado de vuelta).
 *
 * NO toca aceptado / en ejecución / pendiente de facturación / finalizado.
 */
export async function sweepPresupuestosVencidos(opts?: { force?: boolean }): Promise<{ anulados: number; numeros: string[] }> {
  const now = Date.now();
  if (!opts?.force && now - lastSweep < SWEEP_INTERVAL_MS) return { anulados: 0, numeros: [] };
  lastSweep = now;

  const todos = await presupuestosService.getAll();
  const vencidos = todos.filter(p => debeAutoAnularse(p));
  const numeros: string[] = [];

  for (const p of vencidos) {
    const dias = getDaysUntilExpiry(p.validUntil, p.fechaEnvio, p.validezDias) ?? 0;
    try {
      await presupuestosService.update(p.id, {
        estado: 'anulado',
        motivoAnulacion: `Vencido automáticamente — la validez expiró hace ${Math.abs(dias)} día(s)`,
      } as Partial<Presupuesto>);
      numeros.push(p.numero);
    } catch (err) {
      console.error(`[sweepPresupuestosVencidos] no se pudo anular ${p.numero}:`, err);
    }
  }

  if (numeros.length > 0) {
    console.log(`[sweepPresupuestosVencidos] ${numeros.length} presupuesto(s) anulado(s) por vencimiento:`, numeros.join(', '));
  }
  return { anulados: numeros.length, numeros };
}
