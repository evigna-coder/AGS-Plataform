import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { JornadaViaje } from '@ags/shared';
import {
  db, docRef, createBatch, batchAudit,
  deepCleanForFirestore, getCreateTrace, getUpdateTrace,
} from './firebase';

const COL = 'jornadas_viaje';

/**
 * Doc id determinístico por (ingeniero, día): cargar dos veces el mismo día
 * actualiza en lugar de duplicar, que en un reporte de desarraigo sería pagar
 * dos veces (2026-08-08).
 */
export const jornadaId = (ingenieroId: string, fecha: string) => `${ingenieroId}_${fecha}`;

function toJornada(id: string, data: Record<string, unknown>): JornadaViaje {
  const ts = (v: unknown): string =>
    (v as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (v as string) ?? '';
  return {
    id,
    ingenieroId: (data.ingenieroId as string) ?? '',
    ingenieroNombre: (data.ingenieroNombre as string) ?? '',
    fecha: (data.fecha as string) ?? '',
    horaSalida: (data.horaSalida as string) ?? null,
    horaLlegada: (data.horaLlegada as string) ?? null,
    llegadaDiaSiguiente: !!data.llegadaDiaSiguiente,
    observaciones: (data.observaciones as string) ?? null,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
    createdBy: (data.createdBy as string) ?? null,
    createdByName: (data.createdByName as string) ?? null,
    updatedBy: (data.updatedBy as string) ?? null,
    updatedByName: (data.updatedByName as string) ?? null,
  };
}

export const jornadasViajeService = {
  /**
   * Jornadas de un mes ('YYYY-MM'). Se filtra por rango de `fecha` como string:
   * el formato 'YYYY-MM-DD' ordena igual que la fecha real.
   */
  async getByMes(mes: string): Promise<JornadaViaje[]> {
    if (!/^\d{4}-\d{2}$/.test(mes)) return [];
    const snap = await getDocs(query(
      collection(db, COL),
      where('fecha', '>=', `${mes}-01`),
      where('fecha', '<=', `${mes}-31`),
    ));
    return snap.docs.map(d => toJornada(d.id, d.data()))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  /** Alta o actualización de la jornada de un día (upsert por doc id). */
  async guardar(input: {
    ingenieroId: string;
    ingenieroNombre: string;
    fecha: string;
    horaSalida?: string | null;
    horaLlegada?: string | null;
    llegadaDiaSiguiente?: boolean;
    observaciones?: string | null;
  }): Promise<string> {
    const id = jornadaId(input.ingenieroId, input.fecha);
    const payload = deepCleanForFirestore({
      ingenieroId: input.ingenieroId,
      ingenieroNombre: input.ingenieroNombre,
      fecha: input.fecha,
      horaSalida: input.horaSalida ?? null,
      horaLlegada: input.horaLlegada ?? null,
      llegadaDiaSiguiente: !!input.llegadaDiaSiguiente,
      observaciones: input.observaciones ?? null,
      ...getCreateTrace(),
      ...getUpdateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    // merge: si el día ya existía, no se pierde la traza de creación original.
    batch.set(docRef(COL, id), payload, { merge: true });
    batchAudit(batch, { action: 'update', collection: COL, documentId: id, after: payload });
    await batch.commit();
    return id;
  },
};
