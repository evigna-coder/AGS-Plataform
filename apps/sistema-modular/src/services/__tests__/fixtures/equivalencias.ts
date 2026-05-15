/**
 * Test fixtures for equivalenciasService unit tests.
 * Used by equivalencias.test.ts via __setTestFirestore().
 *
 * MockEquivalenciasState shape mirrors what the service reads:
 *   - collections.articulos: Articulo-like rows (id, codigo, equivalencias, articuloIdDestinoEquivalencia)
 *   - collections.unidades: UnidadStock-like rows (id, articuloId, estado, ubicacion, activo)
 *   - collections.movimientosStock: MovimientoStock-like rows (id, tipo, subtipo, ...)
 *
 * Phase 13 Wave 0 RED baseline.
 * Run: pnpm --filter @ags/sistema-modular test:equivalencias
 */

export interface MockEquivalencia {
  articuloIdDestino: string;
  articuloCodigoDestino: string;
  articuloDescripcionDestino: string;
  factor: number;
}

export interface MockArticulo {
  id: string;
  codigo: string;
  descripcion?: string;
  equivalencias: MockEquivalencia[];
  articuloIdDestinoEquivalencia: string | null;
}

export interface MockUbicacion {
  tipo: string;
  referenciaId: string;
  referenciaNombre: string;
}

export interface MockUnidadStock {
  id: string;
  articuloId: string;
  estado: string;
  ubicacion: MockUbicacion;
  activo?: boolean;
}

export interface MockMovimientoStock {
  id: string;
  tipo: string;
  subtipo?: string;
  articuloOrigenId?: string;
  articuloDestinoId?: string;
  factor?: number;
  cantidadOrigen?: number;
  cantidadDestino?: number;
  solicitadoPorNombre?: string;
  createdAt?: string;
}

export interface MockCollections {
  articulos: MockArticulo[];
  unidades: MockUnidadStock[];
  movimientosStock: MockMovimientoStock[];
}

export interface MockEquivalenciasState {
  collections: MockCollections;
}

