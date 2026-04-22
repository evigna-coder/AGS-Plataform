/**
 * STKP-02 — Cloud Function trigger verification
 *
 * These tests require the Firebase emulator. Running them via `pnpm -C functions serve`
 * will start the emulator and exercise the triggers against an in-memory Firestore.
 * run via: pnpm -C functions serve (firebase emulators:start --only functions,firestore)
 *
 * MANUAL VERIFY steps (Task 3 checkpoint):
 * 1. Start emulator: `cd functions && pnpm serve` (firebase emulators:start --only functions,firestore)
 * 2. Seed: create `/articulos/ART-TEST-1` doc with { codigo: 'ART-1', descripcion: 'Test' }
 * 3. Write `/unidades/U-1` with { articuloId: 'ART-TEST-1', estado: 'disponible', activo: true }
 * 4. Within ~3s, read `/articulos/ART-TEST-1` → expect resumenStock.disponible === 1
 * 5. Delete U-1 → expect resumenStock.disponible === 0 within ~3s (delete covered by onDocumentWritten)
 * 6. Create OC with items=[{ articuloId: 'ART-TEST-1', cantidad: 5, cantidadRecibida: 0 }], estado: 'aprobada'
 *    → expect resumenStock.enTransito === 5 (no overlap with unidades because U-1 was deleted)
 * 7. Multi-articuloId semantic: create OC with items=[{ articuloId: 'ART-TEST-1', cantidad: 2 }, { articuloId: 'ART-TEST-2', cantidad: 3 }]
 *    → expect BOTH `/articulos/ART-TEST-1.resumenStock` AND `/articulos/ART-TEST-2.resumenStock` update within ~5s
 * 8. Idempotency: re-run step 3-6 → same values (no double counting)
 *
 * TODO(post-v2.0): convert to automated emulator-based tests when we have a CI setup.
 */

describe.skip('updateResumenStock — requires emulator', () => {
  it('disponible count updates after unidad write', () => { /* see manual steps above */ });
  it('enTransito includes both unit-estado and OC-pending', () => {});
  it('comprometido reflects only condicional+open requerimientos', () => {});
  it('delete of source doc decrements counts (onDocumentWritten covers delete)', () => {});
  it('OC with multiple articuloIds triggers recompute for EACH unique id (Blocker warning 1)', () => {});
  it('idempotency: running twice produces identical resumenStock', () => {});
});
