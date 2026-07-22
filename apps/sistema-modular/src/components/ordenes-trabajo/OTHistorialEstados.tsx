import { OT_ESTADO_LABELS } from '@ags/shared';
import type { OTEstadoHistorial } from '@ags/shared';

interface Props {
  historial?: OTEstadoHistorial[];
}

/** Historial de estados de la OT — compartido entre el layout normal del
 *  EditOTModal y la pestaña "Datos de la OT" del modo cierre. */
export const OTHistorialEstados: React.FC<Props> = ({ historial }) => {
  if (!historial || historial.length === 0) return null;
  return (
    <div className="border-t border-slate-100 pt-2">
      <p className="text-[11px] font-medium text-slate-400 mb-1">Historial de estados</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {historial.map((hist, i) => (
          <div key={i} className="text-[10px]">
            <span className="text-slate-600 font-medium">{OT_ESTADO_LABELS[hist.estado] ?? hist.estado}</span>
            <span className="text-slate-400 ml-1">{hist.fecha ? new Date(hist.fecha).toLocaleDateString('es-AR') : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
