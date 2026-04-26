import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Patron, CategoriaPatron } from '@ags/shared';
import { db, storage, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

// --- Patrones (colección /patrones) ---
// Cada patrón es un estándar/material de referencia con múltiples lotes.
// Cada lote tiene su propio vencimiento y certificado.

function toPatron(id: string, data: any): Patron {
  return {
    id,
    ...data,
    lotes: data.lotes ?? [],
    categorias: data.categorias ?? [],
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
  } as Patron;
}

export const patronesService = {
  async getAll(filters?: {
    categoria?: CategoriaPatron;
    activoOnly?: boolean;
  }): Promise<Patron[]> {
    let q = query(collection(db, 'patrones'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => toPatron(d.id, d.data()));
    if (filters?.categoria) {
      items = items.filter(p => p.categorias.includes(filters.categoria!));
    }
    items.sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
    return items;
  },

  async getById(id: string): Promise<Patron | null> {
    const snap = await getDoc(doc(db, 'patrones', id));
    if (!snap.exists()) return null;
    return toPatron(snap.id, snap.data());
  },

  async create(data: Omit<Patron, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      lotes: data.lotes ?? [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('patrones', id), payload);
    batchAudit(batch, { action: 'create', collection: 'patrones', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Patron, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('patrones', id), payload);
    batchAudit(batch, { action: 'update', collection: 'patrones', documentId: id, after: payload });
    await batch.commit();
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },

  async activate(id: string): Promise<void> {
    await this.update(id, { activo: true });
  },

  async delete(id: string): Promise<void> {
    // Borrar certificados de Storage de todos los lotes antes de eliminar el documento
    const patron = await this.getById(id);
    if (patron?.lotes) {
      for (const lote of patron.lotes) {
        if (lote.certificadoStoragePath) {
          try { await deleteObject(storageRef(storage, lote.certificadoStoragePath)); } catch { /* ignore */ }
        }
      }
    }
    const batch = createBatch();
    batch.delete(docRef('patrones', id));
    batchAudit(batch, { action: 'delete', collection: 'patrones', documentId: id });
    await batch.commit();
  },

  // ── Storage: certificado por lote ──

  /**
   * Sube el certificado de un lote específico y actualiza el array lotes del patrón.
   */
  async uploadCertificadoLote(patronId: string, loteIdx: number, file: File): Promise<{ url: string; path: string }> {
    const patron = await this.getById(patronId);
    if (!patron) throw new Error(`Patron ${patronId} no encontrado`);
    if (loteIdx < 0 || loteIdx >= patron.lotes.length) throw new Error(`Lote index ${loteIdx} fuera de rango`);

    const path = `certificados/patrones/${patronId}/${loteIdx}/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);

    const nuevoLotes = [...patron.lotes];
    nuevoLotes[loteIdx] = {
      ...nuevoLotes[loteIdx],
      certificadoUrl: url,
      certificadoNombre: file.name,
      certificadoStoragePath: path,
    };
    await this.update(patronId, { lotes: nuevoLotes });
    return { url, path };
  },

  /**
   * Elimina el certificado de un lote y limpia las referencias.
   */
  async deleteCertificadoLote(patronId: string, loteIdx: number): Promise<void> {
    const patron = await this.getById(patronId);
    if (!patron) return;
    const lote = patron.lotes[loteIdx];
    if (!lote) return;
    if (lote.certificadoStoragePath) {
      try { await deleteObject(storageRef(storage, lote.certificadoStoragePath)); } catch { /* ignore */ }
    }
    const nuevoLotes = [...patron.lotes];
    nuevoLotes[loteIdx] = {
      ...nuevoLotes[loteIdx],
      certificadoUrl: null,
      certificadoNombre: null,
      certificadoStoragePath: null,
    };
    await this.update(patronId, { lotes: nuevoLotes });
  },

  subscribe(
    filters: { categoria?: CategoriaPatron; activoOnly?: boolean } | undefined,
    callback: (items: Patron[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q = query(collection(db, 'patrones'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    return onSnapshot(q, snap => {
      let items = snap.docs.map(d => toPatron(d.id, d.data()));
      if (filters?.categoria) {
        items = items.filter(p => p.categorias.includes(filters.categoria!));
      }
      items.sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
      callback(items);
    }, onError);
  },
};
