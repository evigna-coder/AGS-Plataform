// Cola global de renderizado pdfjs.
//
// El worker de pdfjs-dist es compartido y no thread-safe: renderizar varios PDFs
// (desde distintos call sites de la app) en paralelo produce "Invalid page request".
// Cualquier componente o hook que llame a getDocument + getPage DEBE envolver esas
// llamadas con enqueuePdfjs para garantizar serialización global.

let pdfjsRenderQueue: Promise<unknown> = Promise.resolve();

export const enqueuePdfjs = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = pdfjsRenderQueue.then(fn, fn);
  pdfjsRenderQueue = next.catch(() => undefined);
  return next;
};
