import { Link } from 'react-router-dom';
import { OT_ESTADO_LABELS } from '@ags/shared';
import type { MisOTListItem } from '../../hooks/useMisOTList';

/**
 * Card de OT en "Mis OT" (mockup mix A+B): franja horaria grande mono,
 * número de OT, tipo de servicio en serif, cliente, chip de estado y
 * ⚠ si el equipo tiene tareas pendientes. Con showEngineer (vista admin
 * "todas las OT") muestra además el ingeniero asignado.
 */
export default function MisOTCard({ item, isToday, showEngineer }: { item: MisOTListItem; isToday: boolean; showEngineer?: boolean }) {
  const { ot, franja, pendientesCount } = item;
  const estadoLabel = ot.estadoAdmin ? OT_ESTADO_LABELS[ot.estadoAdmin] : 'Borrador';
  const fechaDia = ot.fechaServicioAprox
    ? new Date(ot.fechaServicioAprox + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    : null;

  return (
    <Link
      to={`/ordenes-trabajo/${ot.otNumber}`}
      className="flex items-stretch gap-3.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 md:py-2.5 min-h-[44px] hover:border-teal-600 hover:shadow-[0_0_0_3px_#E6F2F1] transition-shadow"
    >
      <div className="shrink-0 w-[62px] pt-0.5">
        <span className="font-mono text-[19px] font-semibold text-teal-900 leading-none">
          {franja ?? fechaDia ?? '—'}
        </span>
        {isToday && (
          <span className="block font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">Hoy</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[11px] font-semibold text-teal-900 tracking-wide">OT {ot.otNumber}</span>
        <p className="font-serif text-lg md:text-base font-medium leading-tight mt-0.5 text-slate-900">
          {ot.tipoServicio || 'Servicio'}
        </p>
        <p className="text-[12.5px] text-slate-500 mt-1 truncate">
          {[ot.razonSocial, ot.sistema].filter(Boolean).join(' — ') || '—'}
        </p>
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-700/25">
            {estadoLabel}
          </span>
          {showEngineer && (
            <span className="inline-block text-[10px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {ot.ingenieroAsignadoNombre || 'Sin asignar'}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end justify-between gap-2">
        {pendientesCount > 0 ? (
          <span
            className="text-[15px] leading-snug text-amber-700 bg-amber-100 border border-amber-700/25 rounded-lg px-2 py-0.5"
            title={`${pendientesCount} tarea(s) pendiente(s) del equipo`}
          >
            ⚠
          </span>
        ) : <span />}
        <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </div>
    </Link>
  );
}
