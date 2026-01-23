import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          {label}
        </label>
      )}
      <input
        className={`w-full border rounded-lg px-4 py-2.5 text-sm bg-white border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};
