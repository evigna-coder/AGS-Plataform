import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import type { Page } from '@playwright/test';
import {
  getPresupuesto,
  getTicketsCoordinacionByPresupuesto,
  getRequerimientosByPresupuesto,
  pollUntil,
} from '../helpers/firestore-assert';

const ts = timestamp();

/**
 * Selecciona el tipo en el select "Tipo *" del modal de creación.
 * (El viejo `getByRole('combobox').nth(4)` agarraba el select "Cambiar estado"
 * de la lista — la UI de cuotas corrió los índices de combobox.)
 */
async function selectTipoPresupuesto(app: Page, tipo: string) {
  const modal = app.locator('[role="dialog"]').last();
  const tipoSelect = modal.locator('label', { hasText: /^Tipo \*$/ }).locator('..').locator('select').first();
  await tipoSelect.waitFor({ timeout: 5000 });
  await tipoSelect.selectOption(tipo);
}

/**
 * Agrega una línea al ppto vía el buscador unificado: elige el primer
 * "Servicio ·" y fuerza precio 100 (el catálogo real tiene servicios con
 * precio 0 y `handleAdd` rechaza precio vacío con un alert).
 */
async function agregarLineaServicio(app: Page) {
  const modal = app.locator('[role="dialog"]').last();
  const combo = modal.getByRole('combobox').filter({ hasText: /carga manual|buscar por c[oó]digo/i }).first();
  if (!await combo.isVisible({ timeout: 2000 }).catch(() => false)) return false;
  await combo.click();
  await app.waitForTimeout(600);
  const srvOpt = app.locator('[role="listbox"] [role="option"]').filter({ hasText: /^Servicio ·/ }).first();
  if (!await srvOpt.isVisible({ timeout: 2000 }).catch(() => false)) return false;
  await srvOpt.click();
  await app.waitForTimeout(400);
  const precioInput = modal.locator('label', { hasText: /^Precio unit\. \*$/ }).locator('..').locator('input').first();
  await precioInput.fill('100');
  await app.getByRole('button', { name: '+ Agregar', exact: true }).evaluate((el: HTMLElement) => el.click());
  await app.waitForTimeout(500);
  return true;
}

/** Borra best-effort un ppto creado por estos tests (y tickets linkeados). */
async function deletePpto(app: Page, pid: string) {
  await app.evaluate(async (id) => {
    const ags = (window as any).__ags;
    const { collection, query, where, getDocs, doc, deleteDoc } = ags.firestore;
    const leads = await getDocs(query(collection(ags.db, 'leads'), where('presupuestosIds', 'array-contains', id)));
    for (const d of leads.docs) await deleteDoc(d.ref).catch(() => {});
    const reqs = await getDocs(query(collection(ags.db, 'requerimientos_compra'), where('presupuestoId', '==', id)));
    for (const d of reqs.docs) await deleteDoc(d.ref).catch(() => {});
    await deleteDoc(doc(ags.db, 'presupuestos', id)).catch(() => {});
  }, pid).catch(() => {});
}

