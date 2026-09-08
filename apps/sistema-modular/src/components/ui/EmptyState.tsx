import { ReactNode } from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  /** Qué no hay. Va como título: "No se encontraron clientes". */
  message: ReactNode;
  /** Qué hacer al respecto: "Probá con otros filtros". */
  hint?: ReactNode;
  /** Acción principal, normalmente "Crear primer …". */
  action?: ReactNode;
  /** Sin Card alrededor, para usar dentro de una sección ya enmarcada. */
  inline?: boolean;
}

/**
 * Estado vacío de listas y secciones (rediseñado 2026-09-07). Antes era un
 * párrafo gris suelto que parecía una pantalla rota; ahora tiene ícono,
 * mensaje, pista y acción, igual en todos los módulos.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ message, hint, action, inline = false }) => {
  const body = (
    <div className={`text-center ${inline ? 'py-6' : 'py-10'}`}>
      <div className="mx-auto w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-2.5">
        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
        </svg>
      </div>
      <p className="text-xs font-medium text-slate-600">{message}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      {action && <div className="mt-3 text-xs">{action}</div>}
    </div>
  );
  return inline ? body : <Card>{body}</Card>;
};
