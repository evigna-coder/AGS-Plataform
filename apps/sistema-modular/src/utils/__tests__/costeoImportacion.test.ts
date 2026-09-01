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

const costeo = computeCosteoImportacion({
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
});

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

// ── Courier: sin estadística ni percepciones ───────────────────────────────
{
  const courier = computeCosteoImportacion({
    items,
    articulosById: new Map([['art-1', { ...articulo, tratamientoArancelario: { ...articulo.tratamientoArancelario, estadistica: 3 } } as Articulo]]),
    gastos: [],
    monedaBase: 'EUR',
    fleteDeclarado: 60, monedaFlete: 'USD',
    seguroDeclarado: 119.61, monedaSeguro: 'EUR',
    tipoCambio: 1503,
    paseEurUsd: PASE,
    esCourier: true,
  });
  cerca('courier: sin estadística', courier.estadistica, 0);
  cerca('courier: sin IVA adicional', courier.ivaAdicional, 0);
  cerca('courier: sin ganancias', courier.ganancias, 0);
  cerca('courier: sin ingresos brutos', courier.iibb, 0);
  assert.ok(courier.derechos > 0 && courier.iva > 0, 'courier sí tributa derechos e IVA');
}

if (fallos > 0) { console.error(`\n❌ costeoImportacion: ${fallos} fallo(s)`); process.exit(1); }
console.log('✅ costeoImportacion: 22 checks OK (contrastado contra el despacho 26001IC04780007)');
