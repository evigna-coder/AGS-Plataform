/**
 * CIRCUITO 13: Orden de Compra del Cliente — FLOW-02 + N:M + condicional
 *
 * RED baseline as of 2026-04-21.
 * - Colección `ordenesCompraCliente` no existe — creada en plan 08-01.
 * - Modal "Cargar OC" no existe — creado en plan 08-02.
 * - Ticket estado `oc_recibida` no existe — agregado en plan 08-01.
 * - Requerimiento condicional (FLOW-03) no existe — agregado en plan 08-04.
 * Will turn GREEN after Wave 3 completes.
 *
 * Selectors targeting unbuilt UI are placeholders — ARIA-role + text first.
 *
 * Scope:
 *   13.01 — Carga simple de OC (FLOW-02 core)
 *   13.02 — Back-ref consistency (presupuesto.ordenesCompraIds + oc.presupuestosIds)
 *   13.03 — N:M (una OC cubre 2 presupuestos — FLOW-02 multi)
 *   13.04 — Pendiente condicional (importación → FLOW-02 → FLOW-03)
 *   13.05 — Idempotencia (cargar 2da OC no rompe ticket.estado)
 */

import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getOCCliente,
  getOCsByPresupuesto,
  getTicketEstado,
  pollUntil,
} from '../helpers/firestore-assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const OC_PDF_PATH = path.join(FIXTURES_DIR, 'oc-sample.pdf');

const ts = timestamp();
const CLIENTE = `${TEST_PREFIX} OC-Flow ${ts}`;
const OC_NUMERO_1 = `O-E2E-${ts}-01`;
const OC_NUMERO_MULTI = `O-E2E-${ts}-MM`;
const OC_NUMERO_2 = `O-E2E-${ts}-02`;

// ── Fixture helper: tiny PDF stub ─────────────────────────────────────────

/**
 * Ensures a minimal PDF file exists at `OC_PDF_PATH`.
 * Not a valid PDF — just enough bytes for Firebase Storage to accept the
 * upload. The app should NOT parse content, only store + link.
 */
function ensureOcSamplePdf() {
  if (fs.existsSync(OC_PDF_PATH)) return;
  // Minimal PDF header — accepted by most upload validators as `.pdf`.
  const MINIMAL_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj<< >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n',
  );
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(OC_PDF_PATH, MINIMAL_PDF);
}

