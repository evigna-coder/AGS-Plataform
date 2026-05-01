import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { TableCatalogColumn } from '@ags/shared';

interface Props {
  col: TableCatalogColumn;
  onSave: (col: TableCatalogColumn) => void;
  onCancel: () => void;
}

/** Form inline para editar una columna del table catalog. */
export const TableEditorColumnForm = ({ col, onSave, onCancel }: Props) => {
  const [d, setD] = useState<TableCatalogColumn>(col);
  const [optionsText, setOptionsText] = useState((col.options ?? []).join(', '));
  const handleSave = () => {
    const withOptions = (d.type === 'select_input' || d.type === 'multi_select')
      ? { ...d, options: optionsText.split(',').map(o => o.trim()).filter(Boolean), key: d.key || crypto.randomUUID().slice(0, 8) }
      : { ...d, key: d.key || crypto.randomUUID().slice(0, 8) };
    onSave(withOptions);
  };
  return (
    <div className="border border-slate-900 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Clave (ej: presion)" value={d.key}
          onChange={e => setD({ ...d, key: e.target.value })} />
        <Input placeholder="Etiqueta (opcional — vacío oculta el encabezado)" value={d.label}
          onChange={e => setD({ ...d, label: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={d.type} onChange={e => setD({ ...d, type: e.target.value as TableCatalogColumn['type'] })}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="text_input">Texto libre</option>
          <option value="number_input">Número</option>
          <option value="checkbox">Checkbox</option>
          <option value="fixed_text">Texto fijo</option>
          <option value="date_input">Fecha</option>
          <option value="pass_fail">Pasa/Falla</option>
          <option value="select_input">Selección (una opción)</option>
          <option value="multi_select">Multi-selección (varias opciones)</option>
        </select>
        <Input placeholder="Unidad (ej: mL/min)" value={d.unit ?? ''}
          onChange={e => setD({ ...d, unit: e.target.value || null })} />
        {d.type === 'fixed_text' ? (
          <Input placeholder="Valor fijo (admin)" value={d.fixedValue ?? ''}
            onChange={e => setD({ ...d, fixedValue: e.target.value || null })} />
        ) : d.type === 'select_input' ? (
          <Input placeholder="Opciones separadas por coma (ej: Sí, No, N/A)" value={optionsText}
            onChange={e => setOptionsText(e.target.value)} />
        ) : d.type === 'multi_select' ? (
          <div className="flex gap-2 flex-1">
            <Input placeholder="Opciones fijas (coma) o vacío si usa tabla" value={optionsText}
              onChange={e => setOptionsText(e.target.value)} />
            <Input placeholder="Tabla fuente (nombre exacto)" value={d.optionsFromTable?.tableName ?? ''}
              onChange={e => setD({ ...d, optionsFromTable: e.target.value ? { tableName: e.target.value, columnKey: d.optionsFromTable?.columnKey ?? '' } : null })} />
            <Input placeholder="Columna (key)" value={d.optionsFromTable?.columnKey ?? ''}
              onChange={e => setD({ ...d, optionsFromTable: { tableName: d.optionsFromTable?.tableName ?? '', columnKey: e.target.value } })} />
          </div>
        ) : (
          <Input placeholder="Valor esperado" value={d.expectedValue ?? ''}
            onChange={e => setD({ ...d, expectedValue: e.target.value || null })} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer">
            <input type="checkbox" checked={d.required} onChange={e => setD({ ...d, required: e.target.checked })} />
            Obligatorio
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="Las filas sin valor de template quedan en blanco (sin input). Útil para columnas de etiqueta fija.">
            <input type="checkbox" checked={!!d.isLabelColumn} onChange={e => setD({ ...d, isLabelColumn: e.target.checked || undefined })} />
            Etiqueta fija
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="La columna existe y guarda datos, pero arranca oculta en reportes-ot. El ingeniero puede mostrarla por instancia.">
            <input type="checkbox" checked={!!d.hiddenByDefault} onChange={e => setD({ ...d, hiddenByDefault: e.target.checked || undefined })} />
            Oculta por defecto
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="En el encabezado, agrega un input entre paréntesis para que el ingeniero lo complete durante el protocolo. Máximo 15 caracteres. Ej: 'Valor medido (Benzaldehído)'.">
            <input type="checkbox" checked={!!d.headerEditable} onChange={e => setD({ ...d, headerEditable: e.target.checked || undefined })} />
            Editable en encabezado
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="En tablas de cabecera, si esta columna es 'Modelo' lee del módulo (moduloModelo) en lugar del nombre del sistema. Útil para mantenimiento de accesorios (MSD, HSS, HTA).">
            <input type="checkbox" checked={!!d.autoFillFromModulo} onChange={e => setD({ ...d, autoFillFromModulo: e.target.checked || undefined })} />
            Modelo desde módulo
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer" title="Renderiza la celda como textarea auto-expandible (varios renglones). El wrap también se refleja en el PDF. Útil para columnas de resultado con texto descriptivo.">
            <input type="checkbox" checked={!!d.multiline} onChange={e => setD({ ...d, multiline: e.target.checked || undefined })} />
            Multilínea
          </label>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Ancho (mm)</label>
            <input
              type="number"
              min={0}
              value={d.width ?? ''}
              onChange={e => setD({ ...d, width: e.target.value ? parseInt(e.target.value) || null : null })}
              placeholder="auto"
              className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center"
              title="Ancho de la columna en mm (vacío = automático)"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Alinear</label>
            <select
              value={d.align ?? 'center'}
              onChange={e => setD({ ...d, align: e.target.value === 'center' ? null : e.target.value as 'left' | 'right' })}
              className="border border-slate-300 rounded-lg px-1.5 py-1 text-xs"
            >
              <option value="left">Izq</option>
              <option value="center">Centro</option>
              <option value="right">Der</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}
            disabled={!d.key}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};
