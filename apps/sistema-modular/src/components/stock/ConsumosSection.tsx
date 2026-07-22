import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsumos, ORIGEN_CONSUMO_LABELS, ORIGEN_CONSUMO_COLORS } from '../../hooks/useConsumos';
import { Card } from '../ui/Card';

/** Máximo de filas embebidas — el resto se ve en la página Consumos por equipo. */
const LIMIT = 30;

interface ConsumosSectionProps {
  /** El scope define qué consumos se muestran (se combinan con AND si viene más de uno). */
  clienteId?: string;
  establecimientoId?: string;
  sistemaId?: string;
  titulo?: string;
}

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * Sección embebible de histórico de consumos para los detalles de Cliente,
 * Establecimiento y Equipo. Carga LAZY (pedido explícito del dueño): renderiza
 * colapsada y NO dispara ninguna consulta hasta que el usuario la expande por
 * primera vez (latch `everExpanded` → habilita useConsumos una única vez).
 */
export const ConsumosSection = ({ clienteId, establecimientoId, sistemaId, titulo = 'Consumos' }: ConsumosSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const [everExpanded, setEverExpanded] = useState(false);
  const { rows, loading } = useConsumos({ enabled: everExpanded });

  const toggle = () => {
    setExpanded(e => !e);
    if (!everExpanded) setEverExpanded(true);
  };

  const scoped = useMemo(() => rows.filter(r =>
    (!clienteId || r.clienteId === clienteId) &&
    (!establecimientoId || r.establecimientoId === establecimientoId) &&
    (!sistemaId || r.sistemaId === sistemaId)
  ), [rows, clienteId, establecimientoId, sistemaId]);

  const visible = scoped.slice(0, LIMIT);
  // En el detalle del equipo la columna Equipo es redundante.
  const showEquipo = !sistemaId;

  const linkParams = sistemaId
    ? `equipoId=${encodeURIComponent(sistemaId)}`
    : establecimientoId
      ? `establecimientoId=${encodeURIComponent(establecimientoId)}`
      : clienteId
        ? `clienteId=${encodeURIComponent(clienteId)}`
        : '';
  const linkTo = `/stock/consumos${linkParams ? `?${linkParams}` : ''}`;

  const th = 'px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap';
  const td = 'px-3 py-2 text-xs';

  return (
    <Card compact>
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between group">
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase group-hover:text-slate-700">
          {titulo}{everExpanded && !loading ? ` (${scoped.length})` : ''}
        </h3>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3">
          {loading ? (
            <p className="text-xs text-slate-400 py-3 text-center">Cargando consumos...</p>
          ) : scoped.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Sin consumos registrados.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className={th}>Fecha</th>
                    <th className={th}>OT</th>
                    {showEquipo && <th className={th}>Equipo</th>}
                    <th className={th}>Artículo</th>
                    <th className={`${th} text-right`}>Cant.</th>
                    <th className={th}>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                      <td className={`${td} text-slate-600 whitespace-nowrap`}>{fmtFecha(r.fecha)}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {r.otNumber ? (
                          <Link to={`/ordenes-trabajo?busqueda=${r.otNumber}&estadoAdmin=`}
                            className="font-mono font-semibold text-teal-600 hover:text-teal-800 hover:underline">
                            {r.otNumber}
                          </Link>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      {showEquipo && (
                        <td className={`${td} text-slate-600 truncate max-w-[140px]`}>
                          {r.sistemaNombre || <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                      )}
                      <td className={td}>
                        <span className="font-mono font-semibold text-teal-800 whitespace-nowrap">{r.articuloCodigo || '—'}</span>
                        {r.articuloDescripcion && <span className="block text-[10px] text-slate-400 max-w-[220px] truncate">{r.articuloDescripcion}</span>}
                      </td>
                      <td className={`${td} text-right tabular-nums text-slate-700 whitespace-nowrap`}>{r.cantidad}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ORIGEN_CONSUMO_COLORS[r.origen]}`}>
                          {ORIGEN_CONSUMO_LABELS[r.origen]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            {scoped.length > LIMIT ? (
              <p className="text-[10px] text-slate-400">
                Mostrando los últimos {LIMIT} de {scoped.length} — ver todos en Consumos.
              </p>
            ) : <span />}
            <Link to={linkTo} className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline">
              Ver en Consumos por equipo →
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
};
