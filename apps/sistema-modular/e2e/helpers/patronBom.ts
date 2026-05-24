/**
 * Phase 14 Wave 4 UAT — seed helpers para specs de Patrones BOM + cierre.
 *
 * Tres seeders + un cleaner, todos con Firestore client SDK (mismo patrón que
 * helpers/equivalencias.ts y firestore-assert.ts). No usan Admin SDK por la
 * decisión I1 de Phase 8 (orchestrator).
 *
 * Lo que cubren:
 *  - seedPatronBom: crea un Patron con N componentes y un único lote → devuelve ids
 *  - seedOTReportePatrones: escribe `reportes/{otNumber}` con patronesSeleccionados
 *    + estadoAdmin (sin tocar reportes-ot, que es frozen surface)
 *  - seedAdminConfigUsuarioRequerimientosPatron: setea usuarioRequerimientosPatronId
 *    en `adminConfig/flujos` (con preservación del resto del doc)
 *  - cleanupPatronBomFixture: borra todos los docs creados por los seeders
 */

import { db } from '../fixtures/firebase-e2e';
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos locales mínimos — espejos shape de @ags/shared (no se importan para
// mantener este helper independiente del paquete shared y evitar friction si
// shared cambia path).
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

export async function seedPatronBom(opts: SeedPatronBomOpts = {}): Promise<SeededPatron> {
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
  const now = Timestamp.now();

  await setDoc(doc(db, 'patrones', patronId), {
    codigoArticulo,
    descripcion,
    marca,
    categorias,
    lotes,
    componentes,
    activo: true,
    createdAt: now,
    updatedAt: now,
    createdBy: 'e2e-seed',
    createdByName: 'E2E Seed',
    updatedBy: 'e2e-seed',
    updatedByName: 'E2E Seed',
  });

  return { patronId, codigoArticulo, descripcion, componentes, lotes };
}

// ──────────────────────────────────────────────────────────────────────────────
// seedOTReportePatrones — escribe `reportes/{otNumber}` con patronesSeleccionados.
// Esto evita tocar reportes-ot (frozen surface) — el técnico normalmente
// seleccionaría los patrones desde la PWA y este doc se generaría al terminar
// el reporte. Para tests, lo escribimos directo.
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

export async function seedOTReportePatrones(opts: SeedOTReporteOpts): Promise<SeededOTReporte> {
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

  await setDoc(doc(db, 'reportes', otNumber), {
    otNumber,
    estadoAdmin,
    patronesSeleccionados,
    // Campos mínimos para que la UI no rompa al leer la OT
    budgets: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'e2e-seed',
    createdByName: 'E2E Seed',
  });

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
  usuarioId: string | null,
): Promise<PrevAdminConfigSnapshot> {
  const ref = doc(db, 'adminConfig', 'flujos');
  const snap = await getDoc(ref);
  const previous = snap.exists()
    ? (((snap.data() as any).usuarioRequerimientosPatronId as string | null | undefined) ?? null)
    : null;

  if (snap.exists()) {
    await setDoc(
      ref,
      { usuarioRequerimientosPatronId: usuarioId, updatedAt: Timestamp.now() },
      { merge: true },
    );
  } else {
    // No existe el doc — creamos uno mínimo (mailFacturacion requerido por el UI)
    await setDoc(ref, {
      usuarioRequerimientosPatronId: usuarioId,
      mailFacturacion: 'e2e@agsanalitica.com',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  return { previousValue: previous };
}

export async function restoreAdminConfigUsuarioRequerimientosPatron(
  snapshot: PrevAdminConfigSnapshot,
): Promise<void> {
  await seedAdminConfigUsuarioRequerimientosPatron(snapshot.previousValue);
}

// ──────────────────────────────────────────────────────────────────────────────
// Cleanup — borra patron + reportes + movimientos + requerimientos generados
// por una fixture.
// ──────────────────────────────────────────────────────────────────────────────

export interface CleanupOpts {
  patronId?: string;
  otNumbers?: string[];
}

export async function cleanupPatronBomFixture(opts: CleanupOpts): Promise<void> {
  // Movimientos por OT
  if (opts.otNumbers?.length) {
    for (const otNumber of opts.otNumbers) {
      const q = query(
        collection(db, 'movimientosStock'),
        where('otNumber', '==', otNumber),
      );
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'reportes', otNumber)).catch(() => {});
    }
  }
  // Requerimientos por patron (origen patron_minimo)
  if (opts.patronId) {
    const q = query(
      collection(db, 'requerimientos_compra'),
      where('patronId', '==', opts.patronId),
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'patrones', opts.patronId)).catch(() => {});
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Readers — para assertions en specs sin duplicar queries en cada test
// ──────────────────────────────────────────────────────────────────────────────

export async function getPatron(patronId: string): Promise<any | null> {
  const snap = await getDoc(doc(db, 'patrones', patronId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getMovimientosPatronByOt(
  otNumber: string,
): Promise<Array<{ id: string } & Record<string, any>>> {
  const q = query(
    collection(db, 'movimientosStock'),
    where('otNumber', '==', otNumber),
    where('entidadTipo', '==', 'patron'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function getReqsPatronMinimoByPatron(
  patronId: string,
): Promise<Array<{ id: string } & Record<string, any>>> {
  const q = query(
    collection(db, 'requerimientos_compra'),
    where('patronId', '==', patronId),
    where('origen', '==', 'patron_minimo'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function getReporteOT(otNumber: string): Promise<any | null> {
  const snap = await getDoc(doc(db, 'reportes', otNumber));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
