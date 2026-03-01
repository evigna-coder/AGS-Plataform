import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { ExtraccionLoaner } from '@ags/shared';

interface Props {
  extracciones: ExtraccionLoaner[];
}

export function LoanerExtraccionesSection({ extracciones }: Props) {
  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

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
          <div key={e.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-700">{e.descripcion}</p>
                {e.codigoArticulo && <p className="text-xs text-slate-500">Part: {e.codigoArticulo}</p>}
              </div>
              <span className="text-xs text-slate-400">{formatDate(e.fecha)}</span>
            </div>
            <div className="flex gap-3 mt-1 text-xs text-slate-400">
              <span>Destino: {e.destino}</span>
              {e.otNumber && (
                <Link to={`/ordenes-trabajo/${e.otNumber}`} className="text-indigo-600 hover:underline">OT {e.otNumber}</Link>
              )}
              <span>Por: {e.extraidoPor}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
