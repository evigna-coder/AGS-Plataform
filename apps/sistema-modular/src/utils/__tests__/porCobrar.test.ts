import assert from 'node:assert/strict';
import type { Presupuesto, WorkOrder } from '@ags/shared';
import { computeACertificar, computeCertificadasSinAviso, computePorCobrar } from '../analitica/porCobrar';

const ppto = (over: Partial<Presupuesto>): Presupuesto => ({
  id: 'p1', numero: 'P9-0001-01', estado: 'en_ejecucion', moneda: 'USD', total: 1000, items: [],
  otsVinculadasNumbers: null, otVinculadaNumber: null, ...over,
} as unknown as Presupuesto);

const ot = (otNumber: string, over: Partial<WorkOrder> = {}): WorkOrder => ({
  otNumber, budgets: ['P9-0001-01'], estadoAdmin: 'CIERRE_ADMINISTRATIVO',
  retenidaFacturacion: true, requisitoFacturacionPendiente: 'certificacion', ...over,
} as unknown as WorkOrder);

let n = 0;
const ok = (c: boolean, msg: string) => { assert.ok(c, msg); n++; };

// 1) una OT retenida = todo el presupuesto
{
  const r = computeACertificar([ppto({})], [ot('30001.01')]);
  ok(r.presupuestos.length === 1 && r.otsRetenidas === 1, 'cuenta el ppto y la OT');
  ok(r.monto.USD === 1000, 'monto completo con una sola OT');
}
// 2) proporcional: 2 de 5 visitas esperando papel
{
  const ots = [0, 1, 2, 3, 4].map(i => ot(`3000${i}.01`, i < 2 ? {} : { retenidaFacturacion: false, requisitoFacturacionPendiente: null }));
  const r = computeACertificar([ppto({})], ots);
  ok(Math.round(r.monto.USD!) === 400, `2/5 de 1000 = 400 (dio ${r.monto.USD})`);
  ok(r.otsRetenidas === 2, 'dos retenidas');
}
// 3) retenida por remito firmado NO cuenta; OT abierta NO cuenta
{
  const r = computeACertificar([ppto({})], [
    ot('30001.01', { requisitoFacturacionPendiente: 'remito_firmado' }),
    ot('30002.01', { estadoAdmin: 'ASIGNADA' }),
  ]);
  ok(r.presupuestos.length === 0, 'sin certificación pendiente no entra');
}
// 4) pesos y dólares nunca se suman
{
  const r = computeACertificar([ppto({ id: 'p1' }), ppto({ id: 'p2', numero: 'P9-0002-01', moneda: 'ARS', total: 500000 })],
    [ot('30001.01'), ot('30002.01', { budgets: ['P9-0002-01'] })]);
  ok(r.monto.USD === 1000 && r.monto.ARS === 500000, 'por moneda separada');
}
// 5) por cobrar = certificar + avisos pendientes + facturado sin cobrar, por moneda
{
  const t = computePorCobrar({ USD: 400 }, [{ moneda: 'USD', montoTotal: 100 }, { moneda: 'ARS', montoTotal: 9000 }], [{ moneda: 'USD', montoTotal: 50 }]);
  ok(t.USD === 550 && t.ARS === 9000, `por cobrar por moneda (dio ${JSON.stringify(t)})`);
}
// 6) estados no aceptados no entran
{
  const r = computeACertificar([ppto({ estado: 'enviado' })], [ot('30001.01')]);
  ok(r.presupuestos.length === 0, 'enviado no cuenta');
}
// 7) certificada (papel recibido, OT liberada) sin aviso → cuenta; con aviso que la nombra → no
{
  const cert = ot('30001.01', { retenidaFacturacion: false, requisitoFacturacionPendiente: null, certificacionId: 'lote1' });
  const sin = computeCertificadasSinAviso([ppto({})], [cert], []);
  ok(sin.otsRetenidas === 1 && sin.monto.USD === 1000, 'certificada sin aviso entra con su monto');
  const con = computeCertificadasSinAviso([ppto({})], [cert], [{ presupuestoId: 'p1', estado: 'pendiente', otNumbers: ['30001.01'] }]);
  ok(con.otsRetenidas === 0, 'con aviso que la nombra no entra');
  const total = computeCertificadasSinAviso([ppto({})], [cert], [{ presupuestoId: 'p1', estado: 'facturada', otNumbers: null }]);
  ok(total.otsRetenidas === 0, 'aviso total del ppto cubre todas');
  const anulada = computeCertificadasSinAviso([ppto({})], [cert], [{ presupuestoId: 'p1', estado: 'anulada', otNumbers: ['30001.01'] }]);
  ok(anulada.otsRetenidas === 1, 'una solicitud anulada no cuenta como aviso');
}
// 8) por cobrar suma el certificado sin aviso
{
  const t = computePorCobrar({ USD: 100 }, [], [], { USD: 50, ARS: 10 });
  ok(t.USD === 150 && t.ARS === 10, 'certificado sin aviso entra en por cobrar');
}
console.log(`✅ porCobrar: ${n}/${n} OK`);
