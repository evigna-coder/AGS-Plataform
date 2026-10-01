/**
 * Costeo de importación contrastado contra un despacho REAL de aduana.
 *
 * Por qué existe: el número que sale de acá es el que se le muestra a la
 * dirección y el que se paga. En septiembre de 2026 se comparó el motor contra
 * el despacho 26001IC04780007 (OC RAI058) y aparecieron tres desvíos —flete
 * convertido con la moneda de la mercadería, arancel SIM ausente y el pase
 * EUR/USD calculado con puntas cruzadas—. Este test fija la estructura del
 * cálculo contra los importes reales para que no vuelva a correrse sin aviso.
 *
 * Correr con: pnpm --filter @ags/sistema-modular test:costeo-importacion
 */
import assert from 'node:assert/strict';
import { computeCosteoImportacion } from '../costeoImportacion';
import type { Articulo, ItemImportacion } from '@ags/shared';

let fallos = 0;
const cerca = (nombre: string, real: number, esperado: number, tol = 0.05) => {
  if (Math.abs(real - esperado) > tol) {
    fallos++;
    console.error(`  ✗ ${nombre}: ${real.toFixed(2)} — esperaba ${esperado.toFixed(2)} (±${tol})`);
  }
};

// ── Despacho 26001IC04780007 · OC RAI058 · oficializado 01/09/2026 ──────────
// FOB EUR 11.960,88 · flete USD 60,00 · seguro EUR 119,61
// Valor en aduana USD 14.110,82 · base imponible USD 15.888,78
const FOB_EUR = 11960.88;
const FOB_USD = 13911.70;   // el que declaró el despacho
// El pase se deriva del propio despacho: es el que aplicó AFIP, no el de mercado.
const PASE = FOB_USD / FOB_EUR;

const articulo = {
  id: 'art-1',
  codigo: 'G1310-68742',
  posicionArancelaria: '9027.90.99.900G',
  tratamientoArancelario: {
    derechoImportacion: 12.6,
    estadistica: 0,        // este despacho NO cobra tasa de estadística
    iva: 21,
    ivaAdicional: 20,
    ganancias: 6,
    ingresosBrutos: 3.4165,
  },
} as unknown as Articulo;

const items = [{
  id: 'it-1',
  articuloId: 'art-1',
  articuloCodigo: 'G1310-68742',
  descripcion: 'Repuestos HPLC',
  cantidadPedida: 42,
  precioUnitario: FOB_EUR / 42,
  moneda: 'EUR',
}] as unknown as ItemImportacion[];

const BASE_ARGS = {
  items,
  articulosById: new Map([['art-1', articulo]]),
  gastos: [],
  monedaBase: 'EUR',
  fleteDeclarado: 60,
  monedaFlete: 'USD',      // el flete viene en dólares aunque la mercadería sea en euros
  seguroDeclarado: 119.61,
  monedaSeguro: 'EUR',
  tipoCambio: 1503,
  paseEurUsd: PASE,
};
const costeo = computeCosteoImportacion(BASE_ARGS);

// ── Valor en aduana ────────────────────────────────────────────────────────
cerca('FOB en dólares', costeo.fobTotal, FOB_USD);
cerca('flete (USD, no se convierte)', costeo.fleteDeclarado, 60);
cerca('seguro (EUR → USD)', costeo.seguroDeclarado, 139.12);
cerca('valor en aduana (CIF)', costeo.cifTotal, 14110.82);

// ── Liquidación, renglón por renglón ───────────────────────────────────────
cerca('derechos de importación', costeo.derechos, 1777.96);
cerca('tasa de estadística', costeo.estadistica, 0);
cerca('IVA', costeo.iva, 3336.64);
cerca('IVA adicional', costeo.ivaAdicional, 3177.76);
cerca('impuesto a las ganancias', costeo.ganancias, 953.33);
cerca('ingresos brutos', costeo.iibb, 542.87, 0.5);
cerca('arancel SIM', costeo.arancelSim, 10);
cerca('TOTAL a pagar', costeo.totalGravamenes, 9798.56, 0.5);

