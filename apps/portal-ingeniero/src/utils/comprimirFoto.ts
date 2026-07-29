const MAX_LADO = 1600;
const CALIDAD = 0.8;

/**
 * Comprime una foto de cámara antes de encolarla para subir (UAT 2026-07-29:
 * las fotos crudas del iPhone pesan varios MB y con señal débil la subida a
 * Storage agota los reintentos — storage/retry-limit-exceeded). Reescala al
 * lado máximo de 1600px y re-encoda JPEG 0.8 (~10x más liviana, sobra para
 * fotos de fichas/loaners). Ante cualquier fallo devuelve la original: nunca
 * bloquea la captura.
 */
export async function comprimirFotoParaSubida(original: Blob): Promise<Blob> {
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
      // 'from-image': respeta la orientación EXIF de la cámara (si el browser
      // no soporta la opción, cae al catch y usamos <img>, que en iOS la aplica solo).
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
