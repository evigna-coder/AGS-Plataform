import type { UnidadStock } from '@ags/shared';
import { otPortadoraDeReserva, resumenReservasStock } from '@ags/shared';
import { presupuestosService } from '../services/presupuestosService';
import { reservasService } from '../services/stockService';
import { ordenesTrabajoService } from '../services/otService';

/**
 * Texto de "reservado en stock" para una OT (2026-09-09), a partir de las
 * unidades reservadas para los presupuestos que la OT declara en `budgets`.
 *
 * Regla de UNA sola nota por presupuesto: si el presupuesto tiene varias OTs
 * (una por módulo o por visita), la reserva se anota solo en la OT portadora
 * —la de número más bajo entre las hijas— y las demás quedan sin nota. Sin
 * esto, tres OTs del mismo presupuesto mostraban tres veces la misma reserva.
 *
 * Devuelve null si no hay reservas o si esta OT no es la portadora.
 */
export async function textoReservaParaOT(otNumber: string, budgets: string[] | null | undefined): Promise<string | null> {
  const numeros = (budgets ?? []).filter(Boolean);
  if (numeros.length === 0) return null;
  const partes: string[] = [];
  for (const numero of numeros) {
    const ppto = await presupuestosService.getByNumero(numero).catch(() => null);
    if (!ppto) continue;
    const unidades: UnidadStock[] = await reservasService.getByPresupuesto(ppto.id).catch(() => []);
    if (unidades.length === 0) continue;
    const hermanas = await ordenesTrabajoService.queryByBudget(numero).catch(() => []);
    const portadora = otPortadoraDeReserva([otNumber, ...hermanas.map(o => o.otNumber)]);
    if (portadora !== otNumber) continue;
    partes.push(`${resumenReservasStock(unidades)} (ppto ${numero})`);
  }
  return partes.length > 0 ? partes.join(' · ') : null;
}
