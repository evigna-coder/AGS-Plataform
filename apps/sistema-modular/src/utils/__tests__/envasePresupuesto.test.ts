// Run with: pnpm --filter @ags/sistema-modular test:envase-presupuesto
// Caso del user (2026-10-01): 5181-3376 = pack de 100; 5183-4493 = kit de 1000
// (×10); 5190-6113 = kit de 10000 (×100). El precio de compra baja con el volumen.
import assert from 'node:assert/strict';
import { cambiarEnvase, codigoVisibleItem, costoParaEnvase, descripcionConEnvase } from '../envasePresupuesto.js';

const kit1000 = { codigoParte: '5183-4493', descripcion: 'Kit x 1000', factor: 10 };
const kit10000 = { codigoParte: '5190-6113', descripcion: 'Kit x 10000', factor: 100 };
const articulo = { descripcion: 'Vial 2 mL 100PK', presentaciones: [kit1000, kit10000] };

// ── Código visible ──
assert.equal(codigoVisibleItem({ codigoProducto: '5181-3376', presentacion: { codigoParte: '5183-4493', factor: 10 } }), '5183-4493');
assert.equal(codigoVisibleItem({ codigoProducto: '5181-3376', presentacion: null }), '5181-3376');

// ── Descripción ──
assert.equal(descripcionConEnvase('Vial 2 mL 100PK', kit1000), 'Vial 2 mL 100PK — Kit x 1000');
assert.equal(descripcionConEnvase('Vial 2 mL 100PK', null), 'Vial 2 mL 100PK');

// ── Cambio de envase: conserva unidades base e importe ──
{
  const r = cambiarEnvase({ cantidad: 1, precioUnitario: 160, descripcion: 'Vial 2 mL 100PK — Kit x 1000', presentacion: { codigoParte: '5183-4493', factor: 10 } }, null, articulo);
  assert.equal(r.cantidad, 10, '1 kit de 1000 = 10 packs de 100');
  assert.equal(r.precioUnitario, 16, 'a un décimo del precio');
  assert.equal(r.presentacion, null);
  assert.equal(r.descripcion, 'Vial 2 mL 100PK', 'descripción de defecto se actualiza');
}
{
  const r = cambiarEnvase({ cantidad: 20, precioUnitario: 20, descripcion: 'Vial 2 mL 100PK', presentacion: null }, kit1000, articulo);
  assert.equal(r.cantidad, 2);
  assert.equal(r.precioUnitario, 200);
  assert.deepEqual(r.presentacion, { codigoParte: '5183-4493', factor: 10 });
  assert.equal(r.descripcion, 'Vial 2 mL 100PK — Kit x 1000');
}
{
  const r = cambiarEnvase({ cantidad: 1, precioUnitario: 160, descripcion: 'Viales ámbar para Roemmers', presentacion: { codigoParte: '5183-4493', factor: 10 } }, kit10000, articulo);
  assert.equal(r.cantidad, 1, '0,1 kit no tiene sentido: se mantiene la cantidad');
  assert.equal(r.precioUnitario, 1600);
  assert.equal(r.descripcion, 'Viales ámbar para Roemmers', 'una descripción escrita a mano no se pisa');
}

{
  // Caso P1-005316-01: 2 packs de 100 pasados al kit de 10000 → 2 kits, no 0,02.
  const r = cambiarEnvase({ cantidad: 2, precioUnitario: 20, descripcion: 'Vial 2 mL 100PK', presentacion: null }, kit10000, articulo);
  assert.equal(r.cantidad, 2);
  assert.equal(r.precioUnitario, 2000);
}

// ── Costo por envase ──
const u = (cantidad: number, costoUnitario: number, presentacion: { codigoParte: string; factor: number } | null) =>
  ({ cantidad, costoUnitario, monedaCosto: 'USD', estado: 'disponible', activo: true, presentacion } as never);
const stock = [
  u(5, 20, null),                                     // 5 packs comprados sueltos: 20 c/u
  u(10, 16, { codigoParte: '5183-4493', factor: 10 }), // 1 kit de 1000 a 160 → 16 por pack
  u(100, 14, { codigoParte: '5190-6113', factor: 100 }),
];
{
  const c = costoParaEnvase(stock, { codigoParte: '5183-4493', factor: 10 })!;
  assert.equal(c.fuente, 'envase');
  assert.equal(c.costo, 160, 'kit de 1000: lo que costó ese kit');
  assert.equal(c.factorEnvase, 10);
}
assert.equal(costoParaEnvase(stock, { codigoParte: '5190-6113', factor: 100 })!.costo, 1400, 'kit de 10000');
assert.equal(costoParaEnvase(stock, null)!.costo, 20, 'pack suelto: los comprados sueltos');
{
  // Sin ingresos en ese envase: promedio general × factor.
  const c = costoParaEnvase([u(10, 16, { codigoParte: '5183-4493', factor: 10 })], null)!;
  assert.equal(c.fuente, 'general');
  assert.equal(c.costo, 16);
}
assert.equal(costoParaEnvase([], null), null);

console.log('✅ envasePresupuesto: OK');
