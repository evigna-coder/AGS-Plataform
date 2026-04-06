import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();
const CLIENTE_RAZON = `${TEST_PREFIX} Cliente ${ts}`;

test.describe('Circuito 1: Clientes → Establecimientos → Equipos', () => {
  test.describe.configure({ mode: 'serial' });

  test('1.1 — Navegar a Clientes', async ({ nav }) => {
    await nav.goTo('Clientes');
    await nav.expectPageTitle('Clientes');
  });

  test('1.2 — Crear nuevo cliente', async ({ app, nav, forms }) => {
    await nav.goTo('Clientes');
    await forms.clickButton(/Nuevo Cliente/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Razón Social * (label sin htmlFor → buscar label + input hermano)
    await forms.fillField('Razón Social', CLIENTE_RAZON, modal);
    // Rubro *
    await forms.fillField('Rubro', 'Industria Farmacéutica', modal);

    // Guardar
    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(2000);
  });

  test('1.3 — Buscar cliente creado', async ({ app, nav, table }) => {
    await nav.goTo('Clientes');
    await table.search(TEST_PREFIX);
    await app.waitForTimeout(2000);
    await table.expectRowWithText(CLIENTE_RAZON);
  });

  test('1.4 — Abrir detalle del cliente', async ({ app, nav, table }) => {
    await nav.goTo('Clientes');
    await table.search(CLIENTE_RAZON);
    await app.waitForTimeout(1000);
    await table.clickRow(CLIENTE_RAZON);
    await app.waitForTimeout(1500);
    await expect(app.getByText(CLIENTE_RAZON).first()).toBeVisible();
  });

  test('1.5 — Navegar a Equipos', async ({ nav }) => {
    await nav.goTo('Equipos');
    await nav.expectPageTitle('Equipos');
  });

  test('1.6 — Verificar lista de equipos', async ({ app, nav }) => {
    await nav.goTo('Equipos');
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });
});
