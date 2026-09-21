import React, { useEffect, useState } from 'react';
import type { CandidataFirmaLote, FirebaseService } from '../services/firebaseService';

interface Props {
  firebase: FirebaseService;
  otNumber: string;
  razonSocial: string;
  fechaInicio: string;
  fechaFin: string;
  /** OTs seleccionadas (viven en el estado del reporte, con autosave). */
  seleccion: string[];
  onChange: (ots: string[]) => void;
  readOnly: boolean;
}

const fechaCorta = (iso: string) => {
  const m = (iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : '';
};

/**
 * Firma por lote (2026-09-21). El cliente firma UNA vez y con esa firma
 * autoriza los reportes de las otras OT que se le hicieron ese día (o esos
 * días): el ingeniero las elige acá, arriba del pad. Solo entran las que ya
 * están completas (reporte técnico + firma del ingeniero) y sin firma del
 * cliente; las vírgenes no aparecen. La selección se guarda con el reporte,
 * así la firma remota por QR también la muestra.
 */
export const FirmaLotePanel: React.FC<Props> = ({ firebase, otNumber, razonSocial, fechaInicio, fechaFin, seleccion, onChange, readOnly }) => {
  const [abierto, setAbierto] = useState(seleccion.length > 0);
  const [cargando, setCargando] = useState(false);
  const [candidatas, setCandidatas] = useState<CandidataFirmaLote[] | null>(null);

  useEffect(() => {
    if (!abierto || candidatas !== null || !otNumber) return;
    let vigente = true;
    setCargando(true);
    firebase.getCandidatasFirmaLote({ otNumber, razonSocial, fechaInicio, fechaFin })
      .then(c => { if (vigente) setCandidatas(c); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [abierto, candidatas, firebase, otNumber, razonSocial, fechaInicio, fechaFin]);

  const toggle = (ot: string) => {
    if (readOnly) return;
    onChange(seleccion.includes(ot) ? seleccion.filter(o => o !== ot) : [...seleccion, ot]);
  };
  const verUrl = (ot: string) => `${window.location.origin}${window.location.pathname}?reportId=${encodeURIComponent(ot)}`;

  if (readOnly && seleccion.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <button type="button" onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Firma por lote{seleccion.length > 0 ? ` · ${seleccion.length} OT más` : ''}
        </span>
        <span className="text-[10px] text-slate-400">{abierto ? 'ocultar' : 'otras OT de este cliente'}</span>
      </button>
      {abierto && (
        <div className="px-3 pb-3 space-y-2">
          {cargando && <p className="text-[11px] text-slate-400">Buscando otras OT del cliente…</p>}
          {!cargando && candidatas && candidatas.length === 0 && (
            <p className="text-[11px] text-slate-400">No hay otras OT de {razonSocial || 'este cliente'} completas y sin firma en estos días.</p>
          )}
          {!cargando && candidatas && candidatas.map(c => (
            <label key={c.otNumber} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${seleccion.includes(c.otNumber) ? 'border-teal-400 bg-teal-50' : 'border-slate-200'}`}>
              <input type="checkbox" checked={seleccion.includes(c.otNumber)} onChange={() => toggle(c.otNumber)} disabled={readOnly}
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              <span className="flex-1 min-w-0 text-[11px] text-slate-700">
                <span className="font-mono font-bold text-slate-900">OT {c.otNumber}</span>
                {c.fecha && <span className="text-slate-400"> · {fechaCorta(c.fecha)}</span>}
                <span className="block truncate">{[c.sistema, c.tipoServicio].filter(Boolean).join(' — ')}</span>
              </span>
              <a href={verUrl(c.otNumber)} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-bold text-teal-700 hover:underline shrink-0" onClick={e => e.stopPropagation()}>Ver</a>
            </label>
          ))}
          {seleccion.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <p className="font-bold">Con esta firma el cliente autoriza también los reportes de:</p>
              <p className="font-mono mt-0.5">{seleccion.map(o => `OT ${o}`).join(' · ')}</p>
              <p className="mt-1 text-amber-800/80">Cada uno queda con la misma firma y aclaración, y en su PDF dice desde qué OT se autorizó. Después hay que finalizar cada reporte.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
