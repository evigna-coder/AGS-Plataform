import type { FC } from 'react';

/**
 * Flechas laterales para moverse de período (2026-09-03, pedido de
 * coordinación). Discretas a propósito: aparecen al pasar el mouse sobre el
 * contenedor (`group`), en gris, y toman el teal al acercarse. El contenedor
 * tiene que estar posicionado (`relative` o `absolute`) y llevar `group`.
 */
const Flecha: FC<{ lado: 'izq' | 'der'; onClick: () => void }> = ({ lado, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={lado === 'izq' ? 'Período anterior' : 'Período siguiente'}
    className={`absolute top-1/2 -translate-y-1/2 ${lado === 'izq' ? 'left-1' : 'right-1'} z-10
      w-8 h-8 rounded-full flex items-center justify-center
      text-slate-300 hover:text-teal-700 hover:bg-white/90 hover:shadow-sm
      opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all`}
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={lado === 'izq' ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
    </svg>
  </button>
);

export const FlechasLaterales: FC<{ onPrev?: () => void; onNext?: () => void }> = ({ onPrev, onNext }) => (
  <>
    {onPrev && <Flecha lado="izq" onClick={onPrev} />}
    {onNext && <Flecha lado="der" onClick={onNext} />}
  </>
);
