import { useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { Articulo, ParteLoanerPrestada } from '@ags/shared';

interface Props {
  indice: number;
  parte: ParteLoanerPrestada;
  articulos: Articulo[];
  onChange: (p: ParteLoanerPrestada) => void;
  /** Sin `onRemove` la fila no se puede quitar (la primera). */
  onRemove?: () => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

/**
 * Una parte del préstamo (extraída de `LoanerPrestamoParteFields` al permitir
 * varias partes por movimiento, 2026-09-08). El N° de parte se lee del
 * catálogo de stock y, si no está catalogada, se carga a mano.
 */
export function LoanerParteRow({ indice, parte, articulos, onChange, onRemove }: Props) {
  const [manual, setManual] = useState(!parte.articuloId && !!parte.codigoArticulo);
  const set = (patch: Partial<ParteLoanerPrestada>) => onChange({ ...parte, ...patch });

  const opciones = useMemo(
    () => articulos.map(a => ({ value: a.id, label: [a.codigo, a.descripcion].filter(Boolean).join(' — ') || a.id })),
    [articulos],
  );

  const elegirArticulo = (id: string) => {
    const a = articulos.find(x => x.id === id);
    if (!a) { set({ articuloId: null, codigoArticulo: null }); return; }
    set({
      articuloId: a.id,
      codigoArticulo: a.codigo,
      descripcion: parte.descripcion.trim() ? parte.descripcion : a.descripcion,
    });
  };

  return (
    <div className="border-l-2 border-teal-200 pl-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wide text-teal-700">Parte {indice + 1}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[11px] text-red-500 hover:text-red-700 hover:underline">Quitar</button>
        )}
      </div>
      <div>
        <label className={lbl}>N° de parte (catálogo de stock)</label>
        {manual ? (
          <Input
            value={parte.codigoArticulo ?? ''}
            onChange={e => set({ codigoArticulo: e.target.value || null, articuloId: null })}
            placeholder="Ej: G1311-60005"
          />
        ) : (
          <SearchableSelect
            value={parte.articuloId ?? ''}
            onChange={elegirArticulo}
            options={opciones}
            placeholder={articulos.length === 0 ? 'Cargando catálogo...' : 'Buscar por código o descripción...'}
            size="sm"
          />
        )}
        <button
          type="button"
          onClick={() => { setManual(m => !m); set({ articuloId: null, codigoArticulo: null }); }}
          className="mt-1 text-[11px] text-teal-700 hover:underline"
        >
          {manual ? 'Buscar en el catálogo' : 'No está en el catálogo: cargar el N° a mano'}
        </button>
      </div>
      <Input
        label="Parte prestada *"
        value={parte.descripcion}
        onChange={e => set({ descripcion: e.target.value })}
        placeholder="Ej: Motor, Detector FID, Inyector split/splitless"
        description="En el remito sale como «[parte] de [módulo] · S/N [serie del módulo]»."
      />
      <Input
        label="Serie de la parte"
        value={parte.serie ?? ''}
        onChange={e => set({ serie: e.target.value || null })}
        placeholder="Opcional"
      />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={parte.dejaInoperativo !== false}
          onChange={e => set({ dejaInoperativo: e.target.checked })}
          className="rounded border-slate-300 mt-0.5"
        />
        <span>
          El módulo queda inoperativo hasta que se reinstale
          <span className="block text-[11px] text-slate-400">Figura INCOMPLETO en la lista, también mientras esté en base sin instalar.</span>
        </span>
      </label>
    </div>
  );
}
