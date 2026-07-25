/**
 * Sube el escaneo/archivo de la certificación del cliente a Firebase Storage.
 *
 * Path: `certificaciones/{certificacionId}/{timestamp}_{filename}`.
 *
 * La certificación habilita a facturar servicios ya ejecutados (clientes con
 * `requisitoFacturacion === 'certificacion'`). Mismo patrón que `fotoStorageService`.
 */
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, uploadBytes, deleteObject } from './firebase';

export const certificacionStorageService = {
  async upload(certificacionId: string, file: File | Blob, filename: string): Promise<{
    storagePath: string;
    url: string;
  }> {
    const safeName = filename.replace(/[^\w.\-]/g, '_');
    const storagePath = `certificaciones/${certificacionId}/${Date.now()}_${safeName}`;
    const r = ref(storage, storagePath);
    await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
    const url = await getDownloadURL(r);
    return { storagePath, url };
  },

  async remove(storagePath: string): Promise<void> {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      console.warn('No se pudo eliminar certificación de Storage:', storagePath, err);
    }
  },
};
