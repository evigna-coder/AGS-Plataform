import type { FC } from 'react';

/**
 * Aviso breve tras un Ctrl+Z (2026-09-04): dice qué se deshizo y desaparece
 * solo. Sin él, deshacer un cambio de estado o un flag no se nota en la grilla
 * y la coordinadora no sabe si el atajo hizo algo.
 */
export const AgendaUndoAviso: FC<{ texto: string | null }> = ({ texto }) => {
  if (!texto) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] px-3 py-1.5 rounded-md bg-slate-900/90 text-white text-xs shadow-lg pointer-events-none"
    >
      {texto}
    </div>
  );
};
