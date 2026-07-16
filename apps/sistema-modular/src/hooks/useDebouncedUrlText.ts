import { useEffect, useRef, useState } from 'react';

/**
 * Input de texto responsivo sobre un filtro persistido en URL (useUrlFilters).
 *
 * Problema (UAT 2026-07-15): escribir en un buscador que hace setFilter por tecla
 * empuja cada keystroke a la URL → re-render completo de la lista (y en listas con
 * filas que consultan Firestore al montar, una tormenta de queries) → el input
 * "traga" teclas. Este hook mantiene el valor local (el input responde siempre) y
 * sincroniza a la URL con debounce.
 *
 * Uso:
 *   const [texto, setTexto] = useDebouncedUrlText(filters.texto, v => setFilter('texto', v));
 *   <input value={texto} onChange={e => setTexto(e.target.value)} />
 *   // filtrar la lista con filters.texto (el valor URL, ya debounced)
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
