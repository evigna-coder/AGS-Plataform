import type { CalificacionProveedor, EstadoCalificacion } from '@ags/shared';
import { ORIGEN_CALIFICACION_LABELS, ORIGEN_CALIFICACION_COLORS } from '@ags/shared';
import { detalleCalificacion, rolCalificacion } from '../../utils/calificaciones';
import type { CicloTab } from './CalificacionesTable';

export const ESTADO_COLORS: Record<string, string> = {
  aprobado: 'bg-emerald-100 text-emerald-700',
  condicional: 'bg-amber-100 text-amber-700',
  no_aprobado: 'bg-red-100 text-red-700',
  sin_datos: 'bg-slate-100 text-slate-500',
};
export const ESTADO_LABELS: Record<string, string> = {
  aprobado: 'Aprobado', condicional: 'Condicional', no_aprobado: 'No aprobado', sin_datos: 'Sin datos',
};

const diasDesde = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

interface Props {
  c: CalificacionProveedor;
  tab: CicloTab;
  prom?: { promedio: number; count: number; estado: EstadoCalificacion };
  /** Fila miembro de un grupo de embarque: fecha/detalle van en el encabezado del grupo. */
  enGrupo?: boolean;
  onCalificar: (c: CalificacionProveedor) => void;
  onOmitir: (c: CalificacionProveedor) => void;
  onEditar: (c: CalificacionProveedor) => void;
  onEliminar: (id: string) => void;
}

/** Una fila del listado de calificaciones — columnas según la pestaña de ciclo. */
export function CalificacionRow({ c, tab, prom, enGrupo, onCalificar, onOmitir, onEditar, onEliminar }: Props) {
  const esPend = tab === 'pendiente';
  const esOmit = tab === 'omitida';
  const conPuntaje = tab === 'calificada' || tab === '';
  const ciclo = c.estadoCiclo ?? 'calificada';
  const origen = c.origen ?? 'manual';
  const detalle = detalleCalificacion(c);
  const antiguedad = diasDesde(c.fechaEvento ?? c.fechaRecepcion);

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-3 py-2 text-slate-600 font-mono text-xs whitespace-nowrap">{enGrupo ? '' : c.fechaRecepcion}</td>
      <td className="px-3 py-2 text-xs font-semibold text-teal-700 truncate max-w-[180px]">
        {enGrupo && <span className="text-slate-300 font-normal mr-1.5">└</span>}
        {c.proveedorNombre}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {enGrupo ? (
          <span className="text-[10px] text-slate-500">{rolCalificacion(c) ?? ORIGEN_CALIFICACION_LABELS[origen]}</span>
        ) : (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ORIGEN_CALIFICACION_COLORS[origen]}`}>
            {ORIGEN_CALIFICACION_LABELS[origen]}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[240px]" title={detalle}>
        {enGrupo ? '' : (detalle || <span className="text-slate-300">—</span>)}
      </td>
      {esPend && (
        <td className="px-3 py-2 text-center whitespace-nowrap">
          {antiguedad != null ? (
            <span className={`font-mono text-xs ${antiguedad > 7 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{antiguedad} d</span>
          ) : <span className="text-slate-300 text-xs">—</span>}
        </td>
      )}
      {esOmit && <td className="px-3 py-2 text-[10px] text-slate-400 truncate max-w-[200px] italic" title={c.omitidaMotivo ?? ''}>{c.omitidaMotivo || '—'}</td>}
      {tab === '' && (
        <td className="px-3 py-2 whitespace-nowrap">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ciclo === 'pendiente' ? 'bg-amber-100 text-amber-700' : ciclo === 'omitida' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
            {ciclo === 'pendiente' ? 'Pendiente' : ciclo === 'omitida' ? 'Omitida' : 'Calificada'}
          </span>
        </td>
      )}
      {conPuntaje && (
        <>
          <td className="px-3 py-2 text-center font-mono font-bold text-xs">{typeof c.puntajeTotal === 'number' ? c.puntajeTotal : <span className="text-slate-300 font-normal">—</span>}</td>
          <td className="px-3 py-2 text-center whitespace-nowrap">
            {prom && prom.count > 0 ? (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[prom.estado]}`}>{prom.promedio} ({prom.count})</span>
            ) : <span className="text-slate-300 text-xs">—</span>}
          </td>
          <td className="px-3 py-2 whitespace-nowrap">
            {c.estado ? (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[c.estado]}`}>{ESTADO_LABELS[c.estado]}</span>
            ) : <span className="text-slate-300 text-xs">—</span>}
          </td>
        </>
      )}
      {!esPend && <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[100px] whitespace-nowrap">{c.responsable || '—'}</td>}
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          {ciclo === 'pendiente' ? (
            <>
              <button onClick={() => onCalificar(c)}
                className="text-[10px] font-medium text-teal-700 hover:text-teal-900 px-1.5 py-0.5 rounded hover:bg-teal-50">Calificar</button>
              <button onClick={() => onOmitir(c)}
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">Omitir…</button>
            </>
          ) : ciclo === 'calificada' ? (
            <>
              <button onClick={() => onEditar(c)}
                className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">Editar</button>
              <button onClick={() => onEliminar(c.id)}
                className="text-[10px] font-medium text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50">×</button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
