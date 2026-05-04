interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  loading?: boolean;
}

export function SistemasSearchBox({
  value,
  onChange,
  placeholder = 'Buscar por sistema, módulo, serie, código...',
  resultCount,
  totalCount,
  loading,
}: Props) {
  const showCounter =
    value.trim().length > 0 && resultCount !== undefined && totalCount !== undefined;

  return (
    <div className="relative">
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-4.34-4.34M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg pl-8 pr-20 py-1.5 text-xs bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
      />
      {showCounter && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-mono tracking-wide text-slate-400">
          {resultCount}/{totalCount}
        </span>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          title="Limpiar"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {loading && !value && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
          cargando módulos…
        </span>
      )}
    </div>
  );
}
