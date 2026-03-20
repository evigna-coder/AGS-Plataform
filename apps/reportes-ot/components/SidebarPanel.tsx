import React from 'react';

interface SidebarPanelProps {
  readOnly: boolean;
  otNumber: string;
  totalHs: string;
  onGenerateQR: () => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  readOnly, otNumber, totalHs, onGenerateQR,
}) => {
  return (
    <div className="lg:col-span-4 no-print space-y-4">

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 sticky top-6 shadow-sm transition-all duration-300">
        <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">
          Sincronización Remota
        </h3>

        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed font-medium italic">
          ¿Necesitas que el cliente firme en un tablet o celular? Genera un QR para abrir este reporte en otro dispositivo.
        </p>

        <button
          onClick={() => {
            if (readOnly) return;
            onGenerateQR();
          }}

          disabled={readOnly}

          className={`w-full rounded-xl py-3 text-[11px] font-black uppercase tracking-widest
          flex items-center justify-center gap-2 select-none appearance-none
           ${
            readOnly
             ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
         : 'bg-white text-slate-800 border border-slate-300 shadow-sm'
         }
        `}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
          Generar Código QR
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resumen OT</h3>
         <div className="flex justify-between items-center"><p className="text-[10px] text-slate-400 font-bold uppercase">Total Horas</p><p className="font-black text-slate-800 text-lg leading-none">{totalHs} h</p></div>
         <div className="flex justify-between items-center pt-2 border-t"><p className="text-[10px] text-slate-400 font-bold uppercase">N° Reporte</p><p className="font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[10px]">{otNumber}</p></div>
      </div>
    </div>
  );
};
