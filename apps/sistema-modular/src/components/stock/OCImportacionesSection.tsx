import { Link } from 'react-router-dom';
import type { Importacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';

interface Props {
  importaciones: Importacion[];
}

export const OCImportacionesSection = ({ importaciones }: Props) => {
  if (importaciones.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Importaciones vinculadas</h3>
        <p className="text-xs text-slate-400">Sin importaciones</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Importaciones vinculadas</h3>
      <div className="divide-y divide-slate-100">
        {importaciones.map(imp => (
          <div key={imp.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">{imp.numero}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[imp.estado]}`}>
                {ESTADO_IMPORTACION_LABELS[imp.estado]}
              </span>
            </div>
            <Link
              to={`/stock/importaciones/${imp.id}`}
              className="text-[11px] text-teal-600 hover:text-teal-800 font-medium"
            >
              Ver
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
