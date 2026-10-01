import { useEffect, useRef, useState } from 'react';

/**
 * Filas que acaban de cambiar en una lista EN VIVO (2026-09-29): compara la
 * huella de cada fila con la del render anterior y devuelve las claves que
 * cambiaron, durante `ms` milisegundos, para resaltarlas. La primera carga no
 * cuenta (no es "cambio", es "llegó"), y las filas nuevas sí.
 *
 *   const cambiadas = useFilasCambiadas(ots, ot => ot.otNumber, ot => `${ot.estadoAdmin}|${ot.updatedAt}`);
 *   <tr className={cambiadas.has(ot.otNumber) ? 'motion-safe:animate-fila-cambio' : ''}>
 *
 * Costo (2026-09-30): la versión original armaba un temporizador POR FILA y
 * cada uno hacía su propio setState al vencer. Con una lista que pasa de vacía
 * a 3.742 filas (Unidades de stock al cargar), eran 3.742 redibujados de la
 * tabla completa en cadena: la pantalla quedaba clavada 40-60 s justo cuando el
 * usuario empezaba a buscar. Ahora: (1) vacío → con datos cuenta como primera
 * carga; (2) si cambian más de `MAX_FILAS_DESTACADAS` a la vez no es "una fila
 * cambió", es que cambió la lista (otro filtro, otra búsqueda) y no se destaca
 * nada; (3) las filas de una misma tanda se apagan con UN solo temporizador.
 */
export const MAX_FILAS_DESTACADAS = 50;

export function useFilasCambiadas<T>(
  items: T[],
  clave: (item: T) => string,
  huella: (item: T) => string,
  ms = 1500,
): Set<string> {
  const previas = useRef<Map<string, string> | null>(null);
  const [cambiadas, setCambiadas] = useState<Set<string>>(() => new Set());
  const timers = useRef<Set<number>>(new Set());
  /** Tanda en la que se destacó cada fila: si volvió a cambiar, la tanda vieja no la apaga. */
  const tandaDe = useRef<Map<string, number>>(new Map());
  const ultimaTanda = useRef(0);

  useEffect(() => {
    const actuales = new Map<string, string>();
    for (const it of items) actuales.set(clave(it), huella(it));
    const prev = previas.current;
    previas.current = actuales;
    if (!prev || prev.size === 0) return; // primera carga (o la lista estaba vacía)
    const nuevas: string[] = [];
    for (const [k, h] of actuales) {
      if (prev.get(k) !== h) {
        nuevas.push(k);
        if (nuevas.length > MAX_FILAS_DESTACADAS) return; // cambió la lista, no una fila
      }
    }
    if (nuevas.length === 0) return;
    const tanda = ++ultimaTanda.current;
    for (const k of nuevas) tandaDe.current.set(k, tanda);
    setCambiadas(s => { const n = new Set(s); nuevas.forEach(k => n.add(k)); return n; });
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      const apagar = nuevas.filter(k => tandaDe.current.get(k) === tanda);
      for (const k of apagar) tandaDe.current.delete(k);
      setCambiadas(s => {
        let n: Set<string> | null = null;
        for (const k of apagar) if (s.has(k)) { n ??= new Set(s); n.delete(k); }
        return n ?? s;
      });
    }, ms);
    timers.current.add(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  return cambiadas;
}
