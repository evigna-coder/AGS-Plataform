import { test, expect } from '../fixtures/test-base';

/**
 * CIRCUITO 10: Smoke Test — Todas las páginas cargan sin errores
 */

// Establecimientos no tiene entrada propia en el sidebar — se accede desde
// el detalle de cada Cliente (ver navigation.ts:20). Removido del smoke 2026-04-25.
const ALL_SIDEBAR_ITEMS = [
  'Clientes', 'Equipos', 'Ordenes de Trabajo',
  'Tickets', 'Presupuestos', 'Biblioteca Tablas', 'Dispositivos',
  'Instrumentos', 'Loaners', 'Contratos', 'Facturacion', 'Usuarios', 'Agenda',
];

const STOCK_SUBITEMS = [
  'Articulos', 'Unidades', 'Minikits', 'Remitos', 'Movimientos',
  'Alertas', 'Ordenes de Compra', 'Importaciones', 'Proveedores',
  'Posiciones', 'Marcas',
];

/**
 * Admin routes smoke — FLOW-07 lands /admin/config-flujos (plan 08-05)
 * and /admin/acciones-pendientes (plan 08-05). Navegación directa vía URL
 * (aún no hay sidebar children bajo "Admin" root consolidado — la decisión
 * del Research queda abierta).
 *
 * RED baseline: both routes return 404/"Not Found" until plan 08-05 lands.
 */
const ADMIN_ROUTES: Array<{ path: string; expectedHeading: RegExp }> = [
  { path: '/admin/config-flujos', expectedHeading: /config.*fluj|flujos autom/i },
  { path: '/admin/acciones-pendientes', expectedHeading: /acciones pendientes|pending actions/i },
];

test.describe('Circuito 10: Smoke Test — Todas las páginas', () => {
  for (const item of ALL_SIDEBAR_ITEMS) {
    test(`Smoke: ${item}`, async ({ app, nav }) => {
      await nav.goTo(item);
      await app.waitForTimeout(2000);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
      // Sidebar sigue visible = la app no crasheó
      const sidebar = app.locator('nav, aside').first();
      await expect(sidebar).toBeVisible();
    });
  }

  for (const subitem of STOCK_SUBITEMS) {
    test(`Smoke: Stock > ${subitem}`, async ({ app, nav }) => {
      await nav.goToStock(subitem);
      await app.waitForTimeout(2000);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
      await expect(app.locator('nav, aside').first()).toBeVisible();
    });
  }

  for (const { path: routePath, expectedHeading } of ADMIN_ROUTES) {
    test(`Smoke: Admin ${routePath}`, async ({ app }) => {
      await app.goto(`http://localhost:3001${routePath}`);
      await app.waitForTimeout(2000);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
      // Sidebar visible = app no crasheó.
      await expect(app.locator('nav, aside').first()).toBeVisible();
      // El heading de la página admin debe aparecer (RED hasta plan 08-05).
      const heading = app
        .locator('h1, h2')
        .filter({ hasText: expectedHeading })
        .first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
  }
});
