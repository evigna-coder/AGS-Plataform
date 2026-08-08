import React, { useState } from 'react';
import type { AgendaOTDelDia } from '../services/firebaseService';

interface Props {
  /** OTs agendadas del ingeniero para el día del reporte (incluye la actual). */
  items: AgendaOTDelDia[];
  /** Número de la OT abierta ahora — se marca y no se puede "saltar" a ella. */
  otActual: string;
  fecha: string;
  /** OT a la que se está cambiando (feedback mientras guarda y recarga). */
  cambiando: string | null;
  /** true = se ven las visitas de TODOS los ingenieros (usuario admin). */
  supervision: boolean;
  onSelect: (otNumber: string) => void;
}

function fechaLabel(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha;
  // Parseo LOCAL: new Date('YYYY-MM-DD') es medianoche UTC y en Argentina cae
  // en el día anterior.
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

/**
 * Panel "OT del día": las otras órdenes que el ingeniero tiene agendadas para
 * la misma fecha del reporte, con salto directo al reporte de cada una.
 *
 * Es una capa flotante (pestaña en el borde derecho + cajón) montada FUERA del
 * flujo del formulario a propósito: no cambia el layout del wizard ni el del
 * escritorio, no toca ningún campo y lleva `no-print` para no aparecer nunca en
 * una impresión. Los contenedores que captura el PDF son otros
 * (`#pdf-container*`), así que no puede filtrarse al informe.
 *
 * Si el día no tiene otra OT además de la actual, no se renderiza nada.
 */
export const OTsDelDiaPanel: React.FC<Props> = ({ items, otActual, fecha, cambiando, supervision, onSelect }) => {
  const [abierto, setAbierto] = useState(false);
  const otras = items.filter(i => i.otNumber !== otActual);
  if (otras.length === 0) return null;

  return (
    <div className="no-print">
      {/* Pestaña en el borde derecho — mismo patrón que el resto de flotantes */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`Tenés ${items.length} OT agendadas este día`}
        aria-label="Ver las otras OT del día"
        className="fixed right-0 top-1/3 z-40 flex flex-col items-center gap-1 rounded-l-xl bg-blue-600 text-white px-2 py-3 shadow-lg active:bg-blue-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[11px] font-black leading-none">{items.length}</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <aside className="relative w-[300px] max-w-[88vw] h-full bg-white shadow-2xl flex flex-col">
            <header className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">OT del día</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{fechaLabel(fecha)}</p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-slate-400 text-xl leading-none px-2 py-0.5"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.map(it => {
                const esActual = it.otNumber === otActual;
                const enCurso = cambiando === it.otNumber;
                return (
                  <button
                    key={it.otNumber}
                    type="button"
                    disabled={esActual || !!cambiando}
                    onClick={() => onSelect(it.otNumber)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      esActual
                        ? 'border-blue-200 bg-blue-50 cursor-default'
                        : 'border-slate-200 bg-white active:bg-slate-50 disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {it.franja && (
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                          {it.franja}
                        </span>
                      )}
                      <span className="text-xs font-black text-slate-800">OT {it.otNumber}</span>
                      {/* En supervisión las visitas son de distintos ingenieros:
                          sin el nombre, la lista no se entiende (2026-08-08). */}
                      {supervision && it.ingenieroNombre && (
                        <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">
                          {it.ingenieroNombre}
                        </span>
                      )}
                      {esActual && (
                        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-blue-600">
                          Actual
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-700 mt-1 leading-tight">
                      {it.clienteNombre || '—'}
                    </p>
                    {(it.sistemaNombre || it.establecimientoNombre) && (
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        {[it.establecimientoNombre, it.sistemaNombre].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {it.tipoServicio && (
                      <p className="text-[11px] text-slate-400 leading-tight">{it.tipoServicio}</p>
                    )}
                    {enCurso && (
                      <p className="text-[11px] font-semibold text-blue-600 mt-1">Guardando y abriendo…</p>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="px-4 py-2.5 border-t border-slate-200 text-[10px] text-slate-400 leading-snug">
              Al abrir otra OT se guarda el borrador actual y se recarga el reporte.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
};
