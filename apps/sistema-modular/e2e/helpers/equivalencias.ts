/**
 * Phase 13 — equivalencias E2E helpers.
 *
 * seedEquivalenciaPair is a REAL implementation (not a TODO stub) that writes
 * two artículo docs to Firestore using the client SDK (same pattern as
 * firestore-assert.ts / fixtures/firebase-e2e.ts). Reuses the existing `db`
 * export — no new admin SDK wiring path introduced.
 *
 * Decision (m4 fix): all 4 describe groups in equivalencias.spec.ts must have
 * fixme count == 0. "Annotated-skip-reason if seed pending" is no longer acceptable.
 */

import type { Page } from '@playwright/test';
import { db } from '../fixtures/firebase-e2e';
import { collection, doc, setDoc } from 'firebase/firestore';

export async function navigateToArticulosList(page: Page): Promise<void> {
  await page.goto('/stock/articulos');
  await page.waitForSelector('[data-testid="articulos-list"], h1', { timeout: 10000 });
}

export async function openArticuloDetail(page: Page, codigo: string): Promise<void> {
  await page.getByText(codigo).first().click();
}

/**
 * Phase 13 STKE-07 — seed a linked pair of artículos for E2E.
 *
 * REAL implementation (m4 fix — no TODO stub). Uses the Firestore client SDK
 * (`db` from fixtures/firebase-e2e.ts) that the test suite already establishes.
 * Writes two artículo documents (destino first, then origen with equivalencias[]).
 *
 * Returns the pair's IDs and codes for use in test assertions.
 */
export async function seedEquivalenciaPair(opts: {
  codigoOrigen?: string;
  codigoDestino?: string;
  factor?: number;
} = {}): Promise<{
  origenId: string;
  destinoId: string;
  codigoOrigen: string;
  codigoDestino: string;
  factor: number;
}> {
  const ts = Date.now();
  const codigoOrigen = opts.codigoOrigen ?? `TEST-COMPRA-${ts}`;
  const codigoDestino = opts.codigoDestino ?? `TEST-USO-${ts}`;
  const factor = opts.factor ?? 10;

  const articulosCol = collection(db, 'articulos');

  // 1. Create destino artículo first (origen needs to denormalize its codigo/descripcion)
  const destinoRef = doc(articulosCol);
  const destinoId = destinoRef.id;
  await setDoc(destinoRef, {
    id: destinoId,
    codigo: codigoDestino,
    descripcion: `E2E destino ${codigoDestino}`,
    categoriaEquipo: 'GENERAL',
    marcaId: null,
    proveedorIds: [],
    tipo: 'consumible',
    unidadMedida: 'unidad',
    stockMinimo: 0,
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    equivalencias: [],
    articuloIdDestinoEquivalencia: null,
  });

  // 2. Create origen with the equivalencia payload + flat pointer field
  const origenRef = doc(articulosCol);
  const origenId = origenRef.id;
  await setDoc(origenRef, {
    id: origenId,
    codigo: codigoOrigen,
    descripcion: `E2E origen ${codigoOrigen}`,
    categoriaEquipo: 'GENERAL',
    marcaId: null,
    proveedorIds: [],
    tipo: 'consumible',
    unidadMedida: 'unidad',
    stockMinimo: 0,
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    equivalencias: [{
      articuloIdDestino: destinoId,
      articuloCodigoDestino: codigoDestino,
      articuloDescripcionDestino: `E2E destino ${codigoDestino}`,
      factor,
    }],
    // Flat index field for Firestore where() queries (source of truth stays in equivalencias[])
    articuloIdDestinoEquivalencia: destinoId,
  });

  return { origenId, destinoId, codigoOrigen, codigoDestino, factor };
}
