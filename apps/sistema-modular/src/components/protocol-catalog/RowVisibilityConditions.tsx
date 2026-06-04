import type { TableHeaderField } from '@ags/shared';

/** Una condición de visibilidad: la fila se muestra según el valor de un campo de encabezado. */
export interface VisibilityCondition {
  headerFieldId: string;
  values: string[];
  operator: 'in' | 'not_in';
}

interface Props {
  /** Campos de encabezado disponibles para condicionar la fila. */
  headerFields: TableHeaderField[];
  /** Lista de condiciones. Combinadas con AND: la fila se muestra si se cumplen TODAS. */
  conditions: VisibilityCondition[];
  onChange: (conditions: VisibilityCondition[]) => void;
}

/**
 * Editor de visibilidad condicional de una fila. Soporta múltiples condiciones
 * combinadas con AND (ej. "Modelo = 8453" Y "Concentración = 60"). La primera
 * condición se persiste en `visibleWhenSelector`; las demás en `visibleWhenAll`.
 */
export const RowVisibilityConditions = ({ headerFields, conditions, onChange }: Props) => {
  // Siempre mostramos al menos una ranura de condición. Los handlers operan sobre `slots`
  // (no sobre `conditions`) para que la ranura sintética inicial sea editable cuando la fila
  // todavía no tiene ninguna condición guardada.
  const slots: VisibilityCondition[] = conditions.length > 0
    ? conditions
    : [{ headerFieldId: '', values: [], operator: 'in' }];

  const update = (idx: number, patch: Partial<VisibilityCondition>) => {
    onChange(slots.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const remove = (idx: number) => onChange(slots.filter((_, i) => i !== idx));
  const add = () => onChange([...slots, { headerFieldId: '', values: [], operator: 'in' }]);

  const toggleValue = (idx: number, val: string) => {
    const cur = slots[idx];
    const values = cur.values.includes(val) ? cur.values.filter(v => v !== val) : [...cur.values, val];
    update(idx, { values });
  };

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
      <p className="text-[10px] font-bold text-teal-700 uppercase">Visible solo si...</p>
      {headerFields.length === 0 ? (
        <p className="text-[10px] text-teal-600 italic">
          Primero agregá un <strong>campo de encabezado</strong> a la tabla (pestaña "Encabezado") para habilitar visibilidad condicional.
        </p>
      ) : (
        <>
          {slots.length > 1 && (
            <p className="text-[10px] text-teal-600">Se deben cumplir <strong>todas</strong> las condiciones (Y).</p>
          )}
          <div className="space-y-2">
            {slots.map((cond, idx) => {
              const fieldOptions = headerFields.find(h => h.fieldId === cond.headerFieldId)?.options ?? [];
              return (
                <div key={idx} className={idx > 0 ? 'pt-2 border-t border-dashed border-teal-300 space-y-2' : 'space-y-2'}>
                  {idx > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-teal-700 uppercase tracking-wider bg-teal-200/60 rounded px-1.5 py-0.5">Y</span>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Campo de encabezado</label>
                    <select
                      value={cond.headerFieldId}
                      onChange={e => update(idx, { headerFieldId: e.target.value, values: [] })}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="">Sin condición (siempre visible)</option>
                      {headerFields.map(hf => (
                        <option key={hf.fieldId} value={hf.fieldId}>{hf.label}</option>
                      ))}
                    </select>
                  </div>
                  {cond.headerFieldId && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operador</label>
                        <div className="flex gap-2">
                          <label className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${cond.operator === 'in' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'}`}>
                            <input type="radio" name={`visOperator-${idx}`} checked={cond.operator === 'in'} onChange={() => update(idx, { operator: 'in' })} className="sr-only" />
                            Es uno de
                          </label>
                          <label className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${cond.operator === 'not_in' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'}`}>
                            <input type="radio" name={`visOperator-${idx}`} checked={cond.operator === 'not_in'} onChange={() => update(idx, { operator: 'not_in' })} className="sr-only" />
                            Es distinto de
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {cond.operator === 'in' ? 'Visible cuando el valor es...' : 'Ocultar cuando el valor es...'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {fieldOptions.map(opt => (
                            <label key={opt} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-colors ${cond.values.includes(opt) ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400'}`}>
                              <input type="checkbox" checked={cond.values.includes(opt)} onChange={() => toggleValue(idx, opt)} className="sr-only" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {slots[0]?.headerFieldId && (
            <button
              type="button"
              onClick={add}
              className="text-[10px] font-bold text-teal-700 hover:text-teal-900 uppercase tracking-wide"
            >
              + Agregar condición
            </button>
          )}
        </>
      )}
    </div>
  );
};
