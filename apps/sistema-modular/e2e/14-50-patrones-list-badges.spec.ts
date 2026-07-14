/**
 * Phase 14 BOM-06 — UAT automatizada de la visibilidad del estado BOM en
 * PatronesList + PatronEditorPage.
 *
 * Reemplaza los 4 puntos de UAT manual del checkpoint del plan 14-05:
 *  14.50  badge BOM (teal) cuando patron tiene componentes
 *  14.51  badges Bloqueado/Agotado (rosa) cuando saldo ≤ stockMinimo
 *  14.52  filtro "Bloqueados" persistido en URL + filtra la tabla
 *  14.53  alert banner rosa en el editor cuando hay componentes bajo mínimo
 *  14.54  legacy patron (sin componentes) → ningún badge ni banner
 */

import { test, expect } from './fixtures/test-base';
import type { Page } from '@playwright/test';
import {
  seedPatronBom,
  cleanupPatronBomFixture,
  type SeededPatron,
} from './helpers/patronBom';

const BASE = 'http://localhost:3001';

/** Helper — espera a que la lista termine de cargar (al menos una fila visible o un empty state) */
async function waitForListLoaded(page: Page): Promise<void> {
  await page.waitForSelector(
    '[data-testid="patron-row"], table tbody tr, [class*="empty"]',
    { timeout: 15_000 },
  );
}

