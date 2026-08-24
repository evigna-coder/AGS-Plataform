/**
 * Phase 16 — Entregas Resolver unit suite (Wave 0 RED baseline).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:entregas
 *
 * Uses node:test + node:assert/strict — no framework install.
 *
 * === RED baseline ===
 * Tests fail until:
 *   - 16-03 implements computeSemaforo, computeEtaFecha, buildEntregaRows
 *   - 16-02 ensures Presupuesto.fechaAceptacion + RequerimientoCompra.presupuestoItemId
 *     are written by aceptarConRequerimientos (only affects ENT-03 integration via fixtures)
 *
 * Each test logs [ENT-XX label] for stdout grep:
 *   pnpm --filter @ags/sistema-modular test:entregas 2>&1 | grep '\[ENT-'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularDisponibilidad,
  computeSemaforo,
  computeEtaFecha,
  buildEntregaRows,
  resolverOCCliente,
} from '../utils/entregasResolver.ts';
import {
  FIXTURE_NOW,
  makePresupuestoBase,
  makeItem,
  makeRequerimiento,
  makeOC,
  makeImportacion,
  CLIENTE_NOMBRE_BY_ID,
} from './fixtures/entregas.ts';

test('[ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly', () => {
  assert.equal(computeSemaforo(10), 'verde',     'diasRestantes=10 → verde (>5)');
  assert.equal(computeSemaforo(6),  'verde',     'diasRestantes=6  → verde (>5)');
  assert.equal(computeSemaforo(5),  'amarillo',  'diasRestantes=5  → amarillo (0..5)');
  assert.equal(computeSemaforo(0),  'amarillo',  'diasRestantes=0  → amarillo (boundary)');
  assert.equal(computeSemaforo(-1), 'rojo',      'diasRestantes=-1 → rojo (<0)');
  assert.equal(computeSemaforo(null), 'sin_eta', 'diasRestantes=null → sin_eta');
});

test('[ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly', () => {
  // 2026-05-15 + 30 = 2026-06-14
  const eta = computeEtaFecha('2026-05-15T10:00:00.000Z', 30);
  assert.ok(eta && eta.startsWith('2026-06-14'), `expected 2026-06-14, got ${eta}`);

  // null inputs → null
  assert.equal(computeEtaFecha(null, 30), null, 'fechaAceptacion null → null');
  assert.equal(computeEtaFecha('2026-05-15T10:00:00.000Z', null), null, 'etaDiasEstimados null → null');
});

test('[ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-1', etaDiasEstimados: 30 })],
  });
  const req = makeRequerimiento({ presupuestoItemId: 'ITEM-1', ordenCompraId: 'OC-001', ordenCompraNumero: 'OC-2025-0042' });
  const oc = makeOC();
  const imp = makeImportacion();

  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [req],
    ordenesCompra: [oc],
    importaciones: [imp],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });

  assert.equal(rows.length, 1, 'exactly 1 row per item');
  const r = rows[0];
  assert.equal(r.presupuestoNumero, 'PRE-0001');
  assert.equal(r.clienteNombre, 'Bayer S.A.', 'clienteNombre resolved from map');
  assert.equal(r.requerimientoId, 'REQ-001', 'req joined by presupuestoItemId');
  assert.equal(r.ocNumero, 'OC-2025-0042', 'oc joined via requerimientoId on ocItem');
  assert.equal(r.importacionId, 'IMP-001');
  assert.equal(r.importacionNumero, 'IMP-0001');
  assert.equal(r.importacionEstado, 'en_transito');
  assert.ok(r.etaFecha && r.etaFecha.startsWith('2026-06-14'), `etaFecha computed: ${r.etaFecha}`);
  assert.equal(r.diasRestantes, 13, 'diasRestantes from FIXTURE_NOW (2026-06-01) to 2026-06-14');
  assert.equal(r.semaforo, 'verde', '13 días → verde');
});

test('[ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash)', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-X', etaDiasEstimados: null })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].etaFecha, null);
  assert.equal(rows[0].diasRestantes, null);
  assert.equal(rows[0].semaforo, 'sin_eta');
});

test('[ENT-05] item con importacion.estado=recibido → semaforo = entregado', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-1', etaDiasEstimados: 10 /* would be rojo without entregado override */ })],
  });
  const req = makeRequerimiento({ presupuestoItemId: 'ITEM-1' });
  const oc = makeOC();
  const imp = makeImportacion({ estado: 'recibido', items: [
    { id: 'IMPITEM-1', itemOCId: 'OCITEM-1', articuloId: 'ART-1', articuloCodigo: 'G1312-60067',
      descripcion: 'Columna', cantidadPedida: 1, cantidadRecibida: 1, unidadMedida: 'unidad', requerimientoId: 'REQ-001' },
  ] });

  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [req],
    ordenesCompra: [oc],
    importaciones: [imp],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows[0].importacionEstado, 'recibido');
  assert.equal(rows[0].semaforo, 'entregado', 'recibido → entregado (no rojo)');
});

