interface Props {
  requiereNumeroSerie: boolean;
  requiereNumeroLote: boolean;
  onChange: (patch: { requiereNumeroSerie?: boolean; requiereNumeroLote?: boolean }) => void;
}

/**
 * Toggles de trazabilidad de un artículo. Compartido entre CreateArticuloModal y EditArticuloModal.
 * Definen cómo el modal de carga en lote pide los datos de cada unidad:
 *  - requiereNumeroSerie → una fila (con su serie) por unidad física.
 *  - requiereNumeroLote → filas de lote + cantidad.
 * Son independientes: un artículo puede requerir ambos, uno o ninguno.
 */
export const TrazabilidadFields: React.FC<Props> = ({ requiereNumeroSerie, requiereNumeroLote, onChange }) => {
  const chip = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs ${
      active ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">Trazabilidad</label>
      <div className="flex flex-wrap gap-2">
        <label className={chip(requiereNumeroSerie)}>
          <input type="checkbox" checked={requiereNumeroSerie}
            onChange={e => onChange({ requiereNumeroSerie: e.target.checked })}
            className="w-3 h-3 accent-teal-600" />
          Requiere nº de serie
        </label>
        <label className={chip(requiereNumeroLote)}>
          <input type="checkbox" checked={requiereNumeroLote}
            onChange={e => onChange({ requiereNumeroLote: e.target.checked })}
            className="w-3 h-3 accent-teal-600" />
          Requiere nº de lote
        </label>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        Define cómo se cargan las unidades en stock. Serie: una fila por unidad. Lote: lote + cantidad.
      </p>
    </div>
  );
};
