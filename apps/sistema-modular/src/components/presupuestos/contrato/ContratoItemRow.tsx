import React from 'react';
import type { PresupuestoItem } from '@ags/shared';

interface Props {
  item: PresupuestoItem;
  isMixta: boolean;
  onUpdate: (field: keyof PresupuestoItem, value: any) => void;
  onRemove: () => void;
}

const input = 'w-full border border-slate-200 rounded px-1 py-0.5 text-[11px] focus:ring-1 focus:ring-teal-400 focus:border-teal-400';
const inputRight = input + ' text-right';

/**
 * Single row in a contrato items table. Handles both S/L rows (components
 * without price) and priced service rows. Supports MIXTA rendering with
 * a moneda selector.
 */
export const ContratoItemRow: React.FC<Props> = ({ item, isMixta, onUpdate, onRemove }) => {
  const isSL = item.esSinCargo === true;
  const isBonif = item.esBonificacion === true;
  const handleNum = (field: keyof PresupuestoItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value) || 0;
    onUpdate(field, v);
    if (field === 'cantidad' || field === 'precioUnitario') {
      const cant = field === 'cantidad' ? v : (item.cantidad || 0);
      const precio = field === 'precioUnitario' ? v : (item.precioUnitario || 0);
      onUpdate('subtotal', cant * precio);
    }
  };

  const rowClass = isSL
    ? 'bg-slate-50/50 text-slate-500'
    : isBonif
      ? 'bg-red-50/30'
      : 'bg-white';

  return (
    <tr className={`border-t border-slate-100 ${rowClass}`}>
      {/* # sub */}
      <td className="px-2 py-1 font-mono text-[10px] text-slate-400 whitespace-nowrap">{item.subItem}</td>

      {/* Código / Servicio */}
      <td className="px-2 py-1">
        <input className={input} value={item.codigoProducto || ''}
          onChange={e => onUpdate('codigoProducto', e.target.value)}
          placeholder={isSL ? 'G1322A' : 'MP1_CN'} />
        {item.servicioCode && (
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">{item.servicioCode}</div>
        )}
      </td>

      {/* Descripción */}
      <td className="px-2 py-1">
        <input className={input} value={item.descripcion}
          onChange={e => onUpdate('descripcion', e.target.value)}
          placeholder="Descripción del item..." />
        <input className={input + ' mt-1 text-[10px] italic text-slate-500'}
          value={item.itemNotasAdicionales || ''}
          onChange={e => onUpdate('itemNotasAdicionales', e.target.value || null)}
          placeholder="Nota adicional (ej: LLEVA SELLO DE FASE REVERSA)" />
      </td>

      {/* Cantidad */}
      <td className="px-2 py-1 w-14">
        {isSL ? (
          <span className="text-[10px] text-slate-400 font-mono">S/L</span>
        ) : (
          <input type="number" min="0" className={inputRight}
            value={item.cantidad || 0} onChange={handleNum('cantidad')} />
        )}
      </td>

      {/* Moneda (solo MIXTA) */}
      {isMixta && (
        <td className="px-2 py-1 w-14">
          {!isSL && (
            <select className={input} value={item.moneda || 'USD'}
              onChange={e => onUpdate('moneda', e.target.value)}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="EUR">EUR</option>
            </select>
          )}
        </td>
      )}

      {/* Precio unitario */}
      <td className="px-2 py-1 w-24">
        {isSL ? (
          <span className="text-[10px] text-slate-400">—</span>
        ) : (
          <input type="number" min="0" step="0.01" className={inputRight}
            value={item.precioUnitario || ''} onChange={handleNum('precioUnitario')}
            placeholder="0.00" />
        )}
      </td>

      {/* Subtotal */}
      <td className="px-2 py-1 text-right text-[11px] font-semibold text-slate-700 whitespace-nowrap w-24">
        {isSL ? '—' : (item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </td>

      {/* Delete */}
      <td className="px-2 py-1 w-8 text-center">
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm" title="Eliminar ítem">×</button>
      </td>
    </tr>
  );
};
