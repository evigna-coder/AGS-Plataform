import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface UseSearchableSelectParams {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  disabled: boolean;
  creatable: boolean;
  createLabel: string;
}

export function useSearchableSelect({
  value,
  onChange,
  options,
  disabled,
  creatable,
  createLabel,
}: UseSearchableSelectParams) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Filter options based on search term
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // In creatable mode, add "Create: X" option if no exact match
  const trimmedSearch = searchTerm.trim();
  const showCreateOption = creatable && trimmedSearch &&
    !filteredOptions.some(opt => opt.label.toLowerCase() === trimmedSearch.toLowerCase());
  const createOption: SearchableSelectOption | null = showCreateOption
    ? { value: `__create__:${trimmedSearch}`, label: `${createLabel}: "${trimmedSearch}"` }
    : null;

  // All options including the create option (for keyboard navigation)
  const allOptions = createOption ? [...filteredOptions, createOption] : filteredOptions;

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Close on click outside (includes portal dropdown)
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

  // Focus input when opening
  useLayoutEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Calculate dropdown position (portal)
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

  // Scroll highlighted element into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback((optionValue: string) => {
    // In creatable mode, extract the real value from __create__: prefix
    if (optionValue.startsWith('__create__:')) {
      onChange(optionValue.slice('__create__:'.length));
    } else {
      onChange(optionValue);
    }
    setIsOpen(false);
    setSearchTerm('');
    // Return focus to container only if user hasn't moved focus to another field
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && active !== containerRef.current &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
      containerRef.current?.focus();
    });
  }, [onChange]);

  // Shared Tab navigation used by both container and input key handlers
  const handleTabNav = useCallback((e: React.KeyboardEvent): boolean => {
    if (!isOpen || allOptions.length === 0) return false;
    e.preventDefault();
    if (e.shiftKey) {
      if (highlightedIndex <= 0) { setIsOpen(false); return true; }
      setHighlightedIndex(prev => prev - 1);
    } else {
      if (highlightedIndex >= allOptions.length - 1) {
        if (highlightedIndex >= 0 && allOptions[highlightedIndex]) handleSelect(allOptions[highlightedIndex].value);
        setIsOpen(false);
        return true;
      }
      setHighlightedIndex(prev => prev + 1);
    }
    return true;
  }, [isOpen, allOptions, highlightedIndex, handleSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && allOptions[highlightedIndex]) {
          handleSelect(allOptions[highlightedIndex].value);
        } else if (isOpen && createOption) {
          handleSelect(createOption.value);
        } else if (!isOpen) { setIsOpen(true); }
        break;
      case 'Escape':
        setIsOpen(false);
        containerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) { setIsOpen(true); }
        else { setHighlightedIndex(prev => prev < allOptions.length - 1 ? prev + 1 : prev); }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) { setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); }
        break;
      case 'Tab':
        handleTabNav(e);
        break;
      case ' ':
        if (!isOpen) { e.preventDefault(); setIsOpen(true); }
        else if (highlightedIndex >= 0 && allOptions[highlightedIndex] && e.target === containerRef.current) {
          e.preventDefault(); handleSelect(allOptions[highlightedIndex].value);
        }
        break;
    }
  }, [disabled, isOpen, highlightedIndex, allOptions, createOption, handleSelect, handleTabNav]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const handled = handleTabNav(e);
      if (handled) { e.stopPropagation(); return; }
      setIsOpen(false);
      return;
    }
    if (e.key === ' ' && highlightedIndex >= 0 && allOptions[highlightedIndex]) {
      e.preventDefault(); e.stopPropagation();
      handleSelect(allOptions[highlightedIndex].value);
      return;
    }
    handleKeyDown(e);
    e.stopPropagation();
  }, [allOptions, highlightedIndex, handleSelect, handleKeyDown, handleTabNav]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    setHighlightedIndex(-1);
  }, []);

  const open = useCallback(() => {
    if (!disabled && !isOpen) setIsOpen(true);
  }, [disabled, isOpen]);

  return {
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
  };
}
