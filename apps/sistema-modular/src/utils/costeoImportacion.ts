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
  esCourier: boolean;         // régimen courier: sin percepciones (IVA adic./ganancias/IIBB)
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
  /** Arancel SIM: monto fijo por despacho, no proporcional al valor. */
  arancelSim: number;
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

/**
 * Arancel SIM: cargo FIJO por despacho oficializado, en dólares (2026-09-01).
 * No es proporcional al valor ni integra la base imponible — se suma al final.
 * Verificado en los despachos 26001IC04780007 y 26001IC04780509: USD 10 en los
 * dos, con FOB de 12.000 y 6.800 euros respectivamente.
 */
export const ARANCEL_SIM_USD = 10;

export function computeCosteoImportacion(input: {
  items: ItemImportacion[];
  articulosById: Map<string, Articulo>;
  gastos: GastoImportacion[];
  monedaBase: string;
  fleteDeclarado: number;
  seguroDeclarado: number;
  /**
   * Moneda del flete/seguro declarados (2026-09-01). Antes se asumían en la
   * moneda del EMBARQUE, pero vienen por separado en la guía: en los despachos
   * de DHL el flete está en dólares y la mercadería en euros, así que 60 USD se
   * convertían como 60 EUR. Sin dato, se mantiene el supuesto anterior.
   */
  monedaFlete?: string | null;
  monedaSeguro?: string | null;
  tipoCambio: number | null | undefined;
  paseEurUsd?: number | null;
  /** Régimen courier (puerta a puerta): sin percepciones. Ver `esCourier` abajo. */
  esCourier?: boolean | null;
}): CosteoImportacion {
  // Régimen COURIER (regla del dueño 2026-08-06/07): SOLO tributa los derechos
  // de la posición arancelaria y el IVA. NO paga tasa de estadística, IVA
  // adicional, percepción de ganancias ni ingresos brutos — sin importar lo que
  // diga el tratamiento arancelario del artículo.
  const esCourier = input.esCourier === true;
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

  // Flete/seguro declarados: cada uno en SU moneda (default, la del embarque).
  const fleteDeclarado = toUsd(input.fleteDeclarado || 0, input.monedaFlete || monedaEmbarque);
  const seguroDeclarado = toUsd(input.seguroDeclarado || 0, input.monedaSeguro || monedaEmbarque);
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
    // Courier: tampoco paga tasa de estadística (confirmado 2026-08-07).
    const estadistica = esCourier ? 0 : cif * pct(trat?.estadistica, DEFAULTS.estadistica);
    const baseImponible = cif + derechos + estadistica;
    const iva = baseImponible * pct(trat?.iva, DEFAULTS.iva);
    // Percepciones: no aplican en courier.
    const ivaAdicional = esCourier ? 0 : baseImponible * pct(trat?.ivaAdicional, DEFAULTS.ivaAdicional);
    const ganancias = esCourier ? 0 : baseImponible * pct(trat?.ganancias, DEFAULTS.ganancias);
    const iibb = esCourier ? 0 : baseImponible * pct(trat?.ingresosBrutos, DEFAULTS.ingresosBrutos);
    const gravamenes = derechos + estadistica + iva + ivaAdicional + ganancias + iibb;

    // Costo computable (para stock): no recuperables + IIBB + 3% financiero sobre lo recuperable.
    const costoFinanciero = (iva + ivaAdicional + ganancias) * finPct;
    const gastosRealesItem = peso * gastosReales;
    // El arancel SIM es fijo del despacho: se prorratea por valor, como los
    // gastos, para que el factor de cada artículo lo absorba.
    const arancelSimItem = peso * ARANCEL_SIM_USD;
    const costoComputable = cif + derechos + estadistica + iibb + gastosRealesItem + arancelSimItem + costoFinanciero;
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
  // El arancel SIM es fijo por despacho: se suma a los gravámenes (es parte de
  // lo que se paga a la aduana) pero NO integra ninguna base imponible.
  const arancelSim = ARANCEL_SIM_USD;
  const totalGravamenes = derechos + estadistica + iva + ivaAdicional + ganancias + iibb + arancelSim;

  const cifTotal = fobTotal + adicionalCif;
  const costoTotal = cifTotal + totalGravamenes + gastosReales;
  const costoTotalARS = tc ? costoTotal * tc : null;

  const costoFinanciero = (iva + ivaAdicional + ganancias) * finPct;
  const costoComputable = sum(l => l.costoComputable);
  const factorEmbarque = fobTotal > 0 ? costoComputable / fobTotal : 0;

  return {
    esCourier,
    moneda: 'USD', monedaEmbarque, paseEurUsd: pase, tipoCambio: tc,
    fobTotal, fleteDeclarado, seguroDeclarado, cifTotal,
    derechos, estadistica, iva, ivaAdicional, ganancias, iibb, arancelSim,
    totalGravamenes, gastosReales, costoTotal, costoTotalARS,
    costoFinanciero, costoComputable, factorEmbarque, lineas,
  };
}
