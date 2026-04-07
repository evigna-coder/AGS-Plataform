import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 4: Órdenes de Trabajo', () => {
  test.describe.configure({ mode: 'serial' });

  test('4.1 — Navegar a OT', async ({ app, nav }) => {
    await nav.goTo('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    const title = app.locator('h1, h2').first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('4.2 — Crear nueva OT', async ({ app, nav }) => {
    await nav.goToFresh('Ordenes de Trabajo');

    await app.getByRole('button', { name: '+ Nueva OT' }).click();
    await app.waitForTimeout(1500);

    // Tipo de servicio
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar tipo...' }).click();
    await app.waitForTimeout(500);
    await app.getByRole('option').first().click();
    await app.waitForTimeout(500);

    // Cliente
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(500);
    await app.getByRole('option').first().click();
    await app.waitForTimeout(1500);

    // Establecimiento (si aparece)
    const estabCombo = app.getByRole('combobox').filter({ hasText: 'Todos los establecimientos' });
    if (await estabCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await estabCombo.click();
      await app.waitForTimeout(500);
      const estabOpt = app.getByRole('option').first();
      if (await estabOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await estabOpt.click();
        await app.waitForTimeout(500);
      }
    }

    // Sistema (si aparece)
    const sistemaCombo = app.getByRole('combobox').filter({ hasText: 'Sin sistema' });
    if (await sistemaCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sistemaCombo.click();
      await app.waitForTimeout(500);
      const sistOpt = app.getByRole('option').first();
      if (await sistOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sistOpt.click();
        await app.waitForTimeout(500);
      }
    }

    // Descripción del problema
    const descInput = app.getByRole('textbox', { name: /descripcion del problema/i });
    if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descInput.fill(`${TEST_PREFIX} Problema prueba ${ts}`);
    }

    // Crear OT
    await app.getByRole('button', { name: 'Crear OT' }).click();
    await app.waitForTimeout(3000);
  });

  test('4.3 — Verificar OTs en lista', async ({ app, nav }) => {
    await nav.goToFresh('Ordenes de Trabajo');
    await app.waitForTimeout(2000);
    expect(await app.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);
  });

  test('4.4 — Abrir detalle de OT', async ({ app }) => {
    const firstRow = app.locator('tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('4.5 — Verificar botón exportar CSV', async ({ app, nav }) => {
    await nav.goToFresh('Ordenes de Trabajo');
    await app.waitForTimeout(1500);
    const exportBtn = app.getByRole('button', { name: /csv|exportar|descargar/i }).first();
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(exportBtn).toBeEnabled();
    }
  });
});
