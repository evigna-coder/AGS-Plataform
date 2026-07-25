import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EquipoResumen } from '@/data/types';
import { ESTADO_BADGE } from '@/data/types';
import type { BadgeTone } from '@/components/ui/Badge';
import { CategoriaIcon } from './CategoriaIcon';

const DOT: Record<BadgeTone, string> = {
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  teal: 'bg-teal-500',
  neutral: 'bg-ink-faint',
};

interface EquipoListProps {
  equipos: EquipoResumen[];
  selectedId?: string;
}

export function EquipoList({ equipos, selectedId }: EquipoListProps) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return equipos;
    return equipos.filter((e) =>
      [e.nombre, e.id, e.categoria, e.marca].some((f) => f.toLowerCase().includes(term)),
    );
  }, [equipos, q]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5 rounded-xl bg-surface-muted px-3.5 py-2.5">
        <Search className="h-[17px] w-[17px] text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar equipo…"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      {filtered.map((e) => {
        const active = e.id === selectedId;
        const tone = ESTADO_BADGE[e.estado].tone;
        return (
          <NavLink
            key={e.id}
            to={`/equipos/${e.id}`}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-2.5 transition-colors',
              active
                ? 'border-teal-100 bg-teal-50'
                : 'border-transparent hover:bg-surface-muted',
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[9px]',
                active ? 'bg-surface' : 'bg-surface-muted',
              )}
            >
              <CategoriaIcon
                name={e.icon}
                className={cn('h-[18px] w-[18px]', active ? 'text-teal-700' : 'text-ink-soft')}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-ink">{e.nombre}</span>
              <span className="truncate font-mono text-[10px] text-ink-faint">
                {e.id} · {e.categoria}
              </span>
            </div>
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[tone])} />
          </NavLink>
        );
      })}

      {filtered.length === 0 && (
        <p className="px-2 py-6 text-center text-sm text-ink-faint">Sin resultados.</p>
      )}
    </div>
  );
}
