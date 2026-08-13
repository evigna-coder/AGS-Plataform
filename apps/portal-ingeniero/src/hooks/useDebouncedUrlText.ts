import { useEffect, useRef, useState } from 'react';

/**
 * Input de texto responsivo sobre un filtro persistido en URL (useUrlFilters).
 *
 * Copiado de sistema-modular (2026-08-13): el buscador del Historial empujaba
 * CADA tecla a la URL, y eso dispara una navegación de react-router más el
 * refiltrado y el ORDENAMIENTO completo del historial en cada pulsación. Con
 * varios miles de OTs el input se traba y traga teclas — se siente como si
 * consultara la base por letra, aunque los datos ya estén en memoria.
 *
 * El valor local hace que el input responda siempre; la URL se sincroniza con
 * debounce y es la que dispara el filtrado.
 *
 * Uso:
 *   const [texto, setTexto] = useDebouncedUrlText(filters.texto, v => setFilter('texto', v));
 *   <input value={texto} onChange={e => setTexto(e.target.value)} />
 */
export function useDebouncedUrlText(
  urlValue: string,
  setUrlValue: (v: string) => void,
  delayMs = 300,
): [string, (v: string) => void] {
  const [text, setText] = useState(urlValue);
  const lastPushed = useRef(urlValue);

  // Cambio externo de la URL (reset de filtros, back/forward, deep-link): adoptar.
  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setText(urlValue);
    }
  }, [urlValue]);

  // Cambio local: empujar a la URL con debounce.
  useEffect(() => {
    if (text === lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = text;
      setUrlValue(text);
    }, delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delayMs]);

  return [text, setText];
}
