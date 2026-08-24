import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { ExtraccionLoaner } from '@ags/shared';
import { useDestinoExtracciones, type DestinoPieza } from '../../hooks/useDestinoExtracciones';

interface Props {
  extracciones: ExtraccionLoaner[];
  /** Reponer la pieza: el loaner deja de figurar incompleto (2026-08-20). */
  onReponer?: (extraccionId: string) => Promise<void>;
}

/**
 * Dónde terminó la pieza. La OT que aparece acá es la del CONSUMO, que no tiene
 * por qué ser la de la extracción: una OT saca la pieza y otra la usa.
 */
function DestinoLinea({ destino, fromState }: { destino?: DestinoPieza; fromState: object }) {
  if (!destino) return null;
  const fmt = (iso: string) => { try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return ''; } };

  if (destino.estado === 'consumida') {
    return (
      <p className="text-xs text-slate-500 mt-1">
        <span className="text-emerald-600">→ Consumida</span>
        {destino.otNumber && (
          <> en <Link to={`/ordenes-trabajo/${destino.otNumber}`} state={fromState}
            className="text-teal-600 hover:underline">OT {destino.otNumber}</Link></>
        )}
        {destino.fecha && ` el ${fmt(destino.fecha)}`}
      </p>
    );
  }
  if (destino.estado === 'en_stock') {
    // "En stock — R4 — RESERVA" se leía como "está reservada", cuando RESERVA es
    // el nombre del estante. La frase deja claro que todavía no se consumió y
    // que lo que sigue es DÓNDE está (2026-08-24).
    return (
      <p className="text-xs text-slate-500 mt-1">
        <span className="text-slate-600">→ Sin consumir</span>
        {' · '}en {destino.ubicacion}
        {destino.cantidad > 1 && ` (${destino.cantidad} u.)`}
        {destino.reservadaPara && (
          <span className="text-amber-700"> · reservada para {destino.reservadaPara}</span>
        )}
      </p>
    );
  }
  if (destino.estado === 'baja') {
    return <p className="text-xs text-slate-400 mt-1">→ La unidad ya no está en inventario</p>;
  }
  return null;
}

export function LoanerExtraccionesSection({ extracciones, onReponer }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  // Se descubre recorriendo unidad → consumo; no se declara al extraer.
  const destinos = useDestinoExtracciones(extracciones);
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
              {!e.unidadId && <span className="text-slate-400">Sin ingreso a stock</span>}
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
            {e.unidadId && <DestinoLinea destino={destinos.get(e.unidadId)} fromState={fromState} />}
          </div>
        ))}
      </div>
    </Card>
  );
}
