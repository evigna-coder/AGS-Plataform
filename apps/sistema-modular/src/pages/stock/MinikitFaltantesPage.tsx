import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { minikitsService, unidadesService } from '../../services/firebaseService';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { Minikit, UnidadStock } from '@ags/shared';

interface FaltanteRow {
  /** unique key per (minikit × artículo) */
  key: string;
  minikitId: string;
  minikitCodigo: string;
  minikitNombre: string;
  minikitEstado: string;
  asignadoNombre: string;
  sector: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  cantidadMinima: number;
  actual: number;
  deficit: number;
}

export const MinikitFaltantesPage = () => {
  const FILTER_SCHEMA = useMemo(() => ({
    minikitId: { type: 'string' as const, default: '' },
    asignado: { type: 'string' as const, default: '' },
    articulo: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'deficit' },
    sortDir: { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = minikitsService.subscribe(true, (data) => {
      setMinikits(data);
    }, err => console.error('minikits subscribe error:', err));
    return () => { unsubRef.current?.(); };
  }, []);

  useEffect(() => {
    unidadesService.getAll({ activoOnly: true })
      .then(setUnidades)
      .catch(err => console.error('Error cargando unidades:', err))
      .finally(() => setLoading(false));
  }, []);

  // Re-load unidades when minikits change (in case we just refreshed and unidades stale)
  useEffect(() => {
    if (minikits.length === 0) return;
    unidadesService.getAll({ activoOnly: true })
      .then(setUnidades)
      .catch(err => console.error('Error refreshing unidades:', err));
  }, [minikits.length]);

  const rows = useMemo<FaltanteRow[]>(() => {
    const out: FaltanteRow[] = [];
    // Index unidades by (minikitId, articuloId) for O(1) count
    const counts: Record<string, Record<string, number>> = {};
    for (const u of unidades) {
      if (u.ubicacion?.tipo !== 'minikit' || !u.ubicacion.referenciaId) continue;
      const mkId = u.ubicacion.referenciaId;
      counts[mkId] ??= {};
      counts[mkId][u.articuloId] = (counts[mkId][u.articuloId] ?? 0) + 1;
    }
    for (const mk of minikits) {
      const requeridos = mk.requeridos ?? [];
      const mkCounts = counts[mk.id] ?? {};
      for (const req of requeridos) {
        const actual = mkCounts[req.articuloId] ?? 0;
        if (actual >= req.cantidadMinima) continue;
        out.push({
          key: `${mk.id}-${req.articuloId}`,
          minikitId: mk.id,
          minikitCodigo: mk.codigo,
          minikitNombre: mk.nombre,
          minikitEstado: mk.estado,
          asignadoNombre: mk.asignadoA?.nombre ?? '',
          sector: req.sector ?? '',
          articuloCodigo: req.articuloCodigo,
          articuloDescripcion: req.articuloDescripcion,
          cantidadMinima: req.cantidadMinima,
          actual,
          deficit: req.cantidadMinima - actual,
        });
      }
    }
    return out;
  }, [minikits, unidades]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filters.minikitId) r = r.filter(x => x.minikitId === filters.minikitId);
    if (filters.asignado) {
      const q = filters.asignado.toLowerCase();
      r = r.filter(x => x.asignadoNombre.toLowerCase().includes(q));
    }
    if (filters.articulo) {
      const q = filters.articulo.toLowerCase();
      r = r.filter(x => x.articuloCodigo.toLowerCase().includes(q) || x.articuloDescripcion.toLowerCase().includes(q));
    }
    return sortByField(r, filters.sortField, filters.sortDir as SortDir);
  }, [rows, filters]);

  const minikitOpts = useMemo(
    () => minikits.map(mk => ({ value: mk.id, label: `${mk.codigo} — ${mk.nombre}` })),
    [minikits],
  );

  const totalFaltantes = rows.length;
  const minikitsConFaltantes = useMemo(() => new Set(rows.map(r => r.minikitId)).size, [rows]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Faltantes en minikits"
        subtitle={`${totalFaltantes} item(s) por reponer en ${minikitsConFaltantes} minikit(s)`}
        count={totalFaltantes}
      />

      <div className="px-5 pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1 uppercase tracking-wide">Minikit</label>
            <select
              value={filters.minikitId}
              onChange={e => setFilter('minikitId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white"
            >
              <option value="">Todos</option>
              {minikitOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Input
            label="Asignado a"
            inputSize="sm"
            value={filters.asignado}
            onChange={e => setFilter('asignado', e.target.value)}
            placeholder="Nombre del ingeniero..."
          />
          <Input
            label="Artículo"
            inputSize="sm"
            value={filters.articulo}
            onChange={e => setFilter('articulo', e.target.value)}
            placeholder="Código o descripción..."
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Calculando faltantes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              {rows.length === 0 ? (
                <>
                  <p className="text-green-600 font-medium">Todos los minikits están completos</p>
                  <p className="text-slate-400 text-sm mt-1">Ningún artículo está debajo del mínimo configurado.</p>
                </>
              ) : (
                <p className="text-slate-400 text-sm">No hay resultados con los filtros aplicados.</p>
              )}
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <SortableHeader label="Minikit" field="minikitCodigo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Asignado" field="asignadoNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Artículo" field="articuloCodigo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Sector" field="sector" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Mínimo" field="cantidadMinima" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                  <SortableHeader label="Actual" field="actual" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                  <SortableHeader label="Falta" field="deficit" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center" />
                  <th className="px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link to={`/stock/minikits/${r.minikitId}`} className="font-mono text-teal-600 hover:underline font-medium">
                        {r.minikitCodigo}
                      </Link>
                      <span className="text-slate-500 ml-1.5">— {r.minikitNombre}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.asignadoNombre || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-teal-600 font-semibold">{r.articuloCodigo}</span>
                      <span className="text-slate-600 ml-1.5">{r.articuloDescripcion}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.sector || '—'}</td>
                    <td className="px-4 py-2 text-center tabular-nums text-slate-600">{r.cantidadMinima}</td>
                    <td className="px-4 py-2 text-center tabular-nums font-semibold text-red-600">{r.actual}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-flex items-center text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                        -{r.deficit}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Link to={`/stock/minikits/${r.minikitId}`} className="text-[10px] font-medium text-teal-600 hover:underline">
                        Ver minikit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
