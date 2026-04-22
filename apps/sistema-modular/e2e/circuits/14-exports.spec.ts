import { test, expect, TEST_PREFIX, timestamp } from '../fixtures/test-base';

/**
 * CIRCUITO 14: Exports XLSX + PDF (FMT-04 / FMT-05 / FMT-06)
 *
 * Wave 0 RED baseline — all tests either:
 *   a) Assert presence of export buttons (fail informatively until Wave 4 / plan 10-05 lands), or
 *   b) test.fixme with reason until the implementing wave lands.
 *
 * Wave map:
 *   14.1 / 14.2 — /presupuestos XLSX + PDF exports        → Wave 4 (plan 10-05) desfixmeará
 *   14.3         — filter-aware export smoke               → Wave 4 (plan 10-05) desfixmeará
 *   14.4         — /facturacion XLSX + PDF exports         → Wave 4 (plan 10-05) desfixmeará
 *   14.5         — OCs pendientes export                   → Wave 4 (plan 10-05) desfixmeará
 *   14.6         — Export buttons hidden for non-admin     → Wave 4 desfixmeará (needs role fixture)
 */

const ts = timestamp();

test.describe('Circuito 14: Exports XLSX + PDF (FMT-04/05/06)', () => {
  test.describe.configure({ mode: 'serial' });

  test('14.1 — /presupuestos: Exportar Excel descarga archivo .xlsx', async ({ app, nav }) => {
    test.fixme(true, 'Wave 4 (plan 10-05) lands Exportar Excel button + XLSX generation. Desfixmear when FMT-04 implemented.');

    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);

    const excelBtn = app.getByRole('button', { name: /exportar excel/i }).first();
    await expect(
      excelBtn,
      'Requires Wave 4 implementation (FMT-04): Exportar Excel button not found in /presupuestos',
    ).toBeVisible({ timeout: 5000 });

    const downloadPromise = app.waitForEvent('download', { timeout: 15_000 });
    await excelBtn.click();
    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(/presupuestos.*\.xlsx$/i);
  });

  test('14.2 — /presupuestos: Exportar PDF descarga archivo .pdf', async ({ app, nav }) => {
    test.fixme(true, 'Wave 4 (plan 10-05) lands Exportar PDF (lista) button. Desfixmear when FMT-04 implemented.');

    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);

    const pdfBtn = app.getByRole('button', { name: /exportar pdf/i }).first();
    await expect(
      pdfBtn,
      'Requires Wave 4 implementation (FMT-04): Exportar PDF button not found in /presupuestos',
    ).toBeVisible({ timeout: 5000 });

    const downloadPromise = app.waitForEvent('download', { timeout: 15_000 });
    await pdfBtn.click();
    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(/presupuestos.*\.pdf$/i);
  });

  test('14.3 — /presupuestos: Export filter-aware — filtrar por cliente, exportar, smoke', async ({ app, nav }) => {
    test.fixme(true, 'Wave 4 (plan 10-05) lands filter-aware export. Desfixmear when filtering + XLSX generation is implemented.');

    await nav.goToFresh('Presupuestos');
    await app.waitForTimeout(2000);

    // Apply a client filter (if filter input exists)
    const clientFilter = app.locator('input[placeholder*="cliente"], input[placeholder*="Cliente"]').first();
    if (await clientFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientFilter.fill(`${TEST_PREFIX}`);
      await app.waitForTimeout(1500);
    }

    // Export with filter applied
    const excelBtn = app.getByRole('button', { name: /exportar excel/i }).first();
    await expect(
      excelBtn,
      'Requires Wave 4 implementation (FMT-04): Exportar Excel button not found',
    ).toBeVisible({ timeout: 5000 });

    const downloadPromise = app.waitForEvent('download', { timeout: 15_000 });
    await excelBtn.click();
    const dl = await downloadPromise;

    // Smoke: verify download happened with a filename (filter-aware filename is a bonus)
    const filename = dl.suggestedFilename();
    expect(filename).toMatch(/\.xlsx$/i);
    // Ideally filename contains a client slug — Wave 4 can tighten this
    console.info(`[14.3] Filter-aware export filename: ${filename}`);
  });

  test('14.4 — /facturacion: Exportar Excel + PDF solicitudes (FMT-06)', async ({ app, nav }) => {
    test.fixme(true, 'Wave 4 (plan 10-05) lands Facturacion export buttons (FMT-06). Desfixmear when implemented.');

    await nav.goToFresh('Facturacion');
    await app.waitForTimeout(2000);

    // Excel export
    const excelBtn = app.getByRole('button', { name: /exportar excel/i }).first();
    const excelVisible = await excelBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(
      excelVisible,
      'Requires Wave 4 implementation (FMT-06): Exportar Excel button not found in /facturacion',
    ).toBeTruthy();

    if (excelVisible) {
      const dlExcel = app.waitForEvent('download', { timeout: 15_000 });
      await excelBtn.click();
      const excelDl = await dlExcel;
      expect(excelDl.suggestedFilename()).toMatch(/\.xlsx$/i);
    }

    // PDF export
    const pdfBtn = app.getByRole('button', { name: /exportar pdf/i }).first();
    const pdfVisible = await pdfBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(
      pdfVisible,
      'Requires Wave 4 implementation (FMT-06): Exportar PDF button not found in /facturacion',
    ).toBeTruthy();

    if (pdfVisible) {
      const dlPdf = app.waitForEvent('download', { timeout: 15_000 });
      await pdfBtn.click();
      const pdfDl = await dlPdf;
      expect(pdfDl.suggestedFilename()).toMatch(/\.pdf$/i);
    }
  });

  test('14.5 — OCs pendientes: Exportar Excel + PDF (FMT-05)', async ({ app, nav }) => {
    test.fixme(true, 'Wave 4 (plan 10-05) decides OC pendientes view location (/presupuestos filter or subpage) and lands export. Desfixmear when FMT-05 implemented.');

    // Placeholder — Wave 4 executor decides and implements navigation to OC pendientes view.
    // Likely: nav.goToFresh('Presupuestos') + filter by estado='oc_recibida' or dedicated subpage.

    // const excelBtn = app.getByRole('button', { name: /exportar excel/i }).first();
    // await expect(excelBtn, 'Requires Wave 4: OC export button').toBeVisible({ timeout: 5000 });
    // const dl = app.waitForEvent('download', { timeout: 15_000 });
    // await excelBtn.click();
    // const dlResult = await dl;
    // expect(dlResult.suggestedFilename()).toMatch(/oc.*pendientes.*\.xlsx$/i);
  });

  test('14.6 — Export buttons ocultos para rol no-admin', async ({ app, nav }) => {
    test.fixme(true, 'Requires role fixture (ventas/tecnico login). Wave 4 (plan 10-05) will implement RBAC gate + desfixmear when complete.');

    // Implementation when role fixture is available:
    // await nav.loginAs('ventas');
    // await nav.goToFresh('Presupuestos');
    // const excelBtn = app.getByRole('button', { name: /exportar excel/i });
    // await expect(excelBtn, 'Export should be hidden for non-admin roles').toBeHidden({ timeout: 5000 });
    // await nav.loginAs('admin'); // restore
  });
});
