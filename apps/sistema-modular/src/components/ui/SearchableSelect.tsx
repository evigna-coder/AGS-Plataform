import { useState, useRef, useEffect } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  emptyMessage?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  required = false,
  disabled = false,
  error,
  emptyMessage = 'No se encontraron opciones',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Filtrar opciones basado en el término de búsqueda
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Resetear búsqueda cuando se cierra el dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus en el input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll al elemento destacado
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const baseClasses = `w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
    error ? 'border-red-400' : 'border-slate-300'
  } ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'cursor-pointer'} ${className}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Input visible - muestra el valor seleccionado o permite escribir */}
      <div
        className={baseClasses}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent outline-none"
            placeholder={placeholder}
            disabled={disabled}
          />
        ) : (
          <span className={displayValue ? 'text-slate-900' : 'text-slate-400'}>
            {displayValue || placeholder}
          </span>
        )}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {/* Dropdown con opciones filtradas */}
      {isOpen && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400 italic">{emptyMessage}</li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  option.value === value
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : highlightedIndex === index
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}

      {/* Mensaje de error */}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};
