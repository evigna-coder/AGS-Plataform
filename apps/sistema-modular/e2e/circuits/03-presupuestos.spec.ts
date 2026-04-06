import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 3: Presupuestos', () => {
  test.describe.configure({ mode: 'serial' });

  test('3.1 — Navegar a Presupuestos', async ({ nav }) => {
    await nav.goTo('Presupuestos');
    await nav.expectPageTitle('Presupuestos');
  });

  test('3.2 — Crear nuevo presupuesto', async ({ app, nav, forms }) => {
    await nav.goTo('Presupuestos');
    await forms.clickButton(/Nuevo Presupuesto/i);
    await app.waitForTimeout(1500);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Tipo * (select)
    await forms.selectField('Tipo', 1, modal);

    // Cliente * (SearchableSelect)
    await forms.searchableSelectFirst('Seleccionar cliente...', modal);
    await app.waitForTimeout(500);

    // Guardar
    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(3000);
  });

  test('3.3 — Verificar presupuesto en lista', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('3.4 — Abrir detalle de presupuesto', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(1500);
    await app.locator('tbody tr').first().click();
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.5 — Verificar filtros', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(1500);
    expect(await app.locator('select').count()).toBeGreaterThanOrEqual(1);
  });
});
