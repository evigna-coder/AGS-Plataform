import { useEffect, useRef, useState } from 'react';

/**
 * Mantiene montado un overlay unos milisegundos después de `open = false` para
 * que pueda animar la salida (2026-09-30). Devuelve `montado` (renderizar o no)
 * y `saliendo` (aplicar la animación de salida). Con "reducir movimiento" del
 * sistema operativo se desmonta al instante.
 *
 *   const { montado, saliendo } = useSalidaAnimada(open, 180);
 *   if (!montado) return null;
 *   <aside className={saliendo ? 'motion-safe:animate-drawer-out' : 'motion-safe:animate-drawer-in'}>
 */
export function useSalidaAnimada(open: boolean, ms = 180): { montado: boolean; saliendo: boolean } {
  const [montado, setMontado] = useState(open);
  const [saliendo, setSaliendo] = useState(false);
  const montadoRef = useRef(open);

  useEffect(() => {
    if (open) {
      montadoRef.current = true;
      setMontado(true);
      setSaliendo(false);
      return;
    }
    if (!montadoRef.current) return;
    const reducir = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducir) {
      montadoRef.current = false;
      setMontado(false);
      return;
    }
    setSaliendo(true);
    const t = window.setTimeout(() => {
      montadoRef.current = false;
      setSaliendo(false);
      setMontado(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);

  return { montado, saliendo };
}
