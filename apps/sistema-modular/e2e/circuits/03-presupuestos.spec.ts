import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 3: Presupuestos', () => {
  test.describe.configure({ mode: 'serial' });

  test('3.1 — Navegar a Presupuestos', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.2 — Crear nuevo presupuesto', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');

    await app.getByRole('button', { name: '+ Nuevo Presupuesto' }).click();
    await app.waitForTimeout(1500);

    // Tipo (select nativo — usar selectOption como codegen)
    await app.getByRole('combobox').nth(4).selectOption('servicio');
    await app.waitForTimeout(300);

    // Cliente (SearchableSelect — click en combobox, luego opción del listbox)
    await app.getByRole('combobox').filter({ hasText: 'Seleccionar cliente...' }).click();
    await app.waitForTimeout(800);
    // Las opciones del SearchableSelect están en un listbox portal con role="option"
    // Filtrar para no matchear <option> de <select> nativos
    const clientOpts = app.locator('[role="listbox"] [role="option"], ul li');
    const firstClient = clientOpts.first();
    await firstClient.waitFor({ timeout: 5000 });
    await firstClient.click();
    await app.waitForTimeout(1500);

    // Catálogo de servicios (si aparece)
    const catalogCombo = app.getByRole('combobox').filter({ hasText: 'Carga manual...' });
    if (await catalogCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await catalogCombo.click();
      await app.waitForTimeout(500);
      const firstConcept = app.getByRole('option').first();
      if (await firstConcept.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstConcept.click();
        await app.waitForTimeout(500);
      }
    }

    // Agregar línea (botón puede estar fuera de viewport)
    const addBtn = app.getByRole('button', { name: '+ Agregar' });
    await addBtn.evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(500);

    // Crear presupuesto (botón puede estar fuera de viewport)
    const createBtn = app.getByRole('button', { name: 'Crear presupuesto' });
    await createBtn.evaluate((el: HTMLElement) => el.click());
    await app.waitForTimeout(3000);
  });

  test('3.3 — Verificar presupuesto en lista', async ({ app, nav }) => {
    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('3.4 — Abrir detalle de presupuesto', async ({ app }) => {
    const firstRow = app.locator('tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });
});
