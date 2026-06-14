/**
 * Costeo de importación (Argentina). Calcula los gravámenes aduaneros de cada
 * ítem del embarque y el costo total.
 *
 * Decisiones del dueño (2026-06-12):
 *   - Todo el cálculo se hace en la **moneda de la importación** (USD por defecto),
 *     no en ARS. El tipo de cambio se usa solo para convertir a ARS al final y
 *     para incorporar gastos cargados en ARS.
 *   - Base imponible (valor en aduana) = CIF = FOB (precio×cantidad)
 *     + **flete declarado** + **seguro declarado** (los de la guía, NO los pagos
 *     locales). El flete/seguro pagados localmente van como gastos reales y NO
 *     integran la base imponible.
 *   - Sobre la base imponible (CIF + derechos + estadística) se calculan IVA,
 *     IVA adicional, ganancias e IIBB.
 *
 * Las alícuotas (%) salen del `tratamientoArancelario` del artículo. Defaults si
 * el artículo no las tiene: IVA 21, estadística 3, resto 0.
 *
 * Función pura, testeable sin Firestore.
 */
import type { ItemImportacion, GastoImportacion, Articulo } from '@ags/shared';

export interface LineaCosteoItem {
  itemId: string;
  descripcion: string;
  fob: number;
  cif: number;
  derechos: number;
  estadistica: number;
  iva: number;
  ivaAdicional: number;
  ganancias: number;
  iibb: number;
  gravamenes: number;
}

export interface CosteoImportacion {
  moneda: string;             // moneda base del cálculo (USD/EUR)
  tipoCambio: number | null;  // ARS por unidad de la moneda base
  fobTotal: number;
  fleteDeclarado: number;
  seguroDeclarado: number;
  cifTotal: number;
  derechos: number;
  estadistica: number;
  iva: number;
  ivaAdicional: number;
  ganancias: number;
  iibb: number;
  totalGravamenes: number;
  gastosReales: number;       // gastos cargados (flete/seguro locales, agente, despachante, etc.)
  costoTotal: number;         // CIF + gravámenes + gastos reales (en moneda base)
  costoTotalARS: number | null;
  lineas: LineaCosteoItem[];
}

const DEFAULTS = { derechoImportacion: 0, estadistica: 3, iva: 21, ivaAdicional: 0, ganancias: 0, ingresosBrutos: 0 };
const pct = (v: number | null | undefined, def: number): number => (v ?? def) / 100;

/** Convierte el monto de un gasto a la moneda base. ARS → ÷TC; misma moneda → directo. */
const gastoEnBase = (g: GastoImportacion, monedaBase: string, tc: number | null): number => {
  const monto = g.monto || 0;
  if (g.moneda === monedaBase) return monto;
  if (g.moneda === 'ARS') return tc && tc > 0 ? monto / tc : 0;
  return monto; // otra moneda extranjera: se asume equivalente (caso raro)
};

export function computeCosteoImportacion(input: {
  items: ItemImportacion[];
  articulosById: Map<string, Articulo>;
  gastos: GastoImportacion[];
  monedaBase: string;
  fleteDeclarado: number;
  seguroDeclarado: number;
  tipoCambio: number | null | undefined;
}): CosteoImportacion {
  const monedaBase = input.monedaBase || 'USD';
  const tc = input.tipoCambio && input.tipoCambio > 0 ? input.tipoCambio : null;
  const fleteDeclarado = input.fleteDeclarado || 0;
  const seguroDeclarado = input.seguroDeclarado || 0;
  const adicionalCif = fleteDeclarado + seguroDeclarado;

  // 1) FOB por ítem (en moneda base).
  const fobByItem = input.items.map(it => ({
    item: it,
    fob: (it.precioUnitario || 0) * (it.cantidadPedida || 0),
  }));
  const fobTotal = fobByItem.reduce((s, x) => s + x.fob, 0);

  // 2) Línea de costeo por ítem (CIF prorrateando flete+seguro declarados + gravámenes).
  const lineas: LineaCosteoItem[] = fobByItem.map(({ item, fob }) => {
    const peso = fobTotal > 0 ? fob / fobTotal : 0;
    const cif = fob + peso * adicionalCif;
    const trat = (item.articuloId ? input.articulosById.get(item.articuloId)?.tratamientoArancelario : null) ?? null;

    const derechos = cif * pct(trat?.derechoImportacion, DEFAULTS.derechoImportacion);
    const estadistica = cif * pct(trat?.estadistica, DEFAULTS.estadistica);
    const baseImponible = cif + derechos + estadistica;
    const iva = baseImponible * pct(trat?.iva, DEFAULTS.iva);
    const ivaAdicional = baseImponible * pct(trat?.ivaAdicional, DEFAULTS.ivaAdicional);
    const ganancias = baseImponible * pct(trat?.ganancias, DEFAULTS.ganancias);
    const iibb = baseImponible * pct(trat?.ingresosBrutos, DEFAULTS.ingresosBrutos);
    const gravamenes = derechos + estadistica + iva + ivaAdicional + ganancias + iibb;

    return { itemId: item.id, descripcion: item.descripcion, fob, cif, derechos, estadistica, iva, ivaAdicional, ganancias, iibb, gravamenes };
  });

  const sum = (sel: (l: LineaCosteoItem) => number) => lineas.reduce((s, l) => s + sel(l), 0);
  const derechos = sum(l => l.derechos);
  const estadistica = sum(l => l.estadistica);
  const iva = sum(l => l.iva);
  const ivaAdicional = sum(l => l.ivaAdicional);
  const ganancias = sum(l => l.ganancias);
  const iibb = sum(l => l.iibb);
  const totalGravamenes = derechos + estadistica + iva + ivaAdicional + ganancias + iibb;

  const gastosReales = input.gastos.reduce((s, g) => s + gastoEnBase(g, monedaBase, tc), 0);
  const cifTotal = fobTotal + adicionalCif;
  const costoTotal = cifTotal + totalGravamenes + gastosReales;
  const costoTotalARS = tc ? costoTotal * tc : null;

  return {
    moneda: monedaBase, tipoCambio: tc, fobTotal, fleteDeclarado, seguroDeclarado, cifTotal,
    derechos, estadistica, iva, ivaAdicional, ganancias, iibb,
    totalGravamenes, gastosReales, costoTotal, costoTotalARS, lineas,
  };
}
