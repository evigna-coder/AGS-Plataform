import { useEffect, useMemo, useState } from 'react';
import type { Articulo, GrupoPlanificacion } from '@ags/shared';
import { GRUPOS_PLANIFICACION, GRUPO_PLANIFICACION_LABELS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { articulosService } from '../../services/stockService';
import { articuloMatchesSearch } from '../../utils/articuloSearch';
import { notify } from '../../utils/notify';

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  planificables: Articulo[];
}

const inp = 'border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * Qué artículos entran en la planificación: se buscan en el catálogo, se
 * agregan con su grupo y se quitan. Escribe `planificable` / `grupoPlanificacion`
 * en el artículo (también editable desde el modal del artículo).
 */
export function PlanificablesModal({ open, onClose, onChanged, planificables }: Props) {
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  const [texto, setTexto] = useState('');
  const [grupoNuevo, setGrupoNuevo] = useState<GrupoPlanificacion>('HPLC');
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTexto('');
    articulosService.getAll().then(setCatalogo).catch(err => console.error('[PlanificablesModal]', err));
  }, [open]);

  const idsPlan = useMemo(() => new Set(planificables.map(a => a.id)), [planificables]);
  const candidatos = useMemo(() => {
    const t = texto.trim();
    if (t.length < 2) return [];
    return catalogo.filter(a => !idsPlan.has(a.id) && articuloMatchesSearch(t, a)).slice(0, 25);
  }, [catalogo, texto, idsPlan]);

  const marcar = async (a: Articulo, planificable: boolean, grupo?: GrupoPlanificacion) => {
    setOcupado(a.id);
    try {
      await articulosService.update(a.id, planificable
        ? { planificable: true, grupoPlanificacion: grupo ?? grupoNuevo }
        : { planificable: false, grupoPlanificacion: null });
      onChanged();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo actualizar el artículo');
    } finally {
      setOcupado(null);
    }
  };

  const porGrupo = useMemo(() => {
    const m = new Map<string, Articulo[]>();
    for (const a of planificables) {
      const g = a.grupoPlanificacion ?? 'SIN_GRUPO';
      m.set(g, [...(m.get(g) ?? []), a]);
    }
    return m;
  }, [planificables]);

  return (
    <Modal open={open} onClose={onClose} title="Insumos planificables" subtitle={`${planificables.length} artículos en la planificación`} maxWidth="xl"
      footer={<Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>}>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">Agregar</p>
          <div className="flex gap-2 mb-2">
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Código o descripción (mín. 2 letras)" className={inp} autoFocus />
            <Select value={grupoNuevo} onChange={e => setGrupoNuevo(e.target.value as GrupoPlanificacion)} className="w-32">
              {GRUPOS_PLANIFICACION.map(g => <option key={g} value={g}>{GRUPO_PLANIFICACION_LABELS[g]}</option>)}
            </Select>
          </div>
          <div className="border border-slate-200 rounded-lg max-h-80 overflow-auto divide-y divide-slate-100">
            {candidatos.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 italic">{texto.trim().length < 2 ? 'Escribí para buscar en el catálogo.' : 'Sin resultados fuera de la planificación.'}</p>
            ) : candidatos.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="flex-1 text-xs text-slate-700 truncate"><span className="font-mono">{a.codigo}</span> <span className="text-slate-400">{a.descripcion}</span></span>
                <Button size="sm" variant="ghost" disabled={ocupado === a.id} onClick={() => marcar(a, true)}>+ {GRUPO_PLANIFICACION_LABELS[grupoNuevo]}</Button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">En la planificación</p>
          <div className="border border-slate-200 rounded-lg max-h-[22rem] overflow-auto">
            {planificables.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 italic">Todavía no hay artículos planificables.</p>
            ) : [...porGrupo.entries()].sort().map(([g, arts]) => (
              <div key={g}>
                <div className="px-3 py-1 bg-slate-50 border-y border-slate-100 text-[10px] font-mono uppercase tracking-wide text-slate-400 first:border-t-0">
                  {GRUPO_PLANIFICACION_LABELS[g as GrupoPlanificacion] ?? 'Sin grupo'} · {arts.length}
                </div>
                {arts.map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-1">
                    <span className="flex-1 text-xs text-slate-700 truncate"><span className="font-mono">{a.codigo}</span> <span className="text-slate-400">{a.descripcion}</span></span>
                    <Select value={a.grupoPlanificacion ?? ''} onChange={e => marcar(a, true, e.target.value as GrupoPlanificacion)} className="w-28" disabled={ocupado === a.id}>
                      {!a.grupoPlanificacion && <option value="">Sin grupo</option>}
                      {GRUPOS_PLANIFICACION.map(x => <option key={x} value={x}>{GRUPO_PLANIFICACION_LABELS[x]}</option>)}
                    </Select>
                    <button onClick={() => marcar(a, false)} disabled={ocupado === a.id} className="text-red-400 hover:text-red-600 text-xs px-1" title="Quitar de la planificación">×</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
