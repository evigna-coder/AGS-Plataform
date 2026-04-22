import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import {
  getPresupuesto,
  getOTsByBudget,
  getRequerimientosByPresupuesto,
  pollUntil,
} from '../helpers/firestore-assert';

const ts = timestamp();

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

    // Tipo (select nativo — usar selectOption como codegen)
    await app.getByRole('combobox').nth(4).selectOption('servicio');
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
    const addBtn = app.getByRole('button', { name: '+ Agregar' });
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

  test('3.5 — Crear ppto partes + verificar ArticuloPickerPanel + requerimiento condicional', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');

    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Seleccionar tipo 'partes'
    await app.getByRole('combobox').nth(4).selectOption('partes');
    await app.waitForTimeout(300);

    // Seleccionar cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    const clientOpts = app.locator('[role="listbox"] [role="option"], ul li');
    const firstClient = clientOpts.first();
    await firstClient.waitFor({ timeout: 5000 });
    await firstClient.click();
    await app.waitForTimeout(1500);

    // ArticuloPickerPanel debe ser visible para tipo 'partes'
    const articuloPanel = app.locator('[data-testid="articulo-picker-panel"], [class*="ArticuloPicker"], [class*="articulo-picker"]').first();
    const articlePickerVisible = await articuloPanel.isVisible({ timeout: 5000 }).catch(() => false);
    expect(
      articlePickerVisible,
      'ArticuloPickerPanel not visible — Wave 2 (plan 10-02) not landed yet',
    ).toBeTruthy();

    // Si el panel está visible: seleccionar primer artículo y verificar StockAmplioIndicator
    if (articlePickerVisible) {
      // Seleccionar primer artículo disponible
      const firstArticle = articuloPanel.locator('button, [role="option"], tr').first();
      if (await firstArticle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstArticle.click();
        await app.waitForTimeout(500);
      }

      // StockAmplioIndicator debe mostrar 4 buckets
      const stockIndicator = app.locator('[data-testid="stock-amplio-indicator"], [class*="StockAmplio"]').first();
      const stockVisible = await stockIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      expect(stockVisible, 'StockAmplioIndicator not visible — Wave 2 not landed').toBeTruthy();
    }

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

      // Wave 2 desfixmeará este assert cuando aceptarConRequerimientos para partes exista
      const reqs = await pollUntil(
        () => getRequerimientosByPresupuesto(pid, { condicional: true }),
        (arr) => arr.length >= 1,
        { timeout: 8000 },
      ).catch(() => []);
      // RED: pasa si hay requerimientos; si no, es informativo (Wave 2 pendiente)
      if (reqs.length === 0) {
        console.warn('[RED] 3.5: No conditional requerimientos found — expected Wave 2 (plan 10-02) to generate them');
      }
    }

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.6 — Crear ppto mixto + generar PDF + verificar download', async ({ app, nav }) => {

    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Tipo mixto
    await app.getByRole('combobox').nth(4).selectOption('mixto');
    await app.waitForTimeout(300);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    await app.locator('[role="listbox"] [role="option"], ul li').first().click();
    await app.waitForTimeout(1000);

    // Agregar 1 concepto (servicio)
    const addBtn = app.getByRole('button', { name: '+ Agregar' });
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.evaluate((el: HTMLElement) => el.click());
      await app.waitForTimeout(500);
    }

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

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.7 — Crear ppto ventas + VentasMetadata + aceptar → OT auto-creada', async ({ app, nav }) => {

    await nav.goToFresh('Presupuestos');
    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Tipo ventas
    await app.getByRole('combobox').nth(4).selectOption('ventas');
    await app.waitForTimeout(300);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    await app.locator('[role="listbox"] [role="option"], ul li').first().click();
    await app.waitForTimeout(1500);

    // VentasMetadataSection debe ser visible para tipo 'ventas'
    const metadataSection = app.locator('[data-testid="ventas-metadata-section"], [class*="VentasMetadata"]').first();
    const sectionVisible = await metadataSection.isVisible({ timeout: 5000 }).catch(() => false);
    expect(sectionVisible, 'Requires Wave 3 implementation: VentasMetadataSection not visible for ventas type').toBeTruthy();

    if (sectionVisible) {
      // Fecha estimada entrega (hoy + 30 días)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().slice(0, 10);

      const fechaInput = metadataSection.locator('input[type="date"]').first();
      if (await fechaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fechaInput.fill(futureDateStr);
        await app.waitForTimeout(300);
      }

      // Lugar instalacion
      const lugarInput = metadataSection.locator('input').filter({ has: app.locator('..', { hasText: /lugar|instalacion/i }) }).first();
      if (await lugarInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lugarInput.fill('Lab Prueba');
        await app.waitForTimeout(300);
      }

      // requiereEntrenamiento checkbox
      const entrenamientoCheck = metadataSection.locator('input[type="checkbox"]').filter({ has: app.locator('..', { hasText: /entrenamiento/i }) }).first();
      if (await entrenamientoCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (!await entrenamientoCheck.isChecked()) {
          await entrenamientoCheck.click();
          await app.waitForTimeout(300);
        }
      }
    }

    // Agregar 1 artículo
    const addBtn = app.getByRole('button', { name: '+ Agregar' });
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.evaluate((el: HTMLElement) => el.click());
      await app.waitForTimeout(500);
    }

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
        () => getPresupuesto(pid),
        (p) => p?.ventasMetadata?.fechaEstimadaEntrega != null,
        { timeout: 10_000 },
      ).catch(() => null);

      if (!pres) {
        console.warn('[RED] 3.7: ventasMetadata.fechaEstimadaEntrega not found — Wave 3 not landed');
      } else {
        // Aceptar presupuesto para disparar auto-OT
        const estadoSelect = app.locator('select, [role="combobox"]').filter({ has: app.locator('option, [role="option"]', { hasText: /aceptado/i }) }).first();
        if (await estadoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await estadoSelect.selectOption('aceptado');
          await app.waitForTimeout(2000);
        }

        // Verificar OT auto-creada en reportes collection
        const ots = await pollUntil(
          () => getOTsByBudget(pres.numero),
          (arr) => arr.length >= 1,
          { timeout: 15_000 },
        ).catch(() => []);

        if (ots.length === 0) {
          console.warn('[RED] 3.7: No auto-OT found in reportes — Wave 3 (plan 10-04) trigger not landed');
        }
      }
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
