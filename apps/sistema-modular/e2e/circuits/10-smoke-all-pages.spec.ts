import { test, expect } from '../fixtures/test-base';

/**
 * CIRCUITO 10: Smoke Test — Todas las páginas cargan sin errores
 */

const ALL_SIDEBAR_ITEMS = [
  'Clientes', 'Establecimientos', 'Equipos', 'Ordenes de Trabajo',
  'Tickets', 'Presupuestos', 'Biblioteca Tablas', 'Dispositivos',
  'Instrumentos', 'Loaners', 'Contratos', 'Facturacion', 'Usuarios', 'Agenda',
];

const STOCK_SUBITEMS = [
  'Articulos', 'Unidades', 'Minikits', 'Remitos', 'Movimientos',
  'Alertas', 'Ordenes de Compra', 'Importaciones', 'Proveedores',
  'Posiciones', 'Marcas',
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
});
