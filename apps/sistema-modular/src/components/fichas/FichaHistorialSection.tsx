import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { HistorialFicha } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS } from '@ags/shared';

interface Props {
  historial: HistorialFicha[];
}

export function FichaHistorialSection({ historial }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return '-'; }
  };

  if (historial.length === 0) {
    return (
      <Card title="Historial">
        <p className="text-sm text-slate-400">Sin movimientos registrados</p>
      </Card>
    );
  }

  const sorted = [...historial].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <Card title="Historial de estados">
      <div className="space-y-3">
        {sorted.map(h => (
          <div key={h.id} className="relative pl-6 pb-3 border-l-2 border-slate-200 last:border-l-0">
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-teal-500" />
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_FICHA_COLORS[h.estadoNuevo]}`}>
                {ESTADO_FICHA_LABELS[h.estadoNuevo]}
              </span>
              <span className="text-[11px] text-slate-400">{formatDate(h.fecha)}</span>
            </div>
            <p className="text-sm text-slate-700">{h.nota}</p>
            {h.otNumber && (
              <p className="text-xs text-slate-500 mt-0.5">
                OT:{' '}
                <Link to={`/ordenes-trabajo/${h.otNumber}`} state={fromState} className="text-teal-600 hover:underline">
                  {h.otNumber}
                </Link>
              </p>
            )}
            {h.detalleOT?.ingenieroNombre && (
              <p className="text-xs text-slate-500 mt-0.5">
                Ingeniero/a: <span className="text-slate-700">{h.detalleOT.ingenieroNombre}</span>
              </p>
            )}
            {h.reporteTecnico && (
              h.reporteTecnico.length > 200 ? (
                <details className="mt-1 p-2 bg-slate-50 rounded text-xs text-slate-600 border border-slate-100">
                  <summary className="cursor-pointer select-none">
                    <span className="font-medium">Informe técnico:</span> {h.reporteTecnico.slice(0, 160)}…{' '}
                    <span className="text-teal-600">ver completo</span>
                  </summary>
                  <p className="mt-1.5 whitespace-pre-wrap">{h.reporteTecnico}</p>
                </details>
              ) : (
                <div className="mt-1 p-2 bg-slate-50 rounded text-xs text-slate-600 border border-slate-100">
                  <span className="font-medium">Informe técnico:</span> {h.reporteTecnico}
                </div>
              )
            )}
            {(h.detalleOT?.partesUsadas?.length ?? 0) > 0 && (
              <div className="mt-1 p-2 bg-slate-50 rounded text-xs text-slate-600 border border-slate-100">
                <p className="font-medium mb-0.5">Partes usadas</p>
                <ul className="space-y-0.5">
                  {h.detalleOT!.partesUsadas!.map((p, i) => (
                    <li key={i} className="flex items-baseline gap-1.5">
                      {p.codigo && <span className="font-mono text-slate-500">{p.codigo}</span>}
                      <span className="flex-1">{p.descripcion}</span>
                      <span className="text-slate-400">×{p.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
