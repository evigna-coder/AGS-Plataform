import { useEffect, useRef, useState } from 'react';

/**
 * Filas que acaban de cambiar en una lista EN VIVO (2026-09-29): compara la
 * huella de cada fila con la del render anterior y devuelve las claves que
 * cambiaron, durante `ms` milisegundos, para resaltarlas. La primera carga no
 * cuenta (no es "cambio", es "llegó"), y las filas nuevas sí.
 *
 *   const cambiadas = useFilasCambiadas(ots, ot => ot.otNumber, ot => `${ot.estadoAdmin}|${ot.updatedAt}`);
 *   <tr className={cambiadas.has(ot.otNumber) ? 'motion-safe:animate-fila-cambio' : ''}>
 */
export function useFilasCambiadas<T>(
  items: T[],
  clave: (item: T) => string,
  huella: (item: T) => string,
  ms = 1500,
): Set<string> {
  const previas = useRef<Map<string, string> | null>(null);
  const [cambiadas, setCambiadas] = useState<Set<string>>(() => new Set());
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const actuales = new Map<string, string>();
    for (const it of items) actuales.set(clave(it), huella(it));
    const prev = previas.current;
    previas.current = actuales;
    if (!prev) return; // primera carga
    const nuevas: string[] = [];
    for (const [k, h] of actuales) if (prev.get(k) !== h) nuevas.push(k);
    if (nuevas.length === 0) return;
    setCambiadas(s => { const n = new Set(s); nuevas.forEach(k => n.add(k)); return n; });
    for (const k of nuevas) {
      const t = timers.current.get(k);
      if (t) window.clearTimeout(t);
      timers.current.set(k, window.setTimeout(() => {
        timers.current.delete(k);
        setCambiadas(s => { if (!s.has(k)) return s; const n = new Set(s); n.delete(k); return n; });
      }, ms));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  return cambiadas;
}
