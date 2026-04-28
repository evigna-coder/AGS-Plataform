/**
 * Sube blobs de fotos de fichas a Firebase Storage desde sistema-modular.
 *
 * Mismo path que portal-ingeniero: `fotosFichas/{itemSubId}/{timestamp}_{filename}`.
 *
 * Reemplazo del legacy `googleDriveService` (que solo funcionaba en Electron con
 * service account JWT). Las fotos viejas con `driveFileId` siguen visibles vía
 * `FotoFicha.url` ya guardado en Firestore — solo cambian las nuevas.
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const fotoStorageService = {
  async upload(itemSubId: string, file: File | Blob, filename: string): Promise<{
    storagePath: string;
    url: string;
  }> {
    const safeName = filename.replace(/[^\w.\-]/g, '_');
    const storagePath = `fotosFichas/${itemSubId}/${Date.now()}_${safeName}`;
    const r = ref(storage, storagePath);
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(r);
    return { storagePath, url };
  },

  async remove(storagePath: string): Promise<void> {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      // Ya borrado o ruta inválida — no es fatal
      console.warn('No se pudo eliminar foto de Storage:', storagePath, err);
    }
  },
};
