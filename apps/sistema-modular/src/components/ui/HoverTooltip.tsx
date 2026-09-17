import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Contenido del cartel. */
  contenido: ReactNode;
  /** Ancho máximo del cartel en px. */
  maxWidth?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Tooltip en hover que se dibuja FUERA de la tabla (2026-09-16). Los carteles
 * `absolute` de los badges se recortaban contra el contenedor con scroll del
 * listado: en las primeras filas, el cartel se abría hacia arriba y quedaba
 * cortado por la cabecera. Este va a `document.body` con posición fija,
 * calculada al entrar el mouse, y se abre hacia abajo si arriba no entra.
 */
export function HoverTooltip({ contenido, maxWidth = 320, className = '', children }: Props) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; abajo: boolean } | null>(null);

  const abrir = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    // Sin lugar arriba (menos de 120 px) → hacia abajo.
    const abajo = r.top < 120;
    setPos({ top: abajo ? r.bottom + 6 : r.top - 6, left: r.left + r.width / 2, abajo });
  };

  return (
    <span ref={anchorRef} className={`inline-flex ${className}`} onMouseEnter={abrir} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[70] bg-slate-800 text-white text-[10px] rounded px-2 py-1.5 shadow-lg text-left leading-relaxed"
          style={{
            top: pos.top, left: pos.left, maxWidth,
            transform: pos.abajo ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
        >
          {contenido}
        </span>,
        document.body,
      )}
    </span>
  );
}
