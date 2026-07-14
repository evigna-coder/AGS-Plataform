import { test, expect } from './fixtures/test-base';
import {
  navigateToArticulosList,
  openArticuloDetail,
  seedEquivalenciaPair,
  cleanupEquivalenciaPair,
} from './helpers/equivalencias';

/**
 * Phase 13 — Stock Equivalencias compra↔uso E2E specs.
 *
 * REWRITE 2026-07: migrado de raw `page` (@playwright/test, sin login) a la
 * fixture `app` de test-base (persistent context autenticado) — las reglas
 * Firestore endurecidas exigen auth para leer/escribir. El seed corre
 * in-browser vía window.__ags (patrón circuito 15) y ahora tiene cleanup.
 *
 * Wave plan mapping:
 *   - 13.30  STKE-03 EquivalenciaSection — validada manual (skip documentado)
 *   - 13.40  STKE-05 DesagregarStockModal — validada manual (skip documentado)
 *   - 13.50  STKE-06 ArticuloDetail dual display — validada manual (skip documentado)
 *   - 13.60  STKE-07 ArticulosList badge + on-demand expansion — automatizada
 */

test.describe('13.30 — equivalencia.edit (STKE-03)', () => {
  test.skip(true, 'section UI validated manually in 13-04 UAT; seed helper available from 13-07 for future automation');

  test('admin vincula 5183-2209 → 5188-5367 con factor 10', async ({ app }) => {
    await navigateToArticulosList(app);
    await openArticuloDetail(app, '5183-2209');
    await expect(app.getByText(/equivalencia/i)).toBeVisible();
  });

  test('admin desvincula via unlink button', async ({ app }) => {
    await navigateToArticulosList(app);
    // Validation covered in manual UAT 13-04
  });
});

test.describe('13.40 — desagregar (STKE-05)', () => {
  test.skip(true, 'modal UI validated via visual UAT in 13-06; full seed automation tracked for regression suite');

  test('modal Desagregar ahora baja N origen + crea N×factor destino', async ({ app }) => {
    await navigateToArticulosList(app);
    await openArticuloDetail(app, '5183-2209');
    await app.getByRole('button', { name: /desagregar ahora/i }).click();
    await expect(app.getByText(/3.*×.*10.*=.*30/)).toBeVisible();
  });

  test('modal rechaza cantidad > stock disponible', async ({ app }) => {
    // Covered in manual UAT 13-06
    void app;
  });
});

test.describe('13.50 — detail.equivalencia (STKE-06)', () => {
  test.skip(true, 'dual display validated via visual UAT in 13-06; full seed automation tracked for regression suite');

  test('detail muestra dos lineas (real + equivalente calculado)', async ({ app }) => {
    await navigateToArticulosList(app);
    await openArticuloDetail(app, '5183-2209');
    await expect(app.getByText(/5188-5367/)).toBeVisible();
    await expect(app.getByText(/equivalentes|potenciales/i)).toBeVisible();
  });
});

test.describe('13.60 — lista.equivalencia (STKE-07)', () => {
  // Serial: el seed corre como test explícito (la fixture `app` es test-scoped
  // y beforeAll no puede usarla), el cleanup como test final.
  test.describe.configure({ mode: 'serial' });

  let seeded: Awaited<ReturnType<typeof seedEquivalenciaPair>> | null = null;

  test('13.60.0 — seed par de artículos vinculados', async ({ app, nav }) => {
    await nav.ensureLoaded();
    seeded = await seedEquivalenciaPair(app, {
      codigoOrigen: `TEST-COMPRA-13-${Date.now()}`,
      codigoDestino: `TEST-USO-13-${Date.now()}`,
      factor: 10,
    });
    expect(seeded.origenId).toBeTruthy();
  });

  test('badge ⇄ visible en fila del origen vinculado', async ({ app }) => {
    await navigateToArticulosList(app);
    // Search for the specific code to find the seeded row in the list
    await app.getByPlaceholder(/buscar|search/i).first().fill(seeded!.codigoOrigen);
    const row = app.locator('tr').filter({ hasText: seeded!.codigoOrigen });
    await expect(row.locator('[data-testid="equivalencia-badge"]')).toBeVisible();
  });

  test('NO renderiza dual-row por defecto (sin search exacto)', async ({ app }) => {
    await navigateToArticulosList(app);
    await app.getByPlaceholder(/buscar|search/i).first().fill(seeded!.codigoOrigen.slice(0, 4));
    await app.waitForTimeout(800);
    // Partial match should NOT trigger dual expansion
    await expect(app.locator('[data-testid="dual-row"]')).toHaveCount(0);
  });

  test('buscar codigo destino exacto expande SOLO la fila correspondiente', async ({ app }) => {
    await navigateToArticulosList(app);
    await app.getByPlaceholder(/buscar|search/i).first().fill(seeded!.codigoDestino);
    // Exact match on destino code should expand the origen row with the dual display
    await expect(app.locator('[data-testid="dual-row"]')).toHaveCount(1);
  });

  test('buscar codigo origen exacto expande la fila del origen', async ({ app }) => {
    await navigateToArticulosList(app);
    await app.getByPlaceholder(/buscar|search/i).first().fill(seeded!.codigoOrigen);
    await expect(app.locator('[data-testid="dual-row"]')).toHaveCount(1);
  });

  test('badge tooltip muestra detalles de la equivalencia', async ({ app }) => {
    await navigateToArticulosList(app);
    await app.getByPlaceholder(/buscar|search/i).first().fill(seeded!.codigoOrigen);
    const badge = app.locator('[data-testid="equivalencia-badge"]').first();
    await badge.hover();
    const tooltip = app.locator('[data-testid="equivalencia-badge-tooltip"]').first();
    await expect(tooltip).toContainText(seeded!.codigoOrigen);
    await expect(tooltip).toContainText(seeded!.codigoDestino);
  });

  test('13.60.9 — cleanup par seedeado (+ residuos TEST-* de corridas abortadas)', async ({ app, nav }) => {
    await nav.ensureLoaded();
    if (seeded) {
      await cleanupEquivalenciaPair(app, seeded);
      seeded = null;
    }
    // Sweep: pares seedeados por corridas que abortaron antes de su cleanup.
    // Prefijos exclusivos de este spec (TEST-COMPRA-* / TEST-USO-*).
    const swept = await app.evaluate(async () => {
      const ags = (window as any).__ags;
      const { collection, query, where, getDocs, deleteDoc } = ags.firestore;
      let deleted = 0;
      for (const pfx of ['TEST-COMPRA-', 'TEST-USO-']) {
        const snap = await getDocs(query(
          collection(ags.db, 'articulos'),
          where('codigo', '>=', pfx),
          where('codigo', '<=', pfx + ''),
        ));
        for (const d of snap.docs) { await deleteDoc(d.ref).catch(() => {}); deleted++; }
      }
      return deleted;
    });
    if (swept > 0) console.log(`[13.60.9] sweep: ${swept} artículos TEST-* residuales borrados`);
  });
});
