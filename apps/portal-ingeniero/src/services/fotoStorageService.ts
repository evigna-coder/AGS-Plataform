/**
 * Sube blobs de fotos de fichas a Firebase Storage.
 *
 * Path: `fotosFichas/{fichaNumero}/{timestamp}_{filename}`
 *
 * NOTA (2026-04-26): elegimos Firebase Storage en vez de Drive porque
 * `googleDriveService` solo funciona en Electron (usa window.driveAPI). Esta es la
 * fase 1 — más adelante podemos migrar a Drive u otro destino más barato si el
 * volumen de almacenamiento se vuelve un problema.
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const fotoStorageService = {
  async upload(fichaNumero: string, blob: Blob, filename: string): Promise<{
    storagePath: string;
    url: string;
  }> {
    const safeName = filename.replace(/[^\w.\-]/g, '_');
    const storagePath = `fotosFichas/${fichaNumero}/${Date.now()}_${safeName}`;
    const r = ref(storage, storagePath);
    await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
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
