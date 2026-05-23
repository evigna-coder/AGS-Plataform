import { useMisReportesPendientes } from '../hooks/useMisReportesPendientes';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { REPORTES_OT_URL } from '../utils/constants';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

function abrirEnReportesOt(otNumber: string) {
  window.open(`${REPORTES_OT_URL}?reportId=${encodeURIComponent(otNumber)}`, '_blank');
}

export default function MisReportesPendientesPage() {
  const { borradores, loading, error, viendoTodos } = useMisReportesPendientes();

  const title = viendoTodos ? 'Pendientes del Equipo' : 'Mis Pendientes';
  const subtitle = loading
    ? '...'
    : `${borradores.length} ${borradores.length === 1 ? 'reporte sin finalizar' : 'reportes sin finalizar'}${
        viendoTodos ? ' · vista admin' : ''
      }`;
  const emptyMsg = viendoTodos
    ? 'No hay reportes pendientes en el equipo'
    : 'No tenés reportes pendientes de finalizar';

  return (
    <div className="h-full flex flex-col">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState message={`Error al cargar borradores: ${error}`} />
        ) : borradores.length === 0 ? (
          <EmptyState message={emptyMsg} />
        ) : (
          <>
            {/* Tabla en >=md */}
            <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left">
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">OT</th>
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Sistema</th>
                    {viendoTodos && (
                      <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Ingeniero</th>
                    )}
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Creado</th>
                    <th className="px-3 py-2 w-px"></th>
                  </tr>
                </thead>
                <tbody>
                  {borradores.map((b) => (
                    <tr
                      key={b.otNumber}
                      onClick={() => abrirEnReportesOt(b.otNumber)}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">{b.otNumber}</td>
                      <td className="px-3 py-2 text-slate-800">{b.razonSocial || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{b.sistema || '—'}</td>
                      {viendoTodos && (
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {b.creadoPorNombre || b.creadoPorEmail || '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">{fmtDate(b.creadoFecha)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs font-medium text-teal-700 whitespace-nowrap">Abrir →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card-per-row en mobile */}
            <div className="md:hidden space-y-2">
              {borradores.map((b) => (
                <button
                  key={b.otNumber}
                  onClick={() => abrirEnReportesOt(b.otNumber)}
                  className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 hover:border-teal-400 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-900">{b.otNumber}</span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">{fmtDate(b.creadoFecha)}</span>
                  </div>
                  <p className="text-sm text-slate-800 truncate">{b.razonSocial || '—'}</p>
                  <p className="text-xs text-slate-500 truncate">{b.sistema || '—'}</p>
                  {viendoTodos && (
                    <p className="text-[11px] text-slate-400 truncate mt-1">
                      {b.creadoPorNombre || b.creadoPorEmail || '—'}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
