/**
 * Contrato MIXTO con una porción por moneda en la misma línea (2026-09-04).
 */
import { montosDeItem, totalesPorMonedaDeItems, monedasDeItems, espejoMonedaPrincipal, monedasMixtaDe } from '@ags/shared';
import { computeTotalsByCurrency } from '../cuotasFacturacion';
import type { PresupuestoItem } from '@ags/shared';

let ok = 0;
let fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) ok++; else { fail++; console.error(`  ✗ ${n} ${d}`); } };

const it = (over: Partial<PresupuestoItem>): PresupuestoItem => ({
  id: crypto.randomUUID(), descripcion: 'x', cantidad: 1, unidad: 'servicio', precioUnitario: 0, subtotal: 0, ...over,
});

// Ítem mixto: 2 visitas a 1000 ARS + 50 USD cada una.
const mixto = it({ cantidad: 2, montosPorMoneda: { ARS: 1000, USD: 50 }, moneda: 'ARS', precioUnitario: 1000, subtotal: 2000 });
const m = montosDeItem(mixto, 'MIXTA');
check('dos porciones', m.length === 2);
check('ARS 2000', m.find(x => x.moneda === 'ARS')?.subtotal === 2000);
check('USD 100', m.find(x => x.moneda === 'USD')?.subtotal === 100);

// Legacy: item con moneda propia y subtotal guardado.
const legacy = it({ moneda: 'USD', precioUnitario: 300, subtotal: 300 });
check('legacy una porcion', montosDeItem(legacy, 'MIXTA').length === 1 && montosDeItem(legacy, 'MIXTA')[0].moneda === 'USD');
// Sin moneda en un ppto de moneda unica → la del ppto.
check('fallback moneda base', montosDeItem(it({ precioUnitario: 5, subtotal: 5 }), 'ARS')[0].moneda === 'ARS');
// S/L no suma.
check('S/L vacio', montosDeItem(it({ esSinCargo: true, montosPorMoneda: { ARS: 9 } }), 'MIXTA').length === 0);
// Porción en 0 no cuenta como moneda.
check('porcion cero se ignora', montosDeItem(it({ montosPorMoneda: { ARS: 0, USD: 10 } }), 'MIXTA').length === 1);

// Totales y monedas activas.
const tot = totalesPorMonedaDeItems([mixto, legacy], 'MIXTA');
check('totales ARS 2000 / USD 400', tot.ARS === 2000 && tot.USD === 400, JSON.stringify(tot));
check('monedas activas', monedasDeItems([mixto, legacy], 'MIXTA').join(',') === 'ARS,USD');

// Espejo principal: primera del orden con precio.
const esp = espejoMonedaPrincipal(mixto, ['ARS', 'USD']);
check('espejo ARS', esp.moneda === 'ARS' && esp.precioUnitario === 1000 && esp.subtotal === 2000);
check('espejo salta moneda sin precio', espejoMonedaPrincipal(it({ cantidad: 1, montosPorMoneda: { ARS: 0, USD: 7 } }), ['ARS', 'USD']).moneda === 'USD');

// Cuotas: mismo criterio.
const ct = computeTotalsByCurrency([mixto, legacy], 'MIXTA');
check('computeTotalsByCurrency incluye porciones', ct.ARS === 2000 && ct.USD === 400, JSON.stringify(ct));

// Monedas del contrato.
check('default ARS,USD', monedasMixtaDe({ moneda: 'MIXTA' }).join(',') === 'ARS,USD');
check('respeta orden declarado', monedasMixtaDe({ moneda: 'MIXTA', monedasMixta: ['USD', 'ARS'] }).join(',') === 'USD,ARS');
check('moneda unica', monedasMixtaDe({ moneda: 'EUR' }).join(',') === 'EUR');

console.log(fail === 0 ? `✅ montosMixta: ${ok}/${ok} OK` : `❌ montosMixta: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
