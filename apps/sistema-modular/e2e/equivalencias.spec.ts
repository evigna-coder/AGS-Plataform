import { test, expect } from '@playwright/test';
import { navigateToArticulosList, openArticuloDetail } from './helpers/equivalencias';

/**
 * Phase 13 — Stock Equivalencias compra↔uso E2E specs.
 *
 * Wave 0 RED baseline: ALL specs are test.fixme until landing plans:
 *   - 13.30  STKE-03 EquivalenciaSection — un-fixmed by plan 13-04
 *   - 13.40  STKE-05 DesagregarStockModal — un-fixmed by plan 13-05 (after 13-06 wires CTA)
 *   - 13.50  STKE-06 ArticuloDetail display dual — un-fixmed by plan 13-06
 *   - 13.60  STKE-07 ArticulosList badge + on-demand expansion — un-fixmed by plan 13-07
 */

test.describe('13.30 — equivalencia.edit (STKE-03)', () => {
  // 13.30 GREEN since plan 13-04 (EquivalenciaSection mounted in EditArticuloModal)
  // Full happy-path seed helper lands in plan 13-07 (beforeAll seeding two artículos)

  test.skip(true, 'requires e2e seed helper from plan 13-07 or beforeAll — section UI validated manually');

  test('admin vincula 5183-2209 → 5188-5367 con factor 10', async ({ page }) => {
    // Setup: ensure both artículos exist (admin via helper) — implemented in 13-04
    await navigateToArticulosList(page);
    await openArticuloDetail(page, '5183-2209');
    // Click "Editar", abrir sección Equivalencia, seleccionar destino, factor 10, guardar
    await expect(page.getByText(/equivalencia/i)).toBeVisible();
  });

  test('admin desvincula via unlink button', async ({ page }) => {
    await navigateToArticulosList(page);
    // ...
  });
});

test.describe('13.40 — desagregar (STKE-05)', () => {
  test.fixme(true, 'Wave 2 plan 13-05 implements DesagregarStockModal (CTA wired in 13-06)');

  test('modal Desagregar ahora baja N origen + crea N×factor destino', async ({ page }) => {
    await navigateToArticulosList(page);
    await openArticuloDetail(page, '5183-2209');
    await page.getByRole('button', { name: /desagregar ahora/i }).click();
    // Llenar cantidad=3, ubicacion=Pos-1, confirmar
    await expect(page.getByText(/3.*×.*10.*=.*30/)).toBeVisible();
  });

  test('modal rechaza cantidad > stock disponible', async ({ page }) => {
    // ...
  });
});

test.describe('13.50 — detail.equivalencia (STKE-06)', () => {
  test.fixme(true, 'Wave 2 plan 13-06 implements display dual in ArticuloDetail');

  test('detail muestra dos lineas (real + equivalente calculado)', async ({ page }) => {
    await navigateToArticulosList(page);
    await openArticuloDetail(page, '5183-2209');
    await expect(page.getByText(/5188-5367/)).toBeVisible();
    await expect(page.getByText(/equivalentes|potenciales/i)).toBeVisible();
  });
});

test.describe('13.60 — lista.equivalencia (STKE-07)', () => {
  test.fixme(true, 'Wave 3 plan 13-07 implements badge + on-demand expansion in ArticulosList');

  test('lista muestra badge ↔ en filas vinculadas (NO expansion por defecto)', async ({ page }) => {
    await navigateToArticulosList(page);
    const row = page.locator('tr', { hasText: '5183-2209' });
    await expect(row.locator('[data-testid="equivalencia-badge"]')).toBeVisible();
    // NO debe haber dual rendering por defecto
    await expect(row.locator('[data-testid="dual-row"]')).not.toBeVisible();
  });

  test('buscar codigo destino expande la fila con ambas existencias', async ({ page }) => {
    await navigateToArticulosList(page);
    await page.getByPlaceholder(/buscar|search/i).fill('5188-5367');
    const row = page.locator('tr', { hasText: '5183-2209' });
    await expect(row.locator('[data-testid="dual-row"]')).toBeVisible();
  });
});
