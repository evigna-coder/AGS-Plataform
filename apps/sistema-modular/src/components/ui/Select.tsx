import { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  /** Borde rojo sin mensaje (validación inline). */
  invalid?: boolean;
  /** xs = celdas de tabla y filtros compactos; sm = formularios (default); md = igual que Input md. */
  selectSize?: 'xs' | 'sm' | 'md';
}

/* Chevron propio: el nativo cambia según el sistema operativo. */
const CHEVRON = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M19 9l-7 7-7-7'/></svg>\")";

const SIZE = {
  xs: 'px-1.5 py-0.5 pr-5 text-[11px]',
  sm: 'px-2.5 py-1.5 pr-7 text-xs',
  md: 'px-3 py-2 pr-8 text-sm',
};

/**
 * Select para listas cortas y fijas (moneda, estado, tipo), con la misma piel
 * que Input y SearchableSelect (2026-09-08). Sigue siendo un `<select>`
 * nativo: el desplegable lo dibuja el sistema, pero el control cerrado ya no
 * se ve "de Windows" al lado de los demás campos. Para listas largas o con
 * búsqueda, `SearchableSelect`.
 *
 * `className` es solo para layout (ancho, márgenes, flex); la piel la pone
 * el atom.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, invalid, selectSize = 'sm', className = '', style, children, ...props
}, ref) => {
  const control = (
    <select
      ref={ref}
      className={`border rounded-lg bg-white text-slate-900 appearance-none cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700
        disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
        transition-colors
        ${SIZE[selectSize]}
        ${error || invalid ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-slate-300'}
        ${className}`}
      style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.45rem center', backgroundSize: '12px', ...style }}
      {...props}
    >
      {children}
    </select>
  );
  if (!label && !error) return control;
  return (
    <div className="w-full">
      {label && (
        <label className={`block font-medium text-slate-700 ${selectSize === 'md' ? 'text-sm mb-1.5' : 'text-[11px] mb-1'}`}>
          {label}
        </label>
      )}
      {control}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
