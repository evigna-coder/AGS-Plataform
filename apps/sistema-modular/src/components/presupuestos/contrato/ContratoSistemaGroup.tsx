import React, { useState, useMemo } from 'react';
import type { PresupuestoItem } from '@ags/shared';
import { ContratoItemRow } from './ContratoItemRow';
import type { SistemaBucket } from './contratoItemHelpers';

interface Props {
  bucket: SistemaBucket;
  isMixta: boolean;
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveSistema: (sistemaId: string | null, grupo: number) => void;
  onAddItem: (grupo: number, esSinCargo: boolean) => void;
}

/**
 * Renders one sistema within a contrato presupuesto: collapsible card with
 * header (sistema info), items table, and per-sistema subtotal.
 */
export const ContratoSistemaGroup: React.FC<Props> = ({
  bucket, isMixta, onUpdateItem, onRemoveItem, onRemoveSistema, onAddItem,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Per-currency subtotal for this sistema
  const subtotalsByCurrency = useMemo(() => {
    const m: Record<string, number> = {};
    for (const item of bucket.items) {
      if (item.esSinCargo) continue;
      const cur = item.moneda || 'USD';
      m[cur] = (m[cur] || 0) + (item.subtotal || 0);
    }
    return m;
  }, [bucket.items]);

  const priceableCount = bucket.items.filter(i => !i.esSinCargo).length;
  const slCount = bucket.items.filter(i => i.esSinCargo).length;

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-3">
      {/* Sistema header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-teal-50 to-transparent border-b border-slate-200">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2 flex-1 text-left">
          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <div>
            <div className="text-xs font-semibold text-slate-800">
              <span className="text-teal-700 font-mono mr-1">{bucket.grupo}.</span>
              {bucket.sistemaNombre}
              {bucket.sistemaCodigoInterno && (
                <span className="ml-2 text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {bucket.sistemaCodigoInterno}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {priceableCount} servicio{priceableCount !== 1 ? 's' : ''} · {slCount} S/L
            </div>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            {Object.entries(subtotalsByCurrency).map(([cur, tot]) => (
              <div key={cur} className="text-[11px] font-semibold text-teal-700">
                {cur} {fmt(tot)}
              </div>
            ))}
            {Object.keys(subtotalsByCurrency).length === 0 && (
              <div className="text-[10px] text-slate-400 italic">sin precios</div>
            )}
          </div>
          <button onClick={() => onRemoveSistema(bucket.sistemaId, bucket.grupo)}
            className="text-red-400 hover:text-red-600 text-sm px-1" title="Quitar sistema completo">×</button>
        </div>
      </div>

      {/* Add item toolbar (only when expanded) */}
      {!collapsed && (
        <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50/30">
          <button
            type="button"
            onClick={() => onAddItem(bucket.grupo, true)}
            className="text-[10px] text-slate-500 hover:text-teal-700 font-mono uppercase tracking-wide"
            title="Agregar componente sin cargo (S/L)"
          >
            + Componente S/L
          </button>
          <span className="text-[10px] text-slate-300">·</span>
          <button
            type="button"
            onClick={() => onAddItem(bucket.grupo, false)}
            className="text-[10px] text-teal-700 hover:text-teal-900 font-mono uppercase tracking-wide font-semibold"
            title="Agregar servicio con precio"
          >
            + Servicio
          </button>
        </div>
      )}

      {/* Items table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-2 py-1 text-left text-[9px] font-mono uppercase tracking-wider text-slate-400 w-14">#</th>
                <th className="px-2 py-1 text-left text-[9px] font-mono uppercase tracking-wider text-slate-400 w-32">Código / Servicio</th>
                <th className="px-2 py-1 text-left text-[9px] font-mono uppercase tracking-wider text-slate-400">Descripción</th>
                <th className="px-2 py-1 text-right text-[9px] font-mono uppercase tracking-wider text-slate-400 w-14">Cant.</th>
                {isMixta && <th className="px-2 py-1 text-left text-[9px] font-mono uppercase tracking-wider text-slate-400 w-14">Mon.</th>}
                <th className="px-2 py-1 text-right text-[9px] font-mono uppercase tracking-wider text-slate-400 w-24">Precio</th>
                <th className="px-2 py-1 text-right text-[9px] font-mono uppercase tracking-wider text-slate-400 w-24">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {bucket.items.map(item => (
                <ContratoItemRow
                  key={item.id}
                  item={item}
                  isMixta={isMixta}
                  onUpdate={(field, value) => onUpdateItem(item.id, field, value)}
                  onRemove={() => onRemoveItem(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
