const MAX_LADO = 1600;
const CALIDAD = 0.8;

/**
 * Comprime una foto antes de subirla a Storage (port del util homónimo de
 * portal-ingeniero, 2026-08-06): las fotos crudas de cámara pesan varios MB y
 * con red lenta o intervenida (AV) la subida agota los reintentos —
 * storage/retry-limit-exceeded ("max retry time for operation exceeded").
 * Reescala al lado máximo de 1600px y re-encoda JPEG 0.8 (~10x más liviana).
 * Ante cualquier fallo devuelve la original: nunca bloquea la subida.
 */
export async function comprimirFotoParaSubida(original: Blob): Promise<Blob> {
  // Guardia dura: si el pipeline de canvas se cuelga (decodificador raro, HEIC),
  // a los 10s se sube la ORIGINAL — la subida nunca queda "cargando" por esto.
  const timeout = new Promise<Blob>(res => setTimeout(() => res(original), 10_000));
  return Promise.race([timeout, comprimir(original)]);
}

async function comprimir(original: Blob): Promise<Blob> {
  try {
    const fuente = await crearFuente(original);
    const ancho = 'width' in fuente ? fuente.width : 0;
    const alto = 'height' in fuente ? fuente.height : 0;
    if (!ancho || !alto) return original;
    const escala = Math.min(1, MAX_LADO / Math.max(ancho, alto));
    const w = Math.max(1, Math.round(ancho * escala));
    const h = Math.max(1, Math.round(alto * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(fuente as CanvasImageSource, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', CALIDAD));
    // Solo usar la comprimida si realmente achica (fotos ya chicas quedan igual).
    return blob && blob.size < original.size ? blob : original;
  } catch {
    return original;
  }
}

async function crearFuente(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image': respeta la orientación EXIF de la cámara.
      return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch { /* HEIC u opción no soportada → fallback <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('No se pudo decodificar la imagen'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
