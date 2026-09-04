import { useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService } from '../../services/stockService';
import type { Articulo, ParteLoanerPrestada } from '@ags/shared';

type Alcance = 'modulo' | 'parte';

interface Props {
  alcance: Alcance;
  onAlcanceChange: (a: Alcance) => void;
  parte: ParteLoanerPrestada;
  onParteChange: (p: ParteLoanerPrestada) => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

/**
 * Qué se presta: el módulo entero o una parte suya (2026-09-04). Con "parte"
 * el módulo sigue en base; si la parte lo deja inoperativo, figura INCOMPLETO
 * hasta que vuelva — el mismo aviso que frena prestar un loaner desarmado.
 *
 * El N° de parte se lee del catálogo de stock (el papel lo imprime en la
 * columna Producto) y, si la parte no está catalogada, se carga a mano.
 */
export function LoanerPrestamoParteFields({ alcance, onAlcanceChange, parte, onParteChange }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [manual, setManual] = useState(false);
  const set = (patch: Partial<ParteLoanerPrestada>) => onParteChange({ ...parte, ...patch });

  useEffect(() => {
    if (alcance !== 'parte' || articulos.length > 0) return;
    articulosService.getAll({ activoOnly: true })
      .then(setArticulos)
      .catch(err => console.error('[LoanerPrestamoParteFields] artículos:', err));
  }, [alcance, articulos.length]);

  // Código en la etiqueta, como el resto de los buscadores de artículos.
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
      // La descripción del catálogo sirve de arranque si todavía no se escribió nada.
      descripcion: parte.descripcion.trim() ? parte.descripcion : a.descripcion,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Qué se presta</label>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {([['modulo', 'Módulo completo'], ['parte', 'Una parte']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onAlcanceChange(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                alcance === v ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {alcance === 'parte' && (
        <div className="border-l-2 border-teal-200 pl-3 space-y-2">
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
              El módulo queda inoperativo hasta que vuelva
              <span className="block text-[11px] text-slate-400">Figura INCOMPLETO en la lista, como una pieza extraída.</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
