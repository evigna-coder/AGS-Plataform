/**
 * Costeo de importación (Argentina). Calcula los gravámenes aduaneros de cada
 * ítem del embarque y el costo total.
 *
 * Decisiones del dueño (2026-06-12 / 2026-06-15):
 *   - Todo el cálculo se hace y se guarda en **USD** (moneda canónica del costo).
 *     `tipoCambio` = ARS por USD (mayorista BNA), se usa sólo para el equivalente en ARS
 *     y para convertir gastos cargados en ARS.
 *   - Embarques en EUR: se normaliza FOB/flete/seguro/gastos a USD con `paseEurUsd`
 *     (USD por EUR, lo da el banco/despachante). Sin pase se degrada a 1:1 (warn visual en UI).
 *   - Base imponible (valor en aduana) = CIF = FOB (precio×cantidad)
 *     + **flete declarado** + **seguro declarado** (los de la guía, NO los pagos
 *     locales). El flete/seguro pagados localmente van como gastos reales y NO
 *     integran la base imponible.
 *   - Sobre la base imponible (CIF + derechos + estadística) se calculan IVA,
 *     IVA adicional, ganancias e IIBB.
 *
 * Factor de importación (decisión del dueño 2026-06-14):
 *   `factor = costo computable del artículo / FOB`, `costo en stock = FOB × factor`.
 *   El costo computable incluye lo NO recuperable y excluye los créditos fiscales:
 *     ✅ FOB + flete/seguro declarados (CIF) + derechos + estadística
 *        + gastos reales (despachante, agente, bancarios, flete/seguro local) prorrateados
 *        + IIBB (difícil de recuperar → costo completo)
 *        + costo financiero = 3% sobre (IVA + IVA adicional + Ganancias)
 *     ❌ IVA, IVA adicional, Ganancias NO son costo (son crédito/anticipo recuperable);
 *        solo su 3% entra como costo financiero (configurable, ver COSTO_FINANCIERO_PCT).
 *   El factor difiere por artículo porque los derechos varían según la posición arancelaria.
 *
 * Las alícuotas (%) salen del `tratamientoArancelario` del artículo. Defaults si
 * el artículo no las tiene: IVA 21, estadística 3, resto 0.
 *
 * Función pura, testeable sin Firestore.
 */
import type { ItemImportacion, GastoImportacion, Articulo } from '@ags/shared';

/** % de costo financiero aplicado sobre (IVA + IVA adic. + Ganancias) recuperables. */
export const COSTO_FINANCIERO_PCT = 3;

export interface LineaCosteoItem {
  itemId: string;
  descripcion: string;
  articuloCodigo: string | null;
  posicionArancelaria: string | null;
  derechoPct: number;       // % de derecho aplicado (para verificar la posición)
  estadisticaPct: number;
  ivaPct: number;
  sinTratamiento: boolean;  // true si el artículo no tiene tratamiento arancelario (usa defaults)
  fob: number;
  cif: number;
  derechos: number;
  estadistica: number;
  iva: number;
  ivaAdicional: number;
  ganancias: number;
  iibb: number;
  gravamenes: number;
  costoComputable: number;  // costo real para stock (sin IVA/percep. recuperables)
  factor: number;           // costoComputable / FOB
}

export interface CosteoImportacion {
  moneda: string;             // moneda del costo: siempre 'USD' (canónica)
  monedaEmbarque: string;     // moneda original del embarque (USD/EUR) — para mostrar el origen
  paseEurUsd: number | null;  // pase USD/EUR aplicado (solo si monedaEmbarque==='EUR')
  tipoCambio: number | null;  // ARS por USD (mayorista)
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
  costoTotal: number;         // erogación total (CIF + gravámenes + gastos reales) — lo que se paga
  costoTotalARS: number | null;
  // Factor de importación
  costoFinanciero: number;    // 3% de (IVA + IVA adic. + Ganancias)
  costoComputable: number;    // costo real para stock (no recuperable + IIBB + financiero)
  factorEmbarque: number;     // costoComputable / FOB total
  lineas: LineaCosteoItem[];
}

const DEFAULTS = { derechoImportacion: 0, estadistica: 3, iva: 21, ivaAdicional: 0, ganancias: 0, ingresosBrutos: 0 };
const pct = (v: number | null | undefined, def: number): number => (v ?? def) / 100;

