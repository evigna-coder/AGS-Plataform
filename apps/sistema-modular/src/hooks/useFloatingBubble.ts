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

  // Al abrir, arrimada al costado derecho. Al cerrar, se resetea.
  useEffect(() => {
    if (open) setPos(prev => prev ?? { x: Math.max(12, window.innerWidth - 460), y: 20 });
    else setPos(null);
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

  return { pos, dragHandlers };
}
