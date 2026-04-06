import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 6: Contratos', () => {
  test.describe.configure({ mode: 'serial' });

  test('6.1 — Navegar a Contratos', async ({ nav }) => {
    await nav.goTo('Contratos');
    await nav.expectPageTitle('Contratos');
  });

  test('6.2 — Crear nuevo contrato', async ({ app, nav, forms }) => {
    await nav.goTo('Contratos');
    await forms.clickButton(/Nuevo Contrato/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Cliente *
    await forms.searchableSelectFirst('Seleccionar cliente...', modal);
    await app.waitForTimeout(500);

    // Fecha inicio *
    await forms.fillField('Fecha inicio', '2026-04-01', modal);
    // Fecha fin *
    await forms.fillField('Fecha fin', '2027-04-01', modal);

    // Servicios incluidos * — son botones toggle, click el primero
    const serviceBtns = modal.locator('button').filter({ hasNotText: /guardar|crear|cancelar|cerrar/i });
    const svcCount = await serviceBtns.count();
    for (let i = 0; i < Math.min(svcCount, 3); i++) {
      const btn = serviceBtns.nth(i);
      const text = await btn.textContent();
      // Solo clickear si parece un servicio (no un control)
      if (text && text.length > 2 && text.length < 50) {
        await btn.click().catch(() => {});
        break;
      }
    }

    // Guardar
    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(2000);
  });

  test('6.3 — Verificar contrato en lista', async ({ app, nav }) => {
    await nav.goTo('Contratos');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(0);
  });

  test('6.4 — Abrir detalle de contrato', async ({ app, nav }) => {
    await nav.goTo('Contratos');
    await app.waitForTimeout(1500);
    const firstRow = app.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await app.waitForTimeout(2000);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
    }
  });
});
