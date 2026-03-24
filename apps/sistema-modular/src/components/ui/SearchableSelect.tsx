import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
  /** Compact size for filter bars */
  size?: 'sm' | 'md';
  /** Allow creating new values not in the list */
  creatable?: boolean;
  /** Label prefix for the create option */
  createLabel?: string;
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
  size = 'md',
  creatable = false,
  createLabel = 'Crear',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Filtrar opciones basado en el término de búsqueda
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // En modo creatable, agregar opción "Crear: X" si no hay match exacto
  const trimmedSearch = searchTerm.trim();
  const showCreateOption = creatable && trimmedSearch &&
    !filteredOptions.some(opt => opt.label.toLowerCase() === trimmedSearch.toLowerCase());
  const createOption: SearchableSelectOption | null = showCreateOption
    ? { value: `__create__:${trimmedSearch}`, label: `${createLabel}: "${trimmedSearch}"` }
    : null;

  // All options including the create option (for keyboard navigation)
  const allOptions = createOption ? [...filteredOptions, createOption] : filteredOptions;

  // Resetear búsqueda cuando se cierra el dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Cerrar al hacer click fuera (incluye portal dropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) &&
          listRef.current && !listRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus en el input cuando se abre (useLayoutEffect para evitar ventana sin foco)
  useLayoutEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Calcular posición del dropdown (portal)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const updateDropdownPos = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true);
      window.removeEventListener('resize', updateDropdownPos);
    };
  }, [isOpen, updateDropdownPos]);

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
    // En modo creatable, extraer el valor real del prefijo __create__:
    if (optionValue.startsWith('__create__:')) {
      onChange(optionValue.slice('__create__:'.length));
    } else {
      onChange(optionValue);
    }
    setIsOpen(false);
    setSearchTerm('');
    // Devolver foco al container para que Tab siga funcionando
    requestAnimationFrame(() => containerRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && allOptions[highlightedIndex]) {
          handleSelect(allOptions[highlightedIndex].value);
        } else if (isOpen && createOption) {
          // Enter sin selección pero con texto creatable → crear
          handleSelect(createOption.value);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        requestAnimationFrame(() => containerRef.current?.focus());
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < allOptions.length - 1 ? prev + 1 : prev
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
        // Tab navega entre opciones del dropdown abierto
        if (isOpen && allOptions.length > 0) {
          e.preventDefault();
          if (e.shiftKey) {
            if (highlightedIndex <= 0) {
              setIsOpen(false);
              return;
            }
            setHighlightedIndex(prev => prev - 1);
          } else {
            if (highlightedIndex >= allOptions.length - 1) {
              if (highlightedIndex >= 0 && allOptions[highlightedIndex]) {
                handleSelect(allOptions[highlightedIndex].value);
              }
              setIsOpen(false);
              return;
            }
            setHighlightedIndex(prev => prev + 1);
          }
        }
        // Si dropdown cerrado: NO preventDefault → foco pasa al siguiente campo
        break;
      case ' ':
        // Space abre el dropdown si está cerrado, o selecciona si está abierto
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && allOptions[highlightedIndex] &&
            e.target === containerRef.current) {
          e.preventDefault();
          handleSelect(allOptions[highlightedIndex].value);
        }
        break;
    }
  };

  const isSmall = size === 'sm';
  const baseClasses = `w-full border rounded-lg ${isSmall ? 'px-2.5 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'} bg-white text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 transition-colors ${
    error ? 'border-red-400' : 'border-slate-300'
  } ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'cursor-pointer'} ${className}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Input visible - muestra el valor seleccionado o permite escribir */}
      <div
        className={baseClasses}
        onClick={() => !disabled && !isOpen && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
      >
        {isOpen ? (
          <input
            ref={(el) => {
              inputRef.current = el;
              // Auto-focus cuando se monta (respaldo de useLayoutEffect)
              if (el && document.activeElement !== el) el.focus();
            }}
            autoFocus
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(-1);
            }}
            onKeyDown={(e) => {
              // Tab: navegar entre opciones si hay dropdown abierto
              if (e.key === 'Tab') {
                if (allOptions.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.shiftKey) {
                    // Shift+Tab: ir para atrás o cerrar si estamos al inicio
                    if (highlightedIndex <= 0) {
                      setIsOpen(false);
                      return;
                    }
                    setHighlightedIndex(prev => prev - 1);
                  } else {
                    // Tab: avanzar al siguiente, o seleccionar si estamos en el último
                    if (highlightedIndex >= allOptions.length - 1) {
                      // En el último item → seleccionar y cerrar
                      if (highlightedIndex >= 0 && allOptions[highlightedIndex]) {
                        handleSelect(allOptions[highlightedIndex].value);
                      }
                      setIsOpen(false);
                      return;
                    }
                    setHighlightedIndex(prev => prev + 1);
                  }
                } else {
                  setIsOpen(false);
                  return;
                }
                return;
              }
              // Space: seleccionar el item highlighted (sin escribir espacio en el input)
              if (e.key === ' ' && highlightedIndex >= 0 && allOptions[highlightedIndex]) {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(allOptions[highlightedIndex].value);
                return;
              }
              handleKeyDown(e);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent outline-none"
            placeholder={placeholder}
            disabled={disabled}
          />
        ) : (
          <span className={displayValue ? 'text-slate-900' : 'text-slate-400'}>
            {displayValue || placeholder}
          </span>
        )}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {/* Dropdown con opciones filtradas — portal para evitar clip por overflow */}
      {isOpen && !disabled && createPortal(
        <ul
          ref={listRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          className="z-[100] bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-auto"
          role="listbox"
        >
          {allOptions.length === 0 ? (
            <li className="px-2.5 py-1.5 text-xs text-slate-400 italic">{emptyMessage}</li>
          ) : (
            allOptions.map((option, index) => {
              const isCreate = option.value.startsWith('__create__:');
              return (
                <li
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                    isCreate
                      ? highlightedIndex === index
                        ? 'bg-teal-100 text-teal-800 font-medium'
                        : 'text-teal-700 font-medium border-t border-slate-100'
                      : option.value === value
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : highlightedIndex === index
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  role="option"
                  aria-selected={option.value === value}
                >
                  {isCreate && <span className="mr-1">+</span>}
                  {option.label}
                </li>
              );
            })
          )}
        </ul>,
        document.body
      )}

      {/* Mensaje de error */}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};
