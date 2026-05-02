import { useState, useEffect, useMemo, useRef } from 'react';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { ColAlignIcon } from '../components/ui/ColAlignIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { OTStatusBadge } from '../components/ordenes-trabajo/OTStatusBadge';
import HistorialFilterBar from '../components/historial/HistorialFilterBar';
import HistorialOTCard from '../components/historial/HistorialOTCard';
import { otService, clientesService, tiposServicioService, type WorkOrderWithPdf } from '../services/firebaseService';
import { REPORTES_OT_URL } from '../utils/constants';
import { sortByField, toggleSort, type SortDir } from '../components/ui/SortableHeader';
import { useUrlFilters } from '../hooks/useUrlFilters';

const FILTER_SCHEMA = {
  search: { type: 'string', default: '' },
  cliente: { type: 'string', default: '' },
  equipo: { type: 'string', default: '' },
  tipoServicio: { type: 'string', default: '' },
  fechaDesde: { type: 'string', default: '' },
  fechaHasta: { type: 'string', default: '' },
} as const;

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
  active ? (
    <svg className="w-3 h-3 text-teal-500 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-slate-300 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return dateStr; }
}

const openPDF = (ot: WorkOrderWithPdf) => {
  if (ot.pdfUrl) window.open(ot.pdfUrl, '_blank');
  else window.open(`${REPORTES_OT_URL}?reportId=${encodeURIComponent(ot.otNumber)}`, '_blank');
};

export default function HistorialPage() {
  const [ots, setOts] = useState<WorkOrderWithPdf[]>([]);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [tiposServicio, setTiposServicio] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const [sortField, setSortField] = useState<string>('fechaInicio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('pi-historial-list');

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = otService.subscribe(
      { status: 'FINALIZADO' },
      (data) => { setOts(data); setLoading(false); },
      (err) => { console.error('Historial subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  useEffect(() => {
    clientesService.getAll().then(setClientes).catch(err => console.warn('Clientes load failed:', err));
    tiposServicioService.getAll().then(setTiposServicio).catch(err => console.warn('Tipos servicio load failed:', err));
  }, []);

  const clienteRazonById = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach(c => m.set(c.id, c.razonSocial.toLowerCase()));
    return m;
  }, [clientes]);

  const filtered = useMemo(() => {
    let list = ots;
    if (filters.cliente) {
      const razon = clienteRazonById.get(filters.cliente);
      list = list.filter(ot => {
        if (ot.clienteId === filters.cliente) return true;
        if (razon && ot.razonSocial?.toLowerCase().includes(razon)) return true;
        return false;
      });
    }
    if (filters.tipoServicio) {
      list = list.filter(ot => ot.tipoServicio === filters.tipoServicio);
    }
    if (filters.equipo.trim()) {
      const e = filters.equipo.toLowerCase();
      list = list.filter(ot =>
        ot.moduloModelo?.toLowerCase().includes(e) ||
        ot.moduloSerie?.toLowerCase().includes(e) ||
        ot.sistema?.toLowerCase().includes(e) ||
        ot.codigoInternoCliente?.toLowerCase().includes(e),
      );
    }
    if (filters.fechaDesde) {
      list = list.filter(ot => (ot.fechaInicio || ot.updatedAt || '') >= filters.fechaDesde);
    }
    if (filters.fechaHasta) {
      list = list.filter(ot => (ot.fechaInicio || ot.updatedAt || '') <= filters.fechaHasta + 'T23:59:59');
    }
    if (filters.search.trim()) {
      const s = filters.search.toLowerCase();
      list = list.filter(ot =>
        ot.otNumber?.toLowerCase().includes(s) ||
        ot.razonSocial?.toLowerCase().includes(s) ||
        ot.sistema?.toLowerCase().includes(s) ||
        ot.tipoServicio?.toLowerCase().includes(s) ||
        ot.ingenieroAsignadoNombre?.toLowerCase().includes(s) ||
        ot.moduloModelo?.toLowerCase().includes(s) ||
        ot.moduloSerie?.toLowerCase().includes(s) ||
        ot.codigoInternoCliente?.toLowerCase().includes(s),
      );
    }
    return sortByField(list, sortField, sortDir);
  }, [ots, filters, clienteRazonById, sortField, sortDir]);

  const hasActiveFilters = filters.search || filters.cliente || filters.equipo || filters.tipoServicio || filters.fechaDesde || filters.fechaHasta;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Historial"
        subtitle={loading ? '...' : `${filtered.length} órdenes finalizadas`}
      />

      <HistorialFilterBar
        search={filters.search}
        cliente={filters.cliente}
        equipo={filters.equipo}
        tipoServicio={filters.tipoServicio}
        fechaDesde={filters.fechaDesde}
        fechaHasta={filters.fechaHasta}
        clientes={clientes}
        tiposServicio={tiposServicio}
        onChange={{
          search: v => setFilter('search', v),
          cliente: v => setFilter('cliente', v),
          equipo: v => setFilter('equipo', v),
          tipoServicio: v => setFilter('tipoServicio', v),
          fechaDesde: v => setFilter('fechaDesde', v),
          fechaHasta: v => setFilter('fechaHasta', v),
        }}
        onReset={resetFilters}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-slate-600">
              {hasActiveFilters ? 'Sin resultados' : 'Sin OTs finalizadas'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Probá con otros filtros.' : 'Acá se listan las OTs con cierre técnico.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
              <table ref={tableRef} className="w-full table-fixed">
                {colWidths ? (
                  <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                ) : (
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                )}
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(0)}`}><ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} /><span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('otNumber')}>OT<SortIcon active={sortField === 'otNumber'} dir={sortDir} /></span><div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} /><span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('razonSocial')}>Cliente<SortIcon active={sortField === 'razonSocial'} dir={sortDir} /></span><div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} /><span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('sistema')}>Sistema<SortIcon active={sortField === 'sistema'} dir={sortDir} /></span><div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('moduloModelo')}>Módulo<SortIcon active={sortField === 'moduloModelo'} dir={sortDir} /></span><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(4)}`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} /><span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('tipoServicio')}>Servicio<SortIcon active={sortField === 'tipoServicio'} dir={sortDir} /></span><div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(5)}`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} /><span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('fechaInicio')}>Fecha<SortIcon active={sortField === 'fechaInicio'} dir={sortDir} /></span><div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Reporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(ot => (
                    <tr key={ot.otNumber} className="hover:bg-slate-50 transition-colors">
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-teal-600 text-xs font-mono">OT-{ot.otNumber}</span>
                          <OTStatusBadge status={ot.status} />
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-700 truncate max-w-[160px] ${getAlignClass(1)}`} title={ot.razonSocial}>{ot.razonSocial || '—'}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[120px] ${getAlignClass(2)}`} title={ot.sistema}>{ot.sistema || '—'}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[140px] ${getAlignClass(3)}`} title={[ot.moduloModelo, ot.moduloSerie].filter(Boolean).join(' — ')}>
                        {ot.moduloModelo || '—'}
                        {ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[140px] ${getAlignClass(4)}`} title={ot.tipoServicio}>{ot.tipoServicio || '—'}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(5)}`}>{fmt(ot.fechaInicio || ot.updatedAt)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => openPDF(ot)}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50"
                        >
                          Ver PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filtered.map(ot => <HistorialOTCard key={ot.otNumber} ot={ot} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
