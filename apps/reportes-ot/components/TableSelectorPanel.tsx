import { useState, useEffect, useMemo } from 'react';
import type { TableCatalogEntry, ProtocolSelection } from '../types/tableCatalog';
import { FirebaseService } from '../services/firebaseService';

interface Props {
  firebase: FirebaseService;
  sysType?: string;
  /** Nombre del modelo/equipo seleccionado (ej. "HPLC 1260") para filtrar tablas por modelo. */
  modeloEquipo?: string;
  existingSelections: ProtocolSelection[];
  onApply: (newSelections: ProtocolSelection[]) => void;
  /**
   * Tablas pre-cargadas sugeridas según el tipoServicio.
   * Cuando se proveen, el panel arranca abierto con estas tablas pre-tildadas.
   */
  suggestedTables?: TableCatalogEntry[];
}

export const TableSelectorPanel: React.FC<Props> = ({
  firebase,
  sysType,
  modeloEquipo,
  existingSelections,
  onApply,
  suggestedTables,
}) => {
  const hasSuggestions = (suggestedTables?.length ?? 0) > 0;

  const [open, setOpen] = useState(hasSuggestions);
  const [availableTables, setAvailableTables] = useState<TableCatalogEntry[]>(suggestedTables ?? []);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(
    existingSelections.map(s => s.tableId),
  ));
  const [projectNames, setProjectNames] = useState<Map<string, string>>(new Map());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Detectar proyectos distintos entre las tablas disponibles
  const projectGroups = useMemo(() => {
    const groups = new Map<string, TableCatalogEntry[]>();
    for (const t of availableTables) {
      const pid = t.projectId ?? '__none__';
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid)!.push(t);
    }
    return groups;
  }, [availableTables]);

  // ¿Hay múltiples proyectos? (solo contar proyectos reales, no __none__)
  const realProjectIds = [...projectGroups.keys()].filter(k => k !== '__none__');
  const hasMultipleProjects = realProjectIds.length > 1;

  // Tablas visibles según proyecto seleccionado
  const visibleTables = useMemo(() => {
    if (!hasMultipleProjects) return availableTables;
    if (!selectedProjectId) return [];
    return availableTables.filter(t => t.projectId === selectedProjectId);
  }, [availableTables, hasMultipleProjects, selectedProjectId]);

  // Cargar nombres de proyectos
  useEffect(() => {
    if (!hasMultipleProjects || projectNames.size > 0) return;
    firebase.getProjects().then(projects => {
      const map = new Map<string, string>();
      for (const p of projects) {
        if (p.name) map.set(p.id, p.name);
      }
      setProjectNames(map);
    }).catch(() => {});
  }, [hasMultipleProjects, firebase, projectNames.size]);

  // Cuando llegan nuevas sugerencias desde el padre (cambio de tipoServicio):
  // abrir panel, cargar tablas y pre-tildar las sugeridas (solo si un proyecto).
  useEffect(() => {
    if (!suggestedTables || suggestedTables.length === 0) return;
    setOpen(true);
    setAvailableTables(suggestedTables);
    setSelectedProjectId(null);

    // Detectar si hay múltiples proyectos
    const pids = new Set(suggestedTables.map(t => t.projectId).filter(Boolean));
    if (pids.size <= 1) {
      // Un solo proyecto (o ninguno): pre-tildar todo como antes
      setChecked(prev => {
        const next = new Set(prev);
        suggestedTables.forEach(t => next.add(t.id));
        return next;
      });
    } else {
      // Múltiples proyectos: solo mantener las existentes, no pre-tildar
      setChecked(new Set(existingSelections.map(s => s.tableId)));
    }
  }, [suggestedTables]);

  // Sincronizar checked cuando cambian existingSelections desde afuera
  useEffect(() => {
    setChecked(new Set(existingSelections.map(s => s.tableId)));
  }, [existingSelections]);

  // Al seleccionar un proyecto, pre-tildar sus tablas y destildar las de otros
  // proyectos — los protocolos son mutuamente excluyentes para un mismo servicio.
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const otherProjectTableIds = new Set(
      availableTables
        .filter(t => t.projectId && t.projectId !== projectId)
        .map(t => t.id),
    );
    const projectTables = availableTables.filter(t => t.projectId === projectId);
    setChecked(prev => {
      const next = new Set<string>();
      for (const id of prev) {
        if (!otherProjectTableIds.has(id)) next.add(id);
      }
      projectTables.forEach(t => next.add(t.id));
      return next;
    });
  };

  // Abrir panel: cargar tablas del catálogo (solo si no hay sugeridas ya cargadas)
  const handleOpen = async () => {
    setOpen(true);
    if (availableTables.length > 0) return;
    setLoading(true);
    try {
      const tables = await firebase.getPublishedTables();
      const modeloLower = modeloEquipo?.toLowerCase().trim();
      const filtered = modeloLower
        ? tables.filter(t => !t.modelos || t.modelos.length === 0 || t.modelos.some(m => m.toLowerCase().trim() === modeloLower))
        : tables;
      setAvailableTables(filtered.sort((a, b) => (a.orden || 999) - (b.orden || 999)));
      const already = new Set(existingSelections.map(s => s.tableId));
      setChecked(already);
    } catch (err) {
      console.error('Error cargando tablas del catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

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

      // Tipos de columna que NO deben pre-llenarse con N/A
      const nonEditableTypes = new Set(['fixed_text', 'checkbox', 'pass_fail']);

      // Para carátula: solo snapshot, sin datos editables
      if (table.tableType === 'cover' || table.tableType === 'signatures') {
        return {
          tableId: table.id,
          tableName: table.name,
          tableSnapshot: table,
          filledData: {},
          observaciones: null,
          resultado: 'CONFORME' as const,
          seleccionadoAt: new Date().toISOString(),
        };
      }

      // Para texto: solo snapshot, sin datos editables
      if (table.tableType === 'text') {
        return {
          tableId: table.id,
          tableName: table.name,
          tableSnapshot: table,
          filledData: {},
          observaciones: null,
          resultado: 'CONFORME' as const,
          seleccionadoAt: new Date().toISOString(),
        };
      }

      // Para checklists: inicializar con checklistData vacío
      if (table.tableType === 'checklist') {
        return {
          tableId: table.id,
          tableName: table.name,
          tableSnapshot: table,
          filledData: {},
          checklistData: {},
          collapsedSections: [],
          observaciones: null,
          resultado: 'PENDIENTE' as const,
          seleccionadoAt: new Date().toISOString(),
        };
      }

      // Para tablas: pre-poblar filledData desde templateRows.
      // Celdas editables vacías arrancan con "N/A" por defecto.
      const filledData: Record<string, Record<string, string>> = {};
      const dataRows = table.templateRows.filter(r => !r.isTitle && !r.isSelector);

      // Pre-calcular qué columnas text_input/number_input tienen el mismo valor en todas las filas.
      // Si es el mismo → es un placeholder/unidad (editable, debe ser N/A).
      // Si varía → es un label descriptivo por fila (read-only, conservar valor de fábrica).
      const editableColTypes = new Set(['text_input', 'number_input']);
      const colIsPlaceholder = new Map<string, boolean>();
      for (const col of table.columns) {
        if (!editableColTypes.has(col.type)) continue;
        const vals = dataRows.map(r => String(r.cells?.[col.key] ?? '').trim());
        const allSame = vals.length > 0 && vals.every(v => v === vals[0]);
        colIsPlaceholder.set(col.key, allSame);
      }

      for (const row of table.templateRows) {
        if (row.isTitle) continue;
        filledData[row.rowId] = {};

        // Filas selector: dejar vacío sólo la columna del dropdown (y la columna
        // 0 si el dropdown vive en otra columna — ahí va el label). Las demás
        // celdas de valor siguen la lógica normal de N/A.
        const isSelectorRow = row.isSelector;
        const selectorColIdx = row.selectorColumn ?? 0;

        for (let colIdx = 0; colIdx < table.columns.length; colIdx++) {
          const col = table.columns[colIdx];

          if (isSelectorRow) {
            const isDropdownCol = colIdx === selectorColIdx;
            const isLabelCol = selectorColIdx > 0 && colIdx === 0;
            if (isDropdownCol || isLabelCol) {
              const v = row.cells?.[col.key];
              filledData[row.rowId][col.key] = v != null ? String(v) : '';
              continue;
            }
          }

          const v = row.cells?.[col.key];
          const strVal = v != null ? String(v).trim() : '';
          // Si el valor de fábrica es solo la unidad de la columna, tratarlo como vacío
          const effectiveUnit = (col.unit ?? col.label?.match(/\(\s*([^)]{1,15})\s*\)\s*$/)?.[1])?.trim();
          const isJustUnit = effectiveUnit && strVal === effectiveUnit;

          if (nonEditableTypes.has(col.type) || col.type === 'select_input') {
            // fixed_text, checkbox, pass_fail, select_input → vacío
            filledData[row.rowId][col.key] = strVal;
          } else if (row.variable) {
            // Fila con variable binding (auto-rellenada desde contexto) → vacío, no N/A
            filledData[row.rowId][col.key] = '';
          } else if (!strVal || isJustUnit || colIsPlaceholder.get(col.key)) {
            // Sin valor, solo unidad, o placeholder repetido → "N/A" para que el IST complete
            filledData[row.rowId][col.key] = 'N/A';
          } else {
            // Valor de fábrica que varía por fila → label descriptivo (read-only), conservar
            filledData[row.rowId][col.key] = String(v);
          }
        }
      }
      return {
        tableId: table.id,
        tableName: table.name,
        tableSnapshot: table,
        filledData,
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
          {hasSuggestions ? (
            <p className="text-xs text-blue-600 mt-0.5">
              {hasMultipleProjects
                ? 'Seleccioná el protocolo a utilizar para este servicio.'
                : 'Tablas sugeridas para este tipo de servicio — confirmá o modificá la selección.'}
            </p>
          ) : sysType ? (
            <p className="text-xs text-blue-600 mt-0.5">
              Mostrando tablas para: <strong>{sysType}</strong>
            </p>
          ) : null}
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

      {/* Selector de proyecto (solo cuando hay múltiples proyectos) */}
      {hasMultipleProjects && (
        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Protocolo</p>
          <div className="flex flex-wrap gap-2">
            {realProjectIds.map(pid => {
              const name = projectNames.get(pid) || pid.slice(0, 8);
              const count = projectGroups.get(pid)?.length ?? 0;
              const isSelected = selectedProjectId === pid;
              return (
                <button
                  key={pid}
                  onClick={() => handleSelectProject(pid)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {name}
                  <span className={`ml-1.5 text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de tablas */}
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Cargando catálogo...</p>
        ) : hasMultipleProjects && !selectedProjectId ? (
          <p className="text-xs text-slate-400 text-center py-4">
            Seleccioná un protocolo para ver las tablas disponibles.
          </p>
        ) : visibleTables.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            No hay tablas publicadas en el catálogo
            {sysType ? ` para "${sysType}"` : ''}.
          </p>
        ) : (
          <div className="space-y-1.5">
            {visibleTables.map(table => {
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
                      {table.tableType !== 'text' && (
                        <span className="text-[10px] text-slate-400">
                          {table.columns.length} col · {table.templateRows.filter(r => !r.isTitle).length} filas
                        </span>
                      )}
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
            disabled={hasMultipleProjects && !selectedProjectId}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar selección
          </button>
        </div>
      </div>
    </div>
  );
};
