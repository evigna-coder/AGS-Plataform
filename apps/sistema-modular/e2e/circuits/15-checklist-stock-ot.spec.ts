import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import type { Page } from '@playwright/test';

/**
 * CIRCUITO 15: Checklist de pruebas del circuito presupuesto/stock/OT/facturación
 * (docs/checklist-pruebas-circuito.html — P0-A, P0-B, P1, P2, P3, P6, P7, P8, P5, P11)
 *
 * Estrategia: seed + asserts vía page.evaluate en el browser AUTENTICADO
 * (las reglas Firestore endurecidas rechazan el client SDK sin auth desde Node).
 * Se llaman los servicios reales del bundle Vite (presupuestosService,
 * reservasService vía aceptar/anular, otService.cerrarAdministrativamente) —
 * exactamente el mismo código que dispara la UI.
 *
 * Los side-effects de aceptar/cerrar son post-commit best-effort → todos los
 * asserts contra Firestore van con expect.poll.
 */

// ─── Estado compartido para cleanup ──────────────────────────
const created = {
  articulos: [] as string[],
  unidades: [] as string[],
  presupuestos: [] as string[],
  ots: [] as string[],          // parents e hijos
  solicitudes: [] as string[],
};

const RUN = timestamp();

// ─── Helpers in-browser ──────────────────────────────────────

/** Crea artículo + N unidades disponibles. Devuelve { articuloId, unidadIds }. */
async function seedArticuloConStock(app: Page, opts: {
  codigo: string; unidades: number; stockMinimo?: number;
  requiereNumeroSerie?: boolean; nroSerie?: string; posId?: string;
}) {
  const r = await app.evaluate(async (o) => {
    const { articulosService, unidadesService } = await import('/src/services/stockService.ts');
    const articuloId = await articulosService.create({
      codigo: o.codigo,
      descripcion: `[E2E] chk ${o.codigo}`,
      categoriaEquipo: 'otros',
      marcaId: '',
      proveedorIds: [],
      tipo: 'repuesto',
      unidadMedida: 'unidad',
      stockMinimo: o.stockMinimo ?? 0,
      requiereNumeroSerie: o.requiereNumeroSerie ?? false,
      requiereNumeroLote: false,
      activo: true,
    } as any);
    const unidadIds: string[] = [];
    for (let i = 0; i < o.unidades; i++) {
      const id = await unidadesService.create({
        articuloId,
        articuloCodigo: o.codigo,
        articuloDescripcion: `[E2E] chk ${o.codigo}`,
        condicion: 'nuevo',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: o.posId ?? 'e2e-pos-chk', referenciaNombre: '[E2E] Depósito chk' },
        ...(o.nroSerie ? { nroSerie: `${o.nroSerie}-${i + 1}` } : {}),
        activo: true,
      } as any);
      unidadIds.push(id);
    }
    return { articuloId, unidadIds };
  }, opts);
  created.articulos.push(r.articuloId);
  created.unidades.push(...r.unidadIds);
  return r;
}

/** Crea un presupuesto vía presupuestosService.create. Devuelve { id, numero }. */
async function crearPpto(app: Page, opts: {
  tipo: 'servicio' | 'partes' | 'mixto';
  items: Array<Record<string, unknown>>;
}) {
  const r = await app.evaluate(async (o) => {
    const { presupuestosService } = await import('/src/services/presupuestosService.ts');
    const subtotal = (o.items as any[]).reduce((s, it) => s + (it.subtotal as number ?? 0), 0);
    return await presupuestosService.create({
      clienteId: 'e2e-cliente-chk',
      clienteNombre: '[E2E] Cliente Checklist',
      titulo: `[E2E] chk ppto ${o.tipo}`,
      tipo: o.tipo,
      estado: 'enviado',
      items: o.items,
      subtotal,
      total: subtotal,
      moneda: 'USD',
      validezDias: 15,
      ordenesCompraIds: [],
      adjuntos: [],
    } as any);
  }, opts);
  created.presupuestos.push(r.id);
  return r;
}

