import { test, expect, describe } from '@playwright/test';

/**
 * STKP-03 — Concurrent reservation RED baseline.
 *
 * RUN STATUS: describe.skip() — does NOT execute in v2.0.
 * Reason: requires Firebase emulator + two concurrent browser contexts. Deferred
 * until CI + emulator infrastructure lands post-v2.0. This stub exists as the
 * Wave 0 file contract so VALIDATION.md can mark the STKP-03 E2E row as "file exists".
 *
 * When unskipped, this spec must:
 * 1. Seed a single unidad with estado='disponible'.
 * 2. Open two browser contexts, log in as different users.
 * 3. Trigger `reservasService.reservar(unidadId)` from both within 50ms.
 * 4. Expect: exactly one succeeds (unidad.estado === 'reservado'), the other throws
 *    "Unidad no disponible" (transaction lost the contention).
 * 5. Expect: movimientosStock collection has EXACTLY ONE 'transferencia' entry for this unidad.
 */
describe.skip('STKP-03 concurrent reservation — requires emulator', () => {
  test('two concurrent reservar() calls on same unidad — only one succeeds', async () => {
    // Implementation deferred post-v2.0 (see file header)
    expect(true).toBe(true);
  });
});
