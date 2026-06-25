/**
 * Recorta el whitespace transparente alrededor del trazo de una firma guardada
 * como dataURL PNG. Devuelve un dataURL nuevo con el bounding-box del trazo +
 * padding, o el original si no se puede procesar / está vacío.
 *
 * Por qué: las firmas guardadas del ingeniero (`getUserFirma` → `firmaBase64`)
 * y las de reportes viejos se almacenaron full-canvas, con el trazo chico
 * rodeado de transparencia. Al renderizarlas (pad con `object-contain`, PDF con
 * `object-contain`) el trazo queda diminuto y centrado. Recortando el whitespace
 * al cargar, tanto el pad como el PDF reciben un bbox ajustado y lo agrandan
 * para llenar la caja. Las firmas nuevas ya vienen recortadas (no-op).
 */
export function trimSignatureDataUrl(dataUrl: string, padding = 10): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) { resolve(dataUrl); return; }
        const src = document.createElement('canvas');
        src.width = w;
        src.height = h;
        const sctx = src.getContext('2d');
        if (!sctx) { resolve(dataUrl); return; }
        sctx.drawImage(img, 0, 0);
        const data = sctx.getImageData(0, 0, w, h).data;
        let top = h, bottom = -1, left = w, right = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 0) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
              if (x < left) left = x;
              if (x > right) right = x;
            }
          }
        }
        if (right < left) { resolve(dataUrl); return; } // canvas vacío
        const tw = right - left + 1 + padding * 2;
        const th = bottom - top + 1 + padding * 2;
        // Si ya está prácticamente ajustado (margen < padding por lado), no re-encodear.
        if (left <= padding && top <= padding && right >= w - 1 - padding && bottom >= h - 1 - padding) {
          resolve(dataUrl);
          return;
        }
        const out = document.createElement('canvas');
        out.width = tw;
        out.height = th;
        out.getContext('2d')!.drawImage(src, left - padding, top - padding, tw, th, 0, 0, tw, th);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
