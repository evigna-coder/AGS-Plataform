import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  description,
  error,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      {description && (
        <p className="text-xs text-slate-500 mb-1.5">{description}</p>
      )}
      <input
        ref={ref}
        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-900
          placeholder:text-slate-400
          border-slate-300
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}
          ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
