import { useState, useEffect, useMemo, useRef } from 'react';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { ColAlignIcon } from '../components/ui/ColAlignIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { OTStatusBadge } from '../components/ordenes-trabajo/OTStatusBadge';
import { otService, type WorkOrderWithPdf } from '../services/firebaseService';
import { REPORTES_OT_URL } from '../utils/constants';

type StatusFilter = 'all' | 'BORRADOR' | 'FINALIZADO';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'BORRADOR', label: 'En progreso' },
  { value: 'FINALIZADO', label: 'Finalizadas' },
];

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return dateStr; }
}

/** Abre el PDF directamente si hay URL en Storage, sino abre reportes-ot */
const openPDF = (ot: WorkOrderWithPdf) => {
  if (ot.pdfUrl) {
    window.open(ot.pdfUrl, '_blank');
  } else {
    window.open(`${REPORTES_OT_URL}?reportId=${encodeURIComponent(ot.otNumber)}`, '_blank');
  }
};

const openReport = (otNum: string) => {
  window.open(`${REPORTES_OT_URL}?reportId=${encodeURIComponent(otNum)}`, '_blank');
};

export default function HistorialPage() {
  const [ots, setOts] = useState<WorkOrderWithPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('pi-historial-list');

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = otService.subscribe(
      undefined,
      (data) => { setOts(data); setLoading(false); },
      (err) => { console.error('Historial subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const filtered = useMemo(() => {
    let list = ots;
    if (statusFilter !== 'all') list = list.filter(ot => ot.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(ot =>
        ot.otNumber?.toLowerCase().includes(s) ||
        ot.razonSocial?.toLowerCase().includes(s) ||
        ot.sistema?.toLowerCase().includes(s) ||
        ot.tipoServicio?.toLowerCase().includes(s) ||
        ot.ingenieroAsignadoNombre?.toLowerCase().includes(s) ||
        ot.moduloModelo?.toLowerCase().includes(s) ||
        ot.moduloSerie?.toLowerCase().includes(s) ||
        ot.codigoInternoCliente?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [ots, search, statusFilter]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Historial"
        subtitle={loading ? '...' : `${filtered.length} órdenes de trabajo`}
      />

      {/* Filters */}
      <div className="shrink-0 px-4 pb-3 space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                statusFilter === t.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por OT, cliente, equipo, modelo, serie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-slate-600">
              {search || statusFilter !== 'all' ? 'Sin resultados' : 'Sin órdenes de trabajo'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Probá con otro término de búsqueda.' : 'Las OTs aparecen aquí cuando se crean.'}
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
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                )}
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(0)}`}><ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />OT<div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />Cliente<div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Sistema<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Módulo<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(4)}`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />Servicio<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(5)}`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Fecha<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(6)}`}><ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />Estado<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                    <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative">Acciones<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(ot => (
                    <tr key={ot.otNumber} className="hover:bg-slate-50 transition-colors">
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                        <span className="font-semibold text-teal-600 text-xs font-mono">OT-{ot.otNumber}</span>
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-700 truncate max-w-[160px] ${getAlignClass(1)}`} title={ot.razonSocial}>{ot.razonSocial || '—'}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[120px] ${getAlignClass(2)}`} title={ot.sistema}>{ot.sistema || '—'}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[140px] ${getAlignClass(3)}`} title={[ot.moduloModelo, ot.moduloSerie].filter(Boolean).join(' — ')}>
                        {ot.moduloModelo || '—'}
                        {ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[140px] ${getAlignClass(4)}`} title={ot.tipoServicio}>{ot.tipoServicio || '—'}</td>
                      <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(5)}`}>{fmt(ot.fechaInicio || ot.updatedAt)}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(6)}`}><OTStatusBadge status={ot.status} /></td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {ot.status === 'FINALIZADO' ? (
                            <button
                              onClick={() => openPDF(ot)}
                              className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50"
                            >
                              Ver PDF
                            </button>
                          ) : (
                            <button
                              onClick={() => openReport(ot.otNumber)}
                              className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50"
                            >
                              Abrir reporte
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filtered.map(ot => (
                <MobileOTCard key={ot.otNumber} ot={ot} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MobileOTCard({ ot }: { ot: WorkOrderWithPdf }) {
  const isFinalizado = ot.status === 'FINALIZADO';

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold font-mono text-teal-600">OT-{ot.otNumber}</span>
          <OTStatusBadge status={ot.status} />
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">{fmt(ot.fechaInicio || ot.updatedAt)}</span>
      </div>

      <p className="text-sm font-semibold text-slate-800 truncate">{ot.razonSocial || '—'}</p>

      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
        {ot.sistema && <span className="truncate">{ot.sistema}</span>}
        {ot.tipoServicio && (
          <>
            <span className="shrink-0">·</span>
            <span className="truncate">{ot.tipoServicio}</span>
          </>
        )}
      </div>

      {ot.moduloModelo && (
        <p className="mt-1 text-[11px] text-slate-400 truncate">
          {ot.moduloModelo}
          {ot.moduloSerie && <span className="ml-1">({ot.moduloSerie})</span>}
        </p>
      )}

      {ot.ingenieroAsignadoNombre && (
        <p className="mt-1 text-[11px] text-slate-400">
          Asignado: <span className="text-slate-600">{ot.ingenieroAsignadoNombre}</span>
        </p>
      )}

      <div className="mt-2">
        {isFinalizado ? (
          <button
            onClick={() => openPDF(ot)}
            className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ver PDF
          </button>
        ) : (
          <a
            href={`${REPORTES_OT_URL}?reportId=${encodeURIComponent(ot.otNumber || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-teal-500 font-medium"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Abrir reporte
          </a>
        )}
      </div>
    </div>
  );
}
