import type { ViaticoPeriodo } from '@ags/shared';
import { VIATICO_ESTADO_LABELS, VIATICO_ESTADO_COLORS, MEDIO_PAGO_LABELS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { useState } from 'react';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  open: boolean;
  onClose: () => void;
  historial: ViaticoPeriodo[];
}

export default function HistorialViaticosModal({ open, onClose, historial }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Historial de viáticos">
      {historial.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No hay períodos cerrados</p>
      ) : (
        <div className="space-y-2">
          {historial.map(p => (
            <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{MESES[p.mes - 1]} {p.anio}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${VIATICO_ESTADO_COLORS[p.estado]}`}>
                    {VIATICO_ESTADO_LABELS[p.estado]}
                  </span>
                  <span className="text-[11px] text-slate-400">{p.gastos.length} gastos</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatMoney(p.total)}</p>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {expandedId === p.id && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-1.5 bg-slate-50">
                  <div className="flex gap-4 text-[11px] text-slate-500 mb-2">
                    <span>Efectivo: {formatMoney(p.totalEfectivo)}</span>
                    <span>Tarjeta: {formatMoney(p.totalTarjeta)}</span>
                  </div>
                  {p.gastos.map(g => (
                    <div key={g.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-slate-400 shrink-0 tabular-nums w-10">
                          {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span className="text-xs text-slate-700 truncate">{g.concepto}</span>
                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded shrink-0 ${
                          g.medioPago === 'efectivo' ? 'bg-green-50 text-green-600' : 'bg-violet-50 text-violet-600'
                        }`}>
                          {MEDIO_PAGO_LABELS[g.medioPago][0]}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-700 tabular-nums shrink-0 ml-2">{formatMoney(g.monto)}</span>
                    </div>
                  ))}
                  {p.confirmadoPorNombre && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 mt-2">
                      Confirmado por {p.confirmadoPorNombre}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
