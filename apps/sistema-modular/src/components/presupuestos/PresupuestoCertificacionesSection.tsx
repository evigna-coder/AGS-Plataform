import { useState } from 'react';
import type { Certificacion } from '@ags/shared';
import { ESTADO_CERTIFICACION_LABELS, ESTADO_OT_CERTIFICACION_LABELS, recibidasDeCertificacion } from '@ags/shared';
import { useTabs } from '../../contexts/TabsContext';
import { usePresupuestoCertificaciones } from '../../hooks/usePresupuestoCertificaciones';
import type { PresupuestoRef } from '../../utils/otsDelPresupuestoFetch';

interface Props {
  presupuesto: PresupuestoRef & { clienteId?: string | null };
  /** Mostrar la card aunque no haya lotes (cliente que certifica). */
  mostrarSiVacia: boolean;
}

const CHIP: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  certificada: 'bg-emerald-100 text-emerald-700',
  objetada: 'bg-red-100 text-red-700',
  no_facturable: 'bg-slate-100 text-slate-500',
};

const tituloLote = (c: Certificacion) =>
  c.periodo ? `Período ${c.periodo}` : `Lote del ${(c.fecha || '').slice(0, 10).split('-').reverse().join('/')}`;

/**
 * Certificaciones del presupuesto (2026-09-08). Para el cliente que certifica
 * en vez de emitir OC, este papel es el respaldo de la facturación: la card
 * muestra, por lote, qué OTs del presupuesto entraron, en qué estado están y
 * qué documentos devolvió el cliente. Se gestiona desde Pend. documentación.
 */
export function PresupuestoCertificacionesSection({ presupuesto, mostrarSiVacia }: Props) {
  const { navigateInActiveTab } = useTabs();
  const { lotes, otsSinLote, loading } = usePresupuestoCertificaciones(presupuesto);
  const [open, setOpen] = useState(true);
  if (!loading && lotes.length === 0 && !mostrarSiVacia) return null;

  const certificadas = lotes.reduce((n, l) => n + l.items.filter(i => i.estado === 'certificada').length, 0);
  const total = lotes.reduce((n, l) => n + l.items.length, 0);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
          Certificaciones{total > 0 ? ` (${certificadas}/${total} OTs certificadas)` : ''}
        </span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2">
          {loading ? (
            <p className="text-[11px] text-slate-400">Buscando…</p>
          ) : lotes.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Sin certificaciones todavía. Las OTs quedan retenidas al cerrar y el pedido al cliente se arma desde{' '}
              <button onClick={() => navigateInActiveTab('/facturacion/pendientes-documentacion')} className="text-teal-600 hover:underline">Pend. documentación</button>.
            </p>
          ) : lotes.map(({ cert, items }) => {
            const recibidas = recibidasDeCertificacion(cert).filter(r => r.id !== 'legacy' || r.archivoUrl);
            return (
              <div key={cert.id} className="rounded-lg border border-slate-100 bg-slate-50/40 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-700">{tituloLote(cert)}</span>
                    {cert.numero && <span className="text-[10px] font-mono text-slate-500">N° {cert.numero}</span>}
                    <span className="text-[10px] text-slate-400">{ESTADO_CERTIFICACION_LABELS[cert.estado ?? 'solicitada']}</span>
                  </div>
                  <button onClick={() => navigateInActiveTab('/facturacion/pendientes-documentacion')}
                    className="text-[10px] text-teal-600 hover:underline shrink-0">Gestionar</button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {items.map(i => (
                    <span key={i.otNumber} className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${CHIP[i.estado] ?? CHIP.pendiente}`}
                      title={`${ESTADO_OT_CERTIFICACION_LABELS[i.estado]}${i.motivo ? ` — ${i.motivo}` : ''}`}>
                      OT {i.otNumber} · {ESTADO_OT_CERTIFICACION_LABELS[i.estado]}
                    </span>
                  ))}
                </div>
                {recibidas.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {recibidas.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Documento{r.numero ? ` N° ${r.numero}` : ''}{r.fecha ? ` · ${r.fecha.slice(0, 10).split('-').reverse().join('/')}` : ''}</span>
                        {(r.archivos?.length ? r.archivos : r.archivoUrl ? [{ url: r.archivoUrl, nombre: 'Ver', path: '' }] : []).map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">{a.nombre || `Archivo ${i + 1}`}</a>
                        ))}
                        {r.solicitudesIds?.length ? <span className="text-emerald-600">· pasado a facturación</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!loading && lotes.length > 0 && otsSinLote.length > 0 && (
            <p className="text-[10px] text-slate-400">
              Sin pedir todavía: {otsSinLote.map(n => `OT ${n}`).join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
