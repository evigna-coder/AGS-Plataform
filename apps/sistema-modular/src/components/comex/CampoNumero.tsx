import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (n: number) => void;
  sufijo?: string;
  ancho?: string;
}

/** Con coma, la coma es decimal y los puntos son miles ("89.326,7"); sin coma, el punto es decimal ("89326.7"). */
const parse = (s: string): number => {
  const t = s.trim();
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Número editable del presupuestador de comex (2026-10-01): estado de texto
 * propio (acepta coma decimal y borrar sin que salte a 0), selecciona todo al
 * enfocar, sufijo opcional (%, USD).
 */
export function CampoNumero({ label, value, onChange, sufijo, ancho = 'w-full' }: Props) {
  const [texto, setTexto] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => {
    setTexto(prev => (parse(prev) === value ? prev : (value ? String(value).replace('.', ',') : '')));
  }, [value]);
  return (
    <label className={`block ${ancho}`}>
      <span className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5">{label}</span>
      <span className="flex items-center border border-slate-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-teal-500">
        <input inputMode="decimal" value={texto} placeholder="0"
          onFocus={e => e.target.select()}
          onChange={e => { setTexto(e.target.value); onChange(parse(e.target.value)); }}
          className="w-full min-w-0 text-xs px-2 py-1.5 bg-transparent focus:outline-none tabular-nums text-right" />
        {sufijo && <span className="pr-2 text-[10px] text-slate-400">{sufijo}</span>}
      </span>
    </label>
  );
}
