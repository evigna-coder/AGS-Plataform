import { useEffect, useMemo, useState } from 'react';
import type { Articulo, KitComponente } from '@ags/shared';
import { articulosService } from '../../services/firebaseService';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  componentes: KitComponente[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<KitComponente>) => void;
  onRemove: (idx: number) => void;
  /** Artículo que se está editando — se excluye del selector (un kit no se contiene a sí mismo). */
  articuloId?: string | null;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const inputCls = 'w-full border border-[#E5E5E5] rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700';
const section = 'text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest';

/**
 * BOM del kit de compra (2026-08-25): artículos REALES del catálogo en los que
 * este kit se explota manualmente ("Explotar kit" desde la vista del artículo).
 * No confundir con Presentaciones (mismo producto en otro envase): acá son
 * artículos distintos, cada uno con su cantidad por kit.
 */
export const KitComponentesSection: React.FC<Props> = ({ componentes, onAdd, onUpdate, onRemove, articuloId }) => {
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  useEffect(() => {
    // Cacheado por serviceCache; el SearchableSelect capea el render a 50.
    articulosService.getAll().then(setCatalogo).catch(() => {});
  }, []);

  const options = useMemo(() =>
    catalogo
      .filter(a => a.activo !== false && a.id !== articuloId)
      .map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` })),
    [catalogo, articuloId]);

  const selectArticulo = (idx: number, id: string) => {
    const art = catalogo.find(a => a.id === id);
    if (!art) return;
    onUpdate(idx, { articuloId: art.id, articuloCodigo: art.codigo, articuloDescripcion: art.descripcion });
  };

  return (
    <div className="space-y-2">
      <p className={section}>Componentes de kit</p>
      <p className="text-[10px] text-slate-400">
        Artículos del catálogo en los que este kit se desarma. El kit ingresa y se compra como
        artículo normal; la explosión es la acción <span className="font-medium">"Explotar kit"</span> desde
        la vista del artículo. Los componentes nacen sin costo (el costo queda en el kit).
      </p>

      {componentes.length > 0 && (
        <div className="space-y-1.5">
          {componentes.map((c, idx) => (
            <div key={idx} className="grid grid-cols-[2.6fr_0.7fr_auto] gap-2 items-end">
              <div>
                {idx === 0 && <label className={lbl}>Artículo componente</label>}
                <SearchableSelect
                  value={c.articuloId}
                  onChange={v => selectArticulo(idx, v)}
                  options={options}
                  placeholder="Buscar artículo…"
                  size="sm"
                />
              </div>
              <div>
                {idx === 0 && <label className={lbl}>× por kit</label>}
                <input type="number" min={1} value={String(c.cantidadPorKit ?? '')}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => onUpdate(idx, { cantidadPorKit: Number(e.target.value) || 0 })}
                  className={`${inputCls} text-right tabular-nums`} />
              </div>
              <button type="button" onClick={() => onRemove(idx)}
                className="text-slate-300 hover:text-red-500 text-base leading-none px-1 pb-1" title="Quitar">×</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={onAdd}
        className="text-[11px] text-teal-700 font-medium hover:underline">
        + Agregar componente
      </button>
    </div>
  );
};
