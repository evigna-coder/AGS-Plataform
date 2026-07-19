import { useState } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
// Writes a Storage SIEMPRE vía el wrapper (unstick del keyboard router en Electron) —
// nunca importar uploadBytes del SDK directo. Ver services/firebase.ts.
import { storage, uploadBytes } from '../../../services/firebase';

/** Límite de tamaño por foto — rechazamos archivos más grandes con aviso. */
const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function sanitizeName(name: string): string {
  return (name || 'foto').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

/**
 * Subida de fotos para sub-ítems de presupuestos tipo 'ventas' (Equipos).
 * Soporta input file y pegado desde el portapapeles (Ctrl+V de un screenshot).
 *
 * `presupuestoId` null/undefined → flujo de creación (todavía no hay doc):
 * las fotos van a un path genérico bajo `presupuestos/` (permitido por
 * storage.rules — `presupuestos/{allPaths=**}`).
 */
export function useSubItemFotos(presupuestoId?: string | null) {
  const [uploading, setUploading] = useState(false);

  const uploadOne = async (file: File): Promise<string | null> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert(`"${file.name}": formato no soportado (usar PNG o JPG).`);
      return null;
    }
    if (file.size > MAX_FOTO_BYTES) {
      alert(`"${file.name}" pesa más de 5 MB. Reducí la imagen antes de subirla.`);
      return null;
    }
    const base = presupuestoId
      ? `presupuestos/${presupuestoId}/subitems`
      : 'presupuestos/subitem-fotos';
    const storageRef = ref(storage, `${base}/${Date.now()}_${sanitizeName(file.name)}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  /** Sube una lista de archivos y devuelve las URLs de los que subieron OK. */
  const uploadFiles = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const file of files) {
        try {
          const url = await uploadOne(file);
          if (url) urls.push(url);
        } catch (err) {
          console.error('[useSubItemFotos] Error subiendo foto:', err);
          alert(`Error al subir "${file.name}". Reintentá.`);
        }
      }
    } finally {
      setUploading(false);
    }
    return urls;
  };

  /** Extrae imágenes de un evento de paste (clipboardData.items / files). */
  const extractPastedImages = (e: React.ClipboardEvent): File[] => {
    const out: File[] = [];
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) out.push(f);
        }
      }
    }
    if (out.length === 0 && e.clipboardData?.files) {
      for (const f of Array.from(e.clipboardData.files)) {
        if (f.type.startsWith('image/')) out.push(f);
      }
    }
    return out;
  };

  return { uploading, uploadFiles, extractPastedImages };
}
