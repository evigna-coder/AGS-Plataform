import { useState, useEffect, useRef, useMemo } from 'react';

export interface ArticuloMini { id: string; codigo: string; descripcion: string }

interface Props {
  value: string;
  onChange: (val: string) => void;
  /** Called when an article is picked from the dropdown. Receives the full article so the
   *  caller can set codigoProducto + descripcion + stockArticuloId in a single batch. */
  onSelect: (art: ArticuloMini) => void;
  catalog: ArticuloMini[];
  placeholder?: string;
  className?: string;
}

/**
 * Compact autocomplete for picking a stock article by código or descripción
 * inline inside the contrato items table. Dropdown positions to the right so
 * it doesn't get clipped by narrow table cells. Click outside to close.
 */
export const ArticuloInlineAutocomplete: React.FC<Props> = ({
  value, onChange, onSelect, catalog, placeholder, className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => search.length >= 2
    ? catalog.filter(a =>
        a.codigo.toLowerCase().includes(search.toLowerCase()) ||
        a.descripcion.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 12)
    : [], [search, catalog]);

  const selectItem = (art: ArticuloMini) => {
    onSelect(art);
    setSearch(art.codigo);
    setOpen(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = highlightIdx < filtered.length - 1 ? highlightIdx + 1 : 0;
      setHighlightIdx(next);
      (listRef.current?.children[next] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = highlightIdx > 0 ? highlightIdx - 1 : filtered.length - 1;
      setHighlightIdx(next);
      (listRef.current?.children[next] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    } else if ((e.key === 'Enter' || e.key === 'Tab') && highlightIdx >= 0) {
      e.preventDefault();
      selectItem(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIdx(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(e.target.value.length >= 2);
          setHighlightIdx(-1);
        }}
        onFocus={() => { if (search.length >= 2 && filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Código o descripción...'}
        className={className || 'w-full border border-slate-200 rounded px-1 py-0.5 text-[11px] focus:ring-1 focus:ring-teal-400 focus:border-teal-400'}
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-[9999] left-0 top-full mt-1 min-w-[320px] bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto"
        >
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-[11px] border-b border-slate-100 last:border-0 flex gap-3 items-baseline transition-colors
                ${i === highlightIdx ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
              onMouseEnter={() => setHighlightIdx(i)}
              onClick={() => selectItem(a)}
            >
              <span className="font-mono font-bold text-teal-700 whitespace-nowrap shrink-0">{a.codigo}</span>
              <span className="text-slate-500 truncate">{a.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
