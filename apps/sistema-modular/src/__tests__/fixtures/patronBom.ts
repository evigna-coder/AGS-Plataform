/**
 * Test fixtures for Phase 14 — Patron BOM unit suite.
 *
 * Shapes mirror the 4 canonical Patron variants from .planning/phases/14.../14-RESEARCH.md:
 *   - legacyPatron   → no componentes declared (componentes undefined / [])
 *   - simplePatron   → 1 componente cantidadPorKit=3 (caso "3 ampollas iguales")
 *   - complexPatron  → 8 componentes cantidadPorKit=1 each (caso "UV KIT 8 ampollas distintas")
 *   - bloqueado/agotado lotes → componentesConsumidos that drive saldo<=stockMinimo
 *
 * The future fields (Patron.componentes, PatronLote.componentesConsumidos) land in plan
 * 14-01 — until then we declare them via `as any` to keep the fixture file typecheck-clean.
 *
 * MockPatronBomState mirrors the Phase 13 MockEquivalenciasState pattern. Plan 14-02
 * implements `__setTestFirestore(state)` in patronesService that reads/writes against
 * this in-memory shape (no Firebase imports).
 */

import type { Patron, PatronLote } from '@ags/shared';

// ── Local type stand-ins (extensions land in 14-01) ──────────────────────────

export type ComponentePatronLite = {
  codigoComponente: string;
  descripcion: string;
  cantidadPorKit: number;
  unidadMedida: string;
  stockMinimo?: number | null;
};

export type PatronComponenteConsumidoLite = {
  codigoComponente: string;
  cantidadConsumida: number;
};

// ── Patrón legacy (sin BOM declarado) ────────────────────────────────────────

export const legacyPatron: Patron = {
  id: 'P-LEG',
  codigoArticulo: 'LEG-001',
  descripcion: 'Patrón legacy sin BOM',
  marca: 'Agilent',
  categorias: [],
  lotes: [
    { lote: 'L1', cantidad: 5, fechaVencimiento: '2027-01-01' } as PatronLote,
  ],
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ── Patrón simple (3 ampollas iguales = 1 componente cantidadPorKit=3) ───────

export const simplePatron = {
  ...legacyPatron,
  id: 'P-SIMPLE',
  codigoArticulo: '5182-6917',
  descripcion: 'Patrón 3 ampollas iguales',
  componentes: [
    {
      codigoComponente: 'amp-A',
      descripcion: 'Ampolla A',
      cantidadPorKit: 3,
      unidadMedida: 'ampolla',
      stockMinimo: 1,
    } as ComponentePatronLite,
  ],
} as any;

// Default lote for simplePatron in BOM-02 helper tests
export const simplePatronLoteCantidad5 = {
  lote: 'L1',
  cantidad: 5,
  fechaVencimiento: '2027-01-01',
  componentesConsumidos: [
    { codigoComponente: 'amp-A', cantidadConsumida: 2 } as PatronComponenteConsumidoLite,
  ],
} as any;

// ── Patrón complex (UV KIT 8 ampollas distintas, cantidadPorKit=1 each) ──────

export const complexPatron = {
  ...legacyPatron,
  id: 'P-COMPLEX',
  codigoArticulo: '5062-6503',
  descripcion: 'UV KIT — 8 ampollas distintas',
  componentes: Array.from({ length: 8 }, (_, i) => ({
    codigoComponente: `amp-${i}`,
    descripcion: `Ampolla ${i}`,
    cantidadPorKit: 1,
    unidadMedida: 'ampolla',
    stockMinimo: 0,
  }) as ComponentePatronLite),
} as any;

// Healthy lote: nothing consumed yet
export const loteHealthy = {
  lote: 'L-HEALTHY',
  cantidad: 3,
  fechaVencimiento: '2027-06-01',
  componentesConsumidos: [],
} as any;

// One component already at saldo=0 (cantidad=3, cantidadPorKit=1, consumido=3 → 0 <= stockMinimo=0)
export const loteWithOneComponentAtZero = {
  lote: 'L-BLOCK',
  cantidad: 3,
  fechaVencimiento: '2027-01-01',
  componentesConsumidos: [
    { codigoComponente: 'amp-0', cantidadConsumida: 3 } as PatronComponenteConsumidoLite,
  ],
} as any;

// All 8 components consumed → agotado
export const loteAllZero = {
  lote: 'L-AGOTADO',
  cantidad: 1,
  fechaVencimiento: '2027-01-01',
  componentesConsumidos: Array.from({ length: 8 }, (_, i) => ({
    codigoComponente: `amp-${i}`,
    cantidadConsumida: 1,
  }) as PatronComponenteConsumidoLite),
} as any;

// ── FIFO scenario (3 lotes con distinta fechaVencimiento) ────────────────────

export const patronWithThreeLotes = {
  ...simplePatron,
  id: 'P-FIFO',
  lotes: [
    // L-OLD: earliest venc but cantidad=0 → no saldo (componentesConsumidos eaten all) → skip
    {
      lote: 'L-OLD',
      cantidad: 0,
      fechaVencimiento: '2026-05-01',
      componentesConsumidos: [],
    },
    // L-MID: next earliest with saldo > 0 → expected pick
    {
      lote: 'L-MID',
      cantidad: 5,
      fechaVencimiento: '2026-07-01',
      componentesConsumidos: [],
    },
    // L-NEW: latest fechaVencimiento, plenty of stock
    {
      lote: 'L-NEW',
      cantidad: 10,
      fechaVencimiento: '2027-01-01',
      componentesConsumidos: [],
    },
  ],
} as any;

// ── OT.patronesSeleccionados con duplicados (dedupe pitfall) ─────────────────

export const otPatronesSeleccionadosDuplicados = [
  { patronId: 'P-SIMPLE', lote: 'L1' },
  { patronId: 'P-SIMPLE', lote: 'L1' }, // duplicate — must dedupe
];

// ── Patron with 2 componentes (used by dedupe-by-componente test) ────────────

export const patronWith2Componentes = {
  ...legacyPatron,
  id: 'P-2COMP',
  codigoArticulo: '5500-2222',
  descripcion: 'Patrón 2 componentes',
  componentes: [
    {
      codigoComponente: 'amp-A',
      descripcion: 'Ampolla A',
      cantidadPorKit: 1,
      unidadMedida: 'ampolla',
      stockMinimo: 0,
    } as ComponentePatronLite,
    {
      codigoComponente: 'amp-B',
      descripcion: 'Ampolla B',
      cantidadPorKit: 1,
      unidadMedida: 'ampolla',
      stockMinimo: 0,
    } as ComponentePatronLite,
  ],
} as any;

// ── MockFirestoreState para BOM-03 tx tests ──────────────────────────────────
// Mirrors Phase 13 MockEquivalenciasState shape but indexed by id for fast lookup.

export interface MockPatronBomState {
  /** id → Patron doc (in-memory) */
  patrones: Map<string, any>;
  /** movId → MovimientoStock doc */
  movimientos: Map<string, any>;
  /** reqId → RequerimientoCompra doc */
  requerimientos: Map<string, any>;
  /** Config flag read by autoCrearRequerimientosPatron (lands in 14-03) */
  adminConfigFlujos: { usuarioRequerimientosPatronId?: string | null };
}

export const buildState = (overrides?: Partial<MockPatronBomState>): MockPatronBomState => ({
  patrones: new Map(),
  movimientos: new Map(),
  requerimientos: new Map(),
  adminConfigFlujos: {},
  ...overrides,
});
