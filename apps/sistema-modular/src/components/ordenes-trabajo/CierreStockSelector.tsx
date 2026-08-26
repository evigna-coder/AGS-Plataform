import type { Part, StockSelection } from '@ags/shared';
import { useCierreStockUnits } from '../../hooks/useCierreStockUnits';
import { CierreStockSelectorRow } from './CierreStockSelectorRow';

interface Props {
  articulos: Part[];
  selections: StockSelection[];
  onChange: (selections: StockSelection[]) => void;
  disabled?: boolean;
}

export const CierreStockSelector: React.FC<Props> = ({ articulos, selections, onChange, disabled }) => {
  const { get, loading } = useCierreStockUnits(articulos);

  /**
   * Reemplaza las selecciones de UNA parte conservando el orden del resto. Una
   * parte puede tener varias (una por origen), así que la clave del reemplazo es
   * el conjunto completo de esa parte, no una entrada suelta.
   */
  const replaceForPart = (partId: string, next: StockSelection[]) => {
    const otras = selections.filter(s => s.partId !== partId);
    onChange([...otras, ...next]);
  };

  if (articulos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        Origen de materiales{loading && <span className="ml-2 normal-case font-normal text-slate-400">cargando stock…</span>}
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/60">
            <tr>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left">Material</th>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center w-12">Cant.</th>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left w-56">Origen / Unidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {articulos.map(part => (
              <tr key={part.id} className="bg-white/40 align-top">
                <td className="px-2 py-1.5">
                  <p className="text-xs text-slate-700">{part.descripcion}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{part.codigo || '—'}</p>
                </td>
                <td className="px-2 py-1.5 text-center text-xs text-slate-600">{part.cantidad}</td>
                <td className="px-2 py-1.5">
                  <CierreStockSelectorRow
                    part={part}
                    stock={get(part.id)}
                    selections={selections.filter(s => s.partId === part.id)}
                    onChange={next => replaceForPart(part.id, next)}
                    disabled={disabled}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
