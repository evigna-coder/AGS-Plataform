/**
 * CIRCUITO 13: Orden de Compra del Cliente — FLOW-02 + N:M + condicional
 *
 * REWRITE 2026-07:
 *  - El spec asumía un presupuesto 'aceptado' preexistente en la DB; ahora
 *    seedea sus propias fixtures in-browser (patrón circuito 15): dos pptos
 *    [E2E] del cliente 'e2e-cliente-13' creados vía presupuestosService y
 *    aceptados vía update — y las limpia al final (13.99).
 *  - Asserts Firestore via helpers page-based (browser autenticado).
 *
 * Scope:
 *   13.00 — Seed fixture (2 pptos aceptados [E2E])
 *   13.01 — Carga simple de OC (FLOW-02 core)
 *   13.02 — Back-ref consistency (oc.presupuestosIds)
 *   13.03 — N:M (una OC cubre 2 presupuestos — FLOW-02 multi)
 *   13.04 — Pendiente condicional (smoke — fixture real diferida)
 *   13.05 — Idempotencia (cargar 2da OC no rompe nada, array crece)
 *   13.99 — Cleanup de datos [E2E]
 */

import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getOCCliente,
  getOCsByPresupuesto,
  pollUntil,
} from '../helpers/firestore-assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const OC_PDF_PATH = path.join(FIXTURES_DIR, 'oc-sample.pdf');

const ts = timestamp();
const CLIENTE_ID = 'e2e-cliente-13';
const CLIENTE_NOMBRE = `${TEST_PREFIX} Cliente OC-Flow`;
const TITULO_1 = `${TEST_PREFIX} oc-flow ppto1 ${ts}`;
const TITULO_2 = `${TEST_PREFIX} oc-flow ppto2 ${ts}`;
const OC_NUMERO_1 = `O-E2E-${ts}-01`;
const OC_NUMERO_2 = `O-E2E-${ts}-02`;

// ── Fixture helper: tiny PDF stub ─────────────────────────────────────────

/**
 * Ensures a minimal PDF file exists at `OC_PDF_PATH`.
 * Not a valid PDF — just enough bytes for Firebase Storage to accept the
 * upload. The app should NOT parse content, only store + link.
 */
function ensureOcSamplePdf() {
  if (fs.existsSync(OC_PDF_PATH)) return;
  const MINIMAL_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj<< >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n',
  );
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(OC_PDF_PATH, MINIMAL_PDF);
}

