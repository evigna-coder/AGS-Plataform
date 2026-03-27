import { createPortal } from 'react-dom';
import { useSearchableSelect } from './useSearchableSelect';
export type { SearchableSelectOption } from './useSearchableSelect';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
  required: _required = false,
  disabled = false,
  error,
  emptyMessage = 'No se encontraron opciones',
  size = 'md',
  creatable = false,
  createLabel = 'Crear',
}) => {
  const {
    isOpen,
    searchTerm,
    highlightedIndex,
    dropdownPos,
    containerRef,
    inputRef,
    listRef,
    displayValue,
    allOptions,
    handleSelect,
    handleKeyDown,
    handleInputKeyDown,
    handleSearchChange,
    setHighlightedIndex,
    open,
  } = useSearchableSelect({ value, onChange, options, disabled, creatable, createLabel });

  const isSmall = size === 'sm';
  const baseClasses = `w-full border rounded-lg ${isSmall ? 'px-2.5 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'} bg-white text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 transition-colors ${
    error ? 'border-red-400' : 'border-slate-300'
  } ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'cursor-pointer'} ${className}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Visible input - shows selected value or allows typing */}
      <div
        className={baseClasses}
        onClick={open}
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
              if (el && document.activeElement !== el) el.focus();
            }}
            autoFocus
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
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

      {/* Dropdown with filtered options — portal to avoid clip by overflow */}
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

      {/* Error message */}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};
