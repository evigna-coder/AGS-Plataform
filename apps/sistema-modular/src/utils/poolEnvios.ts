import type { GastoEnvio, Presupuesto } from '@ags/shared';
import { PRESUPUESTO_ESTADOS_ACEPTADOS } from '@ags/shared';

/**
 * Pool de envíos (2026-09-23). Lo que se contempla de flete al cotizar entra a
 * una bolsa única en DÓLARES cuando el presupuesto se acepta; cada viaje de
 * entrega se paga en pesos y sale de la bolsa convertido al BNA vendedor del
 * día. Un pool en pesos se licuaría con cada devaluación; en dólares conserva
 * el valor y la conversión queda registrada en cada salida.
 *
 * Puro: sin Firebase, testeable con `test:pool-envios`.
 */
export interface MovimientoPoolEnvios {
  id: string;
  /** yyyy-mm-dd */
  fecha: string;
  tipo: 'entrada' | 'salida';
  montoUSD: number;
  montoARS: number | null;
  tipoCambio: number | null;
  presupuestoNumero: string | null;
  clienteNombre: string | null;
  /** Qué respalda el movimiento: presupuesto aceptado o remitos/OT del viaje. */
  referencia: string;
  notas: string | null;
  /** Saldo del pool después de este movimiento (lo completa `ledgerPoolEnvios`). */
  saldoUSD: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Envío contemplado en dólares. Un presupuesto en pesos se convierte con su
 * propio tipo de cambio; sin tipo de cambio no se puede valuar y queda afuera
 * (`null`). EUR y MIXTA se toman como dólares: el envío es un estimado.
 */
export function envioContempladoUSD(p: Pick<Presupuesto, 'envioContemplado' | 'moneda' | 'tipoCambio'>): number | null {
  const monto = p.envioContemplado ?? 0;
  if (!(monto > 0)) return null;
  if (p.moneda === 'ARS') {
    const tc = p.tipoCambio ?? 0;
    return tc > 0 ? redondear(monto / tc) : null;
  }
  return redondear(monto);
}

const diaDe = (v: string | null | undefined): string => (v ?? '').slice(0, 10);

/** Lo que el pool necesita de un presupuesto; el nombre del cliente lo agrega el caller. */
export type PresupuestoPool = Pick<Presupuesto, 'id' | 'numero' | 'estado' | 'envioContemplado' | 'moneda' | 'tipoCambio' | 'fechaAceptacion' | 'updatedAt'>
  & { clienteNombre?: string | null };

/** Entradas: presupuestos ACEPTADOS (cualquier etapa posterior incluida) con envío contemplado. */
export function entradasPoolEnvios(pptos: PresupuestoPool[]): MovimientoPoolEnvios[] {
  const out: MovimientoPoolEnvios[] = [];
  for (const p of pptos) {
    if (!PRESUPUESTO_ESTADOS_ACEPTADOS.includes(p.estado)) continue;
    const usd = envioContempladoUSD(p);
    if (usd == null) continue;
    out.push({
      id: `ppto:${p.id}`,
      fecha: diaDe(p.fechaAceptacion) || diaDe(p.updatedAt),
      tipo: 'entrada',
      montoUSD: usd,
      montoARS: p.moneda === 'ARS' ? redondear(p.envioContemplado ?? 0) : null,
      tipoCambio: p.moneda === 'ARS' ? (p.tipoCambio ?? null) : null,
      presupuestoNumero: p.numero,
      clienteNombre: p.clienteNombre ?? null,
      referencia: `Presupuesto ${p.numero}`,
      notas: null,
      saldoUSD: 0,
    });
  }
  return out;
}

/** Salidas: gastos de envío registrados (un viaje, uno o varios remitos). */
export function salidasPoolEnvios(gastos: GastoEnvio[]): MovimientoPoolEnvios[] {
  return gastos.map(g => ({
    id: `gasto:${g.id}`,
    fecha: diaDe(g.fecha),
    tipo: 'salida' as const,
    montoUSD: redondear(g.montoUSD),
    montoARS: redondear(g.montoARS),
    tipoCambio: g.tipoCambio,
    presupuestoNumero: g.presupuestoNumeros?.[0] ?? null,
    clienteNombre: g.clienteNombre ?? null,
    referencia: [
      g.remitoNumeros?.length ? `Remito${g.remitoNumeros.length > 1 ? 's' : ''} ${g.remitoNumeros.join(', ')}` : null,
      g.otNumbers?.length ? `OT ${g.otNumbers.join(', ')}` : null,
      g.presupuestoNumeros?.length ? g.presupuestoNumeros.join(', ') : null,
    ].filter(Boolean).join(' · ') || 'Sin referencia',
    notas: g.notas ?? null,
    saldoUSD: 0,
  }));
}

/** Libro del pool en orden cronológico, con el saldo acumulado en cada línea. */
export function ledgerPoolEnvios(pptos: PresupuestoPool[], gastos: GastoEnvio[]): MovimientoPoolEnvios[] {
  const movs = [...entradasPoolEnvios(pptos), ...salidasPoolEnvios(gastos)]
    // Misma fecha: primero las entradas, así el saldo no queda negativo por orden.
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === b.tipo ? 0 : a.tipo === 'entrada' ? -1 : 1));
  let saldo = 0;
  for (const m of movs) {
    saldo = redondear(saldo + (m.tipo === 'entrada' ? m.montoUSD : -m.montoUSD));
    m.saldoUSD = saldo;
  }
  return movs;
}

export interface ResumenPoolEnvios {
  saldoUSD: number;
  entradasMesUSD: number;
  salidasMesUSD: number;
  salidasMesARS: number;
  cantidadEntradas: number;
  cantidadSalidas: number;
}

/** Saldo actual y movimiento del mes de `hoy` (yyyy-mm-dd). */
export function resumenPoolEnvios(ledger: MovimientoPoolEnvios[], hoy: string): ResumenPoolEnvios {
  const mes = hoy.slice(0, 7);
  const r: ResumenPoolEnvios = { saldoUSD: 0, entradasMesUSD: 0, salidasMesUSD: 0, salidasMesARS: 0, cantidadEntradas: 0, cantidadSalidas: 0 };
  for (const m of ledger) {
    if (m.tipo === 'entrada') r.cantidadEntradas++; else r.cantidadSalidas++;
    if (m.fecha.slice(0, 7) !== mes) continue;
    if (m.tipo === 'entrada') r.entradasMesUSD = redondear(r.entradasMesUSD + m.montoUSD);
    else { r.salidasMesUSD = redondear(r.salidasMesUSD + m.montoUSD); r.salidasMesARS = redondear(r.salidasMesARS + (m.montoARS ?? 0)); }
  }
  r.saldoUSD = ledger.length ? ledger[ledger.length - 1].saldoUSD : 0;
  return r;
}

/** Pesos → dólares al tipo de cambio dado, a dos decimales. */
export function arsAUsd(montoARS: number, tipoCambio: number): number {
  return tipoCambio > 0 ? redondear(montoARS / tipoCambio) : 0;
}
