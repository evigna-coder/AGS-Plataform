/**
 * Recorta el whitespace transparente alrededor del trazo de una firma guardada
 * como dataURL PNG. Devuelve un dataURL nuevo con el bounding-box de los trazos
 * reales + padding, o el original si no se puede procesar / está vacío.
 *
 * Por qué: las firmas guardadas del ingeniero (`getUserFirma` → `firmaBase64`)
 * y las de reportes viejos se almacenaron full-canvas, con el trazo chico
 * rodeado de transparencia. Al renderizarlas (pad / PDF con `object-contain`) el
 * trazo queda diminuto y centrado. Recortando el whitespace al cargar, tanto el
 * pad como el PDF reciben un bbox ajustado y lo agrandan para llenar la caja.
 *
 * Robusto a "manchitas": muchas firmas guardadas tienen specks sueltos (un
 * puntito o tick aislado lejos de la firma). Un bbox ingenuo de TODO el tinta se
 * estira hasta esa mancha y deja la firma real chica. Por eso descartamos los
 * componentes conexos cuya área es despreciable frente al trazo principal antes
 * de calcular el bbox. Las firmas nuevas ya vienen recortadas → no-op.
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
        const alpha = sctx.getImageData(0, 0, w, h).data;

        // Máscara de píxeles con tinta. Umbral > 16 para ignorar el antialias casi
        // transparente del borde.
        const opaque = new Uint8Array(w * h);
        let totalOpaque = 0;
        for (let i = 0; i < w * h; i++) {
          if (alpha[i * 4 + 3] > 16) { opaque[i] = 1; totalOpaque++; }
        }
        if (totalOpaque === 0) { resolve(dataUrl); return; } // canvas vacío

        // Componentes conexos (8-conectividad) por BFS iterativo.
        const label = new Int32Array(w * h).fill(-1);
        const stack = new Int32Array(w * h);
        const compArea: number[] = [];
        let nComp = 0;
        for (let start = 0; start < w * h; start++) {
          if (!opaque[start] || label[start] !== -1) continue;
          const id = nComp++;
          let area = 0;
          let sp = 0;
          stack[sp++] = start;
          label[start] = id;
          while (sp > 0) {
            const p = stack[--sp];
            area++;
            const px = p % w;
            const py = (p / w) | 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = px + dx, ny = py + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const np = ny * w + nx;
                if (opaque[np] && label[np] === -1) {
                  label[np] = id;
                  stack[sp++] = np;
                }
              }
            }
          }
          compArea.push(area);
        }

        // Umbral: descartar componentes despreciables (specks). Conservamos los que
        // superan el 4% del componente más grande o un piso absoluto, lo que sea mayor.
        const largest = Math.max(...compArea);
        const minArea = Math.max(40, largest * 0.04);

        let top = h, bottom = -1, left = w, right = -1;
        for (let p = 0; p < w * h; p++) {
          const id = label[p];
          if (id < 0) continue;
          if (compArea[id] < minArea) continue;
          const px = p % w;
          const py = (p / w) | 0;
          if (py < top) top = py;
          if (py > bottom) bottom = py;
          if (px < left) left = px;
          if (px > right) right = px;
        }
        if (right < left) { resolve(dataUrl); return; }

        const tw = right - left + 1 + padding * 2;
        const th = bottom - top + 1 + padding * 2;
        // Si ya está prácticamente ajustado (margen ≤ padding por lado) y sin specks
        // recortados, no re-encodear.
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