// La base imponible es CIF + derechos + estadística (el despacho imprime 15.888,78).
cerca('base imponible', costeo.lineas[0].cif + costeo.derechos + costeo.estadistica, 15888.78);

// ── El flete NO se convierte con la moneda de la mercadería ────────────────
// Regresión directa del bug: sin `monedaFlete`, 60 dólares entraban como 60
// euros y el CIF se iba 8,58 dólares para arriba.
{
  const conBug = computeCosteoImportacion({
    items,
    articulosById: new Map([['art-1', articulo]]),
    gastos: [],
    monedaBase: 'EUR',
    fleteDeclarado: 60,
    seguroDeclarado: 119.61,
    tipoCambio: 1503,
    paseEurUsd: PASE,
  });
  // Sin declarar la moneda se mantiene el supuesto viejo (la del embarque).
  cerca('sin monedaFlete asume la del embarque', conBug.fleteDeclarado, 60 * PASE);
  assert.ok(
    conBug.cifTotal > costeo.cifTotal,
    'declarar el flete en su moneda real baja el CIF respecto de asumir euros',
  );
}

// ── El arancel SIM entra al costo computable, prorrateado ──────────────────
{
  const suma = costeo.lineas.reduce((a, l) => a + l.costoComputable, 0);
  cerca('costo computable = suma de las líneas', costeo.costoComputable, suma);
  assert.ok(costeo.factorEmbarque > 1, 'el factor de importación siempre supera 1');
}

// ── Courier: factura DHL 0396A00607679 (guía 1259109014, 28/09/2026) ──────
// FOB USD 2.784,00 · flete 4,30 · seguro 27,88 → valor en aduana 2.816,18.
// Derechos 354,84 (12,6 %) · procesamiento 30,62 · IVA 672,34 · percepción
// IIBB 20,24 (Bs.As. 1,75 % + CABA 3,50 %) · total a pagar USD 1.078,04.
// Antes el motor omitía el procesamiento y la percepción y sumaba un arancel
// SIM que el courier no cobra: ~USD 57 de diferencia en cada VEP.
{
  const dhl = computeCosteoImportacion({
    items: [{
      id: 'it-dhl', articuloId: 'art-dhl', articuloCodigo: '05990-65420B', descripcion: 'Repuestos HPLC (courier)',
      cantidadPedida: 1, precioUnitario: 2784, moneda: 'USD',
    }] as unknown as ItemImportacion[],
    articulosById: new Map([['art-dhl', {
      id: 'art-dhl', codigo: '05990-65420B', posicionArancelaria: '9027.90.99.900G',
      tratamientoArancelario: { derechoImportacion: 12.6, estadistica: 3, iva: 21, ivaAdicional: 20, ganancias: 6, ingresosBrutos: 3.4165 },
    } as unknown as Articulo]]),
    gastos: [],
    monedaBase: 'USD',
    fleteDeclarado: 4.30, monedaFlete: 'USD',
    seguroDeclarado: 27.88, monedaSeguro: 'USD',
    tipoCambio: 1525.5,
    esCourier: true,
  });
  cerca('courier: valor en aduana', dhl.cifTotal, 2816.18);
  cerca('courier: derechos', dhl.derechos, 354.84);
  cerca('courier: sin estadística', dhl.estadistica, 0);
  cerca('courier: procesamiento de aranceles (3 % s/ derechos + IVA)', dhl.procesamientoCourier, 30.62);
  cerca('courier: IVA (incl. el del procesamiento)', dhl.iva, 672.34);
  cerca('courier: percepción IIBB (5,25 % s/ derechos + procesamiento)', dhl.iibb, 20.24);
  cerca('courier: sin IVA adicional', dhl.ivaAdicional, 0);
  cerca('courier: sin ganancias', dhl.ganancias, 0);
  cerca('courier: sin arancel SIM', dhl.arancelSim, 0);
  cerca('courier: TOTAL a pagar = factura DHL', dhl.totalGravamenes, 1078.04);
  cerca('courier: erogación total = CIF + factura', dhl.costoTotal, 2816.18 + 1078.04);
  // El procesamiento y la percepción son costo; el IVA no (solo su 3 % financiero).
  cerca('courier: costo computable', dhl.costoComputable, 2816.18 + 354.84 + 30.62 + 20.24 + 672.34 * 0.03);
  cerca('courier: alícuotas por default', dhl.courierProcesamientoPct, 3);
  cerca('courier: alícuotas por default (IIBB)', dhl.courierIibbPct, 5.25);
  const suma = dhl.lineas.reduce((a, l) => a + l.procesamientoCourier + l.iibb, 0);
  cerca('courier: procesamiento + IIBB = suma de las líneas', suma, dhl.procesamientoCourier + dhl.iibb);

  // Las alícuotas se pueden pisar por importación (courier o jurisdicción distinta).
  const pisado = computeCosteoImportacion({
    items, articulosById: new Map([['art-1', articulo]]), gastos: [],
    monedaBase: 'EUR', fleteDeclarado: 60, monedaFlete: 'USD', seguroDeclarado: 119.61, monedaSeguro: 'EUR',
    tipoCambio: 1503, paseEurUsd: PASE, esCourier: true, courierProcesamientoPct: 0, courierIibbPct: 0,
  });
  cerca('courier: alícuotas en cero anulan los cargos', pisado.procesamientoCourier + pisado.iibb, 0);
  cerca('courier: con cargos en cero el IVA es el 21 % de la base', pisado.iva, (pisado.cifTotal + pisado.derechos) * 0.21);
  assert.ok(pisado.derechos > 0 && pisado.iva > 0, 'courier sí tributa derechos e IVA');
}

