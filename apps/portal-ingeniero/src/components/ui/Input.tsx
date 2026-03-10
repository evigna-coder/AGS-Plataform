import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  description?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, description, className = '', ...props
}, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
    {description && <p className="text-xs text-slate-500 mb-1.5">{description}</p>}
    <input
      ref={ref}
      className={`w-full border rounded-xl bg-white text-slate-900 px-3 py-3 text-sm
        placeholder:text-slate-400 border-slate-300
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
        disabled:bg-slate-50 disabled:text-slate-400 transition-colors
        ${error ? 'border-red-400 focus:ring-red-400' : ''}
        ${className}`}
      {...props}
    />
    {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
  </div>
));

Input.displayName = 'Input';
