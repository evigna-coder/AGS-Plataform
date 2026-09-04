/**
 * Entregas por OC (2026-09-04): agrupa por OC del cliente, cae al presupuesto
 * sin OC, y la OC queda pendiente hasta el último artículo.
 */
import type { EntregaRow } from '../entregasResolver';
import { agruparEntregasPorOC } from '../entregasPorOC';

let ok = 0;
let fail = 0;
const check = (n: string, c: boolean) => { if (c) ok++; else { fail++; console.error(`  ✗ ${n}`); } };

const row = (over: Partial<EntregaRow>): EntregaRow => ({
  presupuestoId: 'p1', presupuestoNumero: 'P3-1', itemId: crypto.randomUUID(), clienteId: 'c1', clienteNombre: 'ACME',
  establecimientoId: null, codigoProducto: null, stockArticuloId: null, stockReservado: 0, stockLibre: 0,
  descripcion: 'x', cantidad: 1, cantidadBase: 1, presentacionCodigo: null, precioUnitario: 100, moneda: 'USD',
  disponibilidad: null, disponibilidadSugerida: 'stock', disponibilidadCalculada: { clave: 'stock', label: 'Stock' } as never,
  pagoAnticipado: false, etaDiasEstimados: null, fechaAceptacion: null, etaFecha: null, diasRestantes: null,
  semaforo: 'sin_eta', otNumeroVinculada: null, fechaComprometida: null, entregadoManual: null,
  requerimientoId: null, requerimientoNumero: null, ocId: null, ocNumero: null, ocEstado: null,
  importacionId: null, importacionNumero: null, importacionEstado: null, ocCliente: null,
  direccionEntregaId: null, direccionEntregaTexto: null, ...over,
});
const oc = (numero: string) => ({ numero, url: null, nombre: null });

const g = agruparEntregasPorOC([
  row({ ocCliente: oc('4500123'), semaforo: 'verde', diasRestantes: 10, etaFecha: '2026-09-20' }),
  row({ ocCliente: oc('4500123 '), semaforo: 'entregado', diasRestantes: 3, etaFecha: '2026-09-10', presupuestoNumero: 'P3-2', presupuestoId: 'p2' }),
  row({ ocCliente: oc('4500123'), semaforo: 'rojo', diasRestantes: -2, etaFecha: '2026-09-01', cantidad: 3, moneda: 'ARS', precioUnitario: 50 }),
  row({ presupuestoId: 'p9', presupuestoNumero: 'P1-9', semaforo: 'amarillo', diasRestantes: 2 }),
  row({ presupuestoId: 'p9', presupuestoNumero: 'P1-9', semaforo: 'entregado' }),
  row({ presupuestoId: 'p7', presupuestoNumero: 'P1-7', semaforo: 'entregado', clienteNombre: 'Beta', clienteId: 'c2' }),
]);
const oc123 = g.find(x => x.ocNumero === '4500123')!;
check('tres grupos', g.length === 3);
check('misma OC con espacios agrupa', oc123.totalItems === 3);
check('dos presupuestos bajo la OC', oc123.presupuestos.length === 2);
check('pendiente hasta el ultimo articulo', !oc123.completa && oc123.entregados === 1);
check('semaforo = el peor pendiente', oc123.semaforo === 'rojo' && oc123.minDias === -2);
check('ETA mas lejana de los pendientes', oc123.etaMax === '2026-09-20');
check('importe por moneda', oc123.importePorMoneda.find(i => i.moneda === 'USD')?.monto === 200
  && oc123.importePorMoneda.find(i => i.moneda === 'ARS')?.monto === 150);
check('sin OC agrupa por presupuesto', g.find(x => x.key === 'ppto:p9')?.totalItems === 2);
check('grupo completo', g.find(x => x.key === 'ppto:p7')?.completa === true);
check('orden: vencida, luego proxima, completas al final', g.map(x => x.key).join(',') === 'oc:c1:4500123,ppto:p9,ppto:p7');

console.log(fail === 0 ? `✅ entregasPorOC: ${ok}/${ok} OK` : `❌ entregasPorOC: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
