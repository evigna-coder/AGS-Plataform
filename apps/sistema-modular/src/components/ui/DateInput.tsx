import { useEffect, useRef, useState } from 'react';

export interface DateInputProps {
  /** ISO `yyyy-mm-dd` o cadena vacía. */
  value: string;
  /** Recibe ISO `yyyy-mm-dd` cuando la fecha es válida y completa, o `''` cuando se borra. */
  onChange: (iso: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const isoToDisplay = (iso: string): string => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const formatDigits = (digits: string): string => {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const displayToIso = (display: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2999) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/**
 * Input de fecha con tipeo libre `dd/mm/yyyy` (auto-inserta `/`) y botón
 * de calendario que abre el picker nativo. Internamente intercambia ISO
 * `yyyy-mm-dd` con el padre.
 */
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  size = 'sm',
  className = '',
  disabled,
  ariaLabel,
}) => {
  const [text, setText] = useState(() => isoToDisplay(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const formatted = formatDigits(digits);
    setText(formatted);
    if (digits.length === 0) {
      if (value !== '') onChange('');
      return;
    }
    const iso = displayToIso(formatted);
    if (iso && iso !== value) onChange(iso);
  };

  const handleBlur = () => {
    if (!text) return;
    if (displayToIso(text)) return;
    setText(isoToDisplay(value));
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else { el.focus(); el.click(); }
  };

  const padding = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className={`relative inline-flex items-stretch ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`w-28 border border-slate-300 rounded-l-lg ${padding} focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none disabled:bg-slate-50 disabled:text-slate-400`}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        title="Abrir calendario"
        className="border border-l-0 border-slate-300 rounded-r-lg px-2 bg-white hover:bg-slate-50 text-slate-500 disabled:text-slate-300 disabled:bg-slate-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-0 bottom-0 w-1 h-1 opacity-0 pointer-events-none"
      />
    </div>
  );
};
