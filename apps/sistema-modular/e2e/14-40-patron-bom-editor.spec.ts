/**
 * Phase 14 BOM-04 — UAT automatizada del editor de componentes (BOM) en patrones.
 *
 * Reemplaza los 4 pasos de UAT manual del checkpoint del plan 14-04:
 *  - 14.40 happy path: agregar componente → guardar → reload → persiste
 *  - 14.41 validación: dos filas con mismo código bloquean save vía alert
 *  - 14.42 lock guard: lote con componentesConsumidos muestra 🔒, input
 *    disabled, delete bloqueado vía alert
 *
 * Usa la `app` fixture de test-base.ts (persistent context con login profile
 * guardado por `pnpm e2e:setup`) — equivalencias.spec.ts usa raw `page` y
 * no tiene login, ese patrón no funciona para tests que tocan UI logged-in.
 */

import { test, expect } from './fixtures/test-base';
import type { Page, Dialog } from '@playwright/test';
import {
  seedPatronBom,
  cleanupPatronBomFixture,
  getPatron,
  type SeededPatron,
} from './helpers/patronBom';

const BASE = 'http://localhost:3001';

/** Captura el siguiente dialog (alert/confirm) y lo accept-ea, devolviendo el mensaje. */
async function captureNextDialog(page: Page): Promise<string> {
  return new Promise<string>((resolve) => {
    const handler = (dialog: Dialog) => {
      const msg = dialog.message();
      void dialog.accept();
      page.off('dialog', handler);
      resolve(msg);
    };
    page.on('dialog', handler);
  });
}

