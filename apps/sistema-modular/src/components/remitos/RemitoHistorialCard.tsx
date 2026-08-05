import { useEffect, useState } from 'react';
import type { MovimientoStock } from '@ags/shared';
import { Card } from '../ui/Card';
import { movimientosService } from '../../services/stockService';

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso', egreso: 'Salida', transferencia: 'Transferencia',
  devolucion: 'Devolución', consumo: 'Consumo', ajuste: 'Ajuste',
};
const TIPO_CLS: Record<string, string> = {
  egreso: 'bg-amber-100 text-amber-700',
  transferencia: 'bg-blue-100 text-blue-700',
  devolucion: 'bg-green-100 text-green-700',
  consumo: 'bg-orange-100 text-orange-700',
  ingreso: 'bg-teal-100 text-teal-700',
  ajuste: 'bg-slate-100 text-slate-600',
};

const fmtFechaHora = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Historial del remito (2026-08-04): todos los movimientos de stock asentados
 * contra este remito — salida al confirmar, devoluciones, consumos. Es el
 * rastro real del kardex, no un log aparte.
 */
export function RemitoHistorialCard({ remitoId }: { remitoId: string }) {
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    movimientosService.getAll({ remitoId })
      .then(list => { if (!cancelled) setMovs(list); })
      .catch(err => console.error('[RemitoHistorialCard] load:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [remitoId]);

  return (
    <Card compact title={`Historial (${movs.length})`}>
      {loading ? (
        <p className="text-xs text-slate-400 py-2">Cargando movimientos…</p>
      ) : movs.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">Sin movimientos de stock registrados para este remito.</p>
      ) : (
        <ul className="space-y-1.5">
          {movs.map(m => (
            <li key={m.id} className="text-[11px] text-slate-600 flex items-start gap-1.5">
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${TIPO_CLS[m.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                {TIPO_LABEL[m.tipo] ?? m.tipo}
              </span>
              <span className="min-w-0">
                <span className="font-mono text-slate-700">{m.articuloCodigo || '—'}</span>
                {' ×'}{m.cantidad}
                <span className="text-slate-400"> · {m.origenNombre} → {m.destinoNombre}</span>
                {m.otNumber && <span className="text-teal-700"> · OT-{m.otNumber}</span>}
                <span className="block text-[10px] text-slate-400">
                  {fmtFechaHora(m.createdAt)}{m.creadoPor ? ` · ${m.creadoPor}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
