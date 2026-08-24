import React from 'react';
import type { EntregaRow } from '../../utils/entregasResolver';
import { SEMAFORO_COLORS, SEMAFORO_LABELS, computeSemaforo } from '../../utils/entregasResolver';
import { EntregaOCProveedorCell } from './EntregaDocsCells';

interface Props {
  /** Filas (items) de la misma OC completa — mínimo 1. */
  rows: EntregaRow[];
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Fila-grupo del visor de entregas: una OC totalmente recibida se muestra como
 * unidad de entrega (UAT 2026-07-16). Click en la fila despliega los artículos,
 * que conservan sus controles individuales (fechas/OT/entregado por item).
 */
export const EntregaOCGroupRow: React.FC<Props> = ({ rows, expanded, onToggle }) => {
  const first = rows[0];

  const clientes = [...new Set(rows.map(r => r.clienteNombre))];
  const pptos = [...new Set(rows.map(r => r.presupuestoNumero))];
  const cantidadTotal = rows.reduce((s, r) => s + r.cantidad, 0);
  const entregados = rows.filter(r => r.semaforo === 'entregado').length;

  // Semáforo agregado: el peor (menos días) entre los items no entregados;
  // si todos están entregados, el grupo queda "Entregado".
  const pendientes = rows.filter(r => r.semaforo !== 'entregado');
  const dias = pendientes.map(r => r.diasRestantes).filter((d): d is number => d != null);
  const minDias = dias.length ? Math.min(...dias) : null;
  const semaforo = pendientes.length === 0
    ? 'entregado' as const
    : computeSemaforo(minDias);

  return (
    <tr
      onClick={onToggle}
      className="border-b border-slate-100 bg-teal-50/40 hover:bg-teal-50 transition-colors cursor-pointer"
      data-testid={`entrega-oc-group-${first.ocId}`}
    >
      <td className="px-3 py-2 text-xs font-semibold text-teal-700 truncate max-w-[160px]">
        {clientes.length === 1 ? clientes[0] : `${clientes.length} clientes`}
      </td>
      {/* Código: la fila de grupo agrupa varios artículos — el código va en
          cada fila hija (2026-08-13). */}
      <td className="px-3 py-2 text-xs text-slate-300">—</td>
      <td className="px-3 py-2 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="text-slate-400 text-[10px]">{expanded ? '▾' : '▸'}</span>
          OC completa · {rows.length} artículo{rows.length !== 1 ? 's' : ''}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono">{cantidadTotal}</td>
      {/* Stock hoy: por artículo, va en cada fila hija. */}
      <td className="px-3 py-2 text-xs text-slate-300 text-right">—</td>
      <td className="px-3 py-2 text-xs text-slate-300 text-right">—</td>
      <td className="px-3 py-2 text-xs font-mono text-slate-600">
        {pptos.length === 1 ? pptos[0] : `${pptos.length} pptos.`}
      </td>
      <td className="px-3 py-2 text-xs text-slate-300">—</td>
      <td className="px-3 py-2 text-xs font-mono">
        <EntregaOCProveedorCell row={first} bold />
      </td>
      <td className="px-3 py-2 text-xs">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          Recibida
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-300">—</td>
      <td className="px-3 py-2 text-xs text-slate-300">—</td>
      {/* Destino: por ítem — va en cada fila hija. */}
      <td className="px-3 py-2 text-xs text-slate-300">—</td>
      <td className="px-3 py-2 text-center text-[10px] font-mono text-slate-500">
        {entregados}/{rows.length}
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        {semaforo === 'sin_eta' ? (
          <span className="text-slate-300 text-[10px]">—</span>
        ) : (
          <span className={`font-mono font-medium ${SEMAFORO_COLORS[semaforo]}`}>
            {minDias != null ? `${minDias}d` : ''}
          </span>
        )}
        <span className="ml-1.5 text-[9px] text-slate-400">{SEMAFORO_LABELS[semaforo]}</span>
      </td>
    </tr>
  );
};
