import React, { useEffect, useState } from 'react';
import { getReservasStockParaPresupuestos, type ReservaStockOT } from '../services/reservasStock';

interface Props {
  /** Números de presupuesto de la OT (los mismos de la sección Facturación). */
  budgets: string[];
}

/**
 * "Reservado en stock" para esta OT (2026-09-09): lo que el back-office apartó
 * para el servicio, visible en el paso Datos del servicio, al lado de la
 * configuración y los datos técnicos. Solo lectura, no entra al PDF.
 */
export const ReservasStockCard: React.FC<Props> = ({ budgets }) => {
  const [reservas, setReservas] = useState<ReservaStockOT[]>([]);
  const key = budgets.filter(b => b.trim()).join('|');

  useEffect(() => {
    let alive = true;
    if (!key) { setReservas([]); return; }
    getReservasStockParaPresupuestos(key.split('|'))
      .then(r => { if (alive) setReservas(r); })
      .catch(err => console.warn('[ReservasStockCard] no se pudieron leer las reservas:', err));
    return () => { alive = false; };
  }, [key]);

  if (reservas.length === 0) return null;
  return (
    <div className="border border-teal-200 bg-teal-50 rounded-xl p-3">
      <h3 className="text-[10px] font-black text-teal-700 uppercase tracking-[0.2em] mb-1.5">
        Reservado en stock para esta OT
      </h3>
      <ul className="space-y-1">
        {reservas.map((r, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-800">
            <span className="font-mono text-[11px] font-bold text-teal-900 bg-white border border-teal-200 rounded px-1.5 py-px shrink-0">{r.cantidad}×</span>
            <span className="flex-1 min-w-0">
              {r.codigo && <span className="font-mono text-[11px] text-slate-500 mr-1.5">{r.codigo}</span>}
              {r.descripcion}
              {(r.nroSerie || r.nroLote) && (
                <span className="text-[11px] text-slate-500"> · {r.nroSerie ? `S/N ${r.nroSerie}` : `Lote ${r.nroLote}`}</span>
              )}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">Ppto {r.presupuestoNumero}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-teal-800/70 mt-1.5">Retirar de la posición RESERVAS antes de salir. No aparece en el PDF.</p>
    </div>
  );
};
