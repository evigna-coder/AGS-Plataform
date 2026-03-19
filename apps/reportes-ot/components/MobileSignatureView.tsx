import React, { useState, useRef } from 'react';
import { FirebaseService } from '../services/firebaseService';
import SignaturePad, { SignaturePadHandle } from './SignaturePad';
import { CompanyLogo } from './CompanyHeader';
import type { AlertOptions } from '../hooks/useModal';

interface MobileSignatureViewProps {
  ot: string;
  razonSocial: string;
  firebase: FirebaseService;
  shareReportPDF: (ot?: string) => Promise<void>;
  isSharing: boolean;
  showAlert: (options: AlertOptions) => void;
}

export const MobileSignatureView: React.FC<MobileSignatureViewProps> = ({ ot, razonSocial, firebase, shareReportPDF, isSharing, showAlert }) => {
  const [signed, setSigned] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const handleConfirmFirma = async () => {
    const dataUrl = padRef.current?.getSignature();
    if (!dataUrl) {
      showAlert({
        title: 'Firma Requerida',
        message: 'Por favor, realice la firma antes de confirmar.',
        type: 'warning'
      });
      return;
    }

    try {
      // Guardar firma en Firebase con await
      await firebase.updateSignature(ot, dataUrl);
      setSigned(true);

      // Mostrar mensaje de éxito por 700-900ms antes de redirigir
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('modo');
        window.location.href = url.toString();
      }, 800);
    } catch (error) {
      console.error("Error al guardar firma:", error);
      showAlert({
        title: 'Error',
        message: 'Error al guardar la firma. Por favor, intente nuevamente.',
        type: 'error'
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
        <div className="mx-auto mb-6 flex justify-center">
          <CompanyLogo />
        </div>
        <h1 className="text-lg font-black text-slate-800 uppercase mb-1">Firma de Conformidad</h1>
        <p className="text-[10px] bg-blue-50 text-blue-600 font-black px-4 py-1.5 rounded-full inline-block uppercase tracking-widest mb-2">Reporte {ot}</p>
        <p className="text-[11px] font-bold text-slate-500 uppercase mb-6">{razonSocial || "Servicio Técnico"}</p>

        {!signed ? (
          <div className="space-y-6">
            <p className="text-xs text-slate-500 italic">Por favor, firme en el recuadro para validar el servicio.</p>
            <SignaturePad ref={padRef} label="" onClear={() => {}} />
            <button
              onClick={handleConfirmFirma}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"
            >
              Confirmar Firma
            </button>
          </div>
        ) : (
          <div className="py-10 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-lg font-black text-slate-900 uppercase">¡Firma Registrada!</h2>
            <p className="text-xs text-slate-400 mt-2">Su firma ha sido sincronizada exitosamente.</p>
            <p className="text-[10px] text-slate-300 mt-4 uppercase font-bold">Redirigiendo al reporte completo...</p>
          </div>
        )}
      </div>
    </div>
  );
};
