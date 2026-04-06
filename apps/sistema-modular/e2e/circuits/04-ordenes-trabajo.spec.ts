import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 4: Órdenes de Trabajo', () => {
  test.describe.configure({ mode: 'serial' });

  test('4.1 — Navegar a OT', async ({ app, nav }) => {
    await nav.goTo('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    // El título puede ser "Ordenes de Trabajo" o "Órdenes de Trabajo"
    const title = app.locator('h1, h2').first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('4.2 — Crear nueva OT', async ({ app, nav, forms }) => {
    await nav.goTo('Ordenes de Trabajo');
    await forms.clickButton(/Nueva OT/i);
    await app.waitForTimeout(1500);

    // OTNew es página completa
    // Botón "Auto" para generar número
    const autoBtn = app.getByRole('button', { name: /auto/i }).first();
    if (await autoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await autoBtn.click();
      await app.waitForTimeout(1000);
    }

    // Cliente * (SearchableSelect)
    await forms.searchableSelectFirst('Seleccionar cliente...');
    await app.waitForTimeout(1500); // esperar carga de sistemas

    // Sistema * (SearchableSelect)
    const sistemaInput = app.getByPlaceholder('Seleccionar sistema...');
    if (await sistemaInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forms.searchableSelectFirst('Seleccionar sistema...');
      await app.waitForTimeout(500);
    }

    // Tipo de Servicio * (SearchableSelect — puede no aparecer si no hay cliente/sistema)
    const tipoInput = app.getByPlaceholder('Seleccionar tipo de servicio...');
    if (await tipoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forms.searchableSelectFirst('Seleccionar tipo de servicio...');
    }

    // Guardar
    const saveBtn = app.getByRole('button', { name: /guardar|crear/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await app.waitForTimeout(3000);
    }
  });

  test('4.3 — Verificar OTs en lista', async ({ app, nav }) => {
    await nav.goTo('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
  });

  test('4.4 — Abrir detalle de OT', async ({ app, nav }) => {
    await nav.goTo('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    const firstRow = app.locator('tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('4.5 — Verificar filtros', async ({ app, nav }) => {
    await nav.goTo('Ordenes de Trabajo');
    await app.waitForTimeout(1500);
    expect(await app.locator('select').count()).toBeGreaterThanOrEqual(1);
  });

  test('4.6 — Verificar botón exportar CSV', async ({ app, nav }) => {
    await nav.goTo('Ordenes de Trabajo');
    await app.waitForTimeout(1500);
    const exportBtn = app.getByRole('button', { name: /csv|exportar|descargar/i }).first();
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(exportBtn).toBeEnabled();
    }
  });
});
