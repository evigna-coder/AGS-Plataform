/**
 * Phase 14 BOM-06 — Fila de la lista de patrones extraída de PatronesList.
 *
 * Una sola responsabilidad: render de una row de la tabla con todos los campos
 * existentes + badges nuevos de BOM/BLOQUEADO/AGOTADO derivados de
 * `computePatronStatus`.
 *
 * El parent (PatronesList) mantiene state, sorting, filtros, fetch. Esta row
 * recibe todo por props para mantener la extracción puramente presentacional.
 */

import { Link } from 'react-router-dom';
import {
  CATEGORIA_PATRON_LABELS,
  type Patron,
} from '@ags/shared';
import { computePatronStatus } from '@ags/shared/utils/patronBom';

interface PatronRowProps {
  patron: Patron;
  estado: 'vigente' | 'por_vencer' | 'vencido' | 'sin_cert';
  estadoBadge: { label: string; cls: string };
  proximoVencimiento: string | null;
  cantidad: number;
  tieneCantidad: boolean;
  formatFechaAR: (iso: string | null | undefined) => string;
  getAlignClass: (col: number) => string;
  colAligns: string[] | null | undefined;
  onDeactivate: (p: Patron) => void;
}

// Editorial Teal pills BOM-06
const PILL_BOM = 'bg-teal-100 text-teal-800 border border-teal-200';
const PILL_BLOQUEADO = 'bg-rose-100 text-rose-800 border border-rose-200';
const PILL_AGOTADO = 'bg-rose-200 text-rose-900 border border-rose-300';
const PILL_BASE =
  'text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded';

export function PatronRow({
  patron: p,
  estado,
  estadoBadge,
  proximoVencimiento: venc,
  cantidad,
  tieneCantidad,
  formatFechaAR,
  getAlignClass,
  colAligns,
  onDeactivate,
}: PatronRowProps) {
  const bomStatus = computePatronStatus(p);
  const hasBom = (p.componentes ?? []).length > 0;
  const vencCls =
    estado === 'vencido'
      ? 'text-red-600 font-medium'
      : estado === 'por_vencer'
        ? 'text-amber-700 font-medium'
        : 'text-slate-600';

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
      <td className={`px-3 py-2 ${getAlignClass(0)}`}>
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-xs font-semibold text-teal-600 font-mono truncate"
            title={p.codigoArticulo}
          >
            {p.codigoArticulo || <span className="text-slate-300">—</span>}
          </span>
          {(hasBom || bomStatus !== 'active') && (
            <div className="flex flex-wrap gap-1">
              {hasBom && <span className={`${PILL_BASE} ${PILL_BOM}`}>BOM</span>}
              {bomStatus === 'bloqueado' && (
                <span className={`${PILL_BASE} ${PILL_BLOQUEADO}`}>Bloqueado</span>
              )}
              {bomStatus === 'agotado' && (
                <span className={`${PILL_BASE} ${PILL_AGOTADO}`}>Agotado</span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={p.descripcion}>
        {p.descripcion || <span className="text-slate-300">—</span>}
      </td>
      <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`}>
        {p.marca || <span className="text-slate-300">—</span>}
      </td>
      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(3)}`}>
        <div className="flex gap-1 flex-wrap">
          {p.categorias.map(c => (
            <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
              {CATEGORIA_PATRON_LABELS[c] || c}
            </span>
          ))}
        </div>
      </td>
      <td className={`px-3 py-2 ${getAlignClass(4)}`}>
        {p.lotes.length === 0 ? (
          <span className="text-[10px] text-slate-300 italic">Sin lotes</span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {p.lotes.slice(0, 3).map((l, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200"
                title={l.fechaVencimiento ? `Vence: ${formatFechaAR(l.fechaVencimiento)}` : undefined}
              >
                {l.lote || '(vacío)'}
              </span>
            ))}
            {p.lotes.length > 3 && (
              <span className="text-[10px] text-slate-400">+{p.lotes.length - 3}</span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoBadge.cls}`}>
              {estadoBadge.label}
            </span>
          </div>
        )}
      </td>
      <td
        className={`px-3 py-2 text-xs whitespace-nowrap ${vencCls} ${getAlignClass(5)}`}
        title={p.lotes.length > 1 ? 'Vencimiento más próximo entre lotes' : undefined}
      >
        {venc ? formatFechaAR(venc) : <span className="text-slate-300">—</span>}
      </td>
      <td className={`px-3 py-2 text-xs font-mono whitespace-nowrap ${colAligns?.[6] ? getAlignClass(6) : 'text-right'}`}>
        {tieneCantidad ? cantidad : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center whitespace-nowrap">
        <div className="flex items-center justify-end gap-0.5">
          <Link
            to={`/patrones/${p.id}/editar`}
            className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100"
          >
            Editar
          </Link>
          {p.activo && (
            <button
              onClick={() => onDeactivate(p)}
              className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50"
            >
              Desactivar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
