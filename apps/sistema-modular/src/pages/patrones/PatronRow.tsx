/**
 * Phase 14 BOM-06 — Fila de la lista de patrones extraída de PatronesList.
 *
 * Una sola responsabilidad: render de una row de la tabla con todos los campos
 * existentes + badges nuevos de BOM/BLOQUEADO/AGOTADO derivados de
 * `computePatronStatus`. El parent (PatronesList) mantiene state, sorting,
 * filtros, fetch. Esta row recibe todo por props (puramente presentacional).
 *
 * Lotes: un patrón puede tener varios lotes con distinto estado/vencimiento.
 * La fila colapsada muestra el conteo + un badge resumen (estado global); al
 * expandir (chevron) aparece una sub-fila con cada lote por separado y su
 * propio estado/vencimiento/cantidad — antes se apelmazaban en una sola línea.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type EstadoCertificado,
  type Patron,
  type PatronLote,
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

const TOTAL_COLS = 8;

// Editorial Teal pills BOM-06
const PILL_BASE = 'text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded';
const PILL_BOM = 'bg-teal-100 text-teal-800 border border-teal-200';
const PILL_BLOQUEADO = 'bg-rose-100 text-rose-800 border border-rose-200';
const PILL_AGOTADO = 'bg-rose-200 text-rose-900 border border-rose-300';

/** Badge por-lote según su propio estado de certificado. */
const LOTE_BADGE: Record<EstadoCertificado, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

const dash = <span className="text-slate-300">—</span>;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
    </svg>
  );
}

/** Sub-fila desplegada: un renglón por lote activo. Las bajas viven en la
 *  pestaña "Historial de bajas" del listado (crecen sin límite con el tiempo). */
function PatronLotesDetalle({
  lotes, formatFechaAR,
}: { lotes: PatronLote[]; formatFechaAR: (iso: string | null | undefined) => string }) {
  return (
    <tr className="bg-slate-50/60" data-testid="patron-lotes-detalle">
      <td colSpan={TOTAL_COLS} className="px-3 py-2">
        <div className="pl-6 flex flex-col gap-1">
          {lotes.map((l, i) => {
            const est = calcularEstadoCertificado(l.fechaVencimiento);
            const badge = LOTE_BADGE[est];
            const vencCls = est === 'vencido' ? 'text-red-600 font-medium'
              : est === 'por_vencer' ? 'text-amber-700 font-medium' : 'text-slate-600';
            return (
              <div key={i} className="flex items-center gap-3 text-xs" data-testid="patron-lote-item">
                <span className="font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  {l.lote || '(vacío)'}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className={`font-mono ${vencCls}`}>
                  {l.fechaVencimiento ? formatFechaAR(l.fechaVencimiento) : dash}
                </span>
                <span className="text-slate-500">
                  Cant: <span className="font-mono text-slate-700">{typeof l.cantidad === 'number' ? l.cantidad : '—'}</span>
                </span>
                {l.certificadoUrl && (
                  <a href={l.certificadoUrl} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-teal-600 hover:text-teal-800 hover:underline ml-auto">
                    Certificado
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

export function PatronRow({
  patron: p, estado, estadoBadge, proximoVencimiento: venc, cantidad,
  tieneCantidad, formatFechaAR, getAlignClass, colAligns, onDeactivate,
}: PatronRowProps) {
  const [open, setOpen] = useState(false);
  const bomStatus = computePatronStatus(p);
  const hasBom = (p.componentes ?? []).length > 0;
  const bajas = p.lotesBaja ?? [];
  const hasLotes = p.lotes.length > 0;
  const vencCls = estado === 'vencido' ? 'text-red-600 font-medium'
    : estado === 'por_vencer' ? 'text-amber-700 font-medium'
    : 'text-slate-600';

  const toggle = () => { if (hasLotes) setOpen(o => !o); };

  return (
    <>
      <tr
        className={`hover:bg-slate-50 transition-colors ${hasLotes ? 'cursor-pointer' : ''} ${!p.activo ? 'opacity-50' : ''}`}
        data-testid="patron-row"
        data-patron-id={p.id}
        data-bom={hasBom ? 'true' : 'false'}
        data-bom-status={bomStatus}
        onClick={toggle}
      >
        <td className={`px-3 py-2 ${getAlignClass(0)}`}>
          <div className="flex items-start gap-1.5 min-w-0">
            <span className="pt-0.5 shrink-0">{hasLotes ? <ChevronIcon open={open} /> : <span className="inline-block w-3.5" />}</span>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-semibold text-teal-600 font-mono truncate" title={p.codigoArticulo}>
                {p.codigoArticulo || dash}
              </span>
              {(hasBom || bomStatus !== 'active') && (
                <div className="flex flex-wrap gap-1">
                  {hasBom && <span className={`${PILL_BASE} ${PILL_BOM}`} data-testid="badge-bom">BOM</span>}
                  {bomStatus === 'bloqueado' && <span className={`${PILL_BASE} ${PILL_BLOQUEADO}`} data-testid="badge-bloqueado">Bloqueado</span>}
                  {bomStatus === 'agotado' && <span className={`${PILL_BASE} ${PILL_AGOTADO}`} data-testid="badge-agotado">Agotado</span>}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className={`px-3 py-2 text-xs text-slate-700 truncate ${getAlignClass(1)}`} title={p.descripcion}>
          {p.descripcion || dash}
        </td>
        <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`}>{p.marca || dash}</td>
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
          {!hasLotes && bajas.length === 0 ? (
            <span className="text-[10px] text-slate-300 italic">Sin lotes</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {hasLotes && (
                <span className="text-[10px] text-slate-500">
                  {p.lotes.length} {p.lotes.length === 1 ? 'lote' : 'lotes'}
                </span>
              )}
              {hasLotes && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoBadge.cls}`}>
                  {estadoBadge.label}
                </span>
              )}
              {bajas.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600"
                  title="Lotes dados de baja — ver pestaña Historial de bajas">
                  {bajas.length} baja{bajas.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
        </td>
        <td className={`px-3 py-2 text-xs whitespace-nowrap ${vencCls} ${getAlignClass(5)}`}
          title={p.lotes.length > 1 ? 'Vencimiento más próximo entre lotes — desplegá para ver cada lote' : undefined}>
          {venc ? formatFechaAR(venc) : dash}
        </td>
        <td className={`px-3 py-2 text-xs font-mono whitespace-nowrap ${colAligns?.[6] ? getAlignClass(6) : 'text-right'}`}>
          {tieneCantidad ? cantidad : dash}
        </td>
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <div className="flex items-center justify-end gap-0.5">
            <Link to={`/patrones/${p.id}/editar`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100">
              Editar
            </Link>
            {p.activo && (
              <button onClick={e => { e.stopPropagation(); onDeactivate(p); }}
                className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                Desactivar
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && hasLotes && <PatronLotesDetalle lotes={p.lotes} formatFechaAR={formatFechaAR} />}
    </>
  );
}
