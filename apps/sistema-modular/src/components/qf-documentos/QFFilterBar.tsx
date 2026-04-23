import type { QFTipo } from '@ags/shared';
import { QF_TIPO_LABELS } from '@ags/shared';

interface Props {
  search: string;
  tipo: string;
  familia: string;
  mostrarObsoletos: boolean;
  familias: number[];
  onChange: {
    search: (v: string) => void;
    tipo: (v: string) => void;
    familia: (v: string) => void;
    mostrarObsoletos: (v: boolean) => void;
  };
}

export function QFFilterBar({ search, tipo, familia, mostrarObsoletos, familias, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onChange.search(e.target.value)}
        placeholder="Buscar por número, nombre o descripción…"
        className="flex-1 min-w-[240px] border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700"
      />
      <select
        value={tipo}
        onChange={(e) => onChange.tipo(e.target.value)}
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
      >
        <option value="">Todos los tipos</option>
        {(Object.keys(QF_TIPO_LABELS) as QFTipo[]).map(t => (
          <option key={t} value={t}>{QF_TIPO_LABELS[t]}</option>
        ))}
      </select>
      <select
        value={familia}
        onChange={(e) => onChange.familia(e.target.value)}
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
      >
        <option value="">Todas las familias</option>
        {familias.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={mostrarObsoletos}
          onChange={(e) => onChange.mostrarObsoletos(e.target.checked)}
          className="rounded text-teal-700 focus:ring-teal-700"
        />
        Mostrar obsoletos
      </label>
    </div>
  );
}
