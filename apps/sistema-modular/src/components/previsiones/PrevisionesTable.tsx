import type { AgendaPrevision } from '@ags/shared';
import { ESTADO_PREVISION_COLORS, ESTADO_PREVISION_LABELS } from '@ags/shared';
import { StatusBadge } from '../ui/StatusBadge';
import { formatFechaAR } from '../../utils/formatFecha';

interface Props {
  previsiones: AgendaPrevision[];
  onConvertir: (p: AgendaPrevision) => void;
  onReprogramar: (p: AgendaPrevision) => void;
  onDescartar: (p: AgendaPrevision) => void;
}

const th = 'px-3 py-2 text-left text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wider';
const td = 'px-3 py-2 text-xs text-slate-700 align-top';

/** Rango legible: un solo día → una fecha; multi-día → "dd/mm — dd/mm". */
const rango = (p: AgendaPrevision) =>
  p.fechaInicio === p.fechaFin
    ? formatFechaAR(p.fechaInicio)
    : `${formatFechaAR(p.fechaInicio)} — ${formatFechaAR(p.fechaFin)}`;

export const PrevisionesTable: React.FC<Props> = ({ previsiones, onConvertir, onReprogramar, onDescartar }) => (
  // Cabeceras fijas: el contenedor scrollea (flex-1 min-h-0 lo pone el padre) y el
  // thead queda sticky arriba.
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 min-h-0 overflow-auto">
    <table className="w-full">
      <thead className="sticky top-0 z-10 bg-slate-50">
        <tr className="border-b border-slate-200">
          <th className={th}>Fecha</th>
          <th className={th}>Cliente</th>
          <th className={th}>Tipo de servicio</th>
          <th className={th}>Equipo / Sistema</th>
          <th className={th}>Ingeniero</th>
          <th className={th}>Estado</th>
          <th className={`${th} text-center`}>Contrato</th>
          <th className={`${th} text-right`}>Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {previsiones.map(p => {
          const editable = p.estado === 'prevista' || p.estado === 'reprogramada';
          return (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className={`${td} whitespace-nowrap font-mono tabular-nums`}>{rango(p)}</td>
              <td className={td}>
                <div className="font-medium text-slate-900">{p.clienteNombre || '—'}</div>
                {p.establecimientoNombre && (
                  <div className="text-[11px] text-slate-400">{p.establecimientoNombre}</div>
                )}
              </td>
              <td className={td}>
                {p.tipoServicio}
                <div className="text-[11px] text-slate-400 font-mono">
                  desde OT-{p.origenOtNumber || 's/n'}
                </div>
              </td>
              <td className={td}>
                {p.sistemaNombre || p.equipoModelo || '—'}
                {p.equipoAgsId && <div className="text-[11px] text-slate-400 font-mono">{p.equipoAgsId}</div>}
              </td>
              <td className={td}>{p.ingenieroNombre || <span className="text-slate-400">Sin asignar</span>}</td>
              <td className={td}>
                <StatusBadge label={ESTADO_PREVISION_LABELS[p.estado]} colorClass={ESTADO_PREVISION_COLORS[p.estado]} />
                {p.estado === 'convertida' && p.otNumberGenerada && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">OT-{p.otNumberGenerada}</div>
                )}
              </td>
              <td className={`${td} text-center`}>
                {p.tieneContrato
                  ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">Sí</span>
                  : <span className="text-slate-400">No</span>}
              </td>
              <td className={`${td} text-right whitespace-nowrap space-x-2`}>
                {editable ? (
                  <>
                    <button className="text-teal-600 hover:underline" onClick={() => onConvertir(p)}>Convertir en OT</button>
                    <button className="text-slate-500 hover:underline" onClick={() => onReprogramar(p)}>Reprogramar</button>
                    <button className="text-red-500 hover:underline" onClick={() => onDescartar(p)}>Descartar</button>
                  </>
                ) : (
                  <span className="text-slate-300 text-[11px]">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
