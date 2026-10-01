// Run with: pnpm --filter @ags/sistema-modular test:reserva-desviada
import assert from 'node:assert/strict';
import { esConsumoDesviado, faltanteDelPresupuesto, otsDelPresupuesto } from '../reservaDesviada.js';

// Caso real (2026-10-01): Roemmers P1-005120-02, OT 30176.01, 2 lámparas 2140-0820.
const roemmers = {
  otsVinculadasNumbers: ['30176.01'],
  items: [
    { stockArticuloId: 'LAMP', cantidad: 1, otNumeroVinculada: '30176.01' },
    { stockArticuloId: 'LAMP', cantidad: 1, otNumeroVinculada: '30176.01' },
  ],
};

assert.deepEqual([...otsDelPresupuesto(roemmers)], ['30176.01']);
assert.equal(esConsumoDesviado(roemmers, '29930.02'), true, 'consumida en una OT de Bagó');
assert.equal(esConsumoDesviado(roemmers, '30176.01'), false, 'consumida en su propia OT');
assert.equal(esConsumoDesviado(roemmers, null), false, 'sin OT no se puede saber');

// Las dos reservadas se consumieron en Bagó: le faltan 2.
const consumidasEnBago = [
  { articuloId: 'LAMP', estado: 'consumido', cantidad: 1, consumidoEnOt: '29930.02' },
  { articuloId: 'LAMP', estado: 'consumido', cantidad: 1, consumidoEnOt: '29932.01' },
];
assert.equal(faltanteDelPresupuesto(roemmers, 'LAMP', consumidasEnBago, []), 2);
// Con un requerimiento abierto por 2, ya no falta nada.
assert.equal(faltanteDelPresupuesto(roemmers, 'LAMP', consumidasEnBago, [{ articuloId: 'LAMP', estado: 'pendiente', cantidad: 2 }]), 0);
// Uno cancelado no cubre.
assert.equal(faltanteDelPresupuesto(roemmers, 'LAMP', consumidasEnBago, [{ articuloId: 'LAMP', estado: 'cancelado', cantidad: 2 }]), 2);
// Reservada o asignada (en camino al cliente) cubre; consumida en su OT también.
assert.equal(faltanteDelPresupuesto(roemmers, 'LAMP', [
  { articuloId: 'LAMP', estado: 'asignado', cantidad: 1 },
  { articuloId: 'LAMP', estado: 'consumido', cantidad: 1, consumidoEnOt: '30176.01' },
], []), 0);
// Otro artículo no cuenta; un presupuesto sin ese artículo no necesita nada.
assert.equal(faltanteDelPresupuesto(roemmers, 'OTRO', consumidasEnBago, []), 0);

console.log('✅ reservaDesviada: OK');
