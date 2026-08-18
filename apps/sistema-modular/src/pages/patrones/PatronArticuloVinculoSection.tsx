/**
 * Vínculo del patrón con el artículo por el que ENTRA a la casa (2026-08-18).
 *
 * Sub-componente extraído de PatronEditorPage para respetar el budget de 250 LOC
 * (components.md). El parent es source-of-truth: recibe los dos valores y
 * propaga los cambios.
 *
 * Por qué existe: todos los patrones se compran por orden de compra, pero hasta
 * ahora nada decía que el artículo recibido *era* este patrón. El único puente
 * era que `codigoArticulo` coincidiera por texto con el código de la parte —
 * atadura que se corta sola si alguien corrige el catálogo. Con el vínculo
 * declarado, recibir el artículo da de alta el lote del patrón directamente.
 */

import { useEffect, useState } from 'react';
import type { Articulo } from '@ags/shared';
import { articulosService } from '../../services/stockService';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Input } from '../../components/ui/Input';

interface Props {
  articuloId: string | null;
  unidadesPorUnidadDeCompra: number | null;
  /** true cuando el patrón tiene BOM: el factor no aplica y se explica por qué. */
  tieneBom: boolean;
  onChange: (patch: { articuloId?: string | null; unidadesPorUnidadDeCompra?: number | null }) => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';

export const PatronArticuloVinculoSection: React.FC<Props> = ({
  articuloId, unidadesPorUnidadDeCompra, tieneBom, onChange,
}) => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  useEffect(() => {
    articulosService.getAll({ activoOnly: true }).then(setArticulos).catch(() => setArticulos([]));
  }, []);

  const elegido = articulos.find(a => a.id === articuloId) ?? null;
  const factor = unidadesPorUnidadDeCompra ?? 1;

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-800">Entrada por compra</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Artículo por el que este patrón se compra. Al recibirlo en un ingreso de stock
          se da de alta un lote de este patrón, sin crear existencias del artículo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Artículo del catálogo</label>
          <SearchableSelect
            value={articuloId ?? ''}
            onChange={v => onChange({ articuloId: v || null })}
            options={articulos.map(a => ({
              value: a.id,
              label: `${a.codigo} — ${a.descripcion}`,
            }))}
            placeholder="Sin vincular"
          />
        </div>
        <div>
          <label className={lbl}>Unidades de patrón por unidad comprada</label>
          <Input
            type="number" min={1} step={1}
            value={tieneBom ? '' : String(factor)}
            disabled={tieneBom}
            onChange={e => {
              const n = Number(e.target.value);
              onChange({ unidadesPorUnidadDeCompra: Number.isFinite(n) && n > 0 ? n : null });
            }}
            placeholder={tieneBom ? 'Lo define el BOM' : '1'}
          />
        </div>
      </div>

      {tieneBom ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Este patrón tiene BOM: el kit entra como 1 y el desglose en sustancias lo dan
          sus componentes. Aplicar además un factor multiplicaría dos veces.
        </p>
      ) : elegido ? (
        <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          Recibir 1 × {elegido.codigo} da de alta {factor} unidad{factor === 1 ? '' : 'es'} de este patrón.
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Sin vincular, el lote de este patrón se sigue cargando a mano.
        </p>
      )}
    </div>
  );
};
