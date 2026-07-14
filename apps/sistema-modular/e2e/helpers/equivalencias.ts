/**
 * Phase 13 — equivalencias E2E helpers.
 *
 * REWRITE 2026-07: las reglas Firestore endurecidas rompieron el client SDK
 * desde Node sin auth. El seed corre ahora EN EL BROWSER autenticado vía
 * `page.evaluate` + `window.__ags` (patrón circuito 15). La page debe venir
 * de la fixture `app` de test-base (persistent context con login) — el raw
 * `page` de @playwright/test no está autenticado.
 */

import type { Page } from '@playwright/test';

const BASE = 'http://localhost:3001';

/** Recarga la app si la page perdió el bundle (window.__ags ausente). */
async function ensureAgs(page: Page): Promise<void> {
  const ok = await page
    .evaluate(() => typeof (window as any).__ags !== 'undefined')
    .catch(() => false);
  if (!ok) {
    await page.goto(BASE);
    await page.locator('aside nav').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
  }
}

export async function navigateToArticulosList(page: Page): Promise<void> {
  // URL absoluta: la page compartida viene de launchPersistentContext sin baseURL.
  await page.goto(`${BASE}/stock/articulos`);
  // 25s: con caches fríos (o tras una corrida larga) la lista tarda en montar.
  await page.waitForSelector('[data-testid="articulos-list"], h1', { timeout: 25_000 });
}

export async function openArticuloDetail(page: Page, codigo: string): Promise<void> {
  await page.getByText(codigo).first().click();
}

/**
 * Phase 13 STKE-07 — seed a linked pair of artículos for E2E.
 *
 * Writes two artículo documents (destino first, then origen with equivalencias[])
 * in the authenticated browser. Returns the pair's IDs and codes.
 */
export async function seedEquivalenciaPair(page: Page, opts: {
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

  await ensureAgs(page);
  const { origenId, destinoId } = await page.evaluate(async (p) => {
    const ags = (window as any).__ags;
    const { collection, doc, setDoc } = ags.firestore;
    const articulosCol = collection(ags.db, 'articulos');

    // 1. Create destino artículo first (origen denormalizes its codigo/descripcion)
    const destinoRef = doc(articulosCol);
    const destinoId = destinoRef.id;
    await setDoc(destinoRef, {
      id: destinoId,
      codigo: p.codigoDestino,
      descripcion: `E2E destino ${p.codigoDestino}`,
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
      codigo: p.codigoOrigen,
      descripcion: `E2E origen ${p.codigoOrigen}`,
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
        articuloCodigoDestino: p.codigoDestino,
        articuloDescripcionDestino: `E2E destino ${p.codigoDestino}`,
        factor: p.factor,
      }],
      // Flat index field for Firestore where() queries
      articuloIdDestinoEquivalencia: destinoId,
    });

    return { origenId, destinoId };
  }, { codigoOrigen, codigoDestino, factor });

  return { origenId, destinoId, codigoOrigen, codigoDestino, factor };
}

/** Borra el par seedeado (antes no había cleanup y quedaban artículos TEST-*). */
export async function cleanupEquivalenciaPair(
  page: Page,
  seeded: { origenId: string; destinoId: string },
): Promise<void> {
  await ensureAgs(page);
  await page.evaluate(async (s) => {
    const ags = (window as any).__ags;
    const { doc, deleteDoc } = ags.firestore;
    await deleteDoc(doc(ags.db, 'articulos', s.origenId)).catch(() => {});
    await deleteDoc(doc(ags.db, 'articulos', s.destinoId)).catch(() => {});
  }, seeded);
}
