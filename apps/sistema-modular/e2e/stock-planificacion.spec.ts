import { test, expect } from '@playwright/test';

/**
 * STKP-04 — Planning view cache-bypass RED baseline.
 *
 * RUN STATUS: describe.skip() — does NOT execute in v2.0.
 * Reason: requires seeded fixtures + dev server + emulator; manual UAT covered
 * by 09-03 Task 3 checkpoint (12-step walkthrough).
 *
 * When unskipped, this spec must:
 * 1. Log in as admin, navigate to /stock/planificacion.
 * 2. Confirm the table renders Código | Descripción | Marca | Disp | Tráns | Reserv | Comprom | ATP | Acciones.
 * 3. Set filters via URL: ?texto=ABC&marcaId=M1&soloComprometido=true — confirm filter state reflects URL.
 * 4. Reload the page — filters persist (URL-backed via useUrlFilters).
 * 5. Simulate a unidad estado change in another tab — confirm the row updates within 5s (zero 2-min cache).
 * 6. Click "Ver detalle" — drawer shows OCs abiertas + Requerimientos condicionales sections (no Reservas section in v2.0).
 * 7. For a row with ATP < 0, click "Crear req." — navigation lands at /stock/requerimientos/nuevo with prefillArticuloId state.
 */
test.describe.skip('STKP-04 planning view fresh data — requires seeded fixtures', () => {
  test('live refresh without 2-min cache, URL-backed filters', async () => {
    // Implementation deferred post-v2.0 (see file header)
    expect(true).toBe(true);
  });
});
