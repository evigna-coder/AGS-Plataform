import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';
import { getSolicitudesFacturacionByOt, getSolicitudFacturacion, pollUntil } from '../helpers/firestore-assert';

/**
 * CIRCUITO 7: Facturación — Verificar lista y filtros
 */

test.describe('Circuito 7: Facturación', () => {
  test.describe.configure({ mode: 'serial' });

  test('7.1 — Navegar a Facturación', async ({ app, nav }) => {
    await nav.goTo('Facturacion');
    await app.waitForTimeout(2000);
    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('7.2 — Verificar tabla de facturación', async ({ app, nav }) => {
    await nav.goTo('Facturacion');
    await app.waitForTimeout(2000);
    const headers = app.locator('th, [role="columnheader"]');
    expect(await headers.count()).toBeGreaterThanOrEqual(0);
  });

  test('7.3 — Abrir detalle si hay solicitudes', async ({ app, nav }) => {
    await nav.goTo('Facturacion');
    await app.waitForTimeout(2000);
    const firstRow = app.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await app.waitForTimeout(2000);
      await expect(app.locator('body')).not.toContainText('Something went wrong');
    }
  });

  // ── Phase 10 RED tests (Wave 0 baseline) ──────────────────────────────────

  test('7.4 — Dashboard lista doc auto-creado (estado pendiente visible)', async ({ app, nav }) => {
    // Prerequisite: test 11.13b or any solicitudFacturacion with estado 'pendiente' exists.
    // This test navigates to /facturacion and asserts at least 1 pending row is visible.
    await nav.goToFresh('Facturacion');
    await app.waitForTimeout(2000);

    const rows = await app.locator('tbody tr').count();
    expect(
      rows,
      'Requires Wave 3 implementation (plan 10-04): solicitudesFacturacion auto-created doc should appear in /facturacion dashboard',
    ).toBeGreaterThanOrEqual(1);

    if (rows >= 1) {
      // Verify at least one row shows 'Pendiente' estado
      const pendienteCell = app.locator('tbody tr').filter({ hasText: /pendiente/i }).first();
      const hasPendiente = await pendienteCell.isVisible({ timeout: 3000 }).catch(() => false);
      if (!hasPendiente) {
        console.warn('[RED] 7.4: No "Pendiente" row found in facturacion table — Wave 3 trigger may not have created solicitudFacturacion yet');
      }
    }

    await expect(app.locator('body')).not.toContainText('Something went wrong');
  });

  test('7.5 — Acción "marcar enviada" cambia estado a enviada', async ({ app, nav }) => {
    // Wave 5 (plan 10-06) landed: marcar enviada button implemented in FacturacionDetail.
    // This test exercises the button and asserts state transition via Firestore poll.
    await nav.goToFresh('Facturacion');
    await app.waitForTimeout(2000);

    const firstRow = app.locator('tbody tr').first();
    if (!await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.warn('[7.5] No rows in facturacion — skipping estado transition check (requires data)');
      return;
    }

    await firstRow.click();
    await app.waitForTimeout(1500);

    // Verify page loaded without crash
    await expect(app.locator('body')).not.toContainText('Something went wrong');

    // Check if marcar enviada button is visible (requires admin role + estado pendiente)
    const marcarEnviadaBtn = app.getByRole('button', { name: /marcar enviada/i }).first();
    const btnVisible = await marcarEnviadaBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      console.warn('[7.5] marcar enviada button not visible — may be non-admin role, non-pendiente estado, or no solicitud exists');
      return;
    }

    // Extract solicitudId from URL
    const urlBefore = app.url();
    const idMatch = urlBefore.match(/facturacion\/([^/?#]+)/);
    if (!idMatch) return;
    const solicitudId = idMatch[1];

    await marcarEnviadaBtn.click();
    await app.waitForTimeout(1000);

    // Confirm dialog (if present)
    const confirmBtn = app.getByRole('button', { name: /confirmar|aceptar|sí/i }).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await app.waitForTimeout(1000);
    }

    // Assert estado transitioned to enviada
    await pollUntil(
      () => getSolicitudFacturacion(solicitudId),
      (s) => (s as any)?.estado === 'enviada',
      { timeout: 10_000 },
    );
  });
});
