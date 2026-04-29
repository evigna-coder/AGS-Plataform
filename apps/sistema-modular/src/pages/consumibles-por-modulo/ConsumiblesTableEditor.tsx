import type { Articulo, ConsumibleModulo } from '@ags/shared';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

const th = 'px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 text-left';
const td = 'px-2 py-1';
const input = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

interface Props {
  consumibles: ConsumibleModulo[];
  articuloOptions: { value: string; label: string }[];
  articuloByCodigo: Map<string, Articulo>;
  onArticuloChange: (idx: number, codigo: string) => void;
  onUpdate: (idx: number, field: keyof ConsumibleModulo, value: string | number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export const ConsumiblesTableEditor: React.FC<Props> = ({
  consumibles, articuloOptions, articuloByCodigo, onArticuloChange, onUpdate, onAdd, onRemove,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Consumibles <span className="text-slate-400 font-normal">(se adjuntan al PDF anexo)</span>
        </h4>
        <button type="button" onClick={onAdd} className="text-[11px] text-teal-700 hover:text-teal-900 font-medium">
          + Agregar consumible
        </button>
      </div>
      {consumibles.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic px-2">
          Sin consumibles declarados. Agregue al menos uno o deje vacío para indicar
          "este módulo no lleva consumibles" (skip silencioso al generar el anexo).
        </p>
      ) : (
        <table className="w-full border border-slate-200 rounded overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} w-44`}>Artículo (stock)</th>
              <th className={th}>Descripción</th>
              <th className={`${th} w-20`}>Cantidad</th>
              <th className={`${th} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {consumibles.map((c, idx) => {
              const enCatalogo = !!c.codigo && articuloByCodigo.has(c.codigo);
              return (
                <tr key={idx} className="border-t border-slate-100">
                  <td className={td}>
                    <SearchableSelect
                      size="sm"
                      value={c.codigo}
                      onChange={(v) => onArticuloChange(idx, v)}
                      options={articuloOptions}
                      placeholder="Buscar en stock..."
                      creatable
                      createLabel="Usar código manual"
                      emptyMessage="Sin artículos en stock"
                    />
                  </td>
                  <td className={td}>
                    <input
                      className={`${input} ${enCatalogo ? 'bg-slate-50 text-slate-600' : ''}`}
                      value={c.descripcion}
                      onChange={e => onUpdate(idx, 'descripcion', e.target.value)}
                      placeholder="Vial 2ml ámbar con tapa"
                      readOnly={enCatalogo}
                      title={enCatalogo ? 'Auto-completado del catálogo de stock' : ''}
                    />
                  </td>
                  <td className={td}>
                    <input
                      type="number"
                      className={input}
                      value={c.cantidad}
                      min={0}
                      step="1"
                      onChange={e => onUpdate(idx, 'cantidad', parseInt(e.target.value) || 0)}
                    />
                  </td>
                  <td className={td}>
                    <button type="button" onClick={() => onRemove(idx)} className="text-red-500 hover:text-red-700 text-xs">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