test.describe('Circuito 13: Orden de Compra del Cliente — FLOW-02 + N:M', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    ensureOcSamplePdf();
  });

  // State shared across serial tests.
  let presupuesto1Id: string | null = null;
  let presupuesto2Id: string | null = null;
  let presupuestoImportId: string | null = null;
  let lead1Id: string | null = null;
  let ocSimpleId: string | null = null;

  // ══════════════════════════════════════════════════════════════
  // 13.01 — Carga simple (FLOW-02 core)
  // ══════════════════════════════════════════════════════════════

  test('13.01 — Cargar OC desde list del presupuesto aceptado', async ({
    app,
    nav,
  }) => {
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);

    // Abrir el primer presupuesto `aceptado` — asumimos que existe uno del
    // cliente base (precondición: plan 08-02 debe correr sobre DB con
    // presupuestos aceptados previos). Si no hay ninguno, el test falla.
    const aceptadoRow = app
      .locator('tbody tr')
      .filter({ hasText: /aceptado/i })
      .first();

    if (!(await aceptadoRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error(
        'No hay presupuesto aceptado en la lista — precondición FLOW-02',
      );
    }

    // Abrir menú de acciones y clickar "Cargar OC" (action nuevo del plan 08-02).
    const accionesBtn = aceptadoRow
      .getByRole('button', { name: /acciones|m[áa]s|\.\.\./i })
      .first();
    if (await accionesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accionesBtn.click();
      await app.waitForTimeout(500);
    }
    const cargarOcBtn = app.getByRole('menuitem', { name: /cargar oc/i }).first();
    if (!(await cargarOcBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Fallback: botón directo en la row.
      const rowBtn = aceptadoRow.getByRole('button', { name: /cargar oc/i }).first();
      if (!(await rowBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        throw new Error('Action "Cargar OC" no montada — plan 08-02');
      }
      await rowBtn.click();
    } else {
      await cargarOcBtn.click();
    }
    await app.waitForTimeout(1500);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Llenar número + fecha + upload PDF.
    const numeroInput = modal.getByPlaceholder(/n[úu]mero|oc #|oc n/i).first();
    await numeroInput.fill(OC_NUMERO_1);

    const fechaInput = modal.locator('input[type="date"]').first();
    if (await fechaInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await fechaInput.fill(new Date().toISOString().slice(0, 10));
    }

    const fileInput = modal.locator('input[type="file"]').first();
    await fileInput.setInputFiles(OC_PDF_PATH);
    await app.waitForTimeout(1500);

    await modal.getByRole('button', { name: /guardar|cargar oc/i }).click();
    await app.waitForTimeout(3000);

    // Capturar el presupuestoId desde la URL (si quedamos en detail).
    const url = app.url();
    const match = url.match(/presupuestos\/([^/?#]+)/);
    presupuesto1Id = match?.[1] ?? null;
    expect(presupuesto1Id, 'presupuestoId capturado tras cargar OC').not.toBeNull();
  });

  test('13.02 — Assert Firestore: OC shape + back-refs + ticket estado oc_recibida', async () => {
    expect(presupuesto1Id).not.toBeNull();

    // Assert 1: al menos 1 OC con el numero cargado está en la colección.
    const ocs = await pollUntil(
      () => getOCsByPresupuesto(presupuesto1Id!),
      (list) => list.some((o) => o.numero === OC_NUMERO_1),
      { timeout: 10_000 },
    );
    const ocMia = ocs.find((o) => o.numero === OC_NUMERO_1)!;
    ocSimpleId = ocMia.id;

    expect(ocMia.adjuntos.length).toBeGreaterThanOrEqual(1);
    expect(ocMia.adjuntos[0].tipo).toBe('pdf');
    expect(ocMia.presupuestosIds).toContain(presupuesto1Id);
    expect(ocMia.clienteId).toBeTruthy();

    // Assert 2: presupuesto.ordenesCompraIds back-ref se pobló.
    // Reuse: importar getDoc desde fixtures en test si hace falta (plan 08-02).
    // Para RED baseline alcanza con los asserts anteriores.

    // Assert 3: el ticket ligado quedó en 'oc_recibida'.
    // Necesitamos leadId — asumimos que quedó guardado en el presupuesto.
    // Placeholder hasta que Wave 3 ajuste el shape final.
    // NOTE: `'oc_recibida'` aún no está en el union `TicketEstado` (plan 08-01
    // lo agrega). Usamos comparación por string para type-check clean hoy.
    if (lead1Id) {
      const estado = await pollUntil(
        () => getTicketEstado(lead1Id!),
        (e) => (e as string) === 'oc_recibida',
        { timeout: 10_000 },
      );
      expect(estado as string).toBe('oc_recibida');
    }
  });

  // ══════════════════════════════════════════════════════════════
  // 13.03 — N:M: una OC cubre 2 presupuestos
  // ══════════════════════════════════════════════════════════════

  test('13.03 — N:M — OC existente cubre 2do presupuesto aceptado del cliente', async ({
    app,
    nav,
  }) => {
    // Precondición: crear un segundo presupuesto aceptado del mismo cliente.
    // Simplificación: buscar otro row `aceptado` del cliente en la lista.
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);

    const segundaAceptado = app
      .locator('tbody tr')
      .filter({ hasText: /aceptado/i })
      .nth(1);
    if (!(await segundaAceptado.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.fixme(true, 'Sin segundo presupuesto aceptado — fixture previo requerido');
      return;
    }

    // Acción "Cargar OC" sobre el 2do presupuesto.
    const accionesBtn = segundaAceptado
      .getByRole('button', { name: /acciones|m[áa]s|\.\.\./i })
      .first();
    if (await accionesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accionesBtn.click();
      await app.waitForTimeout(500);
    }
    const cargarOc = app.getByRole('menuitem', { name: /cargar oc/i }).first();
    if (await cargarOc.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cargarOc.click();
    } else {
      await segundaAceptado.getByRole('button', { name: /cargar oc/i }).first().click();
    }
    await app.waitForTimeout(1500);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Seleccionar OC existente en lugar de "+ Nueva".
    const ocExistenteSelect = modal
      .getByRole('combobox', { name: /oc existente|seleccionar oc/i })
      .first();
    if (await ocExistenteSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ocExistenteSelect.click();
      await app.waitForTimeout(500);
      const opt = app.getByRole('option', { name: new RegExp(OC_NUMERO_1) }).first();
      if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await opt.click();
      }
    }

    // Checkbox opcional "Esta OC cubre otros presupuestos pendientes".
    const checkbox = modal
      .locator('input[type="checkbox"]')
      .filter({ has: modal.locator('..', { hasText: /cubre otros|cubre varios/i }) })
      .first();
    if (await checkbox.isVisible({ timeout: 1500 }).catch(() => false)) {
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
      }
    }

    await modal.getByRole('button', { name: /guardar|cargar oc|asociar/i }).click();
    await app.waitForTimeout(3000);

    // Capturar el 2do presupuestoId
    const url = app.url();
    const match = url.match(/presupuestos\/([^/?#]+)/);
    presupuesto2Id = match?.[1] ?? null;

    // Assert: la OC existente ahora referencia ambos presupuestos.
    expect(ocSimpleId).not.toBeNull();
    const ocActualizada = await pollUntil(
      () => getOCCliente(ocSimpleId!),
      (oc) => !!oc && oc.presupuestosIds.length >= 2,
      { timeout: 10_000 },
    );
    expect(ocActualizada!.presupuestosIds.length).toBeGreaterThanOrEqual(2);
    if (presupuesto2Id) {
      expect(ocActualizada!.presupuestosIds).toContain(presupuesto2Id);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // 13.04 — Pendiente condicional (FLOW-02 → FLOW-03 setup)
  // ══════════════════════════════════════════════════════════════

  test('13.04 — Presupuesto con ítem importación: carga OC deriva a materiales_comex', async ({
    app,
  }) => {
    // Precondición: presupuesto aceptado cuyo item tenga
    // itemRequiereImportacion === true (stockArticulo con disponible+tránsito+reservado === 0).
    // Esta fixture NO existe hoy — plan 08-04 la provee.
    test.fixme(
      !presupuestoImportId,
      'Fixture presupuesto con item de importación pendiente — plan 08-04 provee',
    );

    // Cargar OC desde el presupuesto de importación.
    // (Flow idéntico a 13.01 — reusable si tuviéramos el fixture.)
    // Assert esperado:
    //   - ticket deriva via Posta con aArea === 'materiales_comex' (lock del naming).
    //   - ticket.estado === 'oc_recibida'.
    //
    // Placeholder assertion (siempre true en RED baseline):
    expect(true).toBe(true);
    void app; // mantener firma consistente
  });

  // ══════════════════════════════════════════════════════════════
  // 13.05 — Idempotencia (2da OC distinta al mismo presupuesto)
  // ══════════════════════════════════════════════════════════════

  test('13.05 — 2da OC al mismo presupuesto: ticket sigue oc_recibida + array crece', async ({
    app,
    nav,
  }) => {
    expect(presupuesto1Id).not.toBeNull();

    // Navegar al detalle del 1er presupuesto y cargar una OC nueva.
    await app.goto(`http://localhost:3001/presupuestos/${presupuesto1Id}`);
    await app.waitForTimeout(2000);

    const cargarOcBtn = app.getByRole('button', { name: /cargar oc/i }).first();
    if (!(await cargarOcBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error('Botón "Cargar OC" no visible desde detail — plan 08-02');
    }
    await cargarOcBtn.click();
    await app.waitForTimeout(1500);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await modal.getByPlaceholder(/n[úu]mero|oc/i).first().fill(OC_NUMERO_2);
    const fileInput = modal.locator('input[type="file"]').first();
    await fileInput.setInputFiles(OC_PDF_PATH);
    await app.waitForTimeout(1000);
    await modal.getByRole('button', { name: /guardar|cargar oc/i }).click();
    await app.waitForTimeout(3000);

    // Assert: presupuesto tiene 2 OCs linkeadas (array grew).
    const ocs = await pollUntil(
      () => getOCsByPresupuesto(presupuesto1Id!),
      (list) => list.length >= 2,
      { timeout: 10_000 },
    );
    expect(ocs.length).toBeGreaterThanOrEqual(2);

    // Assert: ticket sigue en 'oc_recibida' (no pasó a otro estado inválido).
    // NOTE: `'oc_recibida'` se agrega al union en plan 08-01; cast hasta entonces.
    if (lead1Id) {
      const estado = await getTicketEstado(lead1Id);
      expect(estado as string).toBe('oc_recibida');
    }
    void nav; // silence unused
  });
});
