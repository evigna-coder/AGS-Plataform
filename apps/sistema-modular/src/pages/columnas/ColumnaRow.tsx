/**
 * Fila de la lista de columnas — espejo de PatronRow.
 *
 * Una columna (código de artículo) puede tener varias unidades físicas, cada
 * una con su propio número de serie. La fila colapsada muestra el conteo + un
 * badge resumen del estado de certificado más crítico; al expandir (chevron)
 * aparece una sub-fila con cada serie por separado, su vencimiento y su
 * certificado — antes solo se mostraban las 3 primeras inline.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type EstadoCertificado,
  type Columna,
  type ColumnaSerie,
} from '@ags/shared';

interface ColumnaRowProps {
  columna: Columna;
  getAlignClass: (col: number) => string;
  onDeactivate: (c: Columna) => void;
}

const TOTAL_COLS = 6;

const dash = <span className="text-slate-300">—</span>;

/** Formatea YYYY-MM-DD (date-only) a DD/MM/AAAA sin tropezar con timezone. */
function formatFechaAR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const ESTADO_BADGE: Record<EstadoCertificado, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

/** Estado global de la columna: el certificado más crítico entre sus series. */
function estadoGlobal(series: ColumnaSerie[]): EstadoCertificado | null {
  const conCert = series.filter(s => !!s.fechaVencimiento);
  if (conCert.length === 0) return null;
  const estados = conCert.map(s => calcularEstadoCertificado(s.fechaVencimiento));
  if (estados.includes('vencido')) return 'vencido';
  if (estados.includes('por_vencer')) return 'por_vencer';
  return 'vigente';
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
    </svg>
  );
}

/** Sub-fila desplegada: un renglón por serie con su vencimiento/certificado. */
function ColumnaSeriesDetalle({ series }: { series: ColumnaSerie[] }) {
  return (
    <tr className="bg-slate-50/60" data-testid="columna-series-detalle">
      <td colSpan={TOTAL_COLS} className="px-3 py-2">
        <div className="pl-6 flex flex-col gap-1">
          {series.map((s, i) => {
            const est = s.fechaVencimiento ? calcularEstadoCertificado(s.fechaVencimiento) : null;
            const badge = est ? ESTADO_BADGE[est] : null;
            const vencCls = est === 'vencido' ? 'text-red-600 font-medium'
              : est === 'por_vencer' ? 'text-amber-700 font-medium' : 'text-slate-600';
            return (
              <div key={i} className="flex items-center gap-3 text-xs" data-testid="columna-serie-item">
                <span className="font-mono px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  {s.serie || '(vacío)'}
                </span>
                {badge && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
                {s.fechaVencimiento && (
                  <span className={`font-mono ${vencCls}`}>{formatFechaAR(s.fechaVencimiento)}</span>
                )}
                {s.notas && <span className="text-slate-500 truncate" title={s.notas}>{s.notas}</span>}
                {s.certificadoUrl && (
                  <a href={s.certificadoUrl} target="_blank" rel="noopener noreferrer"
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

export function ColumnaRow({ columna: c, getAlignClass, onDeactivate }: ColumnaRowProps) {
  const [open, setOpen] = useState(false);
  const hasSeries = c.series.length > 0;
  const estado = estadoGlobal(c.series);
  const badge = estado ? ESTADO_BADGE[estado] : null;

  const toggle = () => { if (hasSeries) setOpen(o => !o); };

  return (
    <>
      <tr
        className={`hover:bg-slate-50 transition-colors ${hasSeries ? 'cursor-pointer' : ''} ${!c.activo ? 'opacity-50' : ''}`}
        data-testid="columna-row"
        data-columna-id={c.id}
        onClick={toggle}
      >
        <td className={`px-3 py-2 ${getAlignClass(0)}`}>
          <div className="flex items-start gap-1.5 min-w-0">
            <span className="pt-0.5 shrink-0">{hasSeries ? <ChevronIcon open={open} /> : <span className="inline-block w-3.5" />}</span>
            <span className="text-xs font-semibold text-teal-600 font-mono truncate" title={c.codigoArticulo}>
              {c.codigoArticulo || dash}
            </span>
          </div>
        </td>
        <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(1)}`} title={c.descripcion}>
          {c.descripcion || dash}
        </td>
        <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`}>{c.marca || dash}</td>
        <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(3)}`}>
          <div className="flex gap-1 flex-wrap">
            {c.categorias.map(cat => (
              <span key={cat} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                {CATEGORIA_PATRON_LABELS[cat] || cat}
              </span>
            ))}
          </div>
        </td>
        <td className={`px-3 py-2 ${getAlignClass(4)}`}>
          {!hasSeries ? (
            <span className="text-[10px] text-slate-300 italic">Sin series</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500">
                {c.series.length} {c.series.length === 1 ? 'serie' : 'series'}
              </span>
              {badge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <div className="flex items-center justify-end gap-0.5">
            <Link to={`/columnas/${c.id}/editar`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100">
              Editar
            </Link>
            {c.activo && (
              <button onClick={e => { e.stopPropagation(); onDeactivate(c); }}
                className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                Desactivar
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && hasSeries && <ColumnaSeriesDetalle series={c.series} />}
    </>
  );
}
