import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button';

export interface ColumnToggle {
  /** Índice de columna en el espacio del hook useResizableColumns (posición renderizada). */
  idx: number;
  label: string;
}

interface Props {
  columns: ColumnToggle[];
  isHidden: (idx: number) => boolean;
  toggleCol: (idx: number) => void;
  showAllCols: () => void;
}

/** Dropdown "Columnas": muestra/oculta columnas del listado. El filtrado vive en
 *  el hook de datos, así que ocultar una columna no afecta las búsquedas. */
export const OTColumnsMenu: React.FC<Props> = ({ columns, isHidden, toggleCol, showAllCols }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const hiddenCount = columns.filter(c => isHidden(c.idx)).length;

  return (
    <div ref={ref} className="relative inline-block">
      <Button size="sm" variant="outline" onClick={() => setOpen(o => !o)}>
        Columnas{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          <div className="max-h-72 overflow-y-auto">
            {columns.map(col => (
              <label key={col.idx}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={!isHidden(col.idx)}
                  onChange={() => toggleCol(col.idx)}
                  className="w-3.5 h-3.5 accent-teal-600" />
                {col.label}
              </label>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button onClick={showAllCols}
              className="block w-full text-left px-3 py-1.5 text-[11px] text-teal-600 hover:bg-slate-50 border-t border-slate-100 mt-1">
              Mostrar todas
            </button>
          )}
        </div>
      )}
    </div>
  );
};
