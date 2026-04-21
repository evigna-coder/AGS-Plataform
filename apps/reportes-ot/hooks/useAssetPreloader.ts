import { useState, useEffect, useRef, useCallback } from 'react';
import { FirebaseService } from '../services/firebaseService';
import type { InstrumentoPatronOption, AdjuntoMeta, CertificadoIngeniero } from '../types/instrumentos';

interface PreloaderState {
  cache: Map<string, ArrayBuffer>;
  isReady: boolean;
  progress: { loaded: number; total: number };
}

/**
 * Pre-descarga certificados y adjuntos PDF al cargar la OT,
 * para que estén disponibles en cache cuando se genera el PDF.
 */
export const useAssetPreloader = (
  firebase: FirebaseService,
  instrumentosSeleccionados: InstrumentoPatronOption[],
  certificadosIngenieroSeleccionados: CertificadoIngeniero[],
  adjuntos: AdjuntoMeta[],
  clienteRequiereTrazabilidad: boolean = false,
): PreloaderState => {
  const [cache] = useState(() => new Map<string, ArrayBuffer>());
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const preload = useCallback(async () => {
    // Recopilar todas las URLs de PDFs que se van a necesitar
    const urls = new Set<string>();

    // Certificados de ingenieros
    certificadosIngenieroSeleccionados.forEach(c => {
      if (c.certificadoUrl) urls.add(c.certificadoUrl);
    });

    // Certificados de instrumentos y patrones
    instrumentosSeleccionados.forEach(i => {
      if (i.certificadoUrl) urls.add(i.certificadoUrl);
      if (clienteRequiereTrazabilidad && i.tipo === 'instrumento' && i.trazabilidadUrl) {
        urls.add(i.trazabilidadUrl);
      }
    });

    // Adjuntos PDF
    adjuntos.forEach(a => {
      if (a.mimeType === 'application/pdf') urls.add(a.url);
    });

    // Filtrar las que ya están en cache
    const toDownload = Array.from(urls).filter(url => !cache.has(url));

    if (toDownload.length === 0) {
      setProgress({ loaded: urls.size, total: urls.size });
      setIsReady(true);
      return;
    }

    setIsReady(false);
    const alreadyCached = urls.size - toDownload.length;
    setProgress({ loaded: alreadyCached, total: urls.size });

    const controller = new AbortController();
    abortRef.current = controller;

    let loaded = alreadyCached;

    await Promise.all(
      toDownload.map(async (url) => {
        if (controller.signal.aborted) return;
        try {
          const blob = await firebase.downloadStorageBlob(url);
          if (controller.signal.aborted) return;
          const buffer = await blob.arrayBuffer();
          cache.set(url, buffer.slice(0));
        } catch (err) {
          // No bloquear por errores — se reintentará al generar el PDF
          console.warn('[PRELOADER] Error pre-descargando asset:', err);
        } finally {
          loaded++;
          setProgress({ loaded, total: urls.size });
        }
      })
    );

    if (!controller.signal.aborted) {
      setIsReady(true);
    }
  }, [firebase, instrumentosSeleccionados, certificadosIngenieroSeleccionados, adjuntos, cache, clienteRequiereTrazabilidad]);

  useEffect(() => {
    // Cancelar precarga anterior
    abortRef.current?.abort();
    preload();
    return () => { abortRef.current?.abort(); };
  }, [preload]);

  return { cache, isReady, progress };
};
