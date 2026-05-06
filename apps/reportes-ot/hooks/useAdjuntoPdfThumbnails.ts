import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { enqueuePdfjs } from '../utils/pdfjsQueue';
import type { AdjuntoMeta } from '../types/instrumentos';

/**
 * Renderiza la primer página de cada PDF adjunto como dataURL pequeño para usar
 * como thumbnail en la grilla. Cachea por adjuntoId en memoria — sólo re-renderiza
 * cuando llega un id nuevo.
 */
export function useAdjuntoPdfThumbnails(
  adjuntos: AdjuntoMeta[],
  firebase: { downloadStorageBlob: (url: string) => Promise<Blob> },
) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  const pdfIds = adjuntos.filter(a => a.mimeType === 'application/pdf').map(a => a.id).join(',');

  useEffect(() => {
    const pdfList = adjuntos.filter(a => a.mimeType === 'application/pdf');
    if (pdfList.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const adj of pdfList) {
        if (cancelled) return;
        if (thumbnails[adj.id] || inFlightRef.current.has(adj.id)) continue;
        inFlightRef.current.add(adj.id);
        try {
          const blob = await firebase.downloadStorageBlob(adj.url);
          if (cancelled) return;
          const arrayBuf = await blob.arrayBuffer();
          const dataUrl = await enqueuePdfjs(async () => {
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 0.6 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport }).promise;
            const url = canvas.toDataURL('image/jpeg', 0.7);
            pdfDoc.destroy();
            return url;
          });
          if (cancelled) return;
          setThumbnails(prev => ({ ...prev, [adj.id]: dataUrl }));
        } catch (err) {
          console.warn(`[useAdjuntoPdfThumbnails] Error renderizando ${adj.fileName}:`, err);
        } finally {
          inFlightRef.current.delete(adj.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfIds]);

  return thumbnails;
}
