import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { TableCatalogColumn, TableCatalogRow } from '@ags/shared';

interface Props {
  row: TableCatalogRow;
  columns: TableCatalogColumn[];
  onSave: (row: TableCatalogRow) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export const RowFormPanel = ({ row, columns, onSave, onDelete, onCancel }: Props) => {
  const [cells, setCells] = useState<Record<string, string | number | boolean | null>>(row.cells);
  const [isTitle, setIsTitle] = useState(row.isTitle ?? false);
  const [titleText, setTitleText] = useState(row.titleText ?? '');

  const handleChange = (key: string, value: string | boolean | null) => {
    setCells(prev => ({ ...prev, [key]: value === '' ? null : value }));
  };

  return (
    <div className="border border-slate-900 rounded-lg p-4 bg-slate-50 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-black text-slate-900 uppercase">
          {isTitle ? 'Título de sección' : 'Editar fila'}
        </h4>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer">
          <input type="checkbox" checked={isTitle} onChange={e => setIsTitle(e.target.checked)} />
          Es título de sección
        </label>
      </div>

      {isTitle ? (
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Texto del título</label>
          <Input
            value={titleText}
            onChange={e => setTitleText(e.target.value)}
            placeholder="Ej: Sección 1 — Preparación del sistema"
          />
        </div>
      ) : columns.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Primero definí las columnas en la pestaña "Columnas".
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {columns.map(col => (
            <div key={col.key}>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                {col.label}
                {col.required ? ' *' : ''}
                {col.unit ? ` (${col.unit})` : ''}
              </label>
              {col.type === 'pass_fail' ? (
                <select
                  value={String(cells[col.key] ?? '')}
                  onChange={e => handleChange(col.key, e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="PASA">PASA</option>
                  <option value="FALLA">FALLA</option>
                  <option value="N/A">N/A</option>
                </select>
              ) : col.type === 'checkbox' ? (
                <div className="flex items-center h-9">
                  <input
                    type="checkbox"
                    checked={Boolean(cells[col.key])}
                    onChange={e => handleChange(col.key, e.target.checked)}
                    className="w-4 h-4 accent-slate-900"
                  />
                </div>
              ) : (
                <Input
                  type={col.type === 'number_input' ? 'number' : col.type === 'date_input' ? 'date' : 'text'}
                  value={String(cells[col.key] ?? '')}
                  onChange={e => handleChange(col.key, e.target.value)}
                  placeholder={
                    col.type === 'fixed_text'
                      ? col.fixedValue ?? '(valor fijo)'
                      : (col.expectedValue ?? '')
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2 border-t border-slate-200">
        {onDelete ? (
          <Button size="sm" variant="danger" onClick={onDelete}>Eliminar fila</Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={() => onSave({ ...row, cells, isTitle, titleText: isTitle ? titleText : null })}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};
