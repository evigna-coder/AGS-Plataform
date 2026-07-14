/**
 * Phase 14 Wave 4 UAT — seed helpers para specs de Patrones BOM + cierre.
 *
 * REWRITE 2026-07: las reglas Firestore endurecidas rompieron el client SDK
 * desde Node sin auth. Todos los seeds/reads/cleanups corren ahora EN EL
 * BROWSER autenticado vía `page.evaluate` + `window.__ags` (mismo patrón que
 * circuits/15-checklist-stock-ot.spec.ts). Toda función recibe `page` primero.
 *
 * Lo que cubren:
 *  - seedPatronBom: crea un Patron con N componentes y un único lote → devuelve ids
 *  - seedOTReportePatrones: escribe `reportes/{otNumber}` con patronesSeleccionados
 *    + estadoAdmin (sin tocar reportes-ot, que es frozen surface)
 *  - seedAdminConfigUsuarioRequerimientosPatron: setea usuarioRequerimientosPatronId
 *    en `adminConfig/flujos` (con preservación del resto del doc)
 *  - cleanupPatronBomFixture: borra todos los docs creados por los seeders
 */

import type { Page } from '@playwright/test';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos locales mínimos — espejos shape de @ags/shared.
// ──────────────────────────────────────────────────────────────────────────────

interface SeedComponente {
  codigoComponente: string;
  descripcion: string;
  cantidadPorKit: number;
  unidadMedida: string;
  stockMinimo?: number | null;
}

interface SeedLote {
  lote: string;
  cantidad?: number | null;
  fechaVencimiento?: string | null;
  /** Si querés simular un lote que ya tiene consumos previos (test del 🔒) */
  componentesConsumidos?: Array<{ codigoComponente: string; cantidadConsumida: number }>;
}

