/**
 * Unit tests — deducción de stock POR LÍNEA en el cierre de OT (2026-09-10).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:cierre-stock-lineas
 *
 * Fija la semántica que hace posible reabrir sin doble descuento:
 *  - una OT cerrada con el flag viejo y sin detalle se toma como "todo
 *    descontado" (legacy) y solo lo agregado después queda pendiente;
 *  - lo descontado (aunque sea parcial) o cubierto por reserva queda marcado;
 *  - lo que dio 0 sigue pendiente para el retry;
 *  - el flag global es "todas las líneas descontadas".
 */

import assert from 'node:assert/strict';
import type { CierreAdministrativo, StockSelection } from '@ags/shared';
import { seleccionesPendientesDeDeduccion, marcarSeleccionesDeducidas, todasDeducidas } from '../cierreStockLineas';

const sel = (partId: string, extra: Partial<StockSelection> = {}): StockSelection => ({
  partId, partCodigo: partId, partDescripcion: partId, cantidad: 1, origenTipo: 'posicion', origenId: 'pos', origenNombre: 'CJ1', ...extra,
});
const cierre = (extra: Partial<CierreAdministrativo>): CierreAdministrativo => ({
  horasConfirmadas: true, partesConfirmadas: true, avisoAdminEnviado: false, stockDeducido: false, ...extra,
});

// ── Legacy: flag prendido sin detalle → todas descontadas, solo lo nuevo pendiente ──
{
  const { todas, pendientes, legacyMarcado } = seleccionesPendientesDeDeduccion(
    cierre({ stockDeducido: true, stockSelections: [sel('a'), sel('b')] }), '2026-09-01',
  );
  assert.equal(legacyMarcado, true);
  assert.equal(pendientes.length, 0, 'nada pendiente: ya se descontó en el cierre viejo');
  assert.ok(todas.every(s => s.deducidoAt === '2026-09-01' && s.deducidoLegacy), 'marcadas legacy');

  // Tras reabrir y agregar una línea nueva, solo esa queda pendiente.
  const r2 = seleccionesPendientesDeDeduccion(cierre({ stockDeducido: true, stockSelections: [...todas, sel('c')] }), '2026-09-10');
  assert.equal(r2.legacyMarcado, false);
  assert.deepEqual(r2.pendientes.map(p => p.sel.partId), ['c']);
  assert.equal(r2.pendientes[0].indiceGlobal, 2);
}

// ── Sin flag: todo pendiente ────────────────────────────────────────────────
{
  const { pendientes, legacyMarcado } = seleccionesPendientesDeDeduccion(cierre({ stockSelections: [sel('a'), sel('b')] }), 'x');
  assert.equal(legacyMarcado, false);
  assert.equal(pendientes.length, 2);
}

// ── Marcado de resultados ───────────────────────────────────────────────────
{
  const todas = [sel('a', { deducidoAt: '2026-09-01' }), sel('b', { cantidad: 3 }), sel('c'), sel('d')];
  const { pendientes } = seleccionesPendientesDeDeduccion(cierre({ stockSelections: todas }), 'x');
  assert.deepEqual(pendientes.map(p => p.sel.partId), ['b', 'c', 'd']);
  const out = marcarSeleccionesDeducidas(todas, pendientes, [
    { indice: 0, deducidas: 2, cubiertas: 0, movimientoIds: ['m1', 'm2'] }, // parcial: igual queda marcada
    { indice: 1, deducidas: 0, cubiertas: 1, movimientoIds: [] },           // cubierta por reserva
    { indice: 2, deducidas: 0, cubiertas: 0, movimientoIds: [] },           // nada: sigue pendiente
  ], '2026-09-10');
  assert.equal(out[0].deducidoAt, '2026-09-01', 'la ya deducida no se toca');
  assert.equal(out[1].deducidoAt, '2026-09-10');
  assert.equal(out[1].cantidadDeducida, 2);
  assert.deepEqual(out[1].movimientoIds, ['m1', 'm2']);
  assert.equal(out[2].deducidoAt, '2026-09-10', 'cubierta por reserva cuenta como hecha');
  assert.equal(out[3].deducidoAt, undefined, 'con 0 sigue pendiente para el retry');
  assert.equal(todasDeducidas(out), false);
  assert.equal(todasDeducidas(out.slice(0, 3)), true);
  assert.equal(todasDeducidas([]), false, 'sin selecciones el flag no se prende');
}

console.log('✓ cierreStockLineas: legacy = todo descontado, marcado por línea, flag derivado');
