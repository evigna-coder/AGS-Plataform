import { Button } from '../ui/Button';
import type { TableCatalogColumn, TableCatalogRow } from '@ags/shared';

interface Props {
  columns: TableCatalogColumn[];
  rows: TableCatalogRow[];
  allowExtraRows: boolean;
  onChange: (next: { columns: TableCatalogColumn[]; rows: TableCatalogRow[]; allowExtraRows: boolean }) => void;
}

const newColumn = (): TableCatalogColumn => ({
  key: `col_${crypto.randomUUID().slice(0, 6)}`,
  label: '',
  type: 'text_input',
  required: false,
});

const newRow = (cols: TableCatalogColumn[]): TableCatalogRow => ({
  rowId: crypto.randomUUID().slice(0, 8),
  cells: Object.fromEntries(cols.map(c => [c.key, ''])),
});

export const HeaderTableEditor = ({ columns, rows, allowExtraRows, onChange }: Props) => {
  const updColumn = (idx: number, patch: Partial<TableCatalogColumn>) => {
    const next = [...columns];
    const prevKey = next[idx].key;
    next[idx] = { ...next[idx], ...patch };
    let nextRows = rows;
    if (patch.key && patch.key !== prevKey) {
      nextRows = rows.map(r => {
        const cells = { ...r.cells };
        cells[patch.key!] = cells[prevKey] ?? '';
        delete cells[prevKey];
        return { ...r, cells };
      });
    }
    onChange({ columns: next, rows: nextRows, allowExtraRows });
  };

  const removeColumn = (idx: number) => {
    const key = columns[idx].key;
    const nextColumns = columns.filter((_, i) => i !== idx);
    const nextRows = rows.map(r => {
      const cells = { ...r.cells };
      delete cells[key];
      return { ...r, cells };
    });
    onChange({ columns: nextColumns, rows: nextRows, allowExtraRows });
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ columns: next, rows, allowExtraRows });
  };

  const addColumn = () => onChange({ columns: [...columns, newColumn()], rows, allowExtraRows });

  const updRowCell = (rowIdx: number, colKey: string, value: string) => {
    const next = [...rows];
    next[rowIdx] = { ...next[rowIdx], cells: { ...next[rowIdx].cells, [colKey]: value } };
    onChange({ columns, rows: next, allowExtraRows });
  };

  const removeRow = (idx: number) => onChange({ columns, rows: rows.filter((_, i) => i !== idx), allowExtraRows });

  const moveRow = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ columns, rows: next, allowExtraRows });
  };

  const addRow = () => onChange({ columns, rows: [...rows, newRow(columns)], allowExtraRows });

  return (
    <div className="space-y-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Tabla de encabezado
        </span>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={allowExtraRows}
            onChange={e => onChange({ columns, rows, allowExtraRows: e.target.checked })}
          />
          Permitir agregar filas en la OT
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Mini-tabla que aparece sobre la principal (ej. instrumentos utilizados, identificación de equipos auxiliares). Solo soporta inputs de texto y numéricos.
      </p>

      {/* Columnas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Columnas ({columns.length})</span>
          <Button size="sm" onClick={addColumn}>+ Columna</Button>
        </div>
        {columns.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin columnas. Agregá al menos una para empezar.</p>
        )}
        {columns.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded">
            <input
              type="text"
              value={c.label}
              placeholder="Etiqueta (ej. Modelo)"
              onChange={e => updColumn(i, { label: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs"
            />
            <select
              value={c.type}
              onChange={e => updColumn(i, { type: e.target.value as 'text_input' | 'number_input' })}
              className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white"
            >
              <option value="text_input">Texto</option>
              <option value="number_input">Número</option>
            </select>
            <select
              value={c.align ?? 'left'}
              onChange={e => updColumn(i, { align: e.target.value as 'left' | 'center' | 'right' })}
              className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white"
              title="Alineación de header y celdas"
            >
              <option value="left">Izq</option>
              <option value="center">Centro</option>
              <option value="right">Der</option>
            </select>
            <button onClick={() => moveColumn(i, -1)} disabled={i === 0}
              className="text-slate-500 text-xs px-1 disabled:opacity-30">↑</button>
            <button onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1}
              className="text-slate-500 text-xs px-1 disabled:opacity-30">↓</button>
            <button onClick={() => removeColumn(i)}
              className="text-red-600 text-xs font-bold px-1">×</button>
          </div>
        ))}
      </div>

      {/* Filas */}
      {columns.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Filas template ({rows.length})</span>
            <Button size="sm" onClick={addRow}>+ Fila</Button>
          </div>
          {rows.length === 0 && (
            <p className="text-xs text-slate-400 italic">Sin filas. Las celdas pre-cargadas aparecerán como valor inicial; las vacías como inputs en blanco para el técnico.</p>
          )}
          {rows.map((r, i) => (
            <div key={r.rowId} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded">
              {columns.map(c => (
                <input
                  key={c.key}
                  type={c.type === 'number_input' ? 'number' : 'text'}
                  value={String(r.cells[c.key] ?? '')}
                  placeholder={c.label || c.key}
                  onChange={e => updRowCell(i, c.key, e.target.value)}
                  className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50"
                />
              ))}
              <button onClick={() => moveRow(i, -1)} disabled={i === 0}
                className="text-slate-500 text-xs px-1 disabled:opacity-30">↑</button>
              <button onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1}
                className="text-slate-500 text-xs px-1 disabled:opacity-30">↓</button>
              <button onClick={() => removeRow(i)}
                className="text-red-600 text-xs font-bold px-1">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
