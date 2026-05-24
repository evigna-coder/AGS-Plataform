// Entry point for pnpm --filter @ags/sistema-modular test:venta-loaner
// Pattern: mirror scripts/test-patron-bom.ts (Phase 14) — side-effect import dispara
// node:test runner automáticamente.
// RED baseline lands here in 15-00; turns GREEN as 15-02 lands `registrarVenta`
// + `__setTestFirestore` exports on loanersService.
import '../src/services/__tests__/ventaLoaner.test.ts';
