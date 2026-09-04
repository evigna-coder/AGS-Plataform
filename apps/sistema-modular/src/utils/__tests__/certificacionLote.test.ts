/**
 * Lote de certificación con varios documentos (2026-09-04): qué sigue abierto
 * y qué queda por facturar, tolerando los lotes guardados con la marca vieja
 * a nivel lote.
 */
import type { Certificacion, CertificacionRecibida } from '@ags/shared';
import { certificacionAbierta, recibidasSinFacturar } from '@ags/shared';

let ok = 0;
let fail = 0;
const check = (nombre: string, cond: boolean) => {
  if (cond) ok++;
  else { fail++; console.error(`  ✗ ${nombre}`); }
};

const rec = (over: Partial<CertificacionRecibida>): CertificacionRecibida => ({
  id: crypto.randomUUID(), fecha: '2026-09-01', importes: [{ moneda: 'ARS', monto: 1000 }], ...over,
});
const lote = (over: Partial<Certificacion>): Certificacion => ({
  id: 'l1', fecha: '2026-09-01', otNumbers: ['1', '2'], createdAt: '', updatedAt: '',
  items: [{ otNumber: '1', estado: 'certificada' }, { otNumber: '2', estado: 'certificada' }],
  estado: 'cerrada', ...over,
});

// Cerrado pero con un papel sin facturar: sigue abierto.
const a = lote({ recibidas: [rec({ solicitudesIds: [] })] });
check('papel sin facturar → abierto', certificacionAbierta(a));
check('un papel por facturar', recibidasSinFacturar(a).length === 1);

// Papel facturado: se va.
const b = lote({ recibidas: [rec({ solicitudesIds: ['s1'] })], solicitudesIds: ['s1'] });
check('todo facturado → cerrado', !certificacionAbierta(b));

// Dos papeles, uno facturado y otro nuevo: queda el nuevo.
const c = lote({ recibidas: [rec({ solicitudesIds: ['s1'] }), rec({ solicitudesIds: [] })], solicitudesIds: ['s1'] });
check('segundo papel pendiente', recibidasSinFacturar(c).length === 1 && certificacionAbierta(c));

// Lote viejo: marca a nivel lote, papel sin el campo → facturado.
const d = lote({ recibidas: [rec({ solicitudesIds: undefined })], solicitudesIds: ['s1'] });
check('legacy: lote facturado cubre el papel', recibidasSinFacturar(d).length === 0 && !certificacionAbierta(d));

// Lote viejo sin facturar: el papel cuenta.
const e = lote({ recibidas: [rec({ solicitudesIds: undefined })] });
check('legacy: sin facturar → pendiente', recibidasSinFacturar(e).length === 1);

// Papel sin importe (solo archivo) no se factura ni mantiene abierto.
const f = lote({ recibidas: [rec({ importes: [] })] });
check('sin importe no cuenta', recibidasSinFacturar(f).length === 0 && !certificacionAbierta(f));

// OTs pendientes: abierto aunque no haya papeles.
check('OT pendiente → abierto', certificacionAbierta(lote({ estado: 'solicitada', items: [{ otNumber: '1', estado: 'pendiente' }] })));

console.log(fail === 0 ? `✅ certificacionLote: ${ok}/${ok} OK` : `❌ certificacionLote: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
