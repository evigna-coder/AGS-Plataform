import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { enqueuePdfjs } from '../utils/pdfjsQueue';
import type { AdjuntoMeta } from '../types/instrumentos';

interface Props {
  adjuntos: AdjuntoMeta[];
  firebase: { downloadStorageBlob: (url: string) => Promise<Blob> };
}

interface RenderedPage {
  adjuntoId: string;
  fileName: string;
  pageNum: number;
  totalPages: number;
  dataUrl: string;
}

/**
 * Renderiza las páginas de los PDFs adjuntos como imágenes A4 para el preview.
 * Usa pdfjs-dist para renderizar cada página a canvas.
 */
export const PdfAdjuntoPreview: React.FC<Props> = ({ adjuntos, firebase }) => {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef<string>('');

  const pdfAdjuntos = adjuntos.filter(a => a.mimeType === 'application/pdf');

  useEffect(() => {
    if (pdfAdjuntos.length === 0) { setPages([]); return; }

    const key = pdfAdjuntos.map(a => a.id).join(',');
    if (key === loadedRef.current) return;
    loadedRef.current = key;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const allPages: RenderedPage[] = [];

      for (const adj of pdfAdjuntos) {
        try {
          const blob = await firebase.downloadStorageBlob(adj.url);
          const arrayBuf = await blob.arrayBuffer();
          const rendered = await enqueuePdfjs(async () => {
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
            const out: RenderedPage[] = [];
            for (let i = 1; i <= pdfDoc.numPages; i++) {
              const page = await pdfDoc.getPage(i);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d')!;
              await page.render({ canvasContext: ctx, viewport }).promise;
              out.push({
                adjuntoId: adj.id,
                fileName: adj.fileName,
                pageNum: i,
                totalPages: pdfDoc.numPages,
                dataUrl: canvas.toDataURL('image/jpeg', 0.85),
              });
            }
            pdfDoc.destroy();
            return out;
          });
          allPages.push(...rendered);
        } catch (err) {
          console.warn(`[PdfAdjuntoPreview] Error renderizando ${adj.fileName}:`, err);
        }
      }

      if (!cancelled) {
        setPages(allPages);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfAdjuntos.map(a => a.id).join(',')]);

  if (pdfAdjuntos.length === 0) return null;

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-sm overflow-visible shrink-0 flex items-center justify-center"
        style={{ width: '210mm', height: '297mm', margin: '0 auto' }}>
        <p className="text-sm text-slate-400">Cargando adjuntos PDF...</p>
      </div>
    );
  }

  return (
    <>
      {pages.map((p, idx) => (
        <div
          key={`${p.adjuntoId}-${p.pageNum}`}
          className="bg-white shadow-md rounded-sm overflow-hidden shrink-0"
          style={{ width: '210mm', height: '297mm', margin: '0 auto', boxSizing: 'border-box', position: 'relative' }}
        >
          <img
            src={p.dataUrl}
            alt={`${p.fileName} - Página ${p.pageNum}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }}
          />
          <div style={{
            position: 'absolute', bottom: '4mm', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.85)', padding: '2px 10px', borderRadius: '4px',
            fontSize: '9px', color: '#64748b',
          }}>
            {p.fileName} — Página {p.pageNum} de {p.totalPages}
          </div>
        </div>
      ))}
    </>
  );
};
