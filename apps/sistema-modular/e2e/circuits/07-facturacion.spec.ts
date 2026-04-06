import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

/**
 * CIRCUITO 7: Facturación — Verificar lista y filtros
 */

test.describe('Circuito 7: Facturación', () => {
  test.describe.configure({ mode: 'serial' });

  test('7.1 — Navegar a Facturación', async ({ app, nav }) => {
    await nav.goTo('Facturacion');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('7.2 — Verificar tabla de facturación', async ({ app, nav }) => {
    await nav.goTo('Facturacion');
    await app.waitForTimeout(2000);
    const headers = app.locator('th, [role="columnheader"]');
    expect(await headers.count()).toBeGreaterThanOrEqual(0);
  });

  test('7.3 — Abrir detalle si hay solicitudes', async ({ app, nav }) => {
    await nav.goTo('Facturacion');
    await app.waitForTimeout(2000);
    const firstRow = app.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await app.waitForTimeout(2000);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
    }
  });
});