function itemParte(articuloId: string, cantidad: number, extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    descripcion: `[E2E] item parte ${RUN}`,
    cantidad,
    unidad: 'unidad',
    precioUnitario: 100,
    subtotal: 100 * cantidad,
    stockArticuloId: articuloId,
    ...extra,
  };
}

async function aceptarPpto(app: Page, id: string) {
  await app.evaluate(async (pid) => {
    const { presupuestosService } = await import('/src/services/presupuestosService.ts');
    await presupuestosService.update(pid, { estado: 'aceptado' } as any);
  }, id);
}

async function anularPpto(app: Page, id: string) {
  await app.evaluate(async (pid) => {
    const { presupuestosService } = await import('/src/services/presupuestosService.ts');
    await presupuestosService.update(pid, { estado: 'anulado' } as any);
  }, id);
}

/** Estados actuales de un set de unidades: { unidadId: estado }. */
async function estadosUnidades(app: Page, unidadIds: string[]) {
  return app.evaluate(async (ids) => {
    const { unidadesService } = await import('/src/services/stockService.ts');
    const out: Record<string, string | null> = {};
    for (const id of ids) {
      const u = await unidadesService.getById(id);
      out[id] = u ? (u as any).estado : null;
    }
    return out;
  }, unidadIds);
}

/** Movimientos egreso de una unidad. */
async function egresosDeUnidad(app: Page, unidadId: string) {
  return app.evaluate(async (id) => {
    const { movimientosService } = await import('/src/services/stockService.ts');
    const movs = await movimientosService.getAll({ unidadId: id, tipo: 'egreso' });
    return movs.map((m: any) => ({ id: m.id, otNumber: m.otNumber ?? null, cantidad: m.cantidad }));
  }, unidadId);
}

/** Crea OT parent vía otService (auto-crea child .01). Devuelve { parent, child }. */
async function crearOT(app: Page, opts: { budgets: string[]; presupuestoOrigenId?: string }) {
  const r = await app.evaluate(async (o) => {
    const { ordenesTrabajoService } = await import('/src/services/otService.ts');
    const otNumber = await ordenesTrabajoService.getNextOtNumber();
    await ordenesTrabajoService.create({
      otNumber,
      budgets: o.budgets,
      clienteId: 'e2e-cliente-chk',
      razonSocial: '[E2E] Cliente Checklist',
      tipoOT: 'entrega',
      estadoAdmin: 'CREADA',
    } as any);
    return { parent: otNumber, child: `${otNumber}.01` };
  }, opts);
  created.ots.push(r.parent, r.child);
  return r;
}

async function cerrarOT(app: Page, otNumber: string) {
  return app.evaluate(async (ot) => {
    const { ordenesTrabajoService } = await import('/src/services/otService.ts');
    return await ordenesTrabajoService.cerrarAdministrativamente(ot, {}, { uid: 'e2e', name: '[E2E] runner' });
  }, otNumber);
}

async function getPpto(app: Page, id: string) {
  return app.evaluate(async (pid) => {
    const { presupuestosService } = await import('/src/services/presupuestosService.ts');
    const p: any = await presupuestosService.getById(pid);
    return p ? {
      estado: p.estado,
      otsVinculadasNumbers: p.otsVinculadasNumbers ?? [],
      otsListasParaFacturar: p.otsListasParaFacturar ?? [],
      facturacionEstado: p.facturacionEstado ?? null,
    } : null;
  }, id);
}

/** La page compartida a veces pierde la app (crash/reload) — re-cargarla. */
async function ensureApp(app: Page) {
  const ok = await app.evaluate(() => typeof (window as any).__ags !== 'undefined').catch(() => false);
  if (!ok) {
    await app.goto('http://localhost:3001');
    await app.locator('aside nav').waitFor({ timeout: 30_000 });
    await app.waitForTimeout(1000);
  }
}

