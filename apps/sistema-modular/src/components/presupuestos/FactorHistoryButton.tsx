import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Presupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { presupuestosService } from '../../services/firebaseService';

/** Estados que implican que el presupuesto fue aprobado/aceptado por el cliente. */
const ESTADOS_APROBADO = new Set(['aceptado', 'en_ejecucion', 'finalizado']);

interface FactorRow {
  fecha: string;            // ISO
  numero: string;
  aprobado: boolean;
  codigo: string | null;
  descripcion: string;
  precioUnitario: number;
  moneda: string;
  factor: number;
}

const fmtFecha = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Aplana los items con `factor` cargado de todos los presupuestos del cliente, más recientes primero. */
function buildRows(presupuestos: Presupuesto[], limit = 20): FactorRow[] {
  const rows: FactorRow[] = [];
  for (const p of presupuestos) {
    const aprobado = ESTADOS_APROBADO.has(p.estado);
    for (const item of p.items || []) {
      if (item.factor == null) continue;
      rows.push({
        fecha: p.fechaAceptacion || p.createdAt || '',
        numero: p.numero,
        aprobado,
        codigo: item.codigoProducto || item.servicioCode || null,
        descripcion: item.descripcion,
        precioUnitario: item.precioUnitario,
        moneda: item.moneda || p.moneda || 'USD',
        factor: item.factor,
      });
    }
  }
  rows.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  return rows.slice(0, limit);
}

interface Props {
  clienteId: string | null | undefined;
  clienteNombre?: string;
  /** Estilo del botón: 'inline' (junto a un campo) o 'pill' (header). */
  variant?: 'inline' | 'pill';
}

/** Botón + ventana flotante con el historial de factores de venta usados con un cliente. */
export const FactorHistoryButton: React.FC<Props> = ({ clienteId, clienteNombre, variant = 'inline' }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [error, setError] = useState(false);
  // Posición de la burbuja flotante (arrastrable). null = cerrada / sin inicializar.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Al abrir, ubicar la burbuja arrimada al costado derecho. Al cerrar, resetear.
  useEffect(() => {
    if (open) setPos(prev => prev ?? { x: Math.max(12, window.innerWidth - 460), y: 20 });
    else setPos(null);
  }, [open]);

  // Cerrar con Escape. Escuchamos en fase de CAPTURA y frenamos la propagación para
  // que el Escape NO llegue al handler del Modal padre (que cerraría todo el presupuesto).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    // No iniciar drag si el click es sobre un botón (ej. la ×) — sino el pointer capture
    // se traga el click y no cierra.
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 60);
    const y = Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 40);
    setPos({ x, y });
  };
  const onHeaderPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  useEffect(() => {
    if (!open || !clienteId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    presupuestosService.getByCliente(clienteId)
      .then(data => { if (!cancelled) setPresupuestos(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clienteId]);

  const rows = useMemo(() => buildRows(presupuestos), [presupuestos]);

  if (!clienteId) return null;

  const btnClass = variant === 'pill'
    ? 'inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md px-2 py-1 transition-colors'
    : 'inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 hover:underline';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}
        title="Ver factores de venta usados con este cliente en presupuestos anteriores">
        📊 Factores anteriores
      </button>

      {/* Burbuja flotante NO-modal: sin overlay, arrastrable, translúcida.
          Permite seguir editando precios / agregando ítems con el historial a la vista. */}
      {open && pos && createPortal(
        <div
          className="fixed z-[95] w-[420px] max-w-[92vw] max-h-[94vh] flex flex-col rounded-xl border border-white/30 bg-white/55 backdrop-blur-md shadow-2xl ring-1 ring-black/5 overflow-hidden"
          style={{ top: pos.y, left: pos.x }}
        >
          {/* Header (arrastrable) */}
          <div
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            className="flex items-center justify-between px-4 py-2 bg-teal-700/75 text-white cursor-move select-none shrink-0"
          >
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-teal-100">⠿ Historial de factores · arrastrá · Esc cierra</p>
              <p className="text-xs font-serif truncate">{clienteNombre || 'Cliente'}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-teal-100 hover:text-white text-lg leading-none shrink-0 ml-2">&times;</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#FAFAFA]/30">
            {loading ? (
              <p className="text-center text-[11px] text-slate-400 py-8">Cargando historial...</p>
            ) : error ? (
              <p className="text-center text-[11px] text-red-500 py-8">No se pudo cargar el historial.</p>
            ) : rows.length === 0 ? (
              <p className="text-center text-[11px] text-slate-400 py-8">
                Sin factores registrados para este cliente todavía.
              </p>
            ) : (
              <table className="w-full table-fixed text-[10px]">
                <thead className="sticky top-0 bg-[#F0F0F0]/85 backdrop-blur-sm border-b border-[#E5E5E5]">
                  <tr>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wide py-1.5 px-1.5 text-left w-[66px]">Fecha</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wide py-1.5 px-1 text-left w-[70px]">N°</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wide py-1.5 px-0.5 text-center w-[32px]">Apr</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wide py-1.5 px-1.5 text-left">Artículo</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wide py-1.5 px-1 text-right w-[74px]">Valor</th>
                    <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wide py-1.5 px-1.5 text-right w-[44px]">Factor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-teal-50/40 align-top">
                      <td className="py-1 px-1.5 text-slate-500 font-mono">{fmtFecha(r.fecha)}</td>
                      <td className="py-1 px-1 text-slate-600 font-mono truncate">{r.numero || '—'}</td>
                      <td className="py-1 px-0.5 text-center">
                        {r.aprobado
                          ? <span className="inline-block text-[9px] font-medium text-emerald-700 bg-emerald-100 rounded px-1 py-px">Sí</span>
                          : <span className="inline-block text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1 py-px">No</span>}
                      </td>
                      <td className="py-1 px-1.5 text-slate-700 break-words">
                        {r.codigo && <span className="font-mono text-teal-700 mr-1">{r.codigo}</span>}
                        <span className="text-slate-600">{r.descripcion}</span>
                      </td>
                      <td className="py-1 px-1 text-right font-mono text-slate-600 whitespace-nowrap">
                        {MONEDA_SIMBOLO[r.moneda] || '$'}{r.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">×{r.factor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-1.5 bg-[#F0F0F0]/55 border-t border-[#E5E5E5] flex items-center justify-between shrink-0">
            <span className="text-[9px] font-mono text-slate-400">
              {rows.length > 0 ? `${rows.length} ítem${rows.length !== 1 ? 's' : ''} con factor (recientes)` : ''}
            </span>
            <button onClick={() => setOpen(false)} className="text-[10px] text-slate-500 hover:text-slate-700">Cerrar (Esc)</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
