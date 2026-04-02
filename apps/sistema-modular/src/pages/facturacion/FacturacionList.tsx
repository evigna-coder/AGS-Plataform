import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { facturacionService } from '../../services/facturacionService';
import { clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebounce } from '../../hooks/useDebounce';
import type { SolicitudFacturacion, SolicitudFacturacionEstado, Cliente } from '@ags/shared';
import { SOLICITUD_FACTURACION_ESTADO_LABELS, SOLICITUD_FACTURACION_ESTADO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const FacturacionList = () => {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState<SolicitudFacturacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const FILTER_SCHEMA = useMemo(() => ({
    search:    { type: 'string' as const, default: '' },
    cliente:   { type: 'string' as const, default: '' },
    estado:    { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'createdAt' },
    sortDir:   { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);
  const unsubRef = useRef<(() => void) | null>(null);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  useEffect(() => {
    clientesService.getAll(true).then(setClientes).catch(() => {});
    setLoading(true);
    unsubRef.current = facturacionService.subscribe(
      undefined,
      (data) => { setSolicitudes(data); setLoading(false); },
      () => setLoading(false),
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const filtradas = useMemo(() => {
    let result = solicitudes.filter(s => {
      if (filters.cliente && s.clienteId !== filters.cliente) return false;
      if (filters.estado && s.estado !== filters.estado) return false;
      return true;
    });
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(s =>
        s.presupuestoNumero.toLowerCase().includes(q) ||
        s.clienteNombre.toLowerCase().includes(q) ||
        (s.numeroFactura || '').toLowerCase().includes(q)
      );
    }
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [solicitudes, filters, debouncedSearch]);

  // Summary cards
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
  const facturadas = solicitudes.filter(s => s.estado === 'facturada');
  const montoPendiente = pendientes.reduce((s, x) => s + x.montoTotal, 0);
  const montoFacturado = facturadas.reduce((s, x) => s + x.montoTotal, 0);

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Facturacion" subtitle="Solicitudes de facturacion y seguimiento" />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Pendientes</p>
          <p className="text-xl font-black text-amber-600">{pendientes.length}</p>
          <p className="text-[11px] text-slate-500">U$S {montoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Facturadas</p>
          <p className="text-xl font-black text-blue-600">{facturadas.length}</p>
          <p className="text-[11px] text-slate-500">U$S {montoFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Total solicitudes</p>
          <p className="text-xl font-black text-slate-700">{solicitudes.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              placeholder="Buscar por presupuesto, cliente, nro factura..."
              className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-xs"
            />
          </div>
          <div className="w-48">
            <SearchableSelect
              value={filters.cliente}
              onChange={v => setFilter('cliente', v)}
              options={[{ value: '', label: 'Todos los clientes' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente..."
            />
          </div>
          <div className="w-36">
            <select
              value={filters.estado}
              onChange={e => setFilter('estado', e.target.value)}
              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs"
            >
              <option value="">Todos los estados</option>
              {(Object.entries(SOLICITUD_FACTURACION_ESTADO_LABELS) as [SolicitudFacturacionEstado, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {(filters.search || filters.cliente || filters.estado) && (
            <button onClick={resetFilters} className="text-[11px] text-teal-600 hover:text-teal-700 font-medium">
              Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-8">Cargando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No hay solicitudes de facturacion</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <SortableHeader label="Fecha" field="createdAt" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Presupuesto" field="presupuestoNumero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Items</th>
                  <th className={thClass}>Cond. Pago</th>
                  <SortableHeader label="Monto" field="montoTotal" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Nro Factura</th>
                  <th className={thClass}>Solicitado por</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(sol => {
                  const sym = MONEDA_SIMBOLO[sol.moneda] || '$';
                  return (
                    <tr
                      key={sol.id}
                      onClick={() => navigate(`/facturacion/${sol.id}`)}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{fmtDate(sol.createdAt)}</td>
                      <td className="px-3 py-2 text-center font-medium text-teal-700">{sol.presupuestoNumero}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{sol.clienteNombre}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{sol.items.length}</td>
                      <td className="px-3 py-2 text-center text-slate-500 text-[11px]">{sol.condicionPago || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                        {sym} {sol.montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${SOLICITUD_FACTURACION_ESTADO_COLORS[sol.estado]}`}>
                          {SOLICITUD_FACTURACION_ESTADO_LABELS[sol.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600 font-mono text-[11px]">{sol.numeroFactura || '—'}</td>
                      <td className="px-3 py-2 text-center text-slate-500 text-[11px]">{sol.solicitadoPorNombre || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
