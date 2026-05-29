import React, { useMemo } from 'react';
import { useEntregas } from '../../hooks/useEntregas';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { EntregasFilters } from './EntregasFilters';
import { EntregaRowComponent } from './EntregaRow';
import type { EntregaRow } from '../../utils/entregasResolver';

const FILTER_SCHEMA = {
  clienteId: { type: 'string' as const, default: '' },
  semaforo:  { type: 'string' as const, default: '' },
  estadoImp: { type: 'string' as const, default: '' },
  search:    { type: 'string' as const, default: '' },
  sortField: { type: 'string' as const, default: 'diasRestantes' },
  sortDir:   { type: 'string' as const, default: 'asc' },
};

const thClass = 'text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3';

export const EntregasList: React.FC = () => {
  const { rows, loading, updateOtNumero } = useEntregas();
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

  const filtered = useMemo((): EntregaRow[] => {
    const term = filters.search.trim().toLowerCase();
    return rows.filter(r => {
      if (filters.clienteId && r.clienteId !== filters.clienteId) return false;
      if (filters.semaforo && r.semaforo !== filters.semaforo) return false;
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
  }, [rows, filters.clienteId, filters.semaforo, filters.estadoImp, filters.search]);

  const sorted = useMemo(
    () => sortByField(filtered, filters.sortField, filters.sortDir as SortDir),
    [filtered, filters.sortField, filters.sortDir],
  );

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field);
    setFilter('sortDir', s.dir);
  };

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
                  <SortableHeader label="Días"         field="diasRestantes"      currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <EntregaRowComponent
                    key={`${row.presupuestoId}::${row.itemId}`}
                    row={row}
                    onUpdateOtNumero={(otNumero) => updateOtNumero(row.presupuestoId, row.itemId, otNumero)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
