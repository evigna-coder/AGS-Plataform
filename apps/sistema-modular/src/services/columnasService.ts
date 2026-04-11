import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { deleteObject, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Columna, CategoriaPatron } from '@ags/shared';
import { db, storage, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

// --- Columnas cromatográficas (colección /columnas) ---
// Cada columna se identifica por código de artículo.
// Puede tener múltiples unidades físicas (series) bajo el mismo código.

function toColumna(id: string, data: any): Columna {
  return {
    id,
    ...data,
    series: data.series ?? [],
    categorias: data.categorias ?? [],
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
  } as Columna;
}

export const columnasService = {
  async getAll(filters?: {
    categoria?: CategoriaPatron;
    activoOnly?: boolean;
  }): Promise<Columna[]> {
    let q = query(collection(db, 'columnas'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => toColumna(d.id, d.data()));
    if (filters?.categoria) {
      items = items.filter(c => c.categorias.includes(filters.categoria!));
    }
    items.sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
    return items;
  },

  async getById(id: string): Promise<Columna | null> {
    const snap = await getDoc(doc(db, 'columnas', id));
    if (!snap.exists()) return null;
    return toColumna(snap.id, snap.data());
  },

  async create(data: Omit<Columna, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      series: data.series ?? [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef('columnas', id), payload);
    batchAudit(batch, { action: 'create', collection: 'columnas', documentId: id, after: payload as any });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Columna, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('columnas', id), payload);
    batchAudit(batch, { action: 'update', collection: 'columnas', documentId: id, after: payload as any });
    await batch.commit();
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },

  async activate(id: string): Promise<void> {
    await this.update(id, { activo: true });
  },

  async delete(id: string): Promise<void> {
    // Borrar certificados de Storage de todas las series antes de eliminar
    const columna = await this.getById(id);
    if (columna?.series) {
      for (const s of columna.series) {
        if (s.certificadoStoragePath) {
          try { await deleteObject(storageRef(storage, s.certificadoStoragePath)); } catch { /* ignore */ }
        }
      }
    }
    const batch = createBatch();
    batch.delete(docRef('columnas', id));
    batchAudit(batch, { action: 'delete', collection: 'columnas', documentId: id });
    await batch.commit();
  },

  // ── Storage: certificado por serie ──

  /**
   * Sube el certificado de una serie específica y actualiza el array series de la columna.
   */
  async uploadCertificadoSerie(columnaId: string, serieIdx: number, file: File): Promise<{ url: string; path: string }> {
    const columna = await this.getById(columnaId);
    if (!columna) throw new Error(`Columna ${columnaId} no encontrada`);
    if (serieIdx < 0 || serieIdx >= columna.series.length) throw new Error(`Serie index ${serieIdx} fuera de rango`);

    const path = `certificados/columnas/${columnaId}/${serieIdx}/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);

    const nuevasSeries = [...columna.series];
    nuevasSeries[serieIdx] = {
      ...nuevasSeries[serieIdx],
      certificadoUrl: url,
      certificadoNombre: file.name,
      certificadoStoragePath: path,
    };
    await this.update(columnaId, { series: nuevasSeries });
    return { url, path };
  },

  /**
   * Elimina el certificado de una serie y limpia las referencias.
   */
  async deleteCertificadoSerie(columnaId: string, serieIdx: number): Promise<void> {
    const columna = await this.getById(columnaId);
    if (!columna) return;
    const s = columna.series[serieIdx];
    if (!s) return;
    if (s.certificadoStoragePath) {
      try { await deleteObject(storageRef(storage, s.certificadoStoragePath)); } catch { /* ignore */ }
    }
    const nuevasSeries = [...columna.series];
    nuevasSeries[serieIdx] = {
      ...nuevasSeries[serieIdx],
      certificadoUrl: null,
      certificadoNombre: null,
      certificadoStoragePath: null,
    };
    await this.update(columnaId, { series: nuevasSeries });
  },

  subscribe(
    filters: { categoria?: CategoriaPatron; activoOnly?: boolean } | undefined,
    callback: (items: Columna[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q = query(collection(db, 'columnas'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    return onSnapshot(q, snap => {
      let items = snap.docs.map(d => toColumna(d.id, d.data()));
      if (filters?.categoria) {
        items = items.filter(c => c.categorias.includes(filters.categoria!));
      }
      items.sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
      callback(items);
    }, onError);
  },
};
