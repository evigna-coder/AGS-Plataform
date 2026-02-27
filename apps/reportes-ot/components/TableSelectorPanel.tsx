import { useState, useEffect } from 'react';
import type { TableCatalogEntry, ProtocolSelection } from '../types/tableCatalog';
import { FirebaseService } from '../services/firebaseService';

interface Props {
  firebase: FirebaseService;
  sysType?: string;
  existingSelections: ProtocolSelection[];
  onApply: (newSelections: ProtocolSelection[]) => void;
}

export const TableSelectorPanel: React.FC<Props> = ({
  firebase,
  sysType,
  existingSelections,
  onApply,
}) => {
  const [open, setOpen] = useState(false);
  const [availableTables, setAvailableTables] = useState<TableCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Abrir panel: cargar tablas del catálogo
  const handleOpen = async () => {
    setOpen(true);
    if (availableTables.length > 0) return;
    setLoading(true);
    try {
      const tables = await firebase.getPublishedTables(sysType || undefined);
      setAvailableTables(tables);
      // Pre-seleccionar las tablas que ya están en existingSelections
      const already = new Set(existingSelections.map(s => s.tableId));
      setChecked(already);
    } catch (err) {
      console.error('Error cargando tablas del catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar checked cuando cambian existingSelections desde afuera
  useEffect(() => {
    setChecked(new Set(existingSelections.map(s => s.tableId)));
  }, [existingSelections]);

  const toggle = (tableId: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const handleApply = () => {
    // Para cada tabla seleccionada, mantener la selección existente si ya existe, o crear nueva
    const selectedTables = availableTables.filter(t => checked.has(t.id));
    const newSelections: ProtocolSelection[] = selectedTables.map(table => {
      const existing = existingSelections.find(s => s.tableId === table.id);
      if (existing) return existing; // preservar datos ya completados
      return {
        tableId: table.id,
        tableName: table.name,
        tableSnapshot: table,
        filledData: {},
        observaciones: null,
        resultado: 'PENDIENTE' as const,
        seleccionadoAt: new Date().toISOString(),
      };
    });
    onApply(newSelections);
    setOpen(false);
  };

  const newCount = [...checked].filter(id => !existingSelections.find(s => s.tableId === id)).length;
  const removedCount = existingSelections.filter(s => !checked.has(s.tableId)).length;

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {existingSelections.length > 0
          ? `Editar selección (${existingSelections.length} ${existingSelections.length === 1 ? 'tabla' : 'tablas'})`
          : 'Agregar tablas del catálogo'
        }
      </button>
    );
  }

  return (
    <div className="border border-blue-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header del panel */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
        <div>
          <p className="text-sm font-semibold text-blue-900">Selección de tablas del catálogo</p>
          {sysType && (
            <p className="text-xs text-blue-600 mt-0.5">
              Mostrando tablas para: <strong>{sysType}</strong>
            </p>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-blue-400 hover:text-blue-600 transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Lista de tablas */}
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Cargando catálogo...</p>
        ) : availableTables.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            No hay tablas publicadas en el catálogo
            {sysType ? ` para "${sysType}"` : ''}.
          </p>
        ) : (
          <div className="space-y-1.5">
            {availableTables.map(table => {
              const isChecked = checked.has(table.id);
              const wasAlready = existingSelections.some(s => s.tableId === table.id);
              return (
                <label
                  key={table.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(table.id)}
                    className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${isChecked ? 'text-blue-900' : 'text-slate-800'}`}>
                      {table.name}
                    </p>
                    {table.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{table.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        {table.tableType}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {table.columns.length} col · {table.templateRows.filter(r => !r.isTitle).length} filas
                      </span>
                      {wasAlready && (
                        <span className="text-[10px] text-emerald-600 font-medium">datos guardados</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          {checked.size > 0
            ? `${checked.size} ${checked.size === 1 ? 'tabla seleccionada' : 'tablas seleccionadas'}`
            : 'Ninguna tabla seleccionada'
          }
          {newCount > 0 && <span className="text-blue-600 ml-1">(+{newCount} nuevas)</span>}
          {removedCount > 0 && <span className="text-red-500 ml-1">(-{removedCount} a quitar)</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={availableTables.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Aplicar selección
          </button>
        </div>
      </div>
    </div>
  );
};