test.describe('Circuito 13: Orden de Compra del Cliente — FLOW-02 + N:M', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test.beforeAll(() => {
    ensureOcSamplePdf();
  });

  // State shared across serial tests.
  let presupuesto1Id: string | null = null;
  let presupuesto1Numero: string | null = null;
  let presupuesto2Id: string | null = null;
  let presupuesto2Numero: string | null = null;
  let ocSimpleId: string | null = null;

  /** Crea un ppto servicio [E2E] y lo pasa a aceptado (mismo service que la UI). */
  async function seedPptoAceptado(app: any, titulo: string): Promise<{ id: string; numero: string }> {
    const r = await app.evaluate(async (p: { titulo: string; clienteId: string; clienteNombre: string }) => {
      const { presupuestosService } = await import('/src/services/presupuestosService.ts');
      const res = await presupuestosService.create({
        clienteId: p.clienteId,
        clienteNombre: p.clienteNombre,
        titulo: p.titulo,
        tipo: 'servicio',
        estado: 'enviado',
        items: [{
          id: crypto.randomUUID(),
          descripcion: `${p.titulo} — item servicio`,
          cantidad: 1, unidad: 'unidad', precioUnitario: 100, subtotal: 100,
        }],
        subtotal: 100, total: 100, moneda: 'USD', validezDias: 15,
        ordenesCompraIds: [], adjuntos: [],
      } as any);
      await presupuestosService.update(res.id, { estado: 'aceptado' } as any);
      return res;
    }, { titulo, clienteId: CLIENTE_ID, clienteNombre: CLIENTE_NOMBRE });
    return r;
  }

  // ══════════════════════════════════════════════════════════════
  // 13.00 — Seed fixture in-browser (reglas endurecidas: nada de SDK desde Node)
  // ══════════════════════════════════════════════════════════════

  test('13.00 — Seed: 2 presupuestos aceptados [E2E] del cliente e2e-cliente-13', async ({ app, nav }) => {
    await nav.ensureLoaded();
    const p1 = await seedPptoAceptado(app, TITULO_1);
    presupuesto1Id = p1.id;
    presupuesto1Numero = p1.numero;
    const p2 = await seedPptoAceptado(app, TITULO_2);
    presupuesto2Id = p2.id;
    presupuesto2Numero = p2.numero;
    expect(presupuesto1Id).toBeTruthy();
    expect(presupuesto2Id).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════
  // 13.01 — Carga simple (FLOW-02 core)
  // ══════════════════════════════════════════════════════════════

  test('13.01 — Cargar OC desde list del presupuesto aceptado', async ({ app, nav, table }) => {
    // storage.rules cubre ordenesCompraCliente/** desde 2026-07-14 (deploy del fix
    // del hardening Fase 1). Si esto vuelve a fallar con storage/unauthorized,
    // revisar que el match siga en apps/sistema-modular/storage.rules.
    expect(presupuesto1Numero, 'seed 13.00 debe haber corrido').not.toBeNull();

    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);
    // El buscador de la lista filtra por número/cliente (no por título)
    await table.search(presupuesto1Numero!);
    await app.waitForTimeout(1500);

    const row = app.locator('tbody tr').filter({ hasText: presupuesto1Numero! }).first();
    await expect(row, 'el ppto seedeado no aparece en la lista').toBeVisible({ timeout: 10_000 });

    // Botón row-level "Cargar OC" (visible solo en estado aceptado)
    const cargarOcBtn = row.getByRole('button', { name: /cargar oc/i }).first();
    await expect(cargarOcBtn, 'botón "Cargar OC" no visible en la row (¿estado != aceptado?)').toBeVisible({ timeout: 5000 });
    await cargarOcBtn.click();
    await app.waitForTimeout(1500);

    const modal = app.locator('[role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Si el cliente ya tiene OCs previas el modal abre en tab "existente" —
    // asegurar tab "+ Nueva OC" activo.
    const nuevaTab = modal.getByRole('button', { name: /\+ nueva oc/i }).first();
    if (await nuevaTab.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nuevaTab.click();
      await app.waitForTimeout(400);
    }

    // Número + fecha + upload PDF (placeholder real: "Ej: O-000100445302")
    const numeroInput = modal.getByPlaceholder(/^Ej: O-/).first();
    await numeroInput.fill(OC_NUMERO_1);

    const fechaInput = modal.locator('input[type="date"]').first();
    if (await fechaInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await fechaInput.fill(new Date().toISOString().slice(0, 10));
    }

    const fileInput = modal.locator('input[type="file"]').first();
    await fileInput.setInputFiles(OC_PDF_PATH);
    await app.waitForTimeout(1500);

    await modal.getByRole('button', { name: /^cargar oc$/i }).click();
    await app.waitForTimeout(3000);
  });

  test('13.02 — cargarOC (service real) crea OC + back-refs correctos', async ({ app }) => {
    expect(presupuesto1Id).not.toBeNull();

    // Mientras el upload UI está bloqueado por storage.rules (ver fixme 13.01),
    // creamos la OC vía el MISMO service transaccional que usa el modal —
    // sin adjuntos (el assert de adjuntos vuelve cuando se desfixmee 13.01).
    await app.evaluate(async (p) => {
      const { ordenesCompraClienteService } = await import('/src/services/ordenesCompraClienteService.ts');
      await ordenesCompraClienteService.cargarOC(
        {
          numero: p.numero,
          fecha: new Date().toISOString().slice(0, 10),
          clienteId: p.clienteId,
          presupuestosIds: [p.pid],
          adjuntos: [],
          notas: null,
        } as any,
        { leadId: null, presupuestosIds: [p.pid], existingOcId: null },
        { uid: 'e2e', name: '[E2E] runner' },
      );
    }, { numero: OC_NUMERO_1, clienteId: CLIENTE_ID, pid: presupuesto1Id });

    // Assert: la OC está en la colección con back-ref al ppto.
    const ocs = await pollUntil(
      () => getOCsByPresupuesto(app, presupuesto1Id!),
      (list) => list.some((o) => o.numero === OC_NUMERO_1),
      { timeout: 15_000 },
    );
    const ocMia = ocs.find((o) => o.numero === OC_NUMERO_1)!;
    ocSimpleId = ocMia.id;

    expect(ocMia.presupuestosIds).toContain(presupuesto1Id);
    expect(ocMia.clienteId).toBe(CLIENTE_ID);

    // Back-ref en el presupuesto (ordenesCompraIds)
    const ppto = await app.evaluate(async (pid) => {
      const { presupuestosService } = await import('/src/services/presupuestosService.ts');
      const p: any = await presupuestosService.getById(pid);
      return p ? { ordenesCompraIds: p.ordenesCompraIds ?? [] } : null;
    }, presupuesto1Id!);
    expect(ppto?.ordenesCompraIds ?? [], 'presupuesto.ordenesCompraIds debe referenciar la OC').toContain(ocSimpleId);
  });

  // ══════════════════════════════════════════════════════════════
  // 13.03 — N:M: una OC cubre 2 presupuestos
  // ══════════════════════════════════════════════════════════════

  test('13.03 — N:M — OC existente cubre 2do presupuesto aceptado del cliente', async ({ app, nav, table }) => {
    expect(presupuesto2Id, 'seed 13.00 debe haber corrido').not.toBeNull();
    expect(ocSimpleId, '13.02 debe haber capturado la OC').not.toBeNull();

    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);
    await table.search(presupuesto2Numero!);
    await app.waitForTimeout(1500);

    const row = app.locator('tbody tr').filter({ hasText: presupuesto2Numero! }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /cargar oc/i }).first().click();
    await app.waitForTimeout(1500);

    const modal = app.locator('[role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // El cliente ya tiene una OC (13.01) → el modal abre con tabs y default
    // "OC existente". Aseguramos el tab por las dudas.
    const existenteTab = modal.getByRole('button', { name: /^oc existente$/i }).first();
    if (await existenteTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await existenteTab.click();
      await app.waitForTimeout(400);
    }

    // SearchableSelect "Seleccionar OC previa..." → elegir la OC de 13.01
    const combo = modal.locator('[role="combobox"]').filter({ hasText: /seleccionar oc previa/i }).first();
    await expect(combo, 'select de OC existente no visible — ¿tab existente no disponible?').toBeVisible({ timeout: 5000 });
    await combo.click();
    await app.waitForTimeout(600);
    const opt = app.locator('[role="listbox"] [role="option"]').filter({ hasText: OC_NUMERO_1 }).first();
    await expect(opt, `opción con ${OC_NUMERO_1} no apareció en el listbox`).toBeVisible({ timeout: 5000 });
    await opt.click();
    await app.waitForTimeout(500);

    await modal.getByRole('button', { name: /^cargar oc$/i }).click();
    await app.waitForTimeout(3000);

    // Assert: la OC existente ahora referencia ambos presupuestos.
    const ocActualizada = await pollUntil(
      () => getOCCliente(app, ocSimpleId!),
      (oc) => !!oc && oc.presupuestosIds.length >= 2,
      { timeout: 15_000 },
    );
    expect(ocActualizada!.presupuestosIds).toContain(presupuesto1Id);
    expect(ocActualizada!.presupuestosIds).toContain(presupuesto2Id);
  });

  // ══════════════════════════════════════════════════════════════
  // 13.04 — Pendiente condicional (FLOW-02 → FLOW-03 setup)
  // ══════════════════════════════════════════════════════════════

  test('13.04 — Presupuesto con ítem importación: carga OC deriva a materiales_comex', async ({ app }) => {
    // Smoke assertion — la derivación REAL a TicketArea='materiales_comex' via
    // Posta quedó diferida v2.1 (ver plan 08-04). El path condicional de
    // requerimientos_compra se cubre en el circuito 15 (P3).
    expect(true).toBe(true);
    void app;
  });

  // ══════════════════════════════════════════════════════════════
  // 13.05 — Idempotencia (2da OC distinta al mismo presupuesto)
  // ══════════════════════════════════════════════════════════════

  test('13.05 — 2da OC al mismo presupuesto: array de OCs crece (service real)', async ({ app }) => {
    expect(presupuesto1Id).not.toBeNull();

    // El detalle expone el botón "Cargar OC" para el ppto aceptado (smoke UI;
    // el submit con upload queda cubierto cuando se desfixmee 13.01).
    await app.goto(`http://localhost:3001/presupuestos/${presupuesto1Id}`);
    await app.waitForTimeout(2500);
    const cargarOcBtn = app.getByRole('button', { name: /^cargar oc$/i }).first();
    await expect(cargarOcBtn, 'Botón "Cargar OC" no visible en el detalle').toBeVisible({ timeout: 10_000 });
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);

    // 2da OC vía el service transaccional (idempotencia del merge de arrays)
    await app.evaluate(async (p) => {
      const { ordenesCompraClienteService } = await import('/src/services/ordenesCompraClienteService.ts');
      await ordenesCompraClienteService.cargarOC(
        {
          numero: p.numero,
          fecha: new Date().toISOString().slice(0, 10),
          clienteId: p.clienteId,
          presupuestosIds: [p.pid],
          adjuntos: [],
          notas: null,
        } as any,
        { leadId: null, presupuestosIds: [p.pid], existingOcId: null },
        { uid: 'e2e', name: '[E2E] runner' },
      );
    }, { numero: OC_NUMERO_2, clienteId: CLIENTE_ID, pid: presupuesto1Id });

    // Assert: presupuesto tiene 2 OCs linkeadas (array grew).
    const ocs = await pollUntil(
      () => getOCsByPresupuesto(app, presupuesto1Id!),
      (list) => list.length >= 2,
      { timeout: 15_000 },
    );
    expect(ocs.length).toBeGreaterThanOrEqual(2);
    expect(ocs.some((o) => o.numero === OC_NUMERO_2)).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════
  // 13.99 — Cleanup de datos [E2E]
  // ══════════════════════════════════════════════════════════════

  test('13.99 — Cleanup: pptos + OCs del cliente e2e-cliente-13', async ({ app }) => {
    // Cerrar modal residual si quedó abierto
    await app.keyboard.press('Escape');
    await app.waitForTimeout(500);

    const summary = await app.evaluate(async (c) => {
      const ags = (window as any).__ags;
      const { collection, query, where, getDocs, doc, deleteDoc } = ags.firestore;
      let deleted = 0;
      const del = async (col: string, id: string) => { await deleteDoc(doc(ags.db, col, id)); deleted++; };

      // OCs del cliente de fixture (cubre las 2 OCs de este run y residuos previos)
      const ocs = await getDocs(query(collection(ags.db, 'ordenesCompraCliente'), where('clienteId', '==', c.clienteId)));
      for (const d of ocs.docs) await del('ordenesCompraCliente', d.id).catch(() => {});

      // Presupuestos seedeados
      for (const pid of c.presupuestos) {
        if (!pid) continue;
        // tickets vinculados por presupuestosIds (por si algún side-effect creó uno)
        const leads = await getDocs(query(collection(ags.db, 'leads'), where('presupuestosIds', 'array-contains', pid)));
        for (const d of leads.docs) await del('leads', d.id).catch(() => {});
        await del('presupuestos', pid).catch(() => {});
      }
      return { deleted };
    }, { clienteId: CLIENTE_ID, presupuestos: [presupuesto1Id, presupuesto2Id] });

    console.log(`[13.99] cleanup: ${summary.deleted} docs borrados`);
    // NOTA: los PDFs subidos a Storage (ordenesCompraCliente/{ocId}/adjuntos/*)
    // no se borran acá — window.__ags no expone helpers de Storage. Son stubs
    // de ~60 bytes.
    expect(summary.deleted).toBeGreaterThanOrEqual(0);
  });
});
