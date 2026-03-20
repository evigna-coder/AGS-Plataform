import { useState, useRef, useEffect } from 'react';

interface SmartSelectOption {
  value: string;
  label: string;
}

interface SmartSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SmartSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const SmartSelect: React.FC<SmartSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) { setSearch(''); setHighlighted(-1); }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [isOpen]);

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  const handleSelect = (v: string) => { onChange(v); setIsOpen(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlighted >= 0 && filtered[highlighted])
          handleSelect(filtered[highlighted].value);
        else if (!isOpen) setIsOpen(true);
        break;
      case 'Escape': setIsOpen(false); break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        else setHighlighted(p => p < filtered.length - 1 ? p + 1 : p);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) setHighlighted(p => p > 0 ? p - 1 : -1);
        break;
      case 'Tab': setIsOpen(false); break;
    }
  };

  const baseClass = `w-full border rounded-lg px-3 py-1.5 text-sm ${
    disabled
      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
      : 'bg-white border-slate-300 cursor-pointer'
  }`;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={baseClass}
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
      >
        {loading ? (
          <span className="text-slate-400">Cargando...</span>
        ) : isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setHighlighted(-1); }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent outline-none text-sm"
            placeholder={placeholder}
          />
        ) : (
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {isOpen && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-sm text-slate-400 italic">Sin resultados</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlighted(i)}
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                  opt.value === value
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : highlighted === i
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                role="option"
                aria-selected={opt.value === value}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
