/**
 * Test fixtures for stockAmplioService unit tests.
 * Used by stockAmplio.test.ts via __setTestFirestore().
 *
 * MockFirestoreState shape mirrors what computeStockAmplio() reads:
 *   - unidades: UnidadStock-like rows (articuloId, estado, activo)
 *   - ocs: OrdenCompra-like rows (id, estado, numero, items[])
 *   - requerimientos: RequerimientoCompra-like rows (articuloId, condicional, estado, cantidad, presupuestoId)
 */

export interface MockUnidad {
  articuloId: string;
  estado: string;
  activo?: boolean;
}

export interface MockOCItem {
  articuloId: string;
  cantidad: number;
  cantidadRecibida: number;
}

export interface MockOC {
  id: string;
  estado: string;
  numero?: string | null;
  items: MockOCItem[];
}

export interface MockRequerimiento {
  id: string;
  articuloId: string;
  condicional: boolean;
  estado: string;
  cantidad: number;
  presupuestoId?: string | null;
}

export interface MockFirestoreState {
  unidades: MockUnidad[];
  ocs: MockOC[];
  requerimientos: MockRequerimiento[];
}

// ── Scenario: STKP-01 Happy Path ──────────────────────────────────────────
// 3 disponibles, 1 reservado, 2 en_transito (unit-estado), 1 OC with 4 pending,
// 1 requerimiento condicional (estado='pendiente', cantidad=2)
// Expected: { disponible:3, enTransito:6, reservado:1, comprometido:2 }
export const FIXTURE_HAPPY_PATH: MockFirestoreState = {
  unidades: [
    { articuloId: 'art-1', estado: 'disponible', activo: true },
    { articuloId: 'art-1', estado: 'disponible', activo: true },
    { articuloId: 'art-1', estado: 'disponible', activo: true },
    { articuloId: 'art-1', estado: 'reservado', activo: true },
    { articuloId: 'art-1', estado: 'en_transito', activo: true },
    { articuloId: 'art-1', estado: 'en_transito', activo: true },
  ],
  ocs: [
    {
      id: 'oc-1',
      estado: 'aprobada',
      numero: 'OC-0001',
      items: [{ articuloId: 'art-1', cantidad: 4, cantidadRecibida: 0 }],
    },
  ],
  requerimientos: [
    {
      id: 'req-1',
      articuloId: 'art-1',
      condicional: true,
      estado: 'pendiente',
      cantidad: 2,
      presupuestoId: 'pres-1',
    },
  ],
};

// ── Scenario: STKP-05 Double-Count Regression ─────────────────────────────
// 1 unidad en_transito + 1 OC pending 1 unit → enTransito MUST === 2 (additive)
export const FIXTURE_DOUBLE_COUNT_REGRESSION: MockFirestoreState = {
  unidades: [
    { articuloId: 'art-1', estado: 'en_transito', activo: true },
  ],
  ocs: [
    {
      id: 'oc-2',
      estado: 'en_transito',
      numero: 'OC-0002',
      items: [{ articuloId: 'art-1', cantidad: 1, cantidadRecibida: 0 }],
    },
  ],
  requerimientos: [],
};

// ── Scenario: Empty state ─────────────────────────────────────────────────
// No units, no OCs, no reqs → all zeros
export const FIXTURE_EMPTY: MockFirestoreState = {
  unidades: [],
  ocs: [],
  requerimientos: [],
};

// ── Scenario: Stale reqs excluded from comprometido ───────────────────────
// Reqs with estado='cancelado' | 'comprado' | 'en_compra' must NOT count
export const FIXTURE_STALE_REQS: MockFirestoreState = {
  unidades: [],
  ocs: [],
  requerimientos: [
    { id: 'req-2', articuloId: 'art-1', condicional: true, estado: 'cancelado', cantidad: 5 },
    { id: 'req-3', articuloId: 'art-1', condicional: true, estado: 'comprado', cantidad: 3 },
    { id: 'req-4', articuloId: 'art-1', condicional: true, estado: 'en_compra', cantidad: 2 },
  ],
};

// ── Scenario: Closed OCs excluded from enTransito ─────────────────────────
// OCs with estado='recibida' | 'cancelada' must NOT count in enTransito
export const FIXTURE_CLOSED_OCS: MockFirestoreState = {
  unidades: [],
  ocs: [
    {
      id: 'oc-3',
      estado: 'recibida',
      numero: 'OC-0003',
      items: [{ articuloId: 'art-1', cantidad: 10, cantidadRecibida: 10 }],
    },
    {
      id: 'oc-4',
      estado: 'cancelada',
      numero: 'OC-0004',
      items: [{ articuloId: 'art-1', cantidad: 5, cantidadRecibida: 0 }],
    },
  ],
  requerimientos: [],
};
