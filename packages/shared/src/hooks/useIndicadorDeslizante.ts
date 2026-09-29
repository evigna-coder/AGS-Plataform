import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export interface PosicionIndicador {
  top: number;
  left: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Indicador de foco fluido (2026-09-29): mide el elemento activo dentro de un
 * contenedor y devuelve su posición para dibujar UNA barra o píldora que se
 * desliza de una opción a la otra (en vez de aparecer y desaparecer).
 *
 * - `selector`: cómo encontrar el activo (ej. `[aria-current="page"]`,
 *   `[data-nav-active="leaf"]`). Se acepta una lista: se usa el primero que
 *   exista y esté visible.
 * - Se vuelve a medir cuando cambian las `deps`, al terminar cualquier
 *   transición dentro del contenedor (grupos que se despliegan) y al cambiar el
 *   tamaño del contenedor.
 * - El contenedor debe ser `position: relative` y el indicador `absolute`.
 */
export function useIndicadorDeslizante(
  contenedor: RefObject<HTMLElement | null>,
  selectores: string | string[],
  deps: unknown[],
): { pos: PosicionIndicador; remedir: () => void } {
  const [pos, setPos] = useState<PosicionIndicador>({ top: 0, left: 0, width: 0, height: 0, visible: false });

  const remedir = useCallback(() => {
    const cont = contenedor.current;
    if (!cont) return;
    const lista = Array.isArray(selectores) ? selectores : [selectores];
    let el: HTMLElement | null = null;
    for (const sel of lista) {
      const candidatos = Array.from(cont.querySelectorAll<HTMLElement>(sel));
      el = candidatos.find(c => c.getBoundingClientRect().height > 0 && c.offsetParent !== null) ?? null;
      if (el) break;
    }
    if (!el) { setPos(p => (p.visible ? { ...p, visible: false } : p)); return; }
    const r = el.getBoundingClientRect();
    const c = cont.getBoundingClientRect();
    const next = {
      top: r.top - c.top + cont.scrollTop,
      left: r.left - c.left + cont.scrollLeft,
      width: r.width,
      height: r.height,
      visible: true,
    };
    setPos(p => (p.visible === next.visible && Math.abs(p.top - next.top) < 0.5 && Math.abs(p.left - next.left) < 0.5
      && Math.abs(p.width - next.width) < 0.5 && Math.abs(p.height - next.height) < 0.5) ? p : next);
  }, [contenedor, selectores]);

  useLayoutEffect(() => {
    remedir();
    // Los grupos que se despliegan con transición cambian la posición del activo
    // mientras dura la animación: se vuelve a medir al terminar y un instante después.
    const cont = contenedor.current;
    const onEnd = () => remedir();
    cont?.addEventListener('transitionend', onEnd);
    cont?.addEventListener('animationend', onEnd);
    const t = window.setTimeout(remedir, 260);
    const ro = typeof ResizeObserver !== 'undefined' && cont ? new ResizeObserver(() => remedir()) : null;
    if (ro && cont) ro.observe(cont);
    return () => {
      cont?.removeEventListener('transitionend', onEnd);
      cont?.removeEventListener('animationend', onEnd);
      window.clearTimeout(t);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remedir, ...deps]);

  return { pos, remedir };
}
