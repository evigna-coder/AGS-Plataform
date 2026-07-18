import type { ReactNode } from 'react';

/** Label mono chico uppercase (token del design system Editorial Teal). */
export function MLabel({ children, amber = false }: { children: ReactNode; amber?: boolean }) {
  return (
    <span className={`block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] mb-2 ${amber ? 'text-amber-700' : 'text-teal-700'}`}>
      {children}
    </span>
  );
}

/** Tarjeta "globo" del detalle (mix A+B aprobado): fondo #F8FAFC, borde suave, radio 16. */
export function GCard({ label, amber = false, children, className = '' }: {
  label: string;
  amber?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${amber ? 'bg-amber-100/70 border-amber-700/25' : 'bg-slate-50 border-slate-200'} ${className}`}>
      <MLabel amber={amber}>{label}</MLabel>
      {children}
    </div>
  );
}

/** Fila de ficha técnica: label mono | valor, con hairline entre filas. */
export function FRow({ k, children, mono = false }: { k: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3.5 py-2 border-b border-slate-200 last:border-b-0 items-baseline text-[13.5px]">
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{k}</span>
      <span className={mono ? 'font-mono text-xs text-slate-800' : 'text-slate-800'}>{children}</span>
    </div>
  );
}
