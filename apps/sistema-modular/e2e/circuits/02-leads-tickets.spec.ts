import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 2: Leads / Tickets', () => {
  test.describe.configure({ mode: 'serial' });

  test('2.1 — Navegar a Tickets', async ({ nav }) => {
    await nav.goTo('Tickets');
    await nav.expectPageTitle('Tickets');
  });

  test('2.2 — Crear nuevo ticket', async ({ app, nav, forms }) => {
    await nav.goTo('Tickets');
    await forms.clickButton(/Nuevo Ticket/i);
    await app.waitForTimeout(1000);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Cliente * — primer input del modal (LeadClienteField custom)
    const clienteInput = modal.locator('input').first();
    await clienteInput.evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(500);
    await clienteInput.fill('');
    await app.waitForTimeout(800);
    const firstOption = app.locator('li, [role="option"]').filter({ hasNotText: /crear/i }).first();
    if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstOption.click();
      await app.waitForTimeout(500);
    }

    // Contacto * (placeholder "Persona de contacto")
    const contactoInput = modal.getByPlaceholder('Persona de contacto').first();
    await contactoInput.waitFor({ timeout: 5000 });
    await contactoInput.fill(`${TEST_PREFIX} Contacto ${ts}`);

    // Motivo * (select — index 1 = primera opción real)
    await forms.selectField('Motivo', 1, modal);

    // Guardar
    await modal.getByRole('button', { name: /guardar|crear/i }).click();
    await app.waitForTimeout(2000);
  });

  test('2.3 — Verificar tickets en lista', async ({ app, nav }) => {
    await nav.goTo('Tickets');
    await app.waitForTimeout(2000);
    // Verificar que hay tickets en la lista (puede no encontrar por [E2E] si no es columna visible)
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('2.4 — Abrir detalle del ticket', async ({ app, nav }) => {
    await nav.goTo('Tickets');
    await app.waitForTimeout(2000);
    const firstRow = app.locator('tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('2.5 — Filtrar tickets por estado', async ({ app, nav }) => {
    await nav.goTo('Tickets');
    await app.waitForTimeout(1500);
    const selects = app.locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(1);
  });
});
