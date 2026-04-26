import { test, expect } from '@playwright/test';

/**
 * STKP-02 — Cloud Function trigger RED baseline.
 *
 * RUN STATUS: describe.skip() — does NOT execute in v2.0.
 * Reason: requires Firebase emulator running functions + firestore in parallel.
 * Manual verify covered by 09-02 Task 3 checkpoint.
 *
 * When unskipped, this spec must:
 * 1. Start emulator (functions + firestore).
 * 2. Seed articulo ART-TEST-1.
 * 3. Write `/unidades/U-1` with { articuloId: 'ART-TEST-1', estado: 'disponible', activo: true }.
 * 4. Poll `/articulos/ART-TEST-1.resumenStock.disponible` — expect === 1 within 5s.
 * 5. Write OC with items: [{ articuloId: 'ART-TEST-1', cantidad: 5, cantidadRecibida: 0 }], estado: 'aprobada'.
 * 6. Poll — expect resumenStock.enTransito === 5.
 * 7. Idempotency: retrigger write — values unchanged.
 */
test.describe.skip('STKP-02 updateResumenStock CF — requires emulator', () => {
  test('unidad write triggers resumenStock recomputation within 5s', async () => {
    // Implementation deferred post-v2.0 (see file header)
    expect(true).toBe(true);
  });
});
