/**
 * Sube el escaneo del remito de servicio FIRMADO por el cliente a Firebase Storage.
 *
 * Path: `remitosFirmados/{remitoId}/{timestamp}_{filename}`.
 *
 * El remito firmado es la prueba de entrega del servicio. Se trackea siempre; para
 * clientes con `requisitoFacturacion === 'remito_firmado'` es el gate de facturación.
 * Mismo patrón que `fotoStorageService`.
 */
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, uploadBytes, deleteObject } from './firebase';

export const remitoFirmaStorageService = {
  async upload(remitoId: string, file: File | Blob, filename: string): Promise<{
    storagePath: string;
    url: string;
  }> {
    const safeName = filename.replace(/[^\w.\-]/g, '_');
    const storagePath = `remitosFirmados/${remitoId}/${Date.now()}_${safeName}`;
    const r = ref(storage, storagePath);
    await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
    const url = await getDownloadURL(r);
    return { storagePath, url };
  },

  async remove(storagePath: string): Promise<void> {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      // Ya borrado o ruta inválida — no es fatal
      console.warn('No se pudo eliminar remito firmado de Storage:', storagePath, err);
    }
  },
};
