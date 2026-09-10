/**
 * Unit tests — reglas puras de la reapertura de OT (2026-09-10).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:reapertura-ot
 *
 * Diseño en .claude/plans/reapertura-ot.md. Lo que se fija acá:
 *  - desde qué estados se puede reabrir y a cuál se vuelve por nivel;
 *  - qué pasa con el presupuesto: sin aviso emitido la OT deja de estar lista
 *    y el ppto vuelve a en_ejecucion solo si no le quedan otras; con aviso
 *    vivo (aunque sea "pendiente") no se toca nada y se bloquea el re-cierre;
 *  - el ticket al ingeniero tras una reapertura técnica.
 */

import assert from 'node:assert/strict';
import type { WorkOrder } from '@ags/shared';
import {
  puedeReabrirOT, destinoReapertura, decidirFacturacionAlReabrir, buildTicketAvisoReaperturaTecnica,
  isOTTransicionValida, type ReaperturaOT,
} from '@ags/shared';

const ot = (extra: Partial<WorkOrder>): WorkOrder => ({ otNumber: '30001.01', status: 'FINALIZADO', ...extra } as WorkOrder);

// ── Desde dónde y hacia dónde ───────────────────────────────────────────────
{
  assert.equal(destinoReapertura('administrativa'), 'CIERRE_TECNICO');
  assert.equal(destinoReapertura('tecnica'), 'EN_CURSO');

  assert.equal(puedeReabrirOT(ot({ estadoAdmin: 'FINALIZADO' }), 'administrativa').ok, true);
  assert.equal(puedeReabrirOT(ot({ estadoAdmin: 'CIERRE_ADMINISTRATIVO' }), 'administrativa').ok, true);
  assert.equal(puedeReabrirOT(ot({ estadoAdmin: 'CIERRE_TECNICO' }), 'administrativa').ok, false, 'sin cierre admin no hay nada administrativo que reabrir');

  assert.equal(puedeReabrirOT(ot({ estadoAdmin: 'CIERRE_TECNICO' }), 'tecnica').ok, true);
  assert.equal(puedeReabrirOT(ot({ estadoAdmin: 'FINALIZADO' }), 'tecnica').ok, true, 'facturada o no, el reporte se puede reabrir (D3)');
  assert.equal(puedeReabrirOT(ot({ status: 'FINALIZADO', estadoAdmin: 'EN_CURSO' }), 'tecnica').ok, true, 'reporte finalizado con estadoAdmin desincronizado');
  assert.equal(puedeReabrirOT(ot({ status: 'BORRADOR', estadoAdmin: 'EN_CURSO' }), 'tecnica').ok, false, 'reporte en borrador: nada que reabrir');
  assert.equal(puedeReabrirOT(ot({ estadoAdmin: 'CANCELADA' }), 'tecnica').ok, false);
  assert.equal(puedeReabrirOT(ot({ otNumber: '30001', estadoAdmin: 'FINALIZADO' }), 'tecnica').ok, false, 'el padre no se reabre');

  // Las transiciones de reapertura son legales en la matriz.
  assert.equal(isOTTransicionValida('CIERRE_ADMINISTRATIVO', 'CIERRE_TECNICO'), true);
  assert.equal(isOTTransicionValida('CIERRE_ADMINISTRATIVO', 'EN_CURSO'), true);
  assert.equal(isOTTransicionValida('FINALIZADO', 'EN_CURSO'), true);
}

// ── Presupuesto sin aviso emitido ───────────────────────────────────────────
{
  const d = decidirFacturacionAlReabrir({
    otNumber: '30001.01',
    ppto: { estado: 'pendiente_facturacion', otsListasParaFacturar: ['30001.01'] },
    solicitudesVivas: [],
  });
  assert.equal(d.quitarDeListas, true, 'deja de estar lista para facturar');
  assert.equal(d.nuevoEstado, 'en_ejecucion', 'era la única OT lista: el ppto vuelve a ejecución');
  assert.equal(d.bloqueo, null);

  const d2 = decidirFacturacionAlReabrir({
    otNumber: '30001.01',
    ppto: { estado: 'pendiente_facturacion', otsListasParaFacturar: ['30001.01', '30001.02'] },
    solicitudesVivas: [],
  });
  assert.equal(d2.quitarDeListas, true);
  assert.equal(d2.nuevoEstado, null, 'quedan otras OTs listas: el ppto sigue pendiente de facturación');

  const d3 = decidirFacturacionAlReabrir({
    otNumber: '30001.01',
    ppto: { estado: 'en_ejecucion', otsListasParaFacturar: [] },
    solicitudesVivas: [],
  });
  assert.equal(d3.quitarDeListas, false, 'no estaba lista: nada que quitar');
  assert.equal(d3.nuevoEstado, null);
}

// ── Presupuesto con aviso vivo: no se toca, se bloquea el re-cierre ─────────
{
  for (const estado of ['pendiente', 'enviada', 'facturada', 'cobrada']) {
    const d = decidirFacturacionAlReabrir({
      otNumber: '30001.01',
      ppto: { estado: 'facturado', otsListasParaFacturar: [] },
      solicitudesVivas: [{ id: 'sf1', numero: 'SF-0010', estado }],
    });
    assert.equal(d.quitarDeListas, false, `${estado}: no se toca el ppto`);
    assert.equal(d.nuevoEstado, null, `${estado}: el ppto no vuelve a aparecer`);
    assert.equal(d.bloqueo?.solicitudId, 'sf1', `${estado}: re-cierre bloqueado`);
    assert.match(d.aviso ?? '', /SF-0010/);
  }
  const anulada = decidirFacturacionAlReabrir({
    otNumber: '30001.01',
    ppto: { estado: 'pendiente_facturacion', otsListasParaFacturar: ['30001.01'] },
    solicitudesVivas: [{ id: 'sf2', estado: 'anulada' }],
  });
  assert.equal(anulada.bloqueo, null, 'una solicitud anulada no bloquea');
  assert.equal(anulada.quitarDeListas, true);
}

// ── Ticket al ingeniero tras reapertura técnica ─────────────────────────────
{
  const reap: ReaperturaOT = {
    id: 'r1', fecha: '2026-09-10T19:00:00.000Z', actorUid: 'u1', actorNombre: 'Aldana', motivo: 'Faltó un consumo',
    nivel: 'tecnica', estadoDesde: 'FINALIZADO', estadoHasta: 'EN_CURSO', origen: 'portal-ingeniero', avisos: [],
  };
  const t = buildTicketAvisoReaperturaTecnica(ot({ ingenieroAsignadoId: 'ing-uid', ingenieroAsignadoNombre: 'Aldana', razonSocial: 'IFF' }), reap);
  assert.equal(t.asignadoA, 'ing-uid', 'va al ingeniero asignado');
  assert.equal(t.esAutogenerado, true);
  assert.deepEqual(t.otIds, ['30001.01']);
  assert.match(t.accionPendiente ?? '', /volver a firmar/);
  assert.match(t.descripcion ?? '', /Faltó un consumo/);
}

console.log('✓ reaperturaOT: niveles y estados, presupuesto sin/con aviso, ticket al ingeniero');
