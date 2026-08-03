import { type FC, useState } from 'react';
import type { ZoomLevel } from '@ags/shared';
import { formatRangeLabel } from '../../utils/agendaDateUtils';

interface AgendaHeaderProps {
  anchor: Date;
  zoomLevel: ZoomLevel;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Abre el buscador con salto a celda (Ctrl+B) — pedido 2026-08-03. */
  onSearch?: () => void;
  /** Salto rápido de fecha desde el almanaque — pedido 2026-08-03. */
  onPickDate?: (d: Date) => void;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Almanaque compacto: año navegable + 12 meses — click en mes = ir ahí. */
const MiniAlmanaque: FC<{ anchor: Date; onPick: (d: Date) => void; onClose: () => void }> = ({ anchor, onPick, onClose }) => {
  const [anio, setAnio] = useState(anchor.getFullYear());
  const hoy = new Date();
  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <div
        className="absolute top-12 left-40 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-[240px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setAnio(a => a - 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500">‹</button>
          <span className="text-sm font-semibold text-slate-800 font-mono">{anio}</span>
          <button onClick={() => setAnio(a => a + 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500">›</button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MESES.map((m, i) => {
            const esActual = anio === hoy.getFullYear() && i === hoy.getMonth();
            const esAnchor = anio === anchor.getFullYear() && i === anchor.getMonth();
            return (
              <button
                key={m}
                onClick={() => { onPick(new Date(anio, i, 1)); onClose(); }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                  ${esAnchor ? 'bg-teal-600 text-white' : esActual ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AgendaHeader: FC<AgendaHeaderProps> = ({
  anchor,
  zoomLevel,
  onPrev,
  onNext,
  onToday,
  onSearch,
  onPickDate,
}) => {
  const rangeLabel = formatRangeLabel(anchor, zoomLevel);
  const [showAlmanaque, setShowAlmanaque] = useState(false);

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
      {/* Title */}
      <h1 className="text-base font-semibold tracking-tight text-slate-900 shrink-0">Agenda</h1>

      {/* Nav */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="Anterior"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <button
          onClick={onToday}
          className="px-2 py-1 rounded-md hover:bg-slate-100 text-[11px] font-medium text-slate-600 transition-colors"
        >
          Hoy
        </button>

        <button
          onClick={onNext}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="Siguiente"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Almanaque: salto rápido de año/mes */}
      {onPickDate && (
        <button
          onClick={() => setShowAlmanaque(true)}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          title="Ir a mes/año (almanaque)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </button>
      )}
      {showAlmanaque && onPickDate && (
        <MiniAlmanaque anchor={anchor} onPick={onPickDate} onClose={() => setShowAlmanaque(false)} />
      )}

      {/* Buscador con salto a celda */}
      {onSearch && (
        <button
          onClick={onSearch}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          title="Buscar OT, cliente o equipo (Ctrl+B)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <span className="text-[11px] font-medium">Buscar</span>
          <span className="text-[9px] font-mono text-slate-300 border border-slate-200 rounded px-1">Ctrl+B</span>
        </button>
      )}

      {/* Range label */}
      <span className="text-xs text-slate-400 truncate min-w-0">{rangeLabel}</span>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
};
