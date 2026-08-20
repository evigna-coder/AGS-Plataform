import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { ExtraccionLoaner } from '@ags/shared';

interface Props {
  extracciones: ExtraccionLoaner[];
  /** Reponer la pieza: el loaner deja de figurar incompleto (2026-08-20). */
  onReponer?: (extraccionId: string) => Promise<void>;
}

export function LoanerExtraccionesSection({ extracciones, onReponer }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };
  /** Extracción que hoy deja al loaner incompleto. */
  const falta = (e: ExtraccionLoaner) => e.dejaInoperativo === true && !e.fechaReposicion;

  if (extracciones.length === 0) {
    return (
      <Card title="Extracciones de piezas">
        <p className="text-sm text-slate-400">Sin extracciones registradas</p>
      </Card>
    );
  }

  return (
    <Card title="Extracciones de piezas">
      <div className="space-y-2">
        {extracciones.map(e => (
          <div key={e.id} className={`p-3 rounded-lg border ${falta(e) ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-sm text-slate-700">{e.descripcion}</p>
                {e.codigoArticulo && <p className="text-xs text-slate-500">Part: {e.codigoArticulo}</p>}
              </div>
              <span className="text-xs text-slate-400 shrink-0">{formatDate(e.fecha)}</span>
            </div>
            <div className="flex gap-3 mt-1 text-xs text-slate-400 flex-wrap items-center">
              <span>Destino: {e.destino}</span>
              {e.otNumber && (
                <Link to={`/ordenes-trabajo/${e.otNumber}`} state={fromState} className="text-teal-600 hover:underline">OT {e.otNumber}</Link>
              )}
              <span>Por: {e.extraidoPor}</span>
              {falta(e) && <span className="text-amber-700 font-medium">Falta reponer</span>}
              {e.fechaReposicion && <span className="text-emerald-600">Repuesta {formatDate(e.fechaReposicion)}</span>}
              {falta(e) && onReponer && (
                <button
                  onClick={() => void onReponer(e.id)}
                  className="text-teal-600 hover:text-teal-800 hover:underline font-medium"
                >
                  Reponer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