test.describe.serial('14.50 — Patrones BOM visibility (BOM-06)', () => {
  let healthy: SeededPatron | null = null;     // patron con componentes pero todos OK
  let bloqueado: SeededPatron | null = null;   // patron con un componente bajo mínimo
  let legacy: SeededPatron | null = null;      // patron sin componentes

  // NOTA 2026-07: el seed corre en el browser autenticado (fixture `app`), que
  // es test-scoped — beforeAll/afterAll no pueden usarla. La suite es serial,
  // así que seed y cleanup son tests explícitos (mismo patrón que 15.99).
  test('14.50.0 — seed fixtures de patrones', async ({ app, nav }) => {
    await nav.ensureLoaded();
    // Patron sano: BOM-aware, saldo abundante
    healthy = await seedPatronBom(app, {
      codigoArticulo: `TEST-HEALTHY-${Date.now()}`,
      componentes: [{
        codigoComponente: 'amp-A',
        descripcion: 'Ampolla A',
        cantidadPorKit: 3,
        unidadMedida: 'ampolla',
        stockMinimo: 1,
      }],
      lotes: [{ lote: `L-OK-${Date.now()}`, cantidad: 5, fechaVencimiento: null }],
    });

    // Patron bloqueado: saldo = stockMinimo → status 'agotado' (todos los componentes)
    // saldo = 1*3 - 3 = 0, minimo = 1 → 0 ≤ 1 → bloqueado/agotado
    bloqueado = await seedPatronBom(app, {
      codigoArticulo: `TEST-BLOQ-${Date.now()}`,
      componentes: [{
        codigoComponente: 'amp-Z',
        descripcion: 'Ampolla Z',
        cantidadPorKit: 3,
        unidadMedida: 'ampolla',
        stockMinimo: 1,
      }],
      lotes: [{
        lote: `L-BLOQ-${Date.now()}`,
        cantidad: 1,
        fechaVencimiento: null,
        componentesConsumidos: [{ codigoComponente: 'amp-Z', cantidadConsumida: 3 }],
      }],
    });

    // Patron legacy: sin componentes
    legacy = await seedPatronBom(app, {
      codigoArticulo: `TEST-LEGACY-${Date.now()}`,
      componentes: [],
      lotes: [{ lote: `L-LEG-${Date.now()}`, cantidad: 1, fechaVencimiento: null }],
    });
  });

  test('14.50 — patron BOM-aware muestra badge "BOM" (teal) en la fila', async ({ app }) => {
    await app.goto(`${BASE}/patrones`);
    await waitForListLoaded(app);

    const row = app.locator(`[data-testid="patron-row"][data-patron-id="${healthy!.patronId}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('[data-testid="badge-bom"]')).toBeVisible();
    // Patron sano: NO debería tener badges rosa
    await expect(row.locator('[data-testid="badge-bloqueado"]')).toHaveCount(0);
    await expect(row.locator('[data-testid="badge-agotado"]')).toHaveCount(0);
  });

  test('14.51 — patron con saldo ≤ stockMinimo muestra badge Bloqueado/Agotado (rosa)', async ({ app }) => {
    await app.goto(`${BASE}/patrones`);
    await waitForListLoaded(app);

    const row = app.locator(`[data-testid="patron-row"][data-patron-id="${bloqueado!.patronId}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    // BOM badge sigue mostrándose (es BOM-aware)
    await expect(row.locator('[data-testid="badge-bom"]')).toBeVisible();
    // status 'agotado' (todos los componentes bajo minimo) — badge agotado
    const badgeAgotado = row.locator('[data-testid="badge-agotado"]');
    const badgeBloqueado = row.locator('[data-testid="badge-bloqueado"]');
    // Acepta cualquiera de los dos — depende de si TODOS los componentes están bajo mínimo
    // o solo algunos. Con un solo componente bajo mínimo, todos lo están → 'agotado'.
    const visibleBadge = (await badgeAgotado.count()) > 0 ? 'agotado' : 'bloqueado';
    if (visibleBadge === 'agotado') {
      await expect(badgeAgotado).toBeVisible();
    } else {
      await expect(badgeBloqueado).toBeVisible();
    }
    // Confirmar via attribute en la row
    const status = await row.getAttribute('data-bom-status');
    expect(['bloqueado', 'agotado']).toContain(status);
  });

  test('14.52 — filtro "Bloqueados" gana ?bloqueados=true en URL + filtra la lista', async ({ app }) => {
    await app.goto(`${BASE}/patrones`);
    await waitForListLoaded(app);

    // Ambos patrones visibles inicialmente
    const healthyRow = app.locator(`[data-testid="patron-row"][data-patron-id="${healthy!.patronId}"]`);
    const bloqueadoRow = app.locator(`[data-testid="patron-row"][data-patron-id="${bloqueado!.patronId}"]`);
    await expect(healthyRow).toBeVisible({ timeout: 10_000 });
    await expect(bloqueadoRow).toBeVisible();

    // Activar el filtro (click toggle, no check() para evitar racing con React state)
    await app.locator('[data-testid="filter-bloqueados"]').click();
    await app.waitForTimeout(500);

    // URL debe contener ?bloqueados=true
    expect(app.url()).toContain('bloqueados=true');

    // El sano YA NO debe estar visible; el bloqueado SÍ
    await expect(healthyRow).toHaveCount(0);
    await expect(bloqueadoRow).toBeVisible();

    // Desactivar filtro vía toggle — URL pierde el param, ambos vuelven
    await app.locator('[data-testid="filter-bloqueados"]').click();
    await app.waitForTimeout(500);
    expect(app.url()).not.toContain('bloqueados=true');
    await expect(healthyRow).toBeVisible();
    await expect(bloqueadoRow).toBeVisible();
  });

  test('14.53 — alert banner aparece en el editor cuando hay componentes bajo mínimo', async ({ app }) => {
    // Editor del patron bloqueado
    await app.goto(`${BASE}/patrones/${bloqueado!.patronId}/editar`);
    await app.getByRole('button', { name: /guardar y cerrar/i }).waitFor({ timeout: 15_000 });

    const banner = app.locator('[data-testid="patron-componentes-alert-banner"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    // El banner lista el componente con saldo, mínimo y lote
    await expect(banner).toContainText('amp-Z');
    await expect(banner).toContainText('saldo');
    await expect(banner).toContainText('mínimo');

    // Editor del patron sano — banner NO aparece
    await app.goto(`${BASE}/patrones/${healthy!.patronId}/editar`);
    await app.getByRole('button', { name: /guardar y cerrar/i }).waitFor({ timeout: 15_000 });
    await expect(app.locator('[data-testid="patron-componentes-alert-banner"]')).toHaveCount(0);
  });

  test('14.54 — patron legacy (sin componentes) → ningún badge BOM ni banner', async ({ app }) => {
    await app.goto(`${BASE}/patrones`);
    await waitForListLoaded(app);

    const row = app.locator(`[data-testid="patron-row"][data-patron-id="${legacy!.patronId}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('[data-testid="badge-bom"]')).toHaveCount(0);
    await expect(row.locator('[data-testid="badge-bloqueado"]')).toHaveCount(0);
    await expect(row.locator('[data-testid="badge-agotado"]')).toHaveCount(0);
    expect(await row.getAttribute('data-bom')).toBe('false');

    // Y en su editor: banner NO aparece (return null por componentes.length === 0)
    await app.goto(`${BASE}/patrones/${legacy!.patronId}/editar`);
    await app.getByRole('button', { name: /guardar y cerrar/i }).waitFor({ timeout: 15_000 });
    await expect(app.locator('[data-testid="patron-componentes-alert-banner"]')).toHaveCount(0);
  });

  test('14.55 — cleanup fixtures de patrones', async ({ app }) => {
    for (const p of [healthy, bloqueado, legacy]) {
      if (p) await cleanupPatronBomFixture(app, { patronId: p.patronId });
    }
  });
});
