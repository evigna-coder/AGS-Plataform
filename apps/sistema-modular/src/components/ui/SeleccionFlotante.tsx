import type { ReactNode } from 'react';

interface Props {
  cantidad: number;
  /** "equipo" / "módulo": se pluraliza agregando "s". */
  nombre: string;
  onLimpiar: () => void;
  /** Acciones sobre lo seleccionado (ej. un ExportarButton con solo esas filas). */
  children?: ReactNode;
}

/**
 * Tarjeta flotante de selección (2026-10-01): aparece abajo al centro cuando
 * hay filas tildadas, con cuántas son, acciones sobre esas filas y "Limpiar".
 * Reutilizable en cualquier lista con casillas.
 */
export function SeleccionFlotante({ cantidad, nombre, onLimpiar, children }: Props) {
  if (cantidad === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 motion-safe:animate-barra-in">
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 text-white shadow-2xl pl-4 pr-2 py-2">
        <span className="text-xs">
          <span className="font-semibold tabular-nums">{cantidad}</span> {nombre}{cantidad === 1 ? '' : 's'} seleccionado{cantidad === 1 ? '' : 's'}
        </span>
        <span className="h-5 w-px bg-white/20" />
        <div className="flex items-center gap-2 [&_button]:!bg-white [&_button]:!text-slate-800">{children}</div>
        <button type="button" onClick={onLimpiar} className="px-2 py-1 text-[11px] text-white/70 hover:text-white">Limpiar</button>
      </div>
    </div>
  );
}
