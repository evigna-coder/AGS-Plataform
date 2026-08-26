import { useEffect, useRef, useState } from 'react';

/**
 * Burbuja flotante NO-modal, arrastrable por su header (2026-08-08).
 *
 * Extraído del patrón de `FactorHistoryButton`: la ventana no es un Modal a
 * propósito — sin overlay se puede seguir editando precios y agregando ítems con
 * el panel a la vista, que es justamente para lo que sirve.
 */
export function useFloatingBubble(open: boolean, onClose: () => void) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  // Tamaño elegido estirando desde la esquina (2026-08-26). null = el tamaño
  // natural del CSS (w-[420px] / max-h). Pedido: los historiales largos se
  // leían por un tubo de 420px.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Al abrir, arrimada al costado derecho. Al cerrar, se resetea (posición y tamaño).
  useEffect(() => {
    if (open) setPos(prev => prev ?? { x: Math.max(12, window.innerWidth - 460), y: 20 });
    else { setPos(null); setSize(null); }
  }, [open]);

  // Escape en fase de CAPTURA y con stopImmediatePropagation: si no, el Escape
  // llega al Modal padre y cierra todo el presupuesto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!pos) return;
      // Sobre un botón (la ×) no se arranca drag: el pointer capture se tragaría
      // el click y no cerraría.
      if ((e.target as HTMLElement).closest('button')) return;
      dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const x = Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 60);
      const y = Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 40);
      setPos({ x, y });
    },
    onPointerUp: (e: React.PointerEvent) => {
      dragRef.current = null;
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    },
  };

  /** Handlers de la esquina de resize (abajo a la derecha). */
  const resizeHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      const bubble = (e.currentTarget as HTMLElement).parentElement;
      if (!bubble) return;
      const r = bubble.getBoundingClientRect();
      resizeRef.current = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      const w = Math.min(Math.max(320, resizeRef.current.w + (e.clientX - resizeRef.current.x)), window.innerWidth - 24);
      const h = Math.min(Math.max(220, resizeRef.current.h + (e.clientY - resizeRef.current.y)), window.innerHeight - 24);
      setSize({ w, h });
    },
    onPointerUp: (e: React.PointerEvent) => {
      resizeRef.current = null;
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    },
  };

  /** Estilo inline de la burbuja: posición + (si se estiró) tamaño explícito.
   *  El width inline le gana al w-[420px] de la clase; el height explícito
   *  convive con el layout flex-col + body overflow. */
  const bubbleStyle: React.CSSProperties | undefined = pos
    ? { top: pos.y, left: pos.x, ...(size ? { width: size.w, height: size.h, maxHeight: 'none' as const } : {}) }
    : undefined;

  return { pos, dragHandlers, resizeHandlers, bubbleStyle };
}

/** Esquina de agarre para estirar la burbuja. Ponerla como ÚLTIMO hijo del
 *  contenedor (position absolute — el contenedor ya es fixed). */
export const BUBBLE_RESIZE_CORNER_CLASS =
  'absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-10 ' +
  'after:content-[""] after:absolute after:right-[3px] after:bottom-[3px] ' +
  'after:w-2.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-slate-400/70 after:rounded-br';