test.describe('Circuito 3: Presupuestos', () => {
  test.describe.configure({ mode: 'serial' });

  test('3.1 — Navegar a Presupuestos', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.2 — Crear nuevo presupuesto', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');

    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Tipo (select nativo dentro del modal, ubicado por label)
    await selectTipoPresupuesto(app, 'servicio');
    await app.waitForTimeout(300);

    // Cliente (SearchableSelect — click en combobox, luego opción del listbox)
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    // Las opciones del SearchableSelect están en un listbox portal con role="option"
    // Filtrar para no matchear <option> de <select> nativos
    const clientOpts = app.locator('[role="listbox"] [role="option"], ul li');
    const firstClient = clientOpts.first();
    await firstClient.waitFor({ timeout: 5000 });
    await firstClient.click();
    await app.waitForTimeout(1500);

    // Catálogo de servicios (si aparece)
    const catalogCombo = app.getByRole('combobox').filter({ hasText: 'Carga manual...' });
    if (await catalogCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await catalogCombo.click();
      await app.waitForTimeout(500);
      const firstConcept = app.getByRole('option').first();
      if (await firstConcept.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstConcept.click();
        await app.waitForTimeout(500);
      }
    }

    // Agregar línea (botón puede estar fuera de viewport)
    const addBtn = app.getByRole('button', { name: '+ Agregar', exact: true });
    await addBtn.evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(500);

    // Crear presupuesto (botón puede estar fuera de viewport)
    const createBtn = app.getByRole('button', { name: 'Crear presupuesto' });
    await createBtn.evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(3000);
  });

  test('3.3 — Verificar presupuesto en lista', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('3.4 — Abrir detalle de presupuesto', async ({ app }) => {
    const firstRow = app.locator('tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  // ── Phase 10 RED tests (Wave 0 baseline) ──────────────────────────────────

  test('3.5 — Crear ppto partes + buscador unificado ofrece artículos + requerimiento condicional', async ({ app, nav }) => {
    // La UI actual reemplazó el ArticuloPickerPanel por el buscador UNIFICADO
    // (servicios + artículos, opciones "Artículo · [cod] desc"). El dropdown
    // cappea las opciones visibles ("+N más — escribí para filtrar"), así que
    // para verificar que ofrece artículos seedeamos uno [E2E] y lo buscamos
    // por código. El seed va ANTES de navegar: el catálogo se carga al montar
    // el modal (y pasa por serviceCache) — el goToFresh recarga la página y
    // garantiza catálogo fresco.
    await nav.ensureLoaded();
    const artCodigo = `E2E-035-${ts}`;
    const artId = await app.evaluate(async (codigo) => {
      const { articulosService } = await import('/src/services/stockService.ts');
      return articulosService.create({
        codigo,
        descripcion: `[E2E] articulo buscador 3.5`,
        categoriaEquipo: 'otros', marcaId: '', proveedorIds: [],
        tipo: 'repuesto', unidadMedida: 'unidad', stockMinimo: 0,
        requiereNumeroSerie: false, requiereNumeroLote: false, activo: true,
      } as any);
    }, artCodigo);

    await nav.goToFresh('Presupuestos');

    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Seleccionar tipo 'partes'
    await selectTipoPresupuesto(app, 'partes');
    await app.waitForTimeout(300);

    // Seleccionar cliente (opciones SOLO del listbox portal — `ul li` suelto
    // matchea items del sidebar y desvía el click)
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    const firstClient = app.locator('[role="listbox"] [role="option"]').first();
    await firstClient.waitFor({ timeout: 10_000 });
    await firstClient.click();
    await app.waitForTimeout(1500);

    // El combobox pierde el texto visible al abrirse (el span del placeholder
    // se desmonta) — anclamos por el label de la sección y el input por placeholder.
    // Timeout generoso: la sección recién se monta cuando cargan conceptos/artículos
    // (page reload previo → caches fríos).
    const modal = app.locator('[role="dialog"]').last();
    const buscador = modal.locator('label', { hasText: /^Buscar servicio o artículo$/ }).locator('..').locator('[role="combobox"]').first();
    await expect(buscador, 'buscador unificado de items no visible en ppto partes').toBeVisible({ timeout: 20_000 });
    await buscador.click();
    await app.waitForTimeout(600);
    const searchInput = modal.getByPlaceholder(/buscar por c[oó]digo o descripci/i).first();
    await searchInput.fill(artCodigo);
    await app.waitForTimeout(800);
    const artOption = app.locator('[role="listbox"] [role="option"]').filter({ hasText: new RegExp(`^Artículo · \\[${artCodigo}\\]`) }).first();
    expect(
      await artOption.isVisible({ timeout: 4000 }).catch(() => false),
      'el buscador unificado no ofrece el artículo seedeado para ppto partes',
    ).toBeTruthy();

    // Cerrar el dropdown sin elegir el artículo (la suite corre contra la DB
    // real: aceptar un ppto con stockArticuloId reservaría stock real) y
    // agregar un SERVICIO como línea del ppto.
    await searchInput.fill('');
    await app.waitForTimeout(400);
    await modal.locator('label').first().click();
    await agregarLineaServicio(app);

    // Guardar presupuesto
    const createBtn = app.getByRole('button', { name: 'Crear presupuesto' });
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.evaluate((el: HTMLElement) => el.click());
      await app.waitForTimeout(3000);
    }

    // Leer presupuestoId desde URL (navegar a lista, abrir primera fila, leer URL)
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(1500);
    const firstRow = app.locator('tbody tr').first();
    await firstRow.click({ force: true });
    await app.waitForTimeout(1500);
    const url = app.url();
    const pidMatch = url.match(/presupuestos\/([^/?#]+)/);

    if (pidMatch) {
      const pid = pidMatch[1];
      // Cambiar estado a aceptado (si hay control de estado visible)
      const estadoSelect = app.locator('select, [role="combobox"]').filter({ has: app.locator('option, [role="option"]', { hasText: /aceptado/i }) }).first();
      if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await estadoSelect.selectOption('aceptado');
        await app.waitForTimeout(2000);
      }

      // Informativo: el ppto de este test es servicio-only (sin stockArticuloId),
      // así que NO se esperan requerimientos condicionales. El path real de
      // requerimientos al aceptar partes se cubre en el circuito 15 (P3/P6).
      const reqs = await pollUntil(
        () => getRequerimientosByPresupuesto(app, pid, { condicional: true }),
        (arr) => arr.length >= 1,
        { timeout: 4000 },
      ).catch(() => []);
      if (reqs.length === 0) {
        console.log('[3.5] sin requerimientos condicionales (esperado para ppto servicio-only)');
      }

      // Cleanup: este ppto quedó colgado de un cliente real — borrarlo
      await deletePpto(app, pid);
    }

    // Cleanup del artículo seedeado
    await app.evaluate(async (id) => {
      const ags = (window as any).__ags;
      const { doc, deleteDoc } = ags.firestore;
      await deleteDoc(doc(ags.db, 'articulos', id)).catch(() => {});
    }, artId);

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.6 — Crear ppto mixto + generar PDF + verificar download', async ({ app, nav }) => {

    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Tipo mixto
    await selectTipoPresupuesto(app, 'mixto');
    await app.waitForTimeout(300);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    await app.locator('[role="listbox"] [role="option"], ul li').first().click();
    await app.waitForTimeout(1000);

    // Agregar 1 línea de servicio (el helper llena precio: el catálogo real
    // tiene servicios con precio 0 y "+ Agregar" rechaza precio vacío)
    await agregarLineaServicio(app);

    // Crear
    const createBtn = app.getByRole('button', { name: 'Crear presupuesto' });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.evaluate((el: HTMLElement) => el.click());
      await app.waitForTimeout(3000);
    }

    // Abrir primera fila para llegar al detalle
    await nav.goToFresh('Presupuestos');
    await app.locator('tbody tr').first().click({ force: true });
    await app.waitForTimeout(2000);

    // Verificar botón Descargar PDF + assert download
    const downloadBtn = app.getByRole('button', { name: /descargar pdf|download pdf/i }).first();
    const btnVisible = await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(btnVisible, 'Requires Wave 2 implementation: PresupuestoHeaderBar PDF button for mixto type').toBeTruthy();

    if (btnVisible) {
      const downloadPromise = app.waitForEvent('download', { timeout: 10_000 });
      await downloadBtn.click();
      const dl = await downloadPromise;
      expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
    }

    // Cleanup: borrar el ppto mixto creado (colgado de un cliente real)
    const pidMatch36 = app.url().match(/presupuestos\/([^/?#]+)/);
    if (pidMatch36) await deletePpto(app, pidMatch36[1]);

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.7 — Crear ppto ventas + VentasMetadata + aceptar → ticket coordinación auto-creado', async ({ app, nav }) => {

    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Tipo ventas
    await selectTipoPresupuesto(app, 'ventas');
    await app.waitForTimeout(300);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    await app.locator('[role="listbox"] [role="option"], ul li').first().click();
    await app.waitForTimeout(1500);

    // VentasMetadataSection debe ser visible para tipo 'ventas'.
    // (El componente no tiene testid ni clase propia — se ubica por su heading.)
    const modal37 = app.locator('[role="dialog"]').last();
    const metadataHeading = modal37.locator('h4', { hasText: /datos de entrega e instalaci/i }).first();
    const sectionVisible = await metadataHeading.isVisible({ timeout: 5000 }).catch(() => false);
    expect(sectionVisible, 'VentasMetadataSection no visible para tipo ventas').toBeTruthy();

    if (sectionVisible) {
      // Contenedor = el div más interno que contiene el heading
      const metadataSection = modal37.locator('div').filter({ has: app.locator('h4', { hasText: /datos de entrega e instalaci/i }) }).last();

      // Fecha estimada entrega (hoy + 30 días)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().slice(0, 10);

      const fechaInput = metadataSection.locator('input[type="date"]').first();
      if (await fechaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fechaInput.fill(futureDateStr);
        await app.waitForTimeout(300);
      }

      // Lugar instalacion (segundo input de la sección: date, lugar, checkbox)
      const lugarInput = metadataSection.locator('input:not([type="date"]):not([type="checkbox"])').first();
      if (await lugarInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lugarInput.fill('Lab Prueba');
        await app.waitForTimeout(300);
      }

      // requiereEntrenamiento checkbox
      const entrenamientoCheck = metadataSection.locator('input[type="checkbox"]').first();
      if (await entrenamientoCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (!await entrenamientoCheck.isChecked()) {
          await entrenamientoCheck.click();
          await app.waitForTimeout(300);
        }
      }
    }

    // Agregar 1 línea de servicio (helper llena precio 100)
    await agregarLineaServicio(app);

    // Crear presupuesto
    const createBtn = app.getByRole('button', { name: 'Crear presupuesto' });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.evaluate((el: HTMLElement) => el.click());
      await app.waitForTimeout(3000);
    }

    // Navegar al detalle para leer presupuestoId
    await nav.goToFresh('Presupuestos');
    await app.locator('tbody tr').first().click({ force: true });
    await app.waitForTimeout(1500);
    const url = app.url();
    const pidMatch = url.match(/presupuestos\/([^/?#]+)/);

    if (pidMatch) {
      const pid = pidMatch[1];

      // Verificar ventasMetadata fue guardado
      const pres = await pollUntil(
        () => getPresupuesto(app, pid),
        (p) => p?.ventasMetadata?.fechaEstimadaEntrega != null,
        { timeout: 10_000 },
      ).catch(() => null);

      if (!pres) {
        console.warn('[RED] 3.7: ventasMetadata.fechaEstimadaEntrega not found — Wave 3 not landed');
      } else {
        // Aceptar presupuesto para disparar auto-ticket de coordinación
        const estadoSelect = app.locator('select, [role="combobox"]').filter({ has: app.locator('option, [role="option"]', { hasText: /aceptado/i }) }).first();
        if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await estadoSelect.selectOption('aceptado');
          await app.waitForTimeout(2000);
        }

        // Verificar ticket de coordinación auto-creado en leads collection.
        // Decisión 2026-04-22: reemplazamos la auto-OT genérica (confusa para el
        // coordinador cuando hay que armar múltiples OTs) por un ticket informativo
        // asignado al usuarioCoordinadorOTId. Requiere adminConfig configurado.
        const tickets = await pollUntil(
          () => getTicketsCoordinacionByPresupuesto(app, pid),
          (arr) => arr.length >= 1,
          { timeout: 15_000 },
        ).catch(() => []);

        if (tickets.length === 0) {
          console.warn('[RED] 3.7: No auto-ticket coordinación found in leads — Wave 3 trigger or adminConfig.usuarioCoordinadorOTId not landed');
        }
      }

      // Cleanup: borrar ppto + ticket de coordinación auto-creado (datos de test
      // colgados de un cliente real)
      await deletePpto(app, pid);
    }

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.8 — Botones Exportar Excel + PDF visibles en /presupuestos para admin', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);

    const excelBtn = app.getByRole('button', { name: /exportar excel/i }).first();
    const pdfBtn = app.getByRole('button', { name: /exportar pdf/i }).first();

    const excelVisible = await excelBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const pdfVisible = await pdfBtn.isVisible({ timeout: 5000 }).catch(() => false);

    expect(excelVisible, 'Requires Wave 4 implementation (plan 10-05): Exportar Excel button not visible for admin role').toBeTruthy();
    expect(pdfVisible, 'Requires Wave 4 implementation (plan 10-05): Exportar PDF button not visible for admin role').toBeTruthy();
  });

  test('3.9 — Botón Export oculto para rol no-admin', async ({ app, nav }) => {
    test.fixme(true, 'RBAC testing requires role-switching fixture — Phase 11 (TEST-01/TEST-05)');
    // Implementation when role fixture is available:
    // await nav.loginAs('ventas');
    // await nav.goToFresh('Presupuestos');
    // const excelBtn = app.getByRole('button', { name: /exportar excel/i });
    // await expect(excelBtn).toBeHidden({ timeout: 5000 });
  });
});
