/**
 * Unit tests — una unidad física, una sola opción de origen (2026-08-24).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:dedup-origen
 *
 * El caso real: la placa G1531-60020 salió a campo con REM-0052 y un minuto
 * después se entregó al cliente con el remito 0001-00017438. Las dos líneas son
 * legítimas, pero el cierre de la OT ofrecía DOS lugares de descarga para una
 * sola placa — y elegir cualquiera consumía la misma unidad.
 */

import assert from 'node:assert/strict';
import { dedupPorUnidad, type RemitoItemOrigen } from '../origenRemitoDedup.js';

const origen = (remitoNumero: string, unidadId: string | null, extra: Partial<RemitoItemOrigen> = {}): RemitoItemOrigen => ({
  remitoId: `id-${remitoNumero}`, remitoNumero, itemId: `it-${remitoNumero}`,
  ingenieroNombre: 'Sebastian Genovese', cantidad: 1, serie: null, unidadId, ...extra,
});

// ── El caso que lo motivó ────────────────────────────────────────────────────
{
  const r = dedupPorUnidad([origen('REM-0052', 'u1'), origen('0001-00017438', 'u1')]);
  assert.equal(r.length, 1, 'una unidad = una opción');
  assert.equal(r[0].remitoNumero, '0001-00017438', 'gana el movimiento más nuevo');
  assert.deepEqual(r[0].tambienEn, ['REM-0052'], 'el otro remito no se esconde, se lista');
}

// Dos unidades distintas siguen siendo dos opciones: ahí SÍ hay que elegir.
{
  const r = dedupPorUnidad([origen('REM-0052', 'u1'), origen('REM-0060', 'u2')]);
  assert.equal(r.length, 2, 'unidades distintas no se colapsan');
  assert.equal(r.every(o => !o.tambienEn), true, 'sin duplicados no hay "también en"');
}

// Tres remitos sobre la misma unidad: queda el último y los otros dos se listan.
{
  const r = dedupPorUnidad([origen('A', 'u1'), origen('B', 'u1'), origen('C', 'u1')]);
  assert.equal(r.length, 1);
  assert.equal(r[0].remitoNumero, 'C');
  assert.deepEqual(r[0].tambienEn, ['A', 'B']);
}

// ── Líneas documentales: sin unidad no se puede deducir nada ─────────────────
{
  const r = dedupPorUnidad([origen('REM-1', null), origen('REM-2', null)]);
  assert.equal(r.length, 2, 'sin unidadId NO se deduplica — podrían ser cosas distintas');
}

// Mezcla: las que tienen unidad se agrupan, las documentales pasan enteras.
{
  const r = dedupPorUnidad([
    origen('REM-0052', 'u1'), origen('0001-00017438', 'u1'),
    origen('REM-DOC', null),
  ]);
  assert.equal(r.length, 2);
  assert.equal(r.filter(o => o.unidadId === 'u1').length, 1);
  assert.equal(r.filter(o => !o.unidadId).length, 1, 'la documental sobrevive');
}

// No inventa ni pierde datos de la que gana.
{
  const r = dedupPorUnidad([
    origen('A', 'u1', { cantidad: 3 }),
    origen('B', 'u1', { cantidad: 2, serie: 'S-9' }),
  ]);
  assert.equal(r[0].cantidad, 2, 'conserva la cantidad de la línea que gana');
  assert.equal(r[0].serie, 'S-9');
  assert.equal(r[0].itemId, 'it-B', 'y su itemId: es la línea que se va a descargar');
}

assert.deepEqual(dedupPorUnidad([]), [], 'sin orígenes no explota');

console.log('✅ dedupOrigenRemito: 14/14 OK');
