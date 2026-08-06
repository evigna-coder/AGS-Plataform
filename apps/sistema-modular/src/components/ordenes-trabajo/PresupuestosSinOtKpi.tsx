import { useEffect, useRef, useState } from 'react';
import type { Presupuesto, WorkOrder } from '@ags/shared';
import { clientesService, presupuestosService } from '../../services/firebaseService';
import { otsDelPresupuesto } from '../../hooks/useControlSemanal';
import { useTabs } from '../../contexts/TabsContext';

interface Row {
  id: string;
  numero: string;
  clienteNombre: string;
}

/** Estados "con trabajo" — mismo criterio que el control semanal. */
const ESTADOS_CON_TRABAJO = new Set<Presupuesto['estado']>(
  ['pendiente_oc', 'aceptado', 'en_ejecucion', 'pendiente_facturacion']);

/**
 * KPI para la coordinadora (2026-08-05, en la lista de OTs): presupuestos
 * aceptados SIN ninguna OT abierta — el mismo indicador de la sección 2 del
 * control semanal. Click despliega la lista en un popover; click en un ppto
 * lo abre.
 */
export function PresupuestosSinOtKpi({ ots }: { ots: WorkOrder[] }) {
  const { navigateInActiveTab } = useTabs();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Recalcula con las OTs VIVAS del listado (2026-08-06): antes cargaba sus
  // propias OTs una sola vez al montar — con las pestañas persistentes el tab
  // nunca se desmonta y el contador quedaba congelado ("abrí 2 OTs y el ppto
  // sigue figurando sin OT", P1-005046-01). Pptos/clientes van por el cache de
  // servicios (TTL 2 min), refrescados en cada cambio de OTs.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      presupuestosService.getAll(),
      clientesService.getAll(),
    ]).then(([pptos, clientes]: [Presupuesto[], { id: string; razonSocial: string }[]]) => {
      if (cancelled) return;
      const nombreCliente = new Map(clientes.map(c => [c.id, c.razonSocial]));
      setRows(pptos
        .filter(p => p.tipo !== 'contrato' && ESTADOS_CON_TRABAJO.has(p.estado))
        .filter(p => otsDelPresupuesto(p, ots).size === 0)
        .map(p => ({ id: p.id, numero: p.numero, clienteNombre: nombreCliente.get(p.clienteId) ?? '—' }))
        .sort((a, b) => a.numero.localeCompare(b.numero)));
    }).catch(err => console.error('[PresupuestosSinOtKpi] load:', err));
    return () => { cancelled = true; };
  }, [ots]);

  // Cerrar el popover al clickear afuera.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (rows.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`bg-white border rounded-lg px-3 py-1.5 min-w-[80px] text-left transition-colors ${
          open ? 'border-orange-400 ring-1 ring-orange-300' : 'border-orange-200 hover:border-orange-400'
        }`}
        title="Presupuestos aceptados sin ninguna OT abierta — crear OT o entregar partes"
      >
        <p className="text-[10px] text-orange-600 font-medium">Pptos sin OT</p>
        <p className="text-sm font-semibold text-orange-600">{rows.length}</p>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {rows.map(r => (
            <button
              key={r.id}
              onClick={() => navigateInActiveTab(`/presupuestos/${r.id}`)}
              className="w-full text-left px-3 py-1.5 hover:bg-orange-50/60 border-b border-slate-50 last:border-0"
              title="Abrir el presupuesto"
            >
              <span className="text-[11px] font-semibold text-teal-700">{r.numero}</span>
              <span className="block text-[10px] text-slate-500 truncate">{r.clienteNombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
