import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Presupuesto } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS } from '@ags/shared';
import { extractBase } from '../../utils/presupuestoHelpers';

interface Props {
  presupuestoId: string;
  numero: string;
  estado: Presupuesto['estado'];
  motivoAnulacion: string | null;
  presupuestoOrigenId: string | null;
  showHistory: boolean;
  revisionHistory: Presupuesto[];
  onLoadHistory: () => void;
  onCloseHistory: () => void;
  onClose: () => void;
}

export const PresupuestoRevisionHistory: React.FC<Props> = ({
  presupuestoId, numero, estado, motivoAnulacion, presupuestoOrigenId,
  showHistory, revisionHistory, onLoadHistory, onCloseHistory, onClose,
}) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Anulado banner */}
      {estado === 'anulado' && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="text-xs">
              <span className="font-medium text-slate-600">Presupuesto anulado</span>
              {motivoAnulacion && <span className="text-slate-500"> — {motivoAnulacion}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Revision origin link */}
      {presupuestoOrigenId && (
        <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
          <span>Revisión de</span>
          <button onClick={onLoadHistory} className="text-teal-600 hover:underline font-medium">
            {extractBase(numero)}
          </button>
          <span className="text-slate-300 mx-1">·</span>
          <button onClick={onLoadHistory} className="text-slate-400 hover:text-slate-600 text-[10px]">
            Ver historial de revisiones
          </button>
        </div>
      )}

      {/* Revision history mini-timeline */}
      {showHistory && revisionHistory.length > 1 && (
        <div className="border border-slate-200 rounded-lg px-3 py-2 mb-3 bg-slate-50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Historial de revisiones</span>
            <button onClick={onCloseHistory} className="text-slate-400 hover:text-slate-600">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-1">
            {revisionHistory.map(rev => (
              <div key={rev.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${rev.id === presupuestoId ? 'bg-teal-50 border border-teal-200' : ''}`}>
                <span className={`font-mono font-medium ${rev.id === presupuestoId ? 'text-teal-700' : 'text-slate-600'}`}>{rev.numero}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[rev.estado]}`}>
                  {ESTADO_PRESUPUESTO_LABELS[rev.estado]}
                </span>
                {rev.motivoAnulacion && <span className="text-slate-400 truncate max-w-[200px]" title={rev.motivoAnulacion}>{rev.motivoAnulacion}</span>}
                {rev.id !== presupuestoId && (
                  <button onClick={() => { onClose(); navigate(`/presupuestos/${rev.id}`); }}
                    className="text-teal-500 hover:text-teal-700 text-[10px] ml-auto">Abrir</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
