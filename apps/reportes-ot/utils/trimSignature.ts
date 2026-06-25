/**
 * Recorta el whitespace y las "manchitas" aisladas alrededor de la firma de un
 * dataURL PNG. Devuelve un dataURL nuevo ajustado al bloque real de la firma, o
 * el original si no se puede procesar.
 *
 * Por qué: las firmas guardadas (`getUserFirma` → `firmaBase64`, o las de
 * reportes) suelen tener un trazo suelto / tap accidental (una "manchita")
 * separada de la firma. El recorte ingenuo abarca desde la manchita hasta la
 * firma → imagen alta y angosta → al renderizarla en una caja baja
 * (`object-contain`) la firma queda diminuta.
 *
 * Estrategia: recorte por BANDAS de densidad. Proyectamos la tinta sobre los
 * ejes Y (filas) y X (columnas), partimos cada eje en bandas contiguas de tinta
 * separadas por bandas vacías, y descartamos las bandas marginales con poca
 * tinta (manchitas) antes de calcular el bbox. Robusto al tamaño de la mancha:
 * lo que importa es que esté AISLADA y sea de baja densidad, no su área.
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

        const rowInk = new Float64Array(h);
        const colInk = new Float64Array(w);
        let total = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (alpha[(y * w + x) * 4 + 3] > 16) {
              rowInk[y]++; colInk[x]++; total++;
            }
          }
        }
        if (total === 0) { resolve(dataUrl); return; } // vacío

        // Devuelve [start, end] (inclusive) del bloque de la firma sobre un eje,
        // descartando las bandas marginales de poca tinta y aisladas (manchitas).
        const blockExtent = (ink: Float64Array, n: number): [number, number] => {
          // Bandas contiguas de tinta (separadas por celdas vacías).
          const bands: { start: number; end: number; sum: number }[] = [];
          let i = 0;
          while (i < n) {
            if (ink[i] <= 0) { i++; continue; }
            let j = i, sum = 0;
            while (j < n && ink[j] > 0) { sum += ink[j]; j++; }
            bands.push({ start: i, end: j - 1, sum });
            i = j;
          }
          if (bands.length === 0) return [0, n - 1];
          const maxSum = bands.reduce((m, b) => Math.max(m, b.sum), 0);
          // Mantener bandas con tinta significativa; descartar manchitas marginales.
          const keep = bands.filter(b => b.sum >= Math.max(80, maxSum * 0.08));
          const kept = keep.length > 0 ? keep : bands;
          return [kept[0].start, kept[kept.length - 1].end];
        };

        const [top, bottom] = blockExtent(rowInk, h);
        const [left, right] = blockExtent(colInk, w);
        if (bottom < top || right < left) { resolve(dataUrl); return; }

        const x0 = Math.max(0, left - padding);
        const y0 = Math.max(0, top - padding);
        const x1 = Math.min(w - 1, right + padding);
        const y1 = Math.min(h - 1, bottom + padding);
        const tw = x1 - x0 + 1;
        const th = y1 - y0 + 1;

        // Si el recorte no cambia nada (ya estaba ajustado y sin manchitas), no
        // re-encodear.
        if (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1) {
          resolve(dataUrl);
          return;
        }
        const out = document.createElement('canvas');
        out.width = tw;
        out.height = th;
        out.getContext('2d')!.drawImage(src, x0, y0, tw, th, 0, 0, tw, th);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
