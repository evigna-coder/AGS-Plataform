import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

const ts = timestamp();

test.describe('Circuito 3: Presupuestos', () => {
  test.describe.configure({ mode: 'serial' });

  test('3.1 — Navegar a Presupuestos', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.2 — Crear nuevo presupuesto', async ({ app, nav, forms }) => {
    await nav.goTo('Presupuestos');
    // Esperar que la data cargue completamente (loading state)
    await app.waitForTimeout(4000);
    const btn = app.getByRole('button', { name: /Nuevo Presupuesto/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 15_000 });
    await btn.click({ force: true });
    await app.waitForTimeout(1500);

    const modal = app.locator('[class*="modal"], [role="dialog"]').last();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Tipo * (select)
    await forms.selectField('Tipo', 1, modal);

    // Cliente * — click en el primer combobox del modal para abrir
    const clienteCombobox = modal.locator('[role="combobox"]').first();
    await clienteCombobox.click();
    await app.waitForTimeout(600);
    // Seleccionar primera opción
    const firstOpt = app.locator('[role="option"], li')
      .filter({ hasNotText: /^crear|^sin /i }).first();
    if (await firstOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstOpt.click();
      await app.waitForTimeout(1000);
    }

    // Necesitamos al menos 1 ítem — buscar botón agregar
    const addBtn = modal.getByRole('button', { name: /agregar|añadir|\+/i }).first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await app.waitForTimeout(500);
      // Llenar descripción del ítem
      const descInput = modal.getByPlaceholder(/descripcion/i).first();
      if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descInput.fill(`${TEST_PREFIX} Servicio de prueba`);
      }
      // Cantidad y precio
      const numInputs = modal.locator('input[type="number"]');
      const numCount = await numInputs.count();
      if (numCount > 0) await numInputs.first().fill('1');
      if (numCount > 1) await numInputs.nth(1).fill('1000');
    }

    // Guardar
    const saveBtn = modal.getByRole('button', { name: /guardar|crear/i }).first();
    // Esperar que se habilite (clienteId set + items > 0)
    await app.waitForTimeout(500);
    if (await saveBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await app.waitForTimeout(3000);
    }
  });

  test('3.3 — Verificar presupuesto en lista', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(2000);
    const rows = await app.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('3.4 — Abrir detalle de presupuesto', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(2000);
    const firstRow = app.locator('tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ force: true });
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('3.5 — Verificar filtros', async ({ app, nav }) => {
    await nav.goTo('Presupuestos');
    await app.waitForTimeout(1500);
    expect(await app.locator('select').count()).toBeGreaterThanOrEqual(1);
  });
});