// ── Scenario: HAPPY PATH ──────────────────────────────────────────────────
// art-compra (5183-2209) not yet linked to art-uso (5188-5367)
// Both articles exist, no equivalencias yet.
// Factor will be 10 in the linkEquivalencia call.
export const FIXTURE_HAPPY_PATH: MockEquivalenciasState = {
  collections: {
    articulos: [
      {
        id: 'art-compra',
        codigo: '5183-2209',
        descripcion: 'Caja 10 unidades',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
      {
        id: 'art-uso',
        codigo: '5188-5367',
        descripcion: 'Ampolla unidad',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
    ],
    unidades: [],
    movimientosStock: [],
  },
};

// ── Scenario: SELF_LINK ────────────────────────────────────────────────────
// Single artículo — used to validate origenId === destinoId rejection
export const FIXTURE_SELF_LINK: MockEquivalenciasState = {
  collections: {
    articulos: [
      {
        id: 'art-compra',
        codigo: '5183-2209',
        descripcion: 'Caja 10 unidades',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
    ],
    unidades: [],
    movimientosStock: [],
  },
};

// ── Scenario: DESTINO_TOMADO ──────────────────────────────────────────────
// art-uso is already pointed to by art-compra-1.
// art-compra-2 will attempt to link to the same destino → must be rejected.
export const FIXTURE_DESTINO_TOMADO: MockEquivalenciasState = {
  collections: {
    articulos: [
      {
        id: 'art-uso',
        codigo: '5188-5367',
        descripcion: 'Ampolla unidad',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
      {
        id: 'art-compra-1',
        codigo: '5183-2209',
        descripcion: 'Caja 10 unidades (origen 1)',
        equivalencias: [
          {
            articuloIdDestino: 'art-uso',
            articuloCodigoDestino: '5188-5367',
            articuloDescripcionDestino: 'Ampolla unidad',
            factor: 10,
          },
        ],
        articuloIdDestinoEquivalencia: 'art-uso',
      },
      {
        id: 'art-compra-2',
        codigo: '5183-9999',
        descripcion: 'Caja alternativa (origen 2)',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
    ],
    unidades: [],
    movimientosStock: [],
  },
};

// ── Scenario: CICLO_A_B_A ─────────────────────────────────────────────────
// art-B already points to art-A (articuloIdDestinoEquivalencia = 'art-A').
// Attempt to link art-A → art-B must be rejected (cycle A→B→A).
export const FIXTURE_CICLO_A_B_A: MockEquivalenciasState = {
  collections: {
    articulos: [
      {
        id: 'art-A',
        codigo: 'COD-A',
        descripcion: 'Artículo A',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
      {
        id: 'art-B',
        codigo: 'COD-B',
        descripcion: 'Artículo B',
        equivalencias: [
          {
            articuloIdDestino: 'art-A',
            articuloCodigoDestino: 'COD-A',
            articuloDescripcionDestino: 'Artículo A',
            factor: 5,
          },
        ],
        articuloIdDestinoEquivalencia: 'art-A',
      },
    ],
    unidades: [],
    movimientosStock: [],
  },
};

// ── Scenario: STOCK_INSUFICIENTE ──────────────────────────────────────────
// art-compra is linked to art-uso (factor 10).
// Only 2 unidades disponibles in pos-1.
// Requesting cantidad=5 must fail with 'stock insuficiente'.
export const FIXTURE_STOCK_INSUFICIENTE: MockEquivalenciasState = {
  collections: {
    articulos: [
      {
        id: 'art-compra',
        codigo: '5183-2209',
        descripcion: 'Caja 10 unidades',
        equivalencias: [
          {
            articuloIdDestino: 'art-uso',
            articuloCodigoDestino: '5188-5367',
            articuloDescripcionDestino: 'Ampolla unidad',
            factor: 10,
          },
        ],
        articuloIdDestinoEquivalencia: 'art-uso',
      },
      {
        id: 'art-uso',
        codigo: '5188-5367',
        descripcion: 'Ampolla unidad',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
    ],
    unidades: [
      {
        id: 'unidad-origen-1',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
      {
        id: 'unidad-origen-2',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
    ],
    movimientosStock: [],
  },
};

// ── Scenario: DESAGREGAR_HAPPY ────────────────────────────────────────────
// art-compra is linked to art-uso (factor 10).
// 5 unidades disponibles in pos-1.
// Requesting cantidad=3:
//   → 3 unidades origen → estado='consumido'
//   → 30 unidades nuevas destino con estado='disponible'
//   → 1 MovimientoStock con subtipo='conversion'
export const FIXTURE_DESAGREGAR_HAPPY: MockEquivalenciasState = {
  collections: {
    articulos: [
      {
        id: 'art-compra',
        codigo: '5183-2209',
        descripcion: 'Caja 10 unidades',
        equivalencias: [
          {
            articuloIdDestino: 'art-uso',
            articuloCodigoDestino: '5188-5367',
            articuloDescripcionDestino: 'Ampolla unidad',
            factor: 10,
          },
        ],
        articuloIdDestinoEquivalencia: 'art-uso',
      },
      {
        id: 'art-uso',
        codigo: '5188-5367',
        descripcion: 'Ampolla unidad',
        equivalencias: [],
        articuloIdDestinoEquivalencia: null,
      },
    ],
    unidades: [
      {
        id: 'unidad-origen-1',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
      {
        id: 'unidad-origen-2',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
      {
        id: 'unidad-origen-3',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
      {
        id: 'unidad-origen-4',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
      {
        id: 'unidad-origen-5',
        articuloId: 'art-compra',
        estado: 'disponible',
        ubicacion: { tipo: 'posicion', referenciaId: 'pos-1', referenciaNombre: 'Pos 1' },
        activo: true,
      },
    ],
    movimientosStock: [],
  },
};
