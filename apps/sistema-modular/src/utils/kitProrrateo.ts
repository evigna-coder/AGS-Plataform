import type { KitComponente, UnidadStock } from '@ags/shared';

/**
 * Prorrateo de costo y herencia de factor al explotar un kit (2026-09-10).
 *
 * Hasta hoy los componentes nacían con costo nulo y sin factor: el kit salía
 * consumido con su valor y entraba stock que valía cero (inventario
 * subvaluado, presupuesto sin referencia, costeo definitivo que no los
 * alcanzaba). Regla acordada:
 *  - El FACTOR se hereda: es una propiedad del embarque (costo computable /
 *    FOB) y el componente vino en ese embarque adentro del kit.
 *  - El VALOR se reparte por participación (`participacionPct`, suma 100):
 *    costo del componente = costo del kit × pct ÷ cantidad por kit. La suma de
 *    los componentes es siempre lo que costó el kit, se reparta como se reparta.
 */

export type ModoRelleno = 'iguales' | 'por_cantidad' | 'por_costo';

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Reparte 100 entre los componentes según el modo; los pesos en 0 no reciben nada. */
export function rellenarParticipacion(
  bom: KitComponente[],
  modo: ModoRelleno,
  ultimoCostoPorArticulo: Map<string, number> = new Map(),
): KitComponente[] {
  const pesos = bom.map(c => {
    if (modo === 'iguales') return 1;
    if (modo === 'por_cantidad') return Math.max(0, c.cantidadPorKit ?? 0);
    const costo = ultimoCostoPorArticulo.get(c.articuloId) ?? 0;
    return Math.max(0, costo) * Math.max(0, c.cantidadPorKit ?? 0);
  });
  const total = pesos.reduce((s, p) => s + p, 0);
  if (total <= 0) return bom.map(c => ({ ...c, participacionPct: null }));
  const pcts = pesos.map(p => redondear((p / total) * 100));
  // El redondeo puede dejar 99,99 o 100,01: la diferencia va al mayor.
  const diff = redondear(100 - pcts.reduce((s, p) => s + p, 0));
  if (diff !== 0) {
    const i = pcts.indexOf(Math.max(...pcts));
    pcts[i] = redondear(pcts[i] + diff);
  }
  return bom.map((c, i) => ({ ...c, participacionPct: pcts[i] }));
}

/**
 * ¿La participación está completa y suma 100? Sin ninguna cargada se acepta
 * (la explosión reparte por cantidad); con algunas sí y otras no, o con una
 * suma distinta de 100, se rechaza para no repartir mal.
 */
export function validarParticipacion(bom: KitComponente[]): { ok: boolean; suma: number; motivo?: string } {
  const con = bom.filter(c => c.participacionPct != null);
  if (con.length === 0) return { ok: true, suma: 0 };
  if (con.length !== bom.length) return { ok: false, suma: 0, motivo: 'Faltan porcentajes de participación en algunos componentes.' };
  const suma = redondear(con.reduce((s, c) => s + (c.participacionPct ?? 0), 0));
  if (Math.abs(suma - 100) > 0.05) return { ok: false, suma, motivo: `La participación suma ${suma}% y tiene que sumar 100%.` };
  return { ok: true, suma };
}

/** Participación efectiva: la cargada, o por cantidad si no hay ninguna. */
export function participacionEfectiva(bom: KitComponente[]): KitComponente[] {
  return bom.some(c => c.participacionPct != null) ? bom : rellenarParticipacion(bom, 'por_cantidad');
}

/** Costo por unidad de un componente a partir del costo del kit. */
export function costoComponente(costoKit: number | null | undefined, participacionPct: number | null | undefined, cantidadPorKit: number): number | null {
  if (costoKit == null || participacionPct == null || !(cantidadPorKit > 0)) return null;
  return redondear((costoKit * participacionPct / 100) / cantidadPorKit);
}

export interface CosteoKitConsumido {
  costoUnitario: number | null;
  costoUnitarioReal: number | null;
  factorImportacion: number | null;
  factorImportacionReal: number | null;
  monedaCosto: 'ARS' | 'USD' | null;
  costeoConfirmadoAt: string | null;
  importacionNumero: string | null;
}

/**
 * Costo y factor del kit que se consume, ponderados por la cantidad que sale
 * de cada unidad (los kits pueden venir de dos ingresos con distinto costeo).
 * `consumos` = [unidad, cantidad tomada de esa unidad].
 */
export function costeoKitConsumido(consumos: Array<[Pick<UnidadStock, 'costoUnitario' | 'costoUnitarioReal' | 'factorImportacion' | 'factorImportacionReal' | 'monedaCosto' | 'costeoConfirmadoAt' | 'importacionNumero'>, number]>): CosteoKitConsumido {
  const pond = (get: (u: (typeof consumos)[number][0]) => number | null | undefined): number | null => {
    let suma = 0, qty = 0;
    for (const [u, n] of consumos) {
      const v = get(u);
      if (v == null || !(n > 0)) continue;
      suma += v * n; qty += n;
    }
    return qty > 0 ? redondear(suma / qty * 10000) / 10000 : null;
  };
  const monedas = new Map<string, number>();
  for (const [u, n] of consumos) if (u.costoUnitario != null) monedas.set(u.monedaCosto ?? 'USD', (monedas.get(u.monedaCosto ?? 'USD') ?? 0) + n);
  const moneda = ([...monedas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as 'ARS' | 'USD' | null;
  const impos = new Set(consumos.map(([u]) => u.importacionNumero).filter(Boolean));
  const confirmados = consumos.map(([u]) => u.costeoConfirmadoAt).filter(Boolean) as string[];
  return {
    costoUnitario: pond(u => u.costoUnitario),
    costoUnitarioReal: pond(u => u.costoUnitarioReal),
    factorImportacion: pond(u => u.factorImportacion),
    factorImportacionReal: pond(u => u.factorImportacionReal),
    monedaCosto: moneda,
    costeoConfirmadoAt: confirmados.length === consumos.length && confirmados.length > 0 ? confirmados.sort().at(-1)! : null,
    importacionNumero: impos.size === 1 ? [...impos][0] as string : null,
  };
}