/** Recarga la app si la page perdió el bundle (window.__ags ausente). */
async function ensureAgs(page: Page): Promise<void> {
  const ok = await page
    .evaluate(() => typeof (window as any).__ags !== 'undefined')
    .catch(() => false);
  if (!ok) {
    await page.goto('http://localhost:3001');
    await page.locator('aside nav').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// seedPatronBom — crea un Patron en /patrones con la forma que espera el editor
// ──────────────────────────────────────────────────────────────────────────────

export interface SeedPatronBomOpts {
  codigoArticulo?: string;
  descripcion?: string;
  marca?: string;
  categorias?: string[];
  componentes?: SeedComponente[];
  lotes?: SeedLote[];
}

export interface SeededPatron {
  patronId: string;
  codigoArticulo: string;
  descripcion: string;
  componentes: SeedComponente[];
  lotes: SeedLote[];
}

export async function seedPatronBom(page: Page, opts: SeedPatronBomOpts = {}): Promise<SeededPatron> {
  const ts = Date.now();
  const codigoArticulo = opts.codigoArticulo ?? `TEST-PATRON-${ts}`;
  const descripcion = opts.descripcion ?? `E2E patron ${codigoArticulo}`;
  const marca = opts.marca ?? 'E2E Test';
  const categorias = opts.categorias ?? ['estandar_quimico'];
  const componentes: SeedComponente[] =
    opts.componentes ?? [
      {
        codigoComponente: 'amp-A',
        descripcion: 'Ampolla cafeína',
        cantidadPorKit: 3,
        unidadMedida: 'ampolla',
        stockMinimo: 1,
      },
    ];
  const lotes: SeedLote[] =
    opts.lotes ?? [
      { lote: `L${ts}`, cantidad: 2, fechaVencimiento: null },
    ];

  const patronId = `e2e-patron-${ts}-${Math.random().toString(36).slice(2, 8)}`;

  await ensureAgs(page);
  await page.evaluate(async (p) => {
    const ags = (window as any).__ags;
    const { doc, setDoc, Timestamp } = ags.firestore;
    const now = Timestamp.now();
    await setDoc(doc(ags.db, 'patrones', p.patronId), {
      codigoArticulo: p.codigoArticulo,
      descripcion: p.descripcion,
      marca: p.marca,
      categorias: p.categorias,
      lotes: p.lotes,
      componentes: p.componentes,
      activo: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'e2e-seed',
      createdByName: 'E2E Seed',
      updatedBy: 'e2e-seed',
      updatedByName: 'E2E Seed',
    });
  }, { patronId, codigoArticulo, descripcion, marca, categorias, componentes, lotes });

  return { patronId, codigoArticulo, descripcion, componentes, lotes };
}

// ──────────────────────────────────────────────────────────────────────────────
// seedOTReportePatrones — escribe `reportes/{otNumber}` con patronesSeleccionados.
// ──────────────────────────────────────────────────────────────────────────────

export interface SeedOTReporteOpts {
  otNumber?: string;
  patron: SeededPatron;
  loteIndex?: number;
  estadoAdmin?: string;
}

export interface SeededOTReporte {
  otNumber: string;
  patronesSeleccionados: Array<{
    patronId: string;
    codigoArticulo: string;
    descripcion: string;
    marca: string;
    categorias: string[];
    lote: string;
    fechaVencimiento: string | null;
  }>;
}

export async function seedOTReportePatrones(page: Page, opts: SeedOTReporteOpts): Promise<SeededOTReporte> {
  const ts = Date.now();
  const otNumber = opts.otNumber ?? `E2E-${ts}`;
  const loteIdx = opts.loteIndex ?? 0;
  const estadoAdmin = opts.estadoAdmin ?? 'CIERRE_ADMINISTRATIVO';
  const lote = opts.patron.lotes[loteIdx];
  if (!lote) throw new Error(`seedOTReportePatrones: lote index ${loteIdx} no existe en el patron`);

  const patronesSeleccionados = [
    {
      patronId: opts.patron.patronId,
      codigoArticulo: opts.patron.codigoArticulo,
      descripcion: opts.patron.descripcion,
      marca: 'E2E Test',
      categorias: ['estandar_quimico'],
      lote: lote.lote,
      fechaVencimiento: lote.fechaVencimiento ?? null,
    },
  ];

  await ensureAgs(page);
  await page.evaluate(async (p) => {
    const ags = (window as any).__ags;
    const { doc, setDoc, Timestamp } = ags.firestore;
    await setDoc(doc(ags.db, 'reportes', p.otNumber), {
      otNumber: p.otNumber,
      estadoAdmin: p.estadoAdmin,
      patronesSeleccionados: p.patronesSeleccionados,
      // Campos mínimos para que la UI no rompa al leer la OT
      budgets: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'e2e-seed',
      createdByName: 'E2E Seed',
    });
  }, { otNumber, estadoAdmin, patronesSeleccionados });

  return { otNumber, patronesSeleccionados };
}

// ──────────────────────────────────────────────────────────────────────────────
// seedAdminConfigUsuarioRequerimientosPatron — patch idempotente
// ──────────────────────────────────────────────────────────────────────────────

export interface PrevAdminConfigSnapshot {
  /** Valor previo (puede ser null si no existía o estaba unset) */
  previousValue: string | null;
}

export async function seedAdminConfigUsuarioRequerimientosPatron(
  page: Page,
  usuarioId: string | null,
): Promise<PrevAdminConfigSnapshot> {
  await ensureAgs(page);
  return page.evaluate(async (uid) => {
    const ags = (window as any).__ags;
    const { doc, getDoc, setDoc, Timestamp } = ags.firestore;
    const ref = doc(ags.db, 'adminConfig', 'flujos');
    const snap = await getDoc(ref);
    const previous = snap.exists()
      ? ((snap.data().usuarioRequerimientosPatronId as string | null | undefined) ?? null)
      : null;

    if (snap.exists()) {
      await setDoc(
        ref,
        { usuarioRequerimientosPatronId: uid, updatedAt: Timestamp.now() },
        { merge: true },
      );
    } else {
      // No existe el doc — creamos uno mínimo (mailFacturacion requerido por el UI)
      await setDoc(ref, {
        usuarioRequerimientosPatronId: uid,
        mailFacturacion: 'e2e@agsanalitica.com',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    return { previousValue: previous };
  }, usuarioId);
}

export async function restoreAdminConfigUsuarioRequerimientosPatron(
  page: Page,
  snapshot: PrevAdminConfigSnapshot,
): Promise<void> {
  await seedAdminConfigUsuarioRequerimientosPatron(page, snapshot.previousValue);
}

// ──────────────────────────────────────────────────────────────────────────────
// Cleanup — borra patron + reportes + movimientos + requerimientos generados
// por una fixture.
// ──────────────────────────────────────────────────────────────────────────────

export interface CleanupOpts {
  patronId?: string;
  otNumbers?: string[];
}

export async function cleanupPatronBomFixture(page: Page, opts: CleanupOpts): Promise<void> {
  await ensureAgs(page);
  await page.evaluate(async (o) => {
    const ags = (window as any).__ags;
    const { collection, query, where, getDocs, doc, deleteDoc } = ags.firestore;

    // Movimientos por OT
    if (o.otNumbers?.length) {
      for (const otNumber of o.otNumbers) {
        const snap = await getDocs(query(
          collection(ags.db, 'movimientosStock'),
          where('otNumber', '==', otNumber),
        ));
        await Promise.all(snap.docs.map((d: any) => deleteDoc(d.ref)));
        await deleteDoc(doc(ags.db, 'reportes', otNumber)).catch(() => {});
      }
    }
    // Requerimientos por patron (origen patron_minimo)
    if (o.patronId) {
      const snap = await getDocs(query(
        collection(ags.db, 'requerimientos_compra'),
        where('patronId', '==', o.patronId),
      ));
      await Promise.all(snap.docs.map((d: any) => deleteDoc(d.ref)));
      await deleteDoc(doc(ags.db, 'patrones', o.patronId)).catch(() => {});
    }
  }, opts as { patronId?: string; otNumbers?: string[] });
}

// ──────────────────────────────────────────────────────────────────────────────
// Readers — para assertions en specs sin duplicar queries en cada test
// ──────────────────────────────────────────────────────────────────────────────

export async function getPatron(page: Page, patronId: string): Promise<any | null> {
  await ensureAgs(page);
  return page.evaluate(async (id) => {
    const ags = (window as any).__ags;
    const { doc, getDoc } = ags.firestore;
    const snap = await getDoc(doc(ags.db, 'patrones', id));
    return snap.exists() ? { id: snap.id, ...JSON.parse(JSON.stringify(snap.data())) } : null;
  }, patronId);
}

export async function getMovimientosPatronByOt(
  page: Page,
  otNumber: string,
): Promise<Array<{ id: string } & Record<string, any>>> {
  await ensureAgs(page);
  return page.evaluate(async (ot) => {
    const ags = (window as any).__ags;
    const { collection, query, where, getDocs } = ags.firestore;
    const snap = await getDocs(query(
      collection(ags.db, 'movimientosStock'),
      where('otNumber', '==', ot),
      where('entidadTipo', '==', 'patron'),
    ));
    return snap.docs.map((d: any) => ({ id: d.id, ...JSON.parse(JSON.stringify(d.data())) }));
  }, otNumber);
}

export async function getReqsPatronMinimoByPatron(
  page: Page,
  patronId: string,
): Promise<Array<{ id: string } & Record<string, any>>> {
  await ensureAgs(page);
  return page.evaluate(async (pid) => {
    const ags = (window as any).__ags;
    const { collection, query, where, getDocs } = ags.firestore;
    const snap = await getDocs(query(
      collection(ags.db, 'requerimientos_compra'),
      where('patronId', '==', pid),
      where('origen', '==', 'patron_minimo'),
    ));
    return snap.docs.map((d: any) => ({ id: d.id, ...JSON.parse(JSON.stringify(d.data())) }));
  }, patronId);
}

export async function getReporteOT(page: Page, otNumber: string): Promise<any | null> {
  await ensureAgs(page);
  return page.evaluate(async (ot) => {
    const ags = (window as any).__ags;
    const { doc, getDoc } = ags.firestore;
    const snap = await getDoc(doc(ags.db, 'reportes', ot));
    return snap.exists() ? { id: snap.id, ...JSON.parse(JSON.stringify(snap.data())) } : null;
  }, otNumber);
}