// ── Según despacho (2026-09-16): el real (USD) reemplaza al estimado, prorrateado ──
// Sobre régimen GENERAL (el despacho base es courier y ahí la estadística no existe).
{
  const general = computeCosteoImportacion({ ...BASE_ARGS, esCourier: false });
  const derechosRealUsd = general.derechos * 1.02;   // aduana liquidó 2 % de más
  // +10 USD absolutos: el fixture tiene estadística 0 % y con un real en cero no hay nada que reemplazar.
  const estadisticaRealUsd = general.estadistica * 0.98 + 10;
  const conReal = computeCosteoImportacion({
    ...BASE_ARGS, esCourier: false, derechosDespacho: derechosRealUsd, estadisticaDespacho: estadisticaRealUsd,
  });
  cerca('despacho: derechos = real', conReal.derechos, derechosRealUsd);
  cerca('despacho: estadística = real', conReal.estadistica, estadisticaRealUsd);
  cerca('despacho: estimado conservado', conReal.derechosEstimados, general.derechos);
  assert.ok(conReal.derechosSegunDespacho && conReal.estadisticaSegunDespacho, 'despacho: marca de real');
  cerca('despacho: la suma de líneas da el real', conReal.lineas.reduce((a, l) => a + l.derechos, 0), derechosRealUsd);
  assert.ok(conReal.factorEmbarque > general.factorEmbarque, 'despacho: más derechos → más factor');
  const vacio = computeCosteoImportacion({ ...BASE_ARGS, esCourier: false, derechosDespacho: 0, estadisticaDespacho: null });
  assert.ok(!vacio.derechosSegunDespacho && vacio.derechos === general.derechos, 'despacho: cero/ausente = estimado');
  // Courier: la estadística según despacho no aplica aunque venga cargada.
  const courierReal = computeCosteoImportacion({ ...BASE_ARGS, esCourier: true, estadisticaDespacho: 50 });
  assert.ok(!courierReal.estadisticaSegunDespacho && courierReal.estadistica === 0, 'despacho: courier sigue sin estadística');
}

if (fallos > 0) { console.error(`\n❌ costeoImportacion: ${fallos} fallo(s)`); process.exit(1); }
console.log('✅ costeoImportacion: 40 checks OK (despacho 26001IC04780007 + factura DHL 0396A00607679)');
