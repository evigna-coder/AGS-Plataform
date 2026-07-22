import React, { useMemo, useState } from 'react';
import { useEntregas } from '../../hooks/useEntregas';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { EntregasFilters } from './EntregasFilters';
import { EntregaRowComponent } from './EntregaRow';
import { EntregaOCGroupRow } from './EntregaOCGroupRow';
import type { EntregaRow } from '../../utils/entregasResolver';

/** Entrada de render: fila suelta o grupo por OC completa (recibida). */
type DisplayEntry =
  | { type: 'row'; row: EntregaRow }
  | { type: 'group'; ocId: string; rows: EntregaRow[] };

const FILTER_SCHEMA = {
  clienteId: { type: 'string' as const, default: '' },
  // '__pendientes__' = ocultar entregados (default del dueño: lo terminado no se muestra).
  // Misma semántica que estadoAdmin en OTList.
  semaforo:  { type: 'string' as const, default: '__pendientes__' },
  estadoImp: { type: 'string' as const, default: '' },
  search:    { type: 'string' as const, default: '' },
  sortField: { type: 'string' as const, default: 'diasRestantes' },
  sortDir:   { type: 'string' as const, default: 'asc' },
};

const thClass = 'text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3';

export const EntregasList: React.FC = () => {
  const { rows, loading, updateItem } = useEntregas();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);

  const clienteOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach(r => {
      if (r.clienteId && !seen.has(r.clienteId)) seen.set(r.clienteId, r.clienteNombre);
    });
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // OCs agrupables (recibidas) con al menos un item pendiente: bajo el filtro
  // "Pendientes" sus items ya entregados siguen visibles para no desarmar el
  // grupo. Si TODOS los items del grupo están entregados, el grupo desaparece.
  const ocsConPendientes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.ocId && r.ocEstado === 'recibida' && r.semaforo !== 'entregado') set.add(r.ocId);
    });
    return set;
  }, [rows]);

  const filtered = useMemo((): EntregaRow[] => {
    const term = filters.search.trim().toLowerCase();
    return rows.filter(r => {
      if (filters.clienteId && r.clienteId !== filters.clienteId) return false;
      if (filters.semaforo === '__pendientes__') {
        const enGrupoConPendientes = r.ocId != null && r.ocEstado === 'recibida' && ocsConPendientes.has(r.ocId);
        if (r.semaforo === 'entregado' && !enGrupoConPendientes) return false;
      } else if (filters.semaforo && r.semaforo !== filters.semaforo) return false;
      if (filters.estadoImp && r.importacionEstado !== filters.estadoImp) return false;
      if (term) {
        const hay = [
          r.descripcion, r.presupuestoNumero,
          r.otNumeroVinculada ?? '', r.ocNumero ?? '',
          r.importacionNumero ?? '', r.clienteNombre,
        ].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, ocsConPendientes, filters.clienteId, filters.semaforo, filters.estadoImp, filters.search]);

  const sorted = useMemo(
    () => sortByField(filtered, filters.sortField, filters.sortDir as SortDir),
    [filtered, filters.sortField, filters.sortDir],
  );

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field);
    setFilter('sortDir', s.dir);
  };

  // Agrupación por OC completa (UAT 2026-07-16): cuando la OC está totalmente
  // recibida, la entrega se ve como una fila-OC expandible; mientras esté en
  // curso (o el item no tenga OC), cada artículo sigue como fila suelta.
  const [expandedOCs, setExpandedOCs] = useState<Set<string>>(new Set());
  const toggleOC = (ocId: string) => setExpandedOCs(prev => {
    const next = new Set(prev);
    if (next.has(ocId)) next.delete(ocId); else next.add(ocId);
    return next;
  });

  const display = useMemo((): DisplayEntry[] => {
    const esAgrupable = (r: EntregaRow) => r.ocId != null && r.ocEstado === 'recibida';
    const byOc = new Map<string, EntregaRow[]>();
    for (const r of sorted) {
      if (!esAgrupable(r)) continue;
      const arr = byOc.get(r.ocId!);
      if (arr) arr.push(r); else byOc.set(r.ocId!, [r]);
    }
    const out: DisplayEntry[] = [];
    const emitidas = new Set<string>();
    for (const r of sorted) {
      if (!esAgrupable(r)) { out.push({ type: 'row', row: r }); continue; }
      if (emitidas.has(r.ocId!)) continue;
      emitidas.add(r.ocId!);
      out.push({ type: 'group', ocId: r.ocId!, rows: byOc.get(r.ocId!)! });
    }
    return out;
  }, [sorted]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Entregas"
        subtitle="Visor de cumplimiento de entregas comprometidas"
        count={sorted.length}
      >
        <EntregasFilters filters={filters} setFilter={setFilter} clienteOptions={clienteOptions} />
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4 overflow-hidden flex flex-col">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1 mt-4">
          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400">Cargando...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">No hay items para mostrar</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortableHeader label="Cliente"      field="clienteNombre"     currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Item"         field="descripcion"        currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Cant."        field="cantidad"           currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} text-right`} />
                  <SortableHeader label="Valor unit."  field="precioUnitario"     currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} text-right`} />
                  <SortableHeader label="Presupuesto"  field="presupuestoNumero"  currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>OT#</th>
                  <SortableHeader label="OC#"          field="ocNumero"           currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Importación"  field="importacionNumero"  currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Disp."        field="disponibilidad"     currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="ETA"          field="etaFecha"           currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <th className={`${thClass} text-center`}>Entregado</th>
                  <SortableHeader label="Días"         field="diasRestantes"      currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                </tr>
              </thead>
              <tbody>
                {display.map((entry) => entry.type === 'row' ? (
                  <EntregaRowComponent
                    key={`${entry.row.presupuestoId}::${entry.row.itemId}`}
                    row={entry.row}
                    onUpdate={(patch) => updateItem(entry.row.presupuestoId, entry.row.itemId, patch)}
                  />
                ) : (
                  <React.Fragment key={`oc-group-${entry.ocId}`}>
                    <EntregaOCGroupRow
                      rows={entry.rows}
                      expanded={expandedOCs.has(entry.ocId)}
                      onToggle={() => toggleOC(entry.ocId)}
                    />
                    {expandedOCs.has(entry.ocId) && entry.rows.map((row) => (
                      <EntregaRowComponent
                        key={`${row.presupuestoId}::${row.itemId}`}
                        row={row}
                        onUpdate={(patch) => updateItem(row.presupuestoId, row.itemId, patch)}
                        nested
                      />
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