test.describe.serial('14.40 — Patron BOM Editor (BOM-04)', () => {
  let seeded: SeededPatron | null = null;

  test.afterEach(async () => {
    if (seeded) {
      await cleanupPatronBomFixture({ patronId: seeded.patronId });
      seeded = null;
    }
  });

  test('14.40.1 — agregar componente → guardar → reload → persiste', async ({ app }) => {
    // Seed: patron SIN componentes (queremos drive la UI para agregar)
    seeded = await seedPatronBom({ componentes: [] });
    const editorUrl = `${BASE}/patrones/${seeded.patronId}/editar`;
    await app.goto(editorUrl);
    // Esperar que el editor monte (el form, no el loading state)
    await app.getByRole('button', { name: /guardar y cerrar/i }).waitFor({ timeout: 15_000 });

    // La sección BOM existe — empty state visible con el CTA "+ Agregar componente"
    await expect(app.locator('[data-testid="bom-empty"]')).toBeVisible({ timeout: 10_000 });
    await app.locator('[data-testid="bom-add-btn"]').first().click();

    // Una fila aparece — completar todos los inputs por testid + label scope
    const row = app.locator('[data-testid="bom-row"]').first();
    await expect(row).toBeVisible();
    await row.locator('[data-testid="bom-codigo-input"]').fill('amp-A');
    // Los demás campos no tienen testid; los identificamos por placeholder (estables)
    await row.getByPlaceholder('Ampolla cafeína').fill('Ampolla cafeína E2E');
    // Cantidad por kit + stockMinimo son los inputs type=number dentro de la fila
    const numericInputs = row.locator('input[type="number"]');
    await numericInputs.nth(0).fill('3');
    await numericInputs.nth(1).fill('1');
    // Unidad ya viene defaulteada a 'ampolla' por addRow() — no es necesario llenar

    // Guardar y cerrar — navega a /patrones tras éxito
    await app.getByRole('button', { name: /guardar y cerrar/i }).click();
    await app.waitForURL(/\/patrones(\?|$)/, { timeout: 10_000 });

    // Verificación 1 — el doc en Firestore tiene el componente
    const patronDoc = await getPatron(seeded.patronId);
    expect(patronDoc?.componentes ?? []).toHaveLength(1);
    expect(patronDoc.componentes[0].codigoComponente).toBe('amp-A');
    expect(patronDoc.componentes[0].cantidadPorKit).toBe(3);
    expect(patronDoc.componentes[0].stockMinimo).toBe(1);

    // Verificación 2 — al recargar el editor, el componente persiste en UI
    await app.goto(editorUrl);
    const reloadedRow = app
      .locator('[data-testid="bom-row"][data-codigo="amp-A"]')
      .first();
    await expect(reloadedRow).toBeVisible({ timeout: 10_000 });
    await expect(reloadedRow.locator('[data-testid="bom-codigo-input"]')).toHaveValue('amp-A');
  });

  test('14.41 — dos filas con mismo código → alert bloquea save', async ({ app }) => {
    seeded = await seedPatronBom({ componentes: [] });
    await app.goto(`${BASE}/patrones/${seeded.patronId}/editar`);

    await expect(app.locator('[data-testid="bom-empty"]')).toBeVisible({ timeout: 10_000 });

    // Agregar primera fila
    await app.locator('[data-testid="bom-add-btn"]').first().click();
    const row1 = app.locator('[data-testid="bom-row"]').nth(0);
    await row1.locator('[data-testid="bom-codigo-input"]').fill('amp-A');
    await row1.getByPlaceholder('Ampolla cafeína').fill('Primera ampolla');

    // Agregar segunda fila con el MISMO codigo
    await app.locator('[data-testid="bom-add-btn"]').first().click();
    const row2 = app.locator('[data-testid="bom-row"]').nth(1);
    await expect(row2).toBeVisible();
    await row2.locator('[data-testid="bom-codigo-input"]').fill('amp-A');
    await row2.getByPlaceholder('Ampolla cafeína').fill('Duplicada');

    // Save — esperamos alert de validación
    const dialogPromise = captureNextDialog(app);
    await app.getByRole('button', { name: /guardar y cerrar/i }).click();
    const msg = await dialogPromise;
    expect(msg.toLowerCase()).toMatch(/duplic|repet|igual|amp-a/);

    // La página NO debe haber navegado — sigue en el editor
    await app.waitForTimeout(800);
    expect(app.url()).toContain(`/patrones/${seeded.patronId}`);

    // Doc en Firestore sigue sin componentes (no se persistió)
    const after = await getPatron(seeded.patronId);
    expect(after?.componentes ?? []).toHaveLength(0);
  });

  test('14.42 — componente con consumos previos: 🔒, input disabled, delete bloqueado', async ({ app }) => {
    // Seed: patron con componente AMP-A y un lote que YA tiene consumos sobre AMP-A
    seeded = await seedPatronBom({
      componentes: [
        {
          codigoComponente: 'amp-A',
          descripcion: 'Ampolla cafeína (lockeada)',
          cantidadPorKit: 3,
          unidadMedida: 'ampolla',
          stockMinimo: 1,
        },
      ],
      lotes: [
        {
          lote: `L-LOCK-${Date.now()}`,
          cantidad: 2,
          fechaVencimiento: null,
          componentesConsumidos: [{ codigoComponente: 'amp-A', cantidadConsumida: 1 }],
        },
      ],
    });
    await app.goto(`${BASE}/patrones/${seeded.patronId}/editar`);

    const row = app.locator('[data-testid="bom-row"][data-codigo="amp-A"]').first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // 🔒 indicator visible
    await expect(row.locator('[data-testid="bom-locked-indicator"]')).toBeVisible();

    // Input deshabilitado
    await expect(row.locator('[data-testid="bom-codigo-input"]')).toBeDisabled();

    // Intentar delete → alert "No se puede eliminar..."
    const dialogPromise = captureNextDialog(app);
    await row.locator('[data-testid="bom-delete-btn"]').click();
    const msg = await dialogPromise;
    expect(msg).toMatch(/no se puede eliminar|consumos/i);

    // La fila sigue presente
    await expect(row).toBeVisible();
  });
});
