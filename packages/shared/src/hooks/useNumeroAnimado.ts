import { useEffect, useRef, useState } from 'react';

/**
 * Número que "cuenta" hasta su valor nuevo cuando cambia (2026-09-30): para
 * KPIs y contadores de encabezado. La primera vez muestra el valor directo (no
 * es un cambio, es que llegó); después interpola en `ms` con desaceleración.
 * Con "reducir movimiento" del sistema operativo salta directo. Devuelve el
 * número a mostrar; el formato lo pone quien lo usa.
 *
 *   const total = useNumeroAnimado(kpi.total);
 *   <span>{total.toLocaleString('es-AR')}</span>
 */
export function useNumeroAnimado(valor: number, ms = 300): number {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current) { primera.current = false; desde.current = valor; setMostrado(valor); return; }
    if (!Number.isFinite(valor) || valor === desde.current) { desde.current = valor; setMostrado(valor); return; }
    const reducir = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducir || typeof requestAnimationFrame === 'undefined') { desde.current = valor; setMostrado(valor); return; }
    const inicio = desde.current;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cúbico
      const actual = inicio + (valor - inicio) * e;
      setMostrado(p >= 1 ? valor : actual);
      if (p < 1) raf = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    raf = requestAnimationFrame(paso);
    return () => { cancelAnimationFrame(raf); desde.current = valor; };
  }, [valor, ms]);

  return mostrado;
}
