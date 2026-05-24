/**
 * Test fixtures for Phase 15 — Venta loaner espejo a stock.
 *
 * Mirrors `fixtures/equivalencias.ts` (Phase 13) and `__tests__/fixtures/patronBom.ts` (Phase 14)
 * conventions: factory functions return a fresh state per call so tests can mutate
 * `state.collections` without cross-test pollution.
 *
 * Shape of MockVentaLoanerState matches what `loanersService.registrarVenta` (Wave 2)
 * will read/write through the `__setTestFirestore` DI hook:
 *   - collections.loaners: Loaner-like rows (id, codigo, articuloId, estado, activo, venta)
 *   - collections.unidades: UnidadStock-like rows (free shape; tests assert field-by-field)
 *   - collections.movimientosStock: MovimientoStock-like rows (free shape; tests assert field-by-field)
 *
 * Used by: src/services/__tests__/ventaLoaner.test.ts (Wave 0 RED baseline).
 */

// ── Local type stand-ins (no imports from loanersService — Wave 2 lands those) ──

export interface MockLoaner {
  id: string;
  codigo: string;
  descripcion: string;
  articuloId: string | null;
  articuloCodigo?: string | null;
  articuloDescripcion?: string | null;
  serie?: string | null;
  estado: 'en_base' | 'en_cliente' | 'en_transito' | 'vendido' | 'baja';
  activo: boolean;
  venta?: Record<string, unknown> | null;
}

export interface MockVentaLoanerState {
  collections: {
    loaners: MockLoaner[];
    // Shape libre: tests asertan campo por campo lo que el servicio escribe.
    unidades: any[];
    movimientosStock: any[];
  };
}

// ── Helper to compose custom states inline ───────────────────────────────────

/**
 * Build a state seeded with partial collections. Missing collections default to [].
 * Useful when a test needs a specific loaner shape but no pre-existing unidades/movimientos.
 */
export function buildState(
  overrides: Partial<MockVentaLoanerState['collections']>,
): MockVentaLoanerState {
  return {
    collections: {
      loaners: overrides.loaners ?? [],
      unidades: overrides.unidades ?? [],
      movimientosStock: overrides.movimientosStock ?? [],
    },
  };
}

// ── Fixture: PRE_VINCULADO ────────────────────────────────────────────────────
// Loaner ya tiene articuloId — happy path "venta sin necesidad de vincular".
// Plan 15-02 (Wave 2) implementará registrarVenta para que use el articuloId existente.

export function buildFixturePreVinculado(): MockVentaLoanerState {
  return {
    collections: {
      loaners: [
        {
          id: 'lnr-1',
          codigo: 'LNR-0001',
          descripcion: 'HPLC 1260 Infinity (repuesto)',
          articuloId: 'art-A',
          articuloCodigo: 'EQ-001',
          articuloDescripcion: 'HPLC repuesto',
          serie: 'SN-12345',
          estado: 'en_base',
          activo: true,
        },
      ],
      unidades: [],
      movimientosStock: [],
    },
  };
}

// ── Fixture: SIN_ARTICULO ─────────────────────────────────────────────────────
// Loaner sin articuloId — requiere vincular al momento de la venta.
// Plan 15-02 (Wave 2) acepta `articuloRecienVinculado` y denormaliza dentro de la tx.

export function buildFixtureSinArticulo(): MockVentaLoanerState {
  return {
    collections: {
      loaners: [
        {
          id: 'lnr-1',
          codigo: 'LNR-0002',
          descripcion: 'Equipo loaner sin vincular',
          articuloId: null,
          articuloCodigo: null,
          articuloDescripcion: null,
          serie: 'SN-67890',
          estado: 'en_base',
          activo: true,
        },
      ],
      unidades: [],
      movimientosStock: [],
    },
  };
}

// ── Fixture: YA_VENDIDO ───────────────────────────────────────────────────────
// Loaner ya vendido — el guard READ-FIRST dentro de la tx debe abortar con
// "Loaner ya vendido". Protege contra doble click y concurrencia entre tabs/users.

export function buildFixtureYaVendido(): MockVentaLoanerState {
  return {
    collections: {
      loaners: [
        {
          id: 'lnr-1',
          codigo: 'LNR-0003',
          descripcion: 'HPLC vendido previo',
          articuloId: 'art-A',
          articuloCodigo: 'EQ-001',
          articuloDescripcion: 'HPLC repuesto',
          serie: 'SN-99999',
          estado: 'vendido',
          activo: false,
          venta: {
            fecha: '2026-05-20T10:00:00.000Z',
            clienteId: 'cli-X',
            clienteNombre: 'Cliente Previo',
          },
        },
      ],
      unidades: [],
      movimientosStock: [],
    },
  };
}
