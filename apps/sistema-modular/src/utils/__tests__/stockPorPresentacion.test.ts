// Run with: pnpm --filter @ags/sistema-modular test:stock-por-presentacion
// Caso real 6181-1210 (2026-10-02): lote de 70 ingresado como 6183-4498 (×10),
// 50 como 6061-3370 (×5) y 3 sueltas.
import assert from 'node:assert/strict';
import { fmtCant, stockPorPresentacion } from '../stockPorPresentacion.js';

const pres = [
  { codigoParte: '6061-3370', descripcion: 'Kit x 500', factor: 5, activo: true },
  { codigoParte: '6183-4498', descripcion: 'Kit x 1000', factor: 10, activo: true },
  { codigoParte: '5190-4053', descripcion: 'Kit x 5000', factor: 50, activo: true },
];
const u = (cantidad: number, estado: string, presentacion: { codigoParte: string; factor: number } | null) =>
  ({ cantidad, estado, activo: true, presentacion } as never);

const r = stockPorPresentacion([
  u(30, 'disponible', { codigoParte: '6183-4498', factor: 10 }),
  u(40, 'reservado', { codigoParte: '6183-4498', factor: 10 }),
  u(50, 'disponible', { codigoParte: '6061-3370', factor: 5 }),
  u(3, 'disponible', null),
  u(99, 'consumido', null),
], pres);

assert.equal(r.total, 123, 'consumido no cuenta');
assert.equal(r.sueltas, 3);
const fila = (c: string) => r.filas.find(f => f.codigoParte === c)!;
assert.equal(fila('6183-4498').unidadesBase, 70);
assert.equal(fila('6183-4498').totalEnEnvases, 12.3);
assert.equal(fila('6061-3370').unidadesBase, 50);
assert.equal(fila('6061-3370').totalEnEnvases, 24.6);
assert.equal(fila('5190-4053').unidadesBase, 0);
assert.equal(fila('5190-4053').totalEnEnvases, 2.46);
assert.equal(fmtCant(12.3), '12,3');
assert.equal(fmtCant(7), '7');

console.log('✅ stockPorPresentacion: OK');
