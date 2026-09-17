import { presupuestosService, facturacionService } from '../services/firebaseService';
import { feriadosService } from '../services/agendaService';
import type { SolicitudFacturacion } from '@ags/shared';
import { cuotasContratoPorFacturar, esContratoConCuotas, esDesdePrimerDiaHabil, finDeMes, hoyLocalISO } from './cuotasContrato';

/**
 * Aviso a facturación AUTOMÁTICO de las cuotas mensuales de contrato
 * (2026-09-16). No hay nada corriendo en el servidor: lo hace la primera PC
 * con permiso de facturación que abre la app el primer día hábil del mes o
 * después, para las cuotas del mes en curso (y anteriores sin aviso). En un
 * contrato mixto sale un aviso por moneda. Idempotente: una cuota con
 * solicitud viva (`cuotaNumero` + `cuotaMoneda`) no se vuelve a generar; la
 * pantalla "Cuotas por facturar" muestra lo mismo y sirve para forzar a mano.
 * Best-effort por cuota: un contrato sin OC adjunta falla su aviso y sigue
 * con el resto (queda visible en la pantalla).
 */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastSweep = 0;

export async function sweepCuotasContrato(
  actor: { uid: string; name?: string },
  opts?: { force?: boolean },
): Promise<{ creados: number; errores: string[] }> {
  const now = Date.now();
  if (!opts?.force && now - lastSweep < SWEEP_INTERVAL_MS) return { creados: 0, errores: [] };
  lastSweep = now;

  const hoy = hoyLocalISO();
  const feriados = await feriadosService.getAllFechas().catch(() => new Set<string>());
  if (!esDesdePrimerDiaHabil(hoy, feriados)) return { creados: 0, errores: [] };

  const pptos = (await presupuestosService.getAll()).filter(esContratoConCuotas);
  if (pptos.length === 0) return { creados: 0, errores: [] };
  const solicitudesPorPpto = new Map<string, SolicitudFacturacion[]>();
  await Promise.all(pptos.map(async p => {
    solicitudesPorPpto.set(p.id, await facturacionService.getByPresupuesto(p.id).catch(() => []));
  }));

  const pendientes = cuotasContratoPorFacturar(pptos, solicitudesPorPpto, finDeMes(hoy));
  let creados = 0;
  const errores: string[] = [];
  for (const r of pendientes) {
    try {
      await presupuestosService.generarAvisoFacturacion(r.ppto.id, [], {
        monto: r.cuota.monto,
        montoPorMoneda: { [r.cuota.moneda]: r.cuota.monto },
        cuotaNumero: r.cuota.numero,
        cuotaMoneda: r.cuota.moneda,
        observaciones: `${r.cuota.descripcion || `Cuota ${r.cuota.numero}`} (${r.cuota.moneda}) — contrato ${r.ppto.numero}. Aviso automático del primer día hábil (${hoy}).`,
      }, actor);
      creados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errores.push(`${r.ppto.numero} cuota ${r.cuota.numero} ${r.cuota.moneda}: ${msg}`);
      console.warn('[sweepCuotasContrato]', r.ppto.numero, r.cuota.numero, r.cuota.moneda, msg);
    }
  }
  if (creados > 0) console.log(`[sweepCuotasContrato] ${creados} aviso(s) de cuota generado(s)`);
  return { creados, errores };
}
