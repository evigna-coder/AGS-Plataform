// Run with: pnpm --filter @ags/sistema-modular test:reqs-cubiertos
import assert from 'node:assert/strict';
import type { RequerimientoCompra } from '@ags/shared';
import { requerimientosCubiertosPorReserva } from '../requerimientosCubiertos.js';

const req = (id: string, extra: Partial<RequerimientoCompra> = {}): RequerimientoCompra => ({
  id, numero: `REQ-${id}`, articuloId: 'A', articuloCodigo: '5190-9067', articuloDescripcion: 'Cap', cantidad: 2, unidadMedida: 'u',
  motivo: '', origen: 'presupuesto', estado: 'pendiente', presupuestoId: 'P', solicitadoPor: 'sys', fechaSolicitud: '2026-08-21',
  createdAt: '2026-08-21', updatedAt: '2026-08-21', ...extra,
} as RequerimientoCompra);

// Caso Roemmers REQ-0045: pide 2, el ppto necesita 2, hay 4 reservadas → se cancela.
{
  const r = requerimientosCubiertosPorReserva([req('45')], 'P', 'A', 2, 4);
  assert.deepEqual(r.cancelar.map(x => x.id), ['45']);
  assert.match(r.motivo, /4 u\. reservadas/);
}
// Cobertura parcial: no se toca.
assert.deepEqual(requerimientosCubiertosPorReserva([req('45')], 'P', 'A', 2, 1).cancelar, []);
// Sin ítem en el ppto (necesarias 0): se compara contra lo pedido por los requerimientos.
assert.equal(requerimientosCubiertosPorReserva([req('a'), req('b')], 'P', 'A', 0, 4).cancelar.length, 2);
assert.equal(requerimientosCubiertosPorReserva([req('a'), req('b')], 'P', 'A', 0, 3).cancelar.length, 0);
// Solo abiertos sin OC, del mismo ppto y artículo.
{
  const r = requerimientosCubiertosPorReserva([
    req('ok'), req('aprob', { estado: 'aprobado' }),
    req('en-compra', { estado: 'en_compra', ordenCompraId: 'oc' }), req('con-oc', { ordenCompraId: 'oc' }),
    req('otro-ppto', { presupuestoId: 'Q' }), req('otro-art', { articuloId: 'B' }), req('cancel', { estado: 'cancelado' }),
  ], 'P', 'A', 2, 10);
  assert.deepEqual(r.cancelar.map(x => x.id).sort(), ['aprob', 'ok']);
}
console.log('✅ requerimientosCubiertos: OK');
