// Entry point for pnpm --filter @ags/sistema-modular test:patron-bom
// Pattern: mirror src/services/__tests__/equivalencias.test.ts runner shape (Phase 13).
// Re-exports the test suite from src/__tests__/ so the suite stays colocated near app code.
// RED baseline lands here in 14-00; turns GREEN as 14-01 / 14-02 / 14-03 land downstream.
import '../src/__tests__/patronBom.test.ts';
