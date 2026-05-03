import type { WorkOrderWithPdf } from '../../services/firebaseService';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../ui/ColAlignIcon';
import { OTStatusBadge } from '../ordenes-trabajo/OTStatusBadge';
import { type SortDir } from '../ui/SortableHeader';

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

interface Props {
  rows: WorkOrderWithPdf[];
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;
  onOpenPdf: (ot: WorkOrderWithPdf) => void;
  onOpenProtocol: (ot: WorkOrderWithPdf) => void;
  fmt: (d?: string) => string;
}

const COLS = [
  { key: 'otNumber', label: 'OT', width: '10%' },
  { key: 'razonSocial', label: 'Cliente', width: '20%' },
  { key: 'sistema', label: 'Sistema', width: '14%' },
  { key: 'moduloModelo', label: 'Módulo', width: '16%' },
  { key: 'tipoServicio', label: 'Servicio', width: '14%' },
  { key: 'fechaInicio', label: 'Fecha', width: '11%' },
] as const;

export default function HistorialTable({ rows, sortField, sortDir, onSort, onOpenPdf, onOpenProtocol, fmt }: Props) {
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('pi-historial-list');

  return (
    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
      <table ref={tableRef} className="w-full table-fixed">
        {colWidths ? (
          <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        ) : (
          <colgroup>
            {COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: '15%' }} />
          </colgroup>
        )}
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-200">
            {COLS.map((c, i) => (
              <th key={c.key} className={`px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap relative ${getAlignClass(i)}`}>
                <ColAlignIcon align={colAligns?.[i] || 'left'} onClick={() => cycleAlign(i)} />
                <span className="cursor-pointer hover:text-slate-600" onClick={() => onSort(c.key)}>
                  {c.label}<SortIcon active={sortField === c.key} dir={sortDir} />
                </span>
                <div onMouseDown={e => onResizeStart(i, e)} onDoubleClick={() => onAutoFit(i)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              </th>
            ))}
            <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Reporte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(ot => (
            <tr key={ot.otNumber} className="hover:bg-slate-50 transition-colors">
              <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(0)}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-teal-600 text-xs font-mono">OT-{ot.otNumber}</span>
                  <OTStatusBadge status={ot.status} />
                </div>
              </td>
              <td className={`px-3 py-2 text-xs text-slate-700 truncate max-w-[160px] ${getAlignClass(1)}`} title={ot.razonSocial}>{ot.razonSocial || '—'}</td>
              <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[120px] ${getAlignClass(2)}`} title={[ot.sistema, ot.codigoInternoCliente].filter(Boolean).join(' — ')}>
                <div className="truncate">{ot.sistema || '—'}</div>
                {ot.codigoInternoCliente && (
                  <div className="text-[10px] font-mono text-slate-400 truncate">{ot.codigoInternoCliente}</div>
                )}
              </td>
              <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[140px] ${getAlignClass(3)}`} title={[ot.moduloModelo, ot.moduloSerie].filter(Boolean).join(' — ')}>
                {ot.moduloModelo || '—'}
                {ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}
              </td>
              <td className={`px-3 py-2 text-xs text-slate-600 truncate max-w-[140px] ${getAlignClass(4)}`} title={ot.tipoServicio}>{ot.tipoServicio || '—'}</td>
              <td className={`px-3 py-2 text-xs text-slate-500 whitespace-nowrap ${getAlignClass(5)}`}>{fmt(ot.fechaInicio || ot.fechaFin || ot.fechaServicioAprox)}</td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => onOpenPdf(ot)} className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50">
                    Reporte
                  </button>
                  {ot.protocolPdfUrl && (
                    <button onClick={() => onOpenProtocol(ot)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">
                      Protocolo
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
