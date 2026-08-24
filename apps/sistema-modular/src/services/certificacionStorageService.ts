/**
 * Sube el escaneo/archivo de la certificación del cliente a Firebase Storage.
 *
 * Path: `certificaciones/{certificacionId}/{timestamp}_{filename}`.
 *
 * La certificación habilita a facturar servicios ya ejecutados (clientes con
 * `requisitoFacturacion === 'certificacion'`). Mismo patrón que `fotoStorageService`.
 */
import { ref, getDownloadURL, updateMetadata } from 'firebase/storage';
import { storage, uploadBytes, deleteObject } from './firebase';

/**
 * Tipo de contenido a partir de la extensión (2026-08-23).
 *
 * El bug que fija: "Ver" descargaba el archivo en lugar de abrirlo. El
 * navegador NO siempre completa `file.type` —depende de que el sistema tenga
 * registrada la asociación de la extensión, y con PDFs arrastrados o subidos
 * desde ciertos orígenes viene vacío—. El fallback era `application/octet-stream`,
 * que Storage devuelve tal cual y el navegador solo sabe bajar.
 *
 * El resto de los uploads de PDF del sistema ya caían en `application/pdf`;
 * este era el único que no.
 */
const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

function contentTypeDe(file: File | Blob, filename: string): string {
  // `file.type` manda cuando viene: es lo que declaró el navegador.
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  // La certificación es casi siempre un PDF escaneado: ese es el default sano.
  return MIME_POR_EXTENSION[ext] ?? 'application/pdf';
}

export const certificacionStorageService = {
  async upload(certificacionId: string, file: File | Blob, filename: string): Promise<{
    storagePath: string;
    url: string;
  }> {
    const safeName = filename.replace(/[^\w.\-]/g, '_');
    const storagePath = `certificaciones/${certificacionId}/${Date.now()}_${safeName}`;
    const r = ref(storage, storagePath);
    await uploadBytes(r, file, { contentType: contentTypeDe(file, filename) });
    const url = await getDownloadURL(r);
    return { storagePath, url };
  },

  /**
   * Corrige el tipo de contenido de un archivo ya subido (2026-08-23).
   *
   * Los que se subieron antes del fix quedaron como `application/octet-stream`
   * y se siguen bajando aunque el código nuevo esté bien: el tipo está guardado
   * en el objeto de Storage, no se deduce al leerlo. Esto lo reescribe sin
   * volver a subir el archivo.
   */
  async repararContentType(storagePath: string, filename?: string): Promise<string> {
    const ext = (filename ?? storagePath).split('.').pop()?.toLowerCase() ?? '';
    const contentType = MIME_POR_EXTENSION[ext] ?? 'application/pdf';
    await updateMetadata(ref(storage, storagePath), { contentType });
    return contentType;
  },

  async remove(storagePath: string): Promise<void> {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      console.warn('No se pudo eliminar certificación de Storage:', storagePath, err);
    }
  },
};
