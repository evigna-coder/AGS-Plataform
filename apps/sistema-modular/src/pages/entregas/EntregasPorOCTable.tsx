import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EntregaRow } from '../../utils/entregasResolver';
import { SEMAFORO_COLORS, SEMAFORO_LABELS } from '../../utils/entregasResolver';
import { agruparEntregasPorOC, type GrupoEntregaOC } from '../../utils/entregasPorOC';

const th = 'text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3';
const fmtFecha = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—';
const fmtImporte = (g: GrupoEntregaOC) =>
  g.importePorMoneda.map(i => `${i.moneda} ${i.monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`).join(' · ') || '—';

interface Props {
  rows: EntregaRow[];
}

/**
 * Entregas por orden de compra (2026-09-04): una fila por OC del cliente,
 * pendiente hasta que se entregue el último artículo. Click despliega los
 * artículos en lectura; para tocar fechas, OT o entregado se usa la vista
 * por artículo.
 */
export const EntregasPorOCTable: React.FC<Props> = ({ rows }) => {
  const grupos = agruparEntregasPorOC(rows);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setAbiertas(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  if (grupos.length === 0) return <div className="text-center py-12 text-xs text-slate-400">No hay órdenes de compra para mostrar</div>;

  return (
    <table className="tabla-compacta w-full">
      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
        <tr>
          <th className={th}>Cliente</th>
          <th className={th}>OC cliente</th>
          <th className={th}>Presupuesto</th>
          <th className={`${th} text-center`}>Artículos</th>
          <th className={`${th} text-right`}>Importe</th>
          <th className={th}>ETA completa</th>
          <th className={th}>Estado</th>
          <th className={th}>Días</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map(g => {
          const open = abiertas.has(g.key);
          return (
            <React.Fragment key={g.key}>
              <tr onClick={() => toggle(g.key)}
                className={`border-b border-slate-100 cursor-pointer transition-colors ${g.completa ? 'bg-slate-50/60 hover:bg-slate-50' : 'hover:bg-teal-50/40'}`}>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 truncate max-w-[200px]">
                  <span className="text-slate-400 text-[10px] mr-1.5">{open ? '▾' : '▸'}</span>
                  {g.clienteNombre}
                </td>
                <td className="px-3 py-2 text-xs font-mono">
                  {g.ocNumero ? (
                    g.ocUrl
                      ? <a href={g.ocUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-teal-700 hover:underline">{g.ocNumero}</a>
                      : <span className="text-slate-700">{g.ocNumero}</span>
                  ) : <span className="text-slate-400 italic font-sans">sin OC</span>}
                </td>
                <td className="px-3 py-2 text-xs font-mono text-slate-600">
                  {g.presupuestos.map((p, i) => (
                    <React.Fragment key={p}>
                      {i > 0 && ', '}
                      <Link to={`/presupuestos/${g.rows.find(r => r.presupuestoNumero === p)?.presupuestoId}`} onClick={e => e.stopPropagation()} className="hover:underline">{p}</Link>
                    </React.Fragment>
                  ))}
                </td>
                <td className="px-3 py-2 text-xs text-center font-mono text-slate-600">
                  <span className={g.completa ? 'text-emerald-700' : ''}>{g.entregados}/{g.totalItems}</span>
                  <span className="text-slate-400 ml-1">entreg.</span>
                </td>
                <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 whitespace-nowrap">{fmtImporte(g)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{g.completa ? '—' : fmtFecha(g.etaMax)}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    g.completa ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                    {g.completa ? 'Completa' : `Pendiente · faltan ${g.totalItems - g.entregados}`}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {g.completa || g.semaforo === 'sin_eta'
                    ? <span className="text-slate-300 text-[10px]">—</span>
                    : <span className={`font-mono font-medium ${SEMAFORO_COLORS[g.semaforo]}`}>{g.minDias}d</span>}
                  <span className="ml-1.5 text-[9px] text-slate-400">{SEMAFORO_LABELS[g.semaforo]}</span>
                </td>
              </tr>
              {open && (
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <td colSpan={8} className="px-6 py-2">
                    <table className="w-full">
                      <tbody>
                        {g.rows.map(r => (
                          <tr key={`${r.presupuestoId}::${r.itemId}`} className="text-[11px]">
                            <td className="py-0.5 pr-3 font-mono text-slate-500 w-28">{r.codigoProducto || '—'}</td>
                            <td className="py-0.5 pr-3 text-slate-700">{r.descripcion}</td>
                            <td className="py-0.5 pr-3 font-mono text-slate-600 text-right w-12">{r.cantidad}</td>
                            <td className="py-0.5 pr-3 text-slate-500 w-24">{r.disponibilidadCalculada?.label ?? ''}</td>
                            <td className="py-0.5 pr-3 text-slate-500 w-20">{fmtFecha(r.etaFecha)}</td>
                            <td className="py-0.5 pr-3 text-slate-500 truncate max-w-[220px]">{r.direccionEntregaTexto || ''}</td>
                            <td className="py-0.5 w-24 whitespace-nowrap">
                              {r.semaforo === 'entregado'
                                ? <span className="text-emerald-700">✓ Entregado</span>
                                : <span className={`font-mono ${SEMAFORO_COLORS[r.semaforo]}`}>{r.diasRestantes != null ? `${r.diasRestantes}d` : '—'}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};
