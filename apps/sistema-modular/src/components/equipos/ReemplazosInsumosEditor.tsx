import { useEffect, useMemo, useState } from 'react';
import type { Articulo, ReemplazoInsumo } from '@ags/shared';
import { articulosService } from '../../services/stockService';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  value: ReemplazoInsumo[];
  onChange: (v: ReemplazoInsumo[]) => void;
}

/**
 * "Este módulo usa X en lugar de Y" (2026-10-01): para los equipos que no usan
 * el insumo habitual (ej. aguja G1313-87202 de 900 bar en vez de la
 * G1313-87201). La planificación cuenta el reemplazo en vez del habitual. El
 * habitual se elige entre los planificables; el reemplazo, de todo el catálogo
 * (al guardar queda marcado como planificable).
 */
export function ReemplazosInsumosEditor({ value, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  useEffect(() => { articulosService.getAll().then(setCatalogo).catch(() => setCatalogo([])); }, []);

  const opciones = useMemo(() => catalogo.map(a => ({ value: a.id, label: `${a.codigo} · ${a.descripcion}` })), [catalogo]);
  const habituales = useMemo(() => catalogo.filter(a => a.planificable)
    .map(a => ({ value: a.id, label: `${a.codigo} · ${a.descripcion}` })), [catalogo]);
  const codigo = (id: string) => catalogo.find(a => a.id === id)?.codigo ?? '';

  const set = (i: number, patch: Partial<ReemplazoInsumo>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
      <div>
        <p className="text-[11px] font-medium text-slate-600">Insumos distintos al habitual</p>
        <p className="text-[10px] text-slate-400">Si este equipo usa otra pieza (otra aguja, sello o rotor), la planificación cuenta esa y no la habitual.</p>
      </div>
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 items-center">
          <SearchableSelect size="sm" value={r.habitualId} options={habituales} placeholder="En lugar de…"
            emptyMessage="No hay insumos planificables"
            onChange={v => set(i, { habitualId: v, habitualCodigo: codigo(v) })} />
          <span className="text-[10px] text-slate-400">usa</span>
          <SearchableSelect size="sm" value={r.reemplazoId} options={opciones} placeholder="Buscar el que usa…"
            onChange={v => set(i, { reemplazoId: v, reemplazoCodigo: codigo(v) })} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="text-slate-400 hover:text-red-600 text-xs px-1" title="Quitar">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { habitualId: '', habitualCodigo: '', reemplazoId: '', reemplazoCodigo: '' }])}
        className="text-[11px] text-teal-700 hover:underline">+ Agregar reemplazo</button>
    </div>
  );
}
