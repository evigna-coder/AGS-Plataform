import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { TableHeaderField } from '@ags/shared';

interface Props {
  field: TableHeaderField;
  allFields: TableHeaderField[];
  onSave: (field: TableHeaderField) => void;
  onCancel: () => void;
}

/** Form inline para editar un campo de encabezado de tabla (selector o input numérico). */
export const TableEditorHeaderFieldForm = ({ field, allFields, onSave, onCancel }: Props) => {
  const [label, setLabel] = useState(field.label);
  const [optionsText, setOptionsText] = useState(field.options.join(', '));
  const [inputType, setInputType] = useState<'select' | 'number' | 'text'>(field.inputType ?? 'select');
  const [unit, setUnit] = useState(field.unit ?? '');
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '');
  const [multiSelect, setMultiSelect] = useState<boolean>(!!field.multiSelect);
  const [hideInPrint, setHideInPrint] = useState<boolean>(!!field.hideInPrint);
  const [visTriggerField, setVisTriggerField] = useState<string>(field.visibleWhenSelector?.headerFieldId ?? '');
  const [visValues, setVisValues] = useState<string[]>(field.visibleWhenSelector?.values ?? []);

  // Sólo se puede disparar desde otros campos tipo 'select' (dropdowns con options)
  const triggerCandidates = allFields.filter(f =>
    f.fieldId !== field.fieldId &&
    (f.inputType ?? 'select') === 'select' &&
    f.options.length > 0,
  );
  const triggerField = triggerCandidates.find(f => f.fieldId === visTriggerField) ?? null;

  const handleSave = () => {
    if (!label) return;
    const visibility = visTriggerField && visValues.length > 0
      ? { headerFieldId: visTriggerField, values: visValues }
      : null;
    if (inputType === 'select') {
      const options = optionsText.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length < 1) return;
      onSave({ ...field, label, options, inputType: 'select', unit: null, placeholder: null, multiSelect, hideInPrint: hideInPrint || undefined, visibleWhenSelector: visibility });
    } else if (inputType === 'text') {
      onSave({
        ...field,
        label,
        options: [],
        inputType: 'text',
        unit: null,
        placeholder: placeholder.trim() || null,
        multiSelect: false,
        hideInPrint: hideInPrint || undefined,
        visibleWhenSelector: visibility,
      });
    } else {
      onSave({
        ...field,
        label,
        options: [],
        inputType: 'number',
        unit: unit.trim() || null,
        placeholder: placeholder.trim() || null,
        multiSelect: false,
        hideInPrint: hideInPrint || undefined,
        visibleWhenSelector: visibility,
      });
    }
  };

  const disabled = !label || (inputType === 'select' &&
    optionsText.split(',').map(o => o.trim()).filter(Boolean).length < 1);

  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="flex gap-2">
        <Input placeholder="Etiqueta (ej: Inyector, Ruido)" value={label}
          onChange={e => setLabel(e.target.value)} />
        <select value={inputType} onChange={e => setInputType(e.target.value as 'select' | 'number' | 'text')}
          className="border border-slate-300 rounded-lg px-2 text-xs bg-white">
          <option value="select">Dropdown</option>
          <option value="number">Numérico</option>
          <option value="text">Texto libre</option>
        </select>
      </div>
      {inputType === 'select' ? (
        <div className="space-y-2">
          <Input placeholder="Opciones separadas por coma (ej: ALS, SSL, PTV, COC)" value={optionsText}
            onChange={e => setOptionsText(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={multiSelect} onChange={e => setMultiSelect(e.target.checked)} />
            Selección múltiple (el ingeniero puede elegir varias opciones; las filas se agrupan por valor)
          </label>
        </div>
      ) : inputType === 'text' ? (
        <div className="flex gap-2">
          <Input placeholder="Placeholder (ej: Lote, Nº de orden)" value={placeholder}
            onChange={e => setPlaceholder(e.target.value)} />
        </div>
      ) : (
        <div className="flex gap-2">
          <Input placeholder="Unidad (ej: mAU, %)" value={unit}
            onChange={e => setUnit(e.target.value)} />
          <Input placeholder="Placeholder (ej: 0.5)" value={placeholder}
            onChange={e => setPlaceholder(e.target.value)} />
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer" title="El selector solo aparece durante la carga del protocolo. En el PDF y preview de impresión no se muestra.">
        <input type="checkbox" checked={hideInPrint} onChange={e => setHideInPrint(e.target.checked)} />
        Ocultar en PDF / preview (solo visible durante la carga)
      </label>
      {triggerCandidates.length > 0 && (
        <div className="border-t border-slate-200 pt-2 space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-500">Visibilidad condicional (opcional)</label>
          <div className="flex gap-2">
            <select
              value={visTriggerField}
              onChange={e => { setVisTriggerField(e.target.value); setVisValues([]); }}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white flex-1"
            >
              <option value="">Siempre visible</option>
              {triggerCandidates.map(f => (
                <option key={f.fieldId} value={f.fieldId}>Mostrar cuando {f.label} =</option>
              ))}
            </select>
          </div>
          {triggerField && (
            <div className="flex flex-wrap gap-1.5">
              {triggerField.options.map(opt => {
                const checked = visValues.includes(opt);
                return (
                  <label key={opt} className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
                    checked ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-300 text-slate-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setVisValues(checked ? visValues.filter(v => v !== opt) : [...visValues, opt])}
                      className="hidden"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {inputType === 'select'
            ? 'Mínimo 1 opción'
            : inputType === 'text'
            ? 'Texto libre — útil para etiquetas (Lote, Descripción, Operador)'
            : `Uso en specs: referenciar como {${field.fieldId || 'fieldId'}} (ej. "≥ 1600*{${field.fieldId || 'ruido'}}")`}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={disabled}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};
