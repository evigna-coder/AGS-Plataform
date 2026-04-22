import { useState, useEffect, useMemo, useRef } from 'react';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { facturacionService } from '../../services/facturacionService';
import { clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import { exportSolicitudesExcel, exportSolicitudesPDF } from '../../utils/exports/exportSolicitudesFacturacion';
import type { SolicitudFacturacion, SolicitudFacturacionEstado, Cliente } from '@ags/shared';
import { SOLICITUD_FACTURACION_ESTADO_LABELS, SOLICITUD_FACTURACION_ESTADO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const FacturacionList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkId = searchParams.get('solicitudId');
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('facturacion-list');
  const [solicitudes, setSolicitudes] = useState<SolicitudFacturacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasRole } = useAuth();
  const canAdminAction = hasRole('admin', 'admin_soporte');

  const FILTER_SCHEMA = useMemo(() => ({
    search:     { type: 'string' as const, default: '' },
    cliente:    { type: 'string' as const, default: '' },
    estado:     { type: 'string' as const, default: '' },
    fechaDesde: { type: 'string' as const, default: '' },
    fechaHasta: { type: 'string' as const, default: '' },
    sortField:  { type: 'string' as const, default: 'createdAt' },
    sortDir:    { type: 'string' as const, default: 'desc' },
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

  // Deep link: ?solicitudId=xxx → navigate to detail via direct getById (avoids filter race)
  useEffect(() => {
    if (!deepLinkId) return;
    let cancelled = false;
    facturacionService.getById(deepLinkId)
      .then(sol => {
        if (cancelled) return;
        if (sol) {
          navigate(`/facturacion/${deepLinkId}`);
        } else {
          console.warn('[FacturacionList] deep link: solicitud not found', deepLinkId);
          alert('Solicitud no encontrada');
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[FacturacionList] deep link resolve failed:', err);
        alert('Error al abrir solicitud');
      });
    return () => { cancelled = true; };
  }, [deepLinkId, navigate]);

  const filtradas = useMemo(() => {
    let result = solicitudes.filter(s => {
      if (filters.cliente && s.clienteId !== filters.cliente) return false;
      if (filters.estado && s.estado !== filters.estado) return false;
      if (filters.fechaDesde && s.createdAt < filters.fechaDesde) return false;
      if (filters.fechaHasta && s.createdAt > filters.fechaHasta + 'T23:59:59') return false;
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

  const buildFiltrosLabel = () =>
    [
      filters.cliente && `cliente=${clientes.find(c => c.id === filters.cliente)?.razonSocial || filters.cliente}`,
      filters.estado && `estado=${filters.estado}`,
      filters.fechaDesde && `desde=${filters.fechaDesde}`,
      filters.fechaHasta && `hasta=${filters.fechaHasta}`,
    ].filter(Boolean).join(', ') || 'Sin filtros';

  const hasActiveFilter = !!(filters.search || filters.cliente || filters.estado || filters.fechaDesde || filters.fechaHasta);

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
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400">Desde</label>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={e => setFilter('fechaDesde', e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1.5 text-xs w-32"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400">Hasta</label>
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={e => setFilter('fechaHasta', e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1.5 text-xs w-32"
            />
          </div>
          {hasActiveFilter && (
            <button onClick={resetFilters} className="text-[11px] text-teal-600 hover:text-teal-700 font-medium">
              Limpiar
            </button>
          )}
          {canAdminAction && (
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSolicitudesExcel(filtradas, { filtrosLabel: buildFiltrosLabel() })}
              >
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await exportSolicitudesPDF(filtradas, { filtrosLabel: buildFiltrosLabel() });
                }}
              >
                Exportar PDF
              </Button>
            </div>
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
            <table ref={tableRef} className="w-full text-xs table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
              )}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <SortableHeader label="Fecha" field="createdAt" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Presupuesto" field="presupuestoNumero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(3)} relative`}>Items<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(4)} relative`}>Cond. Pago<ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} /><div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader label="Monto" field="montoTotal" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(5)} relative`}>
                    <ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />
                    <div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(6)} relative`}>Estado<ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} /><div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(7)} relative`}>Nro Factura<ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} /><div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(8)} relative`}>Solicitado por<ColAlignIcon align={colAligns?.[8] || 'left'} onClick={() => cycleAlign(8)} /><div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
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
                      <td className={`px-3 py-2 text-slate-500 whitespace-nowrap ${getAlignClass(0)}`}>{fmtDate(sol.createdAt)}</td>
                      <td className={`px-3 py-2 font-medium text-teal-700 ${getAlignClass(1)}`}>{sol.presupuestoNumero}</td>
                      <td className={`px-3 py-2 text-slate-700 max-w-[200px] truncate ${getAlignClass(2)}`}>{sol.clienteNombre}</td>
                      <td className={`px-3 py-2 text-slate-500 ${getAlignClass(3)}`}>{sol.items.length}</td>
                      <td className={`px-3 py-2 text-slate-500 text-[11px] ${getAlignClass(4)}`}>{sol.condicionPago || '—'}</td>
                      <td className={`px-3 py-2 font-mono font-medium text-slate-700 whitespace-nowrap ${getAlignClass(5)}`}>
                        {sym} {sol.montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 ${getAlignClass(6)}`}>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${SOLICITUD_FACTURACION_ESTADO_COLORS[sol.estado]}`}>
                          {SOLICITUD_FACTURACION_ESTADO_LABELS[sol.estado]}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-slate-600 font-mono text-[11px] ${getAlignClass(7)}`}>{sol.numeroFactura || '—'}</td>
                      <td className={`px-3 py-2 text-slate-500 text-[11px] ${getAlignClass(8)}`}>{sol.solicitadoPorNombre || '—'}</td>
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
