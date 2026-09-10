/**
 * Unit tests — conciliación OC ↔ requerimientos al enviar la OC (2026-09-10).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:conciliar-reqs
 *
 * El comprador arma la OC directo, sin pasar por la planilla de
 * requerimientos, y el requerimiento quedaba vivo para siempre. Al enviar la
 * OC se buscan requerimientos abiertos del mismo artículo: uno solo se propone
 * vinculado; varios, elige el comprador.
 */

import assert from 'node:assert/strict';
import type { ItemOC, RequerimientoCompra } from '@ags/shared';
import {
  candidatosConciliacion, seleccionInicial, aplicarSeleccionAItems, idsSeleccionados, requerimientosDeItem,
  repartirCantidad, cantidadBaseItem,
} from '../conciliarRequerimientosOC';

const item = (id: string, extra: Partial<ItemOC> = {}): ItemOC => ({
  id, articuloId: 'A1', articuloCodigo: '5190-1464', descripcion: 'Jeringa', cantidad: 10, cantidadRecibida: 0, unidadMedida: 'u', ...extra,
});
const req = (id: string, extra: Partial<RequerimientoCompra> = {}): RequerimientoCompra => ({
  id, numero: `REQ-${id}`, articuloId: 'A1', articuloCodigo: '5190-1464', articuloDescripcion: 'Jeringa',
  cantidad: 5, unidadMedida: 'u', motivo: '', origen: 'stock_minimo', estado: 'pendiente',
  solicitadoPor: 'sys', fechaSolicitud: '2026-09-01', createdAt: '2026-09-01', updatedAt: '2026-09-01', ...extra,
});

// ── Un solo candidato: se propone vinculado ─────────────────────────────────
{
  const grupos = candidatosConciliacion({ items: [item('i1')] }, [req('r1')]);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].candidatos.map(r => r.id), ['r1']);
  const sel = seleccionInicial(grupos);
  assert.deepEqual(sel.get('i1'), ['r1'], 'único candidato → propuesto');
}

// ── Varios candidatos: no se propone nada, elige el comprador ───────────────
{
  const grupos = candidatosConciliacion({ items: [item('i1')] }, [req('r1'), req('r2', { origen: 'presupuesto', presupuestoNumero: 'P-1' }), req('r3')]);
  assert.deepEqual(grupos[0].candidatos.map(r => r.id), ['r1', 'r2', 'r3']);
  assert.deepEqual(seleccionInicial(grupos).get('i1'), [], 'varios → sin propuesta');
}

// ── Solo requerimientos abiertos y sin OC ───────────────────────────────────
{
  const reqs = [
    req('ok-pend'), req('ok-aprob', { estado: 'aprobado' }),
    req('en-compra', { estado: 'en_compra' }), req('comprado', { estado: 'comprado' }), req('cancel', { estado: 'cancelado' }),
    req('con-oc', { ordenCompraId: 'oc-otra' }),
  ];
  const grupos = candidatosConciliacion({ items: [item('i1')] }, reqs);
  assert.deepEqual(grupos[0].candidatos.map(r => r.id), ['ok-pend', 'ok-aprob']);
}

// ── Ítems ya vinculados no se tocan; otros artículos no matchean ────────────
{
  const grupos = candidatosConciliacion(
    { items: [item('i1', { requerimientoId: 'r0' }), item('i2', { articuloId: 'B2', articuloCodigo: 'X' })] },
    [req('r0'), req('r1')],
  );
  assert.equal(grupos.length, 0, 'ítem con req no se reconcilia; artículo distinto no matchea');
}

// ── Match por código cuando el ítem no tiene articuloId ────────────────────
{
  const grupos = candidatosConciliacion({ items: [item('i1', { articuloId: null, articuloCodigo: ' 5190-1464 ' })] }, [req('r1')]);
  assert.deepEqual(grupos[0]?.candidatos.map(r => r.id), ['r1'], 'código normalizado');
}

// ── Dos ítems del mismo artículo: los candidatos van al primero ─────────────
{
  const grupos = candidatosConciliacion({ items: [item('i1'), item('i2')] }, [req('r1')]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].item.id, 'i1');
}

// ── Aplicar selección: principal + lista completa ───────────────────────────
{
  const items = [item('i1'), item('i2', { articuloId: 'B2' })];
  const sel = new Map([['i1', ['r2', 'r1']], ['i2', []]]);
  const out = aplicarSeleccionAItems(items, sel);
  assert.equal(out[0].requerimientoId, 'r2');
  assert.deepEqual(out[0].requerimientoIds, ['r2', 'r1']);
  assert.equal(out[1].requerimientoId, undefined, 'sin selección no se toca');
  assert.deepEqual(idsSeleccionados(sel), ['r2', 'r1']);
  assert.deepEqual(requerimientosDeItem(out[0]), ['r2', 'r1'], 'sin duplicar el principal');
  assert.deepEqual(requerimientosDeItem({ requerimientoId: 'x' }), ['x'], 'ítems viejos: solo el principal');
}

// ── Reparto: la OC no cubre el requerimiento → saldo pendiente (caso 5181-8830) ──
{
  const [r] = repartirCantidad(item('i1', { cantidad: 3 }), [req('r1', { cantidad: 4 })]);
  assert.equal(r.cubierta, 3, 'la OC cubre 3');
  assert.equal(r.saldo, 1, 'queda 1 pendiente');

  const [a, b] = repartirCantidad(item('i1', { cantidad: 10 }), [req('r1', { cantidad: 4 }), req('r2', { cantidad: 8 })]);
  assert.deepEqual([a.cubierta, a.saldo], [4, 0], 'el primero se cubre entero');
  assert.deepEqual([b.cubierta, b.saldo], [6, 2], 'el segundo con lo que queda');

  const [c] = repartirCantidad(item('i1', { cantidad: 10 }), [req('r1', { cantidad: 4 })]);
  assert.deepEqual([c.cubierta, c.saldo], [4, 0], 'compra de más: sin saldo');

  const envase = { factor: 50 } as unknown as ItemOC['presentacion'];
  assert.equal(cantidadBaseItem(item('i1', { cantidad: 2, presentacion: envase })), 100, 'envase × factor');
  const [d] = repartirCantidad(item('i1', { cantidad: 2, presentacion: envase }), [req('r1', { cantidad: 120 })]);
  assert.deepEqual([d.cubierta, d.saldo], [100, 20], 'reparto en unidades base');
}

console.log('✓ conciliarRequerimientosOC: match por artículo, único propuesto, varios a elección, cierre múltiple');