test('[ENT-06] item sin requerimiento (stock available) sigue mostrando row (sin cadena req/oc/imp)', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-S', disponibilidad: 'stock', etaDiasEstimados: 2 })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].disponibilidad, 'stock');
  assert.equal(rows[0].requerimientoId, null);
  assert.equal(rows[0].ocNumero, null);
  assert.equal(rows[0].importacionId, null);
  // etaDiasEstimados=2, fechaAceptacion=2026-05-15 → eta=2026-05-17 → diasRestantes=-15 → rojo
  assert.equal(rows[0].semaforo, 'rojo');
});

test('[ENT-07] parte tipeada a mano (con N° de parte, sin artículo de stock ni req) SE MUESTRA', () => {
  // Caso P1-005035-01 (2026-08-13): el presupuesto tenía 2 artículos y el visor
  // mostraba 1. El criterio viejo exigía stockArticuloId o requerimiento, así
  // que una parte cargada a mano —física, hay que entregarla— desaparecía.
  const ppto = makePresupuestoBase({
    items: [
      makeItem({ id: 'ITEM-CAT', codigoProducto: 'G1530-67950' }),
      makeItem({
        id: 'ITEM-MANO',
        descripcion: 'Sello de fase reversa',
        codigoProducto: '5062-8587',
        stockArticuloId: null,
      }),
    ],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows.length, 2, 'los DOS artículos del presupuesto tienen que aparecer');
  assert.deepEqual(rows.map(r => r.codigoProducto), ['G1530-67950', '5062-8587'],
    'la columna Código sale del N° de parte del presupuesto');
});

test('[ENT-08] los servicios siguen fuera del visor (se coordinan en la agenda)', () => {
  const ppto = makePresupuestoBase({
    items: [
      makeItem({ id: 'ITEM-PARTE', codigoProducto: 'G1530-67950' }),
      // Concepto de servicio: sin artículo, sin código, con FK al catálogo.
      makeItem({
        id: 'ITEM-SERV', descripcion: 'Mano de obra de instalación', unidad: 'hora',
        stockArticuloId: null, codigoProducto: null, conceptoServicioId: 'CS-1',
      }),
      // Item de contrato (P5): identificado por servicioCode.
      makeItem({
        id: 'ITEM-CONTRATO', descripcion: 'Mantenimiento preventivo anual',
        stockArticuloId: null, codigoProducto: null, servicioCode: 'MP1_CN_60',
      }),
    ],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.deepEqual(rows.map(r => r.itemId), ['ITEM-PARTE'],
    'solo la parte física entra a Entregas');
});

test('[ENT-10] el stock de HOY viaja por fila, sin depender de la disponibilidad congelada', () => {
  // Caso 5183-2067 (2026-08-13): el ítem quedó marcado `disponibilidad: stock`
  // al presupuestar y ahí se congeló; meses después no hay unidades y el visor
  // seguía prometiendo entrega. Ahora la fila trae los números reales.
  const ppto = makePresupuestoBase({
    id: 'PPTO-1',
    items: [makeItem({ id: 'ITEM-1', disponibilidad: 'stock', cantidad: 3, stockArticuloId: 'ART-1' })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    stockLibrePorArticulo: new Map([['ART-1', 2]]),
    stockReservadoPorPptoArticulo: new Map([['PPTO-1:ART-1', 1]]),
    now: FIXTURE_NOW,
  });
  assert.equal(rows[0].disponibilidad, 'stock', 'la promesa original no se toca');
  assert.equal(rows[0].stockReservado, 1);
  assert.equal(rows[0].stockLibre, 2);
  assert.equal(rows[0].stockArticuloId, 'ART-1');
});

test('[ENT-11] sin mapas de stock (o ítem sin artículo) las columnas quedan en 0', () => {
  const ppto = makePresupuestoBase({ items: [makeItem({ id: 'ITEM-1', disponibilidad: 'stock' })] });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows[0].stockReservado, 0);
  assert.equal(rows[0].stockLibre, 0);
});

test('[ENT-12] item cotizado por envase: la comparación de stock va en unidades base', () => {
  // Fase 3 presentaciones (2026-08-13): 2 envases de 10 comprometen 20 unidades
  // del pool. Si la fila comparara los 2 envases contra el stock, un artículo
  // con 5 unidades pareceria cubierto.
  const ppto = makePresupuestoBase({
    id: 'PPTO-1',
    items: [makeItem({
      id: 'ITEM-1', cantidad: 2, disponibilidad: 'stock', stockArticuloId: 'ART-1',
      presentacion: { codigoParte: '5183-2067', factor: 10 },
    })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    stockLibrePorArticulo: new Map([['ART-1', 5]]),
    now: FIXTURE_NOW,
  });
  assert.equal(rows[0].cantidad, 2, 'la cantidad cotizada se muestra tal cual (envases)');
  assert.equal(rows[0].cantidadBase, 20, '2 envases de 10 = 20 unidades base');
  assert.equal(rows[0].presentacionCodigo, '5183-2067');
  assert.ok(rows[0].stockLibre < rows[0].cantidadBase, 'con 5 en estante NO alcanza');
});

test('[ENT-09] sin código propio, la columna cae al código que estampó el requerimiento', () => {
  const ppto = makePresupuestoBase({
    items: [makeItem({ id: 'ITEM-1', codigoProducto: null })],
  });
  const rows = buildEntregaRows({
    presupuestos: [ppto],
    requerimientos: [makeRequerimiento({ presupuestoItemId: 'ITEM-1', articuloCodigo: 'ART-COD-9' })],
    ordenesCompra: [],
    importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].codigoProducto, 'ART-COD-9');
});

// ── ENT-13: bandera de pago anticipado (2026-08-24) ─────────────────────────
// Avisa que hay mercadería que NO se puede entregar hasta que paguen. Acá solo
// se prueba la bandera; que se MUESTRE exige además stock, y eso vive en la fila.
test('[ENT-13] el presupuesto anticipado marca la bandera de pago', () => {
  const armar = (condicionPagoId: string | null, anticipadas?: Set<string>) => buildEntregaRows({
    presupuestos: [makePresupuestoBase({
      items: [makeItem({ id: 'ITEM-1' })],
      condicionPagoId,
    } as never)],
    requerimientos: [], ordenesCompra: [], importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    condicionesAnticipadas: anticipadas,
    now: FIXTURE_NOW,
  });

  assert.equal(armar('cond-ant', new Set(['cond-ant']))[0].pagoAnticipado, true,
    'la condición anticipada marca');
  assert.equal(armar('cond-contado', new Set(['cond-ant']))[0].pagoAnticipado, false,
    'otra condición no marca');
  assert.equal(armar(null, new Set(['cond-ant']))[0].pagoAnticipado, false,
    'sin condición de pago no marca');
  assert.equal(armar('cond-ant')[0].pagoAnticipado, false,
    'sin catálogo cargado no marca — y no rompe');
});

// ── ENT-14: disponibilidad CALCULADA, sin selector (2026-08-24) ─────────────
// Reemplaza al valor congelado al aceptar el presupuesto. Gana lo más
// específico: una importación en curso dice DÓNDE está la mercadería.
test('[ENT-14] la disponibilidad sale del estado real, no de una elección', () => {
  const d = (datos: Parameters<typeof calcularDisponibilidad>[0]) => calcularDisponibilidad(datos);

  // La importación en curso manda sobre todo lo demás.
  assert.equal(d({ importacionEstado: 'embarcado', stockLibre: 99 }).label, 'Embarcada');
  assert.equal(d({ importacionEstado: 'en_transito' }).label, 'En tránsito');
  assert.equal(d({ importacionEstado: 'en_aduana' }).label, 'En aduana');
  assert.equal(d({ importacionEstado: 'despachado' }).label, 'Oficializada');
  assert.equal(d({ importacionEstado: 'preparacion' }).label, 'En preparación');

  // Recibida = la mercadería entró: se mide contra el estante, no el embarque.
  assert.equal(d({ importacionEstado: 'recibido', stockLibre: 5, cantidadBase: 1 }).clave, 'en_stock',
    'importación recibida con stock → En stock');
  assert.equal(d({ importacionEstado: 'recibido', stockLibre: 0, requerimientoId: 'r1' }).clave, 'a_importar',
    'recibida pero sin stock: sigue el requerimiento');
  assert.equal(d({ importacionEstado: 'cancelado', stockLibre: 0 }).clave, 'sin_stock',
    'una importación cancelada no informa nada');

  // Reservado gana sobre stock libre: está y tiene dueño.
  assert.equal(d({ stockReservado: 2, stockLibre: 9, cantidadBase: 2 }).clave, 'reservado');

  // La cantidad importa: no alcanza con que haya "algo".
  assert.equal(d({ stockLibre: 1, cantidadBase: 5 }).clave, 'sin_stock',
    'stock insuficiente no es "en stock"');
  assert.equal(d({ stockLibre: 5, cantidadBase: 5 }).clave, 'en_stock', 'justo alcanza');
  assert.equal(d({ stockReservado: 1, cantidadBase: 5, requerimientoId: 'r1' }).clave, 'a_importar',
    'reserva parcial no cubre: manda la compra en marcha');

  // Sin cantidad declarada se asume 1 — no puede quedar en "sin stock" por un 0.
  assert.equal(d({ stockLibre: 1 }).clave, 'en_stock');

  // Nada de nada: es el caso que hay que mirar.
  assert.equal(d({}).clave, 'sin_stock');
  assert.equal(d({}).tono, 'nada');
  assert.equal(d({ stockLibre: 3, cantidadBase: 1 }).tono, 'ok');
  assert.equal(d({ requerimientoId: 'r1' }).tono, 'camino');
});

// ── ENT-15: sin aceptación no hay entrega (2026-08-24) ──────────────────────
// Caso real: P1-005016-01 llegó a 'finalizado' sin haber pasado nunca por
// aceptado —dato previo al arranque del módulo— y sus tres repuestos figuraban
// como pendientes de entrega sin que nadie entendiera de dónde salían.
test('[ENT-15] un presupuesto nunca aceptado no genera filas de entrega', () => {
  const armar = (fechaAceptacion: string | null) => buildEntregaRows({
    presupuestos: [makePresupuestoBase({
      items: [makeItem({ id: 'ITEM-1' })],
      fechaAceptacion,
    } as never)],
    requerimientos: [], ordenesCompra: [], importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });

  assert.equal(armar(null).length, 0, 'sin fecha de aceptación no hay nada que entregar');
  assert.equal(armar('2026-05-15T10:00:00.000Z').length, 1, 'aceptado sí genera la fila');
});


// ── ENT-16: la OC del CLIENTE, para abrirla desde la grilla (2026-08-24) ─────
// Hay dos formas legítimas de cargarla y mirar una sola deja la mitad de los
// presupuestos diciendo "sin OC" con el papel adjunto ahí mismo.
test('[ENT-16] resolverOCCliente lee la colección Y los adjuntos del presupuesto', () => {
  const mapa = new Map([
    ['OCC-1', { numero: 'O-000100445302', adjuntos: [{ url: 'https://x/oc.pdf', nombre: 'oc.pdf' }] }],
    ['OCC-SIN-ARCHIVO', { numero: 'O-999', adjuntos: [] }],
  ]);

  // 1) Colección `ordenesCompraCliente` — la vía principal (FLOW-02).
  const desdeColeccion = resolverOCCliente({ ordenesCompraIds: ['OCC-1'] }, mapa);
  assert.deepEqual(desdeColeccion, { numero: 'O-000100445302', url: 'https://x/oc.pdf', nombre: 'oc.pdf' });

  // 2) Adjunto del propio presupuesto — la otra vía real.
  const desdeAdjunto = resolverOCCliente({
    ordenCompraNumero: 'O-777',
    adjuntos: [
      { id: 'a1', tipo: 'otro', url: 'https://x/plano.pdf', nombre: 'plano.pdf' },
      { id: 'a2', tipo: 'orden_compra', url: 'https://x/oc-777.pdf', nombre: 'oc-777.pdf' },
    ],
  });
  assert.equal(desdeAdjunto?.url, 'https://x/oc-777.pdf', 'elige el adjunto de tipo orden_compra');
  assert.equal(desdeAdjunto?.numero, 'O-777');

  // Sin número cargado, el adjunto presta su nombre: algo hay que mostrar.
  const sinNumero = resolverOCCliente({
    adjuntos: [{ id: 'a1', tipo: 'orden_compra', url: 'https://x/f.pdf', nombre: 'f.pdf' }],
  });
  assert.equal(sinNumero?.numero, 'f.pdf');

  // 3) Número suelto sin archivo: se muestra igual, apagado.
  assert.deepEqual(resolverOCCliente({ ordenCompraNumero: 'O-555' }), { numero: 'O-555', url: null, nombre: null });

  // Una OC de la colección sin archivo tampoco inventa una URL.
  assert.deepEqual(
    resolverOCCliente({ ordenesCompraIds: ['OCC-SIN-ARCHIVO'] }, mapa),
    { numero: 'O-999', url: null, nombre: null },
  );

  // Un id que no está en el mapa no puede tapar al adjunto que sí existe.
  const idColgado = resolverOCCliente({
    ordenesCompraIds: ['NO-EXISTE'],
    adjuntos: [{ id: 'a1', tipo: 'orden_compra', url: 'https://x/ok.pdf', nombre: 'ok.pdf' }],
  }, mapa);
  assert.equal(idColgado?.url, 'https://x/ok.pdf', 'cae al adjunto en vez de devolver null');

  // 4) Sin nada: null, y la celda no muestra ruido.
  assert.equal(resolverOCCliente({}), null);
  assert.equal(resolverOCCliente({ ordenCompraNumero: '   ' }), null, 'un número en blanco no es una OC');
});

// La fila la lleva puesta: es lo que consume la celda del visor.
test('[ENT-17] buildEntregaRows estampa la OC del cliente en cada fila', () => {
  const rows = buildEntregaRows({
    presupuestos: [makePresupuestoBase({
      items: [makeItem({ id: 'ITEM-1' })],
      ordenesCompraIds: ['OCC-1'],
    } as never)],
    requerimientos: [], ordenesCompra: [], importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    ocClienteById: new Map([['OCC-1', { numero: 'O-123', adjuntos: [{ url: 'https://x/oc.pdf', nombre: 'oc.pdf' }] }]]),
    now: FIXTURE_NOW,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].ocCliente?.numero, 'O-123');
  assert.equal(rows[0].ocCliente?.url, 'https://x/oc.pdf');
  // Sin dirección elegida la fila no inventa una.
  assert.equal(rows[0].direccionEntregaId, null);
  assert.equal(rows[0].direccionEntregaTexto, null);

  // Sin el mapa (o sin OC) la fila sigue existiendo: el visor no depende de esto.
  const sinOC = buildEntregaRows({
    presupuestos: [makePresupuestoBase({ items: [makeItem({ id: 'ITEM-1' })] })],
    requerimientos: [], ordenesCompra: [], importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });
  assert.equal(sinOC[0].ocCliente, null);
});


// ── ENT-18: el destino del ítem viaja en la fila (2026-08-24) ───────────────
// Se guardan el id Y el texto: la dirección se puede corregir o dar de baja
// después, y lo comprometido no puede cambiar retroactivamente.
test('[ENT-18] la dirección de entrega del ítem llega a la fila', () => {
  const rows = buildEntregaRows({
    presupuestos: [makePresupuestoBase({
      items: [makeItem({
        id: 'ITEM-1',
        direccionEntregaId: 'DIR-9',
        direccionEntregaTexto: 'Depósito Pilar — Ruta 8 Km 42, Pilar, Buenos Aires',
      })],
    } as never)],
    requerimientos: [], ordenesCompra: [], importaciones: [],
    clienteNombreById: CLIENTE_NOMBRE_BY_ID,
    now: FIXTURE_NOW,
  });

  assert.equal(rows[0].direccionEntregaId, 'DIR-9');
  assert.match(rows[0].direccionEntregaTexto ?? '', /Dep.sito Pilar/);
});
