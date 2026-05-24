import { useNavigate } from 'react-router-dom';
import { useMisReportesPendientes } from '../hooks/useMisReportesPendientes';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

function TipoBadge({ tipo }: { tipo: 'borrador' | 'sin_empezar' }) {
  if (tipo === 'borrador') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-100 text-amber-800">
        Borrador
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
      Sin empezar
    </span>
  );
}

export default function MisReportesPendientesPage() {
  const navigate = useNavigate();
  const { borradores, loading, error, viendoTodos } = useMisReportesPendientes();

  // Navega dentro del shell del portal — ReportesPage monta reportes-ot en un
  // iframe pasando el reportId. Mantiene la bottom nav / sidebar visibles.
  const abrirBorrador = (otNumber: string) => {
    navigate(`/reportes?reportId=${encodeURIComponent(otNumber)}`);
  };

  const title = viendoTodos ? 'Pendientes del Equipo' : 'Mis Pendientes';
  const sinEmpezarCount = borradores.filter(b => b.tipo === 'sin_empezar').length;
  const empezadosCount = borradores.length - sinEmpezarCount;
  const subtitle = loading
    ? '...'
    : borradores.length === 0
      ? '0 pendientes'
      : `${empezadosCount} en borrador · ${sinEmpezarCount} sin empezar${viendoTodos ? ' · vista admin' : ''}`;
  const emptyMsg = viendoTodos
    ? 'No hay reportes pendientes en el equipo'
    : 'No tenés reportes pendientes';

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
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Sistema</th>
                    {viendoTodos && (
                      <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Ingeniero</th>
                    )}
                    <th className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {borradores.map((b) => (
                    <tr
                      key={b.otNumber}
                      onClick={() => abrirBorrador(b.otNumber)}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">{b.otNumber}</td>
                      <td className="px-3 py-2">
                        <TipoBadge tipo={b.tipo} />
                      </td>
                      <td className="px-3 py-2 text-slate-800">{b.razonSocial || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{b.sistema || '—'}</td>
                      {viendoTodos && (
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {b.tipo === 'borrador'
                            ? (b.creadoPorNombre || b.creadoPorEmail || '—')
                            : (b.ingenieroAsignadoNombre || '—')}
                        </td>
                      )}
                      <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">{fmtDate(b.creadoFecha)}</td>
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
                  onClick={() => abrirBorrador(b.otNumber)}
                  className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 hover:border-teal-400 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-900">{b.otNumber}</span>
                    <TipoBadge tipo={b.tipo} />
                  </div>
                  <p className="text-sm text-slate-800 truncate">{b.razonSocial || '—'}</p>
                  <p className="text-xs text-slate-500 truncate">{b.sistema || '—'}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    {viendoTodos && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {b.tipo === 'borrador'
                          ? (b.creadoPorNombre || b.creadoPorEmail || '—')
                          : (b.ingenieroAsignadoNombre || '—')}
                      </p>
                    )}
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums ml-auto">{fmtDate(b.creadoFecha)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
