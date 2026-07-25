import { doc, collection, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, createBatch, batchAudit, deepCleanForFirestore, getCreateTrace } from './firebase';
import { ordenesTrabajoService } from './otService';
import { certificacionStorageService } from './certificacionStorageService';
import type { Certificacion } from '@ags/shared';

export interface CreateCertificacionInput {
  numero?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  fecha: string;
  otNumbers: string[];
  archivo?: File | null;
  observaciones?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDoc = (d: any): Certificacion => ({
  id: d.id,
  ...d.data(),
  createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
  updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
});

export const certificacionesService = {
  /**
   * Registra una certificación del cliente y LIBERA para facturación cada OT que
   * cubre (clientes `requisitoFacturacion === 'certificacion'`). Sube el archivo a
   * Storage y estampa `certificacionId` en cada OT liberada (trazabilidad).
   * La liberación por OT es best-effort: si una falla, las demás igual se liberan.
   */
  async create(
    input: CreateCertificacionInput,
    actor?: { uid: string; name?: string },
  ): Promise<{ id: string; liberadas: string[] }> {
    const id = crypto.randomUUID();
    let archivoUrl: string | null = null;
    let archivoPath: string | null = null;
    if (input.archivo) {
      const up = await certificacionStorageService.upload(id, input.archivo, input.archivo.name);
      archivoUrl = up.url;
      archivoPath = up.storagePath;
    }

    const payload = deepCleanForFirestore({
      numero: input.numero ?? null,
      clienteId: input.clienteId ?? null,
      clienteNombre: input.clienteNombre ?? null,
      fecha: input.fecha,
      otNumbers: input.otNumbers,
      archivoUrl,
      archivoPath,
      observaciones: input.observaciones ?? null,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(doc(db, 'certificaciones', id), payload);
    batchAudit(batch, { action: 'create', collection: 'certificaciones', documentId: id, after: payload });
    await batch.commit();

    const liberadas: string[] = [];
    for (const otNumber of input.otNumbers) {
      try {
        await ordenesTrabajoService.liberarParaFacturacion(otNumber, actor);
        await ordenesTrabajoService.update(otNumber, {
          certificacionId: id,
          certificacionNumero: input.numero ?? null,
        });
        liberadas.push(otNumber);
      } catch (err) {
        console.error(`[certificaciones.create] no se pudo liberar OT ${otNumber}:`, err);
      }
    }
    return { id, liberadas };
  },

  async getAll(filters?: { clienteId?: string }): Promise<Certificacion[]> {
    let q = query(collection(db, 'certificaciones'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    const snap = await getDocs(q);
    const items = snap.docs.map(mapDoc);
    items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    return items;
  },

  async getById(id: string): Promise<Certificacion | null> {
    const snap = await getDoc(doc(db, 'certificaciones', id));
    return snap.exists() ? mapDoc(snap) : null;
  },
};
