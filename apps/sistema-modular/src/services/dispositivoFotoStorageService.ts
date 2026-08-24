/**
 * Fotos de identificación de un dispositivo (2026-08-23).
 *
 * Dos por equipo: frente, para reconocerlo de un vistazo, y dorso, que en las
 * de escritorio es donde se ven los puertos y el cableado.
 *
 * A diferencia de fichas y loaners, acá la foto NO viaja al portal ni forma
 * parte de un circuito: es un adjunto de la ficha del equipo.
 *
 * Path: `fotosDispositivos/{dispositivoId}/{cara}_{timestamp}_{filename}`.
 */
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, uploadBytes, deleteObject } from './firebase';

export type CaraFotoDispositivo = 'frente' | 'dorso';

/** Tipo por extensión cuando el navegador no completa `file.type`. */
const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
};

function contentTypeDe(file: File | Blob, filename: string): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_POR_EXTENSION[ext] ?? 'image/jpeg';
}

export const dispositivoFotoStorageService = {
  async upload(dispositivoId: string, cara: CaraFotoDispositivo, file: File | Blob, filename: string): Promise<{
    storagePath: string;
    url: string;
  }> {
    const safeName = filename.replace(/[^\w.\-]/g, '_');
    const storagePath = `fotosDispositivos/${dispositivoId}/${cara}_${Date.now()}_${safeName}`;
    const r = ref(storage, storagePath);
    await uploadBytes(r, file, { contentType: contentTypeDe(file, filename) });
    const url = await getDownloadURL(r);
    return { storagePath, url };
  },

  async remove(storagePath: string): Promise<void> {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      // Ya borrada o ruta inválida — no es fatal.
      console.warn('No se pudo eliminar la foto del dispositivo:', storagePath, err);
    }
  },
};
