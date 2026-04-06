import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

/**
 * CIRCUITO 8: Agenda — Verificar grilla y navegación
 */

test.describe('Circuito 8: Agenda', () => {
  test.describe.configure({ mode: 'serial' });

  test('8.1 — Navegar a Agenda', async ({ app, nav }) => {
    await nav.goTo('Agenda');
    await app.waitForTimeout(3000);
    // La agenda tiene grilla, tabla, o calendar
    const grid = app.locator('[class*="grid"], [class*="calendar"], table').first();
    await expect(grid).toBeVisible({ timeout: 10_000 });
  });

  test('8.2 — Verificar controles de navegación', async ({ app, nav }) => {
    await nav.goTo('Agenda');
    await app.waitForTimeout(2000);

    // Buscar botones de navegación semanal
    const navBtns = app.getByRole('button');
    const count = await navBtns.count();
    expect(count).toBeGreaterThanOrEqual(2); // al menos prev/next
  });

  test('8.3 — Verificar que no crashea', async ({ app, nav }) => {
    await nav.goTo('Agenda');
    await app.waitForTimeout(3000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });
});
