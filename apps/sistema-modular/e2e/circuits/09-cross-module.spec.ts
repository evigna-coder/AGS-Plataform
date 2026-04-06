import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

/**
 * CIRCUITO 9: Cross-Module — Navegación rápida + módulos secundarios
 */

test.describe('Circuito 9: Flujos Cross-Module', () => {
  test.describe.configure({ mode: 'serial' });

  test('9.1 — Navegar entre módulos principales', async ({ app, nav }) => {
    const modules = ['Clientes', 'Equipos', 'Tickets', 'Presupuestos', 'Ordenes de Trabajo', 'Contratos'];
    for (const mod of modules) {
      await nav.goTo(mod);
      await app.waitForTimeout(800);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
    }
  });

  test('9.2 — Verificar Usuarios', async ({ app, nav }) => {
    await nav.goTo('Usuarios');
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('9.3 — Verificar Biblioteca Tablas', async ({ app, nav }) => {
    await nav.goTo('Biblioteca Tablas');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('9.4 — Verificar Dispositivos', async ({ app, nav }) => {
    await nav.goTo('Dispositivos');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('9.5 — Verificar Vehículos', async ({ app, nav }) => {
    await nav.goTo('Vehículos');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('9.6 — Verificar Instrumentos', async ({ app, nav }) => {
    await nav.goTo('Instrumentos');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('9.7 — Verificar Fichas Propiedad', async ({ app, nav }) => {
    await nav.goTo('Fichas');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('9.8 — Verificar Loaners', async ({ app, nav }) => {
    await nav.goTo('Loaners');
    await app.waitForTimeout(1500);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('9.9 — Verificar Calif. Proveedores', async ({ app, nav }) => {
    // Este módulo puede no estar visible según permisos del usuario
    const menuItem = app.locator('aside nav').getByText('Calif. Proveedores', { exact: false }).first();
    if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuItem.scrollIntoViewIfNeeded();
      await menuItem.click({ force: true });
      await app.waitForTimeout(1500);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
    }
    // Si no está visible, skip gracefully (no tiene permiso)
  });
});
