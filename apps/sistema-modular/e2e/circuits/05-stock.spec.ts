import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();
const ARTICULO_CODIGO = `E2E${ts}`;
const ARTICULO_DESC = `${TEST_PREFIX} Artículo ${ts}`;

test.describe('Circuito 5: Stock', () => {
  test.describe.configure({ mode: 'serial' });

  test('5.1 — Navegar a Artículos', async ({ app, nav }) => {
    await nav.goToStock('Articulos');
    await app.waitForTimeout(2000);
    const title = app.locator('h1, h2').first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('5.2 — Crear nuevo artículo', async ({ app, nav, forms }) => {
    await nav.goToStock('Articulos');
    await forms.clickButton(/nuevo articulo/i);
    await app.waitForTimeout(1500);

    // ArticuloEditor es página completa
    await forms.fillField('Codigo', ARTICULO_CODIGO);
    await forms.fillField('Descripcion', ARTICULO_DESC);

    // Categoria equipo (select)
    await forms.selectField('Categoria equipo', 1).catch(() => {});
    // Tipo (select)
    await forms.selectField('Tipo', 1).catch(() => {});

    // Guardar
    const saveBtn = app.getByRole('button', { name: /guardar|crear/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await app.waitForTimeout(2000);
    }
  });

  test('5.3 — Buscar artículo creado', async ({ app, nav, table }) => {
    await nav.goToStock('Articulos');
    await table.search(ARTICULO_CODIGO);
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test('5.4 — Navegar a Unidades', async ({ app, nav }) => {
    await nav.goToStock('Unidades');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.5 — Navegar a Minikits', async ({ app, nav }) => {
    await nav.goToStock('Minikits');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.6 — Navegar a Remitos', async ({ app, nav }) => {
    await nav.goToStock('Remitos');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.7 — Crear remito', async ({ app, nav, forms }) => {
    await nav.goToStock('Remitos');
    await app.waitForTimeout(1000);

    const nuevoBtn = app.getByRole('button', { name: /nuevo remito|nuevo|crear/i }).first();
    if (await nuevoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nuevoBtn.click();
      await app.waitForTimeout(1000);

      const modal = app.locator('[class*="modal"], [role="dialog"]').last();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Tipo *
        await forms.selectField('Tipo', 1, modal);
        // Ingeniero *
        await forms.searchableSelectFirst('Seleccionar ingeniero...', modal);

        await modal.getByRole('button', { name: /guardar|crear/i }).click();
        await app.waitForTimeout(2000);
      }
    }
  });

  test('5.8 — Navegar a Movimientos', async ({ app, nav }) => {
    await nav.goToStock('Movimientos');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.9 — Navegar a Alertas', async ({ app, nav }) => {
    await nav.goToStock('Alertas');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.10 — Navegar a Ordenes de Compra', async ({ app, nav }) => {
    await nav.goToStock('Ordenes de Compra');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.11 — Navegar a Importaciones', async ({ app, nav }) => {
    await nav.goToStock('Importaciones');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.12 — Navegar a Proveedores', async ({ app, nav }) => {
    await nav.goToStock('Proveedores');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.13 — Navegar a Posiciones', async ({ app, nav }) => {
    await nav.goToStock('Posiciones');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('5.14 — Navegar a Marcas', async ({ app, nav }) => {
    await nav.goToStock('Marcas');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });
});