export function computeCosteoImportacion(input: {
  items: ItemImportacion[];
  articulosById: Map<string, Articulo>;
  gastos: GastoImportacion[];
  monedaBase: string;
  fleteDeclarado: number;
  seguroDeclarado: number;
  tipoCambio: number | null | undefined;
  paseEurUsd?: number | null;
}): CosteoImportacion {
  const monedaEmbarque = input.monedaBase || 'USD';
  const tc = input.tipoCambio && input.tipoCambio > 0 ? input.tipoCambio : null; // ARS/USD
  const pase = input.paseEurUsd && input.paseEurUsd > 0 ? input.paseEurUsd : null; // USD/EUR

  /** Normaliza cualquier monto a USD. EUR → ×pase (1:1 si falta); ARS → ÷TC; USD → directo. */
  const toUsd = (monto: number, moneda: string): number => {
    if (!monto) return 0;
    if (moneda === 'USD') return monto;
    if (moneda === 'EUR') return pase ? monto * pase : monto;
    if (moneda === 'ARS') return tc && tc > 0 ? monto / tc : 0;
    return monto;
  };

  // Flete/seguro declarados están en la moneda del embarque → a USD.
  const fleteDeclarado = toUsd(input.fleteDeclarado || 0, monedaEmbarque);
  const seguroDeclarado = toUsd(input.seguroDeclarado || 0, monedaEmbarque);
  const adicionalCif = fleteDeclarado + seguroDeclarado;

  // 1) FOB por ítem (precio×cantidad en moneda del embarque → USD).
  const fobByItem = input.items.map(it => ({
    item: it,
    fob: toUsd((it.precioUnitario || 0) * (it.cantidadPedida || 0), it.moneda || monedaEmbarque),
  }));
  const fobTotal = fobByItem.reduce((s, x) => s + x.fob, 0);

  // Gastos reales (todos los cargados) en USD — se prorratean por valor.
  const gastosReales = input.gastos.reduce((s, g) => s + toUsd(g.monto || 0, g.moneda), 0);
  const finPct = COSTO_FINANCIERO_PCT / 100;

  // 2) Línea de costeo por ítem: CIF + gravámenes + costo computable + factor.
  const lineas: LineaCosteoItem[] = fobByItem.map(({ item, fob }) => {
    const peso = fobTotal > 0 ? fob / fobTotal : 0;
    const cif = fob + peso * adicionalCif;
    const art = item.articuloId ? input.articulosById.get(item.articuloId) : null;
    const trat = art?.tratamientoArancelario ?? null;

    const derechos = cif * pct(trat?.derechoImportacion, DEFAULTS.derechoImportacion);
    const estadistica = cif * pct(trat?.estadistica, DEFAULTS.estadistica);
    const baseImponible = cif + derechos + estadistica;
    const iva = baseImponible * pct(trat?.iva, DEFAULTS.iva);
    const ivaAdicional = baseImponible * pct(trat?.ivaAdicional, DEFAULTS.ivaAdicional);
    const ganancias = baseImponible * pct(trat?.ganancias, DEFAULTS.ganancias);
    const iibb = baseImponible * pct(trat?.ingresosBrutos, DEFAULTS.ingresosBrutos);
    const gravamenes = derechos + estadistica + iva + ivaAdicional + ganancias + iibb;

    // Costo computable (para stock): no recuperables + IIBB + 3% financiero sobre lo recuperable.
    const costoFinanciero = (iva + ivaAdicional + ganancias) * finPct;
    const gastosRealesItem = peso * gastosReales;
    const costoComputable = cif + derechos + estadistica + iibb + gastosRealesItem + costoFinanciero;
    const factor = fob > 0 ? costoComputable / fob : 0;

    return {
      itemId: item.id, descripcion: item.descripcion,
      articuloCodigo: item.articuloCodigo ?? null,
      posicionArancelaria: art?.posicionArancelaria ?? null,
      derechoPct: trat?.derechoImportacion ?? DEFAULTS.derechoImportacion,
      estadisticaPct: trat?.estadistica ?? DEFAULTS.estadistica,
      ivaPct: trat?.iva ?? DEFAULTS.iva,
      sinTratamiento: !trat,
      fob, cif, derechos, estadistica, iva, ivaAdicional, ganancias, iibb, gravamenes,
      costoComputable, factor,
    };
  });

  const sum = (sel: (l: LineaCosteoItem) => number) => lineas.reduce((s, l) => s + sel(l), 0);
  const derechos = sum(l => l.derechos);
  const estadistica = sum(l => l.estadistica);
  const iva = sum(l => l.iva);
  const ivaAdicional = sum(l => l.ivaAdicional);
  const ganancias = sum(l => l.ganancias);
  const iibb = sum(l => l.iibb);
  const totalGravamenes = derechos + estadistica + iva + ivaAdicional + ganancias + iibb;

  const cifTotal = fobTotal + adicionalCif;
  const costoTotal = cifTotal + totalGravamenes + gastosReales;
  const costoTotalARS = tc ? costoTotal * tc : null;

  const costoFinanciero = (iva + ivaAdicional + ganancias) * finPct;
  const costoComputable = sum(l => l.costoComputable);
  const factorEmbarque = fobTotal > 0 ? costoComputable / fobTotal : 0;

  return {
    moneda: 'USD', monedaEmbarque, paseEurUsd: pase, tipoCambio: tc,
    fobTotal, fleteDeclarado, seguroDeclarado, cifTotal,
    derechos, estadistica, iva, ivaAdicional, ganancias, iibb,
    totalGravamenes, gastosReales, costoTotal, costoTotalARS,
    costoFinanciero, costoComputable, factorEmbarque, lineas,
  };
}