/** Query genérica vía window.__ags (dev-only, browser autenticado). */
async function queryDocs(app: Page, params: { col: string; field: string; op: string; value: unknown }) {
  return app.evaluate(async (p) => {
    const ags = (window as any).__ags;
    const { collection, query, where, getDocs } = ags.firestore;
    const snap = await getDocs(query(collection(ags.db, p.col), where(p.field, p.op, p.value)));
    return snap.docs.map((d: any) => ({ id: d.id, ...JSON.parse(JSON.stringify(d.data())) }));
  }, params);
}

// ═════════════════════════════════════════════════════════════

test.describe('Circuito 15: Checklist stock/OT/facturación (P0-P11)', () => {
  // sin mode:'serial' — cada test seedea sus propios datos; un fallo no debe
  // abortar el resto del checklist (corren igual en orden, worker único)
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => { /* la page compartida se carga en el primer test via nav */ });

  test('15.00 — app cargada y __ags disponible', async ({ app, nav }) => {
    await nav.ensureLoaded();
    const hasAgs = await app.evaluate(() => typeof (window as any).__ags !== 'undefined');
    expect(hasAgs, 'window.__ags no disponible — ¿dev server no está en modo DEV?').toBe(true);
  });

  // ── P0-A · Anular presupuesto libera reservas ──────────────
  test('15.01 — P0-A: aceptar reserva, anular libera (reservado → disponible)', async ({ app }) => {
    const { articuloId, unidadIds } = await seedArticuloConStock(app, { codigo: `E2E-CHK-P0A-${RUN}`, unidades: 1 });
    const ppto = await crearPpto(app, { tipo: 'partes', items: [itemParte(articuloId, 1)] });

    await aceptarPpto(app, ppto.id);
    await expect.poll(async () => (await estadosUnidades(app, unidadIds))[unidadIds[0]],
      { timeout: 30_000, message: 'la unidad no pasó a reservado al aceptar' }).toBe('reservado');

    await anularPpto(app, ppto.id);
    await expect.poll(async () => (await estadosUnidades(app, unidadIds))[unidadIds[0]],
      { timeout: 30_000, message: 'FIX bug 1: la unidad no volvió a disponible al anular' }).toBe('disponible');
  });

  // ── P2 + P0-B · Ciclo completo con OT + no doble descuento ─
  test('15.02 — P2: aceptar→reserva, cierre admin→entregado + 1 egreso', async ({ app }) => {
    const { articuloId, unidadIds } = await seedArticuloConStock(app, { codigo: `E2E-CHK-P2-${RUN}`, unidades: 1 });
    const ppto = await crearPpto(app, { tipo: 'partes', items: [itemParte(articuloId, 1)] });

    await aceptarPpto(app, ppto.id);
    await expect.poll(async () => (await estadosUnidades(app, unidadIds))[unidadIds[0]], { timeout: 30_000 }).toBe('reservado');

    const ot = await crearOT(app, { budgets: [ppto.numero] });
    await cerrarOT(app, ot.child);

    await expect.poll(async () => (await estadosUnidades(app, unidadIds))[unidadIds[0]],
      { timeout: 30_000, message: 'la unidad reservada no pasó a entregado al cerrar la OT' }).toBe('entregado');
    await expect.poll(async () => (await egresosDeUnidad(app, unidadIds[0])).length, { timeout: 30_000 }).toBe(1);

    // ppto habilitado para facturar
    await expect.poll(async () => (await getPpto(app, ppto.id))?.otsListasParaFacturar ?? [], { timeout: 30_000 })
      .toContain(ot.child);

    // P0-B: reintentar el cierre NO debe duplicar el egreso (guard stockDeducido)
    await cerrarOT(app, ot.child);
    await app.waitForTimeout(4000); // dar tiempo a que el post-commit (si corriera) escriba
    const egresos = await egresosDeUnidad(app, unidadIds[0]);
    expect(egresos.length, 'FIX bug 2: el re-cierre generó un segundo egreso de stock').toBe(1);

    // Guard de re-entrada (fix 2026-07-14): el re-cierre tampoco duplica el aviso
    // de facturación (mailQueue) ni el ticket admin.
    const mails = await queryDocs(app, { col: 'mailQueue', field: 'data.otNumber', op: '==', value: ot.child });
    expect(mails.length, 'el re-cierre duplicó el aviso de facturación (mailQueue)').toBe(1);
    const tickets = await queryDocs(app, { col: 'leads', field: 'otIds', op: 'array-contains', value: ot.child });
    expect(tickets.length, 'el re-cierre duplicó el ticket admin de cierre').toBe(1);
  });

  // ── P1 · Presupuesto de servicios + 3 OTs vinculadas ───────
  test('15.03 — P1: ppto servicio + 3 OTs quedan en otsVinculadasNumbers', async ({ app }) => {
    const ppto = await crearPpto(app, {
      tipo: 'servicio',
      items: [{ id: crypto.randomUUID(), descripcion: `[E2E] servicio ${RUN}`, cantidad: 1, unidad: 'unidad', precioUnitario: 500, subtotal: 500 }],
    });
    await aceptarPpto(app, ppto.id);

    const ots: string[] = [];
    for (let i = 0; i < 3; i++) {
      const ot = await crearOT(app, { budgets: [] });
      // vínculo bidireccional — mismo service que usa el hook de creación de OT
      await app.evaluate(async (p) => {
        const { ordenesTrabajoService } = await import('/src/services/otService.ts');
        await ordenesTrabajoService.vincularPresupuesto(p.ot, p.numero);
      }, { ot: ot.parent, numero: ppto.numero });
      ots.push(ot.parent);
    }

    await expect.poll(async () => {
      const p = await getPpto(app, ppto.id);
      return ots.filter(o => (p?.otsVinculadasNumbers ?? []).includes(o)).length;
    }, { timeout: 30_000, message: 'las 3 OTs no quedaron vinculadas al ppto' }).toBe(3);
  });

  // ── P3 · Partes SIN stock → requerimiento condicional ──────
  test('15.04 — P3: aceptar sin stock crea RequerimientoCompra condicional y no bloquea', async ({ app }) => {
    const { articuloId } = await seedArticuloConStock(app, { codigo: `E2E-CHK-P3-${RUN}`, unidades: 0 });
    const ppto = await crearPpto(app, {
      tipo: 'partes',
      items: [itemParte(articuloId, 2, { itemRequiereImportacion: true })],
    });

    await aceptarPpto(app, ppto.id);

    await expect.poll(async () => {
      const p = await app.evaluate(async (pid) => {
        const { presupuestosService } = await import('/src/services/presupuestosService.ts');
        const pres: any = await presupuestosService.getById(pid);
        return pres?.estado;
      }, ppto.id);
      return p;
    }, { timeout: 20_000, message: 'la aceptación quedó bloqueada' }).toBe('aceptado');

    await expect.poll(async () => {
      const reqs = await queryDocs(app, { col: 'requerimientos_compra', field: 'presupuestoId', op: '==', value: ppto.id });
      return reqs.filter((r: any) => r.condicional === true).length;
    }, { timeout: 30_000, message: 'no se creó el requerimiento condicional' }).toBeGreaterThanOrEqual(1);
  });

  // ── P6 · Stock parcial: pide 5, hay 2 ──────────────────────
  test('15.05 — P6: reserva las 2 disponibles + requerimiento por el faltante', async ({ app }) => {
    const { articuloId, unidadIds } = await seedArticuloConStock(app, { codigo: `E2E-CHK-P6-${RUN}`, unidades: 2, stockMinimo: 1 });
    const ppto = await crearPpto(app, { tipo: 'partes', items: [itemParte(articuloId, 5)] });

    await aceptarPpto(app, ppto.id);

    await expect.poll(async () => {
      const est = await estadosUnidades(app, unidadIds);
      return Object.values(est).filter(e => e === 'reservado').length;
    }, { timeout: 30_000, message: 'no se reservaron las 2 unidades disponibles' }).toBe(2);

    // Semántica real (presupuestosService L1167 / L287): compra el faltante MÁS la
    // reposición a stockMinimo → max(stockMinimo - (disp - pedido), pedido - disp)
    // = max(1 - (2-5), 5-2) = 4. El checklist esperaba 3 (solo faltante); el sistema
    // pide 4 para terminar con 1 en stock (= mínimo). Cubre el faltante ✓.
    await expect.poll(async () => {
      const reqs = await queryDocs(app, { col: 'requerimientos_compra', field: 'presupuestoId', op: '==', value: ppto.id });
      const noCond = reqs.filter((r: any) => r.condicional !== true);
      return noCond.length > 0 ? noCond[0].cantidad : -1;
    }, { timeout: 30_000, message: 'no se creó requerimiento por el faltante' }).toBe(4);
  });

  // ── P6-bis · mismo caso con stockMinimo=0 (gap conocido?) ──
  test('15.06 — P6-bis: pide 5 hay 2 con stockMinimo=0 — ¿requerimiento por faltante?', async ({ app }) => {
    const { articuloId, unidadIds } = await seedArticuloConStock(app, { codigo: `E2E-CHK-P6B-${RUN}`, unidades: 2, stockMinimo: 0 });
    const ppto = await crearPpto(app, { tipo: 'partes', items: [itemParte(articuloId, 5)] });
    await aceptarPpto(app, ppto.id);

    await expect.poll(async () => {
      const est = await estadosUnidades(app, unidadIds);
      return Object.values(est).filter(e => e === 'reservado').length;
    }, { timeout: 30_000 }).toBe(2);

    // Con stockMinimo=0: max(0 - (2-5), 5-2) = 3 — solo el faltante.
    await expect.poll(async () => {
      const reqs = await queryDocs(app, { col: 'requerimientos_compra', field: 'presupuestoId', op: '==', value: ppto.id });
      const noCond = reqs.filter((r: any) => r.condicional !== true);
      return noCond.length > 0 ? noCond[0].cantidad : -1;
    }, { timeout: 30_000, message: 'no se creó requerimiento por el faltante (stockMinimo=0)' }).toBe(3);
  });

  // ── P7 · Selección manual al cierre (serie + posición) ─────
  test('15.07 — P7: cierre con selección manual — trazable por unidad + no-trazable por posición', async ({ app }) => {
    const posId = `e2e-pos-p7-${RUN}`;
    const serie = await seedArticuloConStock(app, { codigo: `E2E-CHK-P7S-${RUN}`, unidades: 1, requiereNumeroSerie: true, nroSerie: `E2E-SN-${RUN}`, posId });
    const simple = await seedArticuloConStock(app, { codigo: `E2E-CHK-P7P-${RUN}`, unidades: 1, posId });

    const ot = await crearOT(app, { budgets: [] });
    await app.evaluate(async (p) => {
      const { ordenesTrabajoService } = await import('/src/services/otService.ts');
      await ordenesTrabajoService.update(p.ot, {
        cierreAdmin: {
          stockSelections: [
            {
              partId: p.serieArt, partCodigo: 'E2E-P7S', partDescripcion: '[E2E] p7 serie', cantidad: 1,
              origenTipo: 'posicion', origenId: p.posId, origenNombre: '[E2E] Depósito chk',
              unidadStockId: p.serieUnidad, nroSerie: 'E2E-SN',
            },
            {
              partId: p.simpleArt, partCodigo: 'E2E-P7P', partDescripcion: '[E2E] p7 posicion', cantidad: 1,
              origenTipo: 'posicion', origenId: p.posId, origenNombre: '[E2E] Depósito chk',
              articuloId: p.simpleArt,
            },
          ],
        },
      } as any);
    }, { ot: ot.child, serieArt: serie.articuloId, serieUnidad: serie.unidadIds[0], simpleArt: simple.articuloId, posId });

    await cerrarOT(app, ot.child);

    await expect.poll(async () => (await estadosUnidades(app, [serie.unidadIds[0]]))[serie.unidadIds[0]],
      { timeout: 30_000, message: 'unidad trazable no descontada' }).toBe('entregado');
    await expect.poll(async () => {
      const est = (await estadosUnidades(app, [simple.unidadIds[0]]))[simple.unidadIds[0]];
      return est === 'entregado' || est === 'consumido' ? 'descontada' : est;
    }, { timeout: 30_000, message: 'unidad no-trazable (por posición) no descontada' }).toBe('descontada');

    const eg1 = await egresosDeUnidad(app, serie.unidadIds[0]);
    const eg2 = await egresosDeUnidad(app, simple.unidadIds[0]);
    expect(eg1.length, 'egreso de la unidad trazable').toBe(1);
    expect(eg2.length, 'egreso de la unidad por posición').toBe(1);
  });

  // ── P8 · Reservada + seleccionada a mano → 1 solo descuento ─
  test('15.08 — P8: unidad reservada Y seleccionada a mano no se descuenta dos veces', async ({ app }) => {
    const posId = `e2e-pos-p8-${RUN}`;
    const { articuloId, unidadIds } = await seedArticuloConStock(app, { codigo: `E2E-CHK-P8-${RUN}`, unidades: 1, posId });
    const ppto = await crearPpto(app, { tipo: 'partes', items: [itemParte(articuloId, 1)] });
    await aceptarPpto(app, ppto.id);
    await expect.poll(async () => (await estadosUnidades(app, unidadIds))[unidadIds[0]], { timeout: 30_000 }).toBe('reservado');

    const ot = await crearOT(app, { budgets: [ppto.numero] });
    await app.evaluate(async (p) => {
      const { ordenesTrabajoService } = await import('/src/services/otService.ts');
      await ordenesTrabajoService.update(p.ot, {
        cierreAdmin: {
          stockSelections: [{
            partId: p.articuloId, partCodigo: 'E2E-P8', partDescripcion: '[E2E] p8', cantidad: 1,
            origenTipo: 'posicion', origenId: p.posId, origenNombre: '[E2E] Depósito chk',
            unidadStockId: p.unidadId,
          }],
        },
      } as any);
    }, { ot: ot.child, articuloId, unidadId: unidadIds[0], posId });

    await cerrarOT(app, ot.child);

    await expect.poll(async () => (await estadosUnidades(app, unidadIds))[unidadIds[0]], { timeout: 30_000 }).toBe('entregado');
    await app.waitForTimeout(4000);
    const egresos = await egresosDeUnidad(app, unidadIds[0]);
    expect(egresos.length, 'la unidad reservada + seleccionada a mano generó doble egreso').toBe(1);
  });

  // ── P5 · Multi-OT: cada cierre habilita facturación, sin pisarse ─
  test('15.09 — P5: 2 OTs del mismo ppto — ambas quedan listas para facturar al cerrar', async ({ app }) => {
    await ensureApp(app);
    const ppto = await crearPpto(app, {
      tipo: 'servicio',
      items: [{ id: crypto.randomUUID(), descripcion: `[E2E] servicio p5 ${RUN}`, cantidad: 1, unidad: 'unidad', precioUnitario: 1000, subtotal: 1000 }],
    });
    await aceptarPpto(app, ppto.id);
    // localizar reversión de estado: el accept debe persistir ANTES de las OTs
    await expect.poll(async () => (await getPpto(app, ppto.id))?.estado,
      { timeout: 20_000, message: 'el accept no persistió estado=aceptado (ppto servicio)' }).toBe('aceptado');

    const ot1 = await crearOT(app, { budgets: [ppto.numero] });
    const ot2 = await crearOT(app, { budgets: [ppto.numero] });
    console.log(`[15.09] estado post-crear OTs: ${(await getPpto(app, ppto.id))?.estado}`);

    await cerrarOT(app, ot1.child);
    await expect.poll(async () => (await getPpto(app, ppto.id))?.otsListasParaFacturar ?? [], { timeout: 30_000 }).toContain(ot1.child);
    console.log(`[15.09] estado post-cierre OT1: ${(await getPpto(app, ppto.id))?.estado}`);

    await cerrarOT(app, ot2.child);
    await expect.poll(async () => {
      const listas = (await getPpto(app, ppto.id))?.otsListasParaFacturar ?? [];
      return listas.includes(ot1.child) && listas.includes(ot2.child);
    }, { timeout: 30_000, message: 'el segundo cierre pisó/omitió la primera OT en otsListasParaFacturar' }).toBe(true);

    // Regresión del bug PRESUPUESTO_ESTADO_MIGRATION sin 'pendiente_facturacion':
    // el doc quedaba bien en Firestore pero migrateEstado() lo leía como 'borrador'.
    const p = await getPpto(app, ppto.id);
    expect(p?.estado, 'el ppto no pasó a pendiente_facturacion').toBe('pendiente_facturacion');

    // aviso a facturación (mailQueue) por cada cierre
    for (const ot of [ot1.child, ot2.child]) {
      const mails = await queryDocs(app, { col: 'mailQueue', field: 'data.otNumber', op: '==', value: ot });
      expect(mails.length, `sin aviso de facturación (mailQueue) para OT ${ot}`).toBeGreaterThanOrEqual(1);
    }
  });

  // ── P11 · Presupuesto adicional desde OT existente ─────────
  test('15.10 — P11: ppto adicional desde OT — vínculo bidireccional sin duplicados', async ({ app }) => {
    await ensureApp(app);
    const ot = await crearOT(app, { budgets: [] });

    // mismo camino que CreatePresupuestoModal con origenTipo:'ot'
    const mkPpto = async () => {
      const r = await app.evaluate(async (o) => {
        const { presupuestosService } = await import('/src/services/presupuestosService.ts');
        const { ordenesTrabajoService } = await import('/src/services/otService.ts');
        const res = await presupuestosService.create({
          clienteId: 'e2e-cliente-chk',
          clienteNombre: '[E2E] Cliente Checklist',
          titulo: '[E2E] chk ppto adicional desde OT',
          tipo: 'servicio',
          estado: 'borrador',
          origenTipo: 'ot', origenId: o.ot, origenRef: `OT-${o.ot}`,
          items: [], subtotal: 0, total: 0, moneda: 'USD', validezDias: 15,
          ordenesCompraIds: [], adjuntos: [],
        } as any);
        await ordenesTrabajoService.vincularPresupuesto(o.ot, res.numero);
        return res;
      }, { ot: ot.parent });
      created.presupuestos.push(r.id);
      return r;
    };

    const p1 = await mkPpto();
    const p2 = await mkPpto();

    const reporte = await app.evaluate(async (o) => {
      const { ordenesTrabajoService } = await import('/src/services/otService.ts');
      const parent: any = await ordenesTrabajoService.getByOtNumber(o.parent);
      const child: any = await ordenesTrabajoService.getByOtNumber(o.child);
      return { parentBudgets: parent?.budgets ?? [], childBudgets: child?.budgets ?? [] };
    }, ot);

    for (const b of [p1.numero, p2.numero]) {
      expect(reporte.parentBudgets, `ppto ${b} no quedó en budgets del parent`).toContain(b);
      expect(reporte.childBudgets, `ppto ${b} no quedó en budgets del item .01`).toContain(b);
    }
    // sin duplicados
    expect(new Set(reporte.parentBudgets).size).toBe(reporte.parentBudgets.length);

    for (const p of [p1, p2]) {
      const pp = await getPpto(app, p.id);
      expect(pp?.otsVinculadasNumbers, `OT no quedó en otsVinculadasNumbers de ${p.numero}`).toContain(ot.parent);
    }
  });

  // ── P10 · Anular solicitud por OTs devuelve las OTs a facturables ─
  test('15.11 — P10: anular solicitud generada por OTs restaura otsListasParaFacturar', async ({ app }) => {
    await ensureApp(app);
    const ppto = await crearPpto(app, {
      tipo: 'servicio',
      items: [{ id: crypto.randomUUID(), descripcion: `[E2E] servicio p10 ${RUN}`, cantidad: 1, unidad: 'unidad', precioUnitario: 700, subtotal: 700 }],
    });
    await aceptarPpto(app, ppto.id);
    await expect.poll(async () => (await getPpto(app, ppto.id))?.estado, { timeout: 20_000 }).toBe('aceptado');

    const ot = await crearOT(app, { budgets: [ppto.numero] });
    await cerrarOT(app, ot.child);
    await expect.poll(async () => (await getPpto(app, ppto.id))?.otsListasParaFacturar ?? [], { timeout: 30_000 }).toContain(ot.child);

    // generar la solicitud por OTs (camino legacy, mismo service que la UI)
    const solicitudId = await app.evaluate(async (p) => {
      const { presupuestosService } = await import('/src/services/presupuestosService.ts');
      const { solicitudId } = await presupuestosService.generarAvisoFacturacion(
        p.pptoId, [p.ot], {}, { uid: 'e2e', name: '[E2E] runner' },
      );
      return solicitudId;
    }, { pptoId: ppto.id, ot: ot.child });
    created.solicitudes.push(solicitudId);

    // la OT sale de la lista al generar la solicitud
    await expect.poll(async () => (await getPpto(app, ppto.id))?.otsListasParaFacturar ?? [], { timeout: 20_000 })
      .not.toContain(ot.child);

    // anular la solicitud → la OT debe VOLVER a la lista (fix P10 2026-07-14)
    await app.evaluate(async (sid) => {
      const { facturacionService } = await import('/src/services/facturacionService.ts');
      await facturacionService.update(sid, { estado: 'anulada' } as any);
    }, solicitudId);

    await expect.poll(async () => (await getPpto(app, ppto.id))?.otsListasParaFacturar ?? [],
      { timeout: 30_000, message: 'P10: la OT no volvió a otsListasParaFacturar al anular la solicitud' })
      .toContain(ot.child);
  });

  // ── Cleanup ────────────────────────────────────────────────
  test('15.99 — cleanup de datos [E2E] del circuito 15', async ({ app }) => {
    await ensureApp(app);
    const summary = await app.evaluate(async (c) => {
      const ags = (window as any).__ags;
      const { collection, query, where, getDocs, doc, deleteDoc } = ags.firestore;
      let deleted = 0;
      const del = async (col: string, id: string) => { await deleteDoc(doc(ags.db, col, id)); deleted++; };

      for (const id of c.unidades) await del('unidades', id).catch(() => {});
      for (const id of c.articulos) await del('articulos', id).catch(() => {});

      // movimientos de las unidades del run
      for (const uid of c.unidades) {
        const snap = await getDocs(query(collection(ags.db, 'movimientosStock'), where('unidadId', '==', uid)));
        for (const d of snap.docs) await del('movimientosStock', d.id).catch(() => {});
      }
      // requerimientos + tickets + mailQueue + pendingActions de los pptos del run
      for (const pid of c.presupuestos) {
        for (const col of ['requerimientos_compra']) {
          const snap = await getDocs(query(collection(ags.db, col), where('presupuestoId', '==', pid)));
          for (const d of snap.docs) await del(col, d.id).catch(() => {});
        }
        const leads = await getDocs(query(collection(ags.db, 'leads'), where('presupuestosIds', 'array-contains', pid)));
        for (const d of leads.docs) await del('leads', d.id).catch(() => {});
        await del('presupuestos', pid).catch(() => {});
      }
      for (const ot of c.ots) {
        const mails = await getDocs(query(collection(ags.db, 'mailQueue'), where('data.otNumber', '==', ot)));
        for (const d of mails.docs) await del('mailQueue', d.id).catch(() => {});
        const leads = await getDocs(query(collection(ags.db, 'leads'), where('otIds', 'array-contains', ot)));
        for (const d of leads.docs) await del('leads', d.id).catch(() => {});
        await del('reportes', ot).catch(() => {});
      }
      for (const id of c.solicitudes) await del('solicitudesFacturacion', id).catch(() => {});
      return { deleted };
    }, created);
    console.log(`[15.99] cleanup: ${summary.deleted} docs borrados`);
    expect(summary.deleted).toBeGreaterThan(0);
  });
});
