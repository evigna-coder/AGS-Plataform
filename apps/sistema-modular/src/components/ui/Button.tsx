import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  /** React 19: ref-as-prop — llega al <button> nativo vía spread. */
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Feedback de guardado (2026-09-29): `guardando` muestra un spinner y
   * deshabilita; `listo` muestra un tilde por un instante antes de que el
   * modal se cierre. Los formularios lo manejan con `useFeedbackGuardado`.
   */
  estado?: 'idle' | 'guardando' | 'listo';
}

const Spinner = () => (
  <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
const Tilde = () => (
  <svg className="w-3.5 h-3.5 shrink-0 motion-safe:animate-nav-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  estado = 'idle',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-700',
    secondary: 'bg-white text-slate-700 border border-[#E5E5E5] hover:bg-slate-50 focus:ring-teal-700',
    danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-400',
    outline:   'border border-[#E5E5E5] bg-white text-slate-700 hover:bg-slate-50 focus:ring-teal-700',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  };

  const listo = estado === 'listo';
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${listo && variant === 'primary' ? '!bg-emerald-600 hover:!bg-emerald-600' : ''} ${className}`}
      {...props}
      disabled={props.disabled || estado !== 'idle'}
      aria-busy={estado === 'guardando' || undefined}
    >
      {estado === 'guardando' && <Spinner />}
      {listo && <Tilde />}
      {estado === 'guardando' ? 'Guardando…' : listo ? 'Listo' : children}
    </button>
  );
};
