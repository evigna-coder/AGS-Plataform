import React from 'react';
import SignaturePad, { SignaturePadHandle } from './SignaturePad';

interface SignaturesSectionProps {
  readOnly: boolean;
  signatureClient: string | null;
  setSignatureClient: (v: string | null) => void;
  signatureEngineer: string | null;
  setSignatureEngineer: (v: string | null) => void;
  aclaracionCliente: string;
  setAclaracionCliente: (v: string) => void;
  aclaracionEspecialista: string;
  setAclaracionEspecialista: (v: string) => void;
  clientPadRef: React.RefObject<SignaturePadHandle | null>;
  engineerPadRef: React.RefObject<SignaturePadHandle | null>;
  isGenerating: boolean;
  generationStep?: string;
  assetProgress?: { loaded: number; total: number };
  assetReady?: boolean;
  onConfirmClientAndFinalize: () => void;
  /** OT de entrega: la firma del cliente es opcional (firma el remito) — el botón
   *  de finalizar aparece aunque el pad esté vacío. Autorizado 2026-07-15. */
  tipoOT?: 'servicio' | 'entrega';
}

export const SignaturesSection: React.FC<SignaturesSectionProps> = ({
  readOnly,
  signatureClient, setSignatureClient,
  signatureEngineer, setSignatureEngineer,
  aclaracionCliente, setAclaracionCliente,
  aclaracionEspecialista, setAclaracionEspecialista,
  clientPadRef, engineerPadRef,
  isGenerating, generationStep, assetProgress, assetReady, onConfirmClientAndFinalize,
  tipoOT = 'servicio',
}) => {
  const esEntrega = tipoOT === 'entrega';
  return (
    <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      {/* ================= FIRMA CLIENTE ================= */}
      <div
        className={`space-y-4
          ${readOnly ? 'opacity-70 pointer-events-none' : ''}
        `}
      >
        <SignaturePad
          ref={clientPadRef}
          label="Firma del Cliente"
          initialValue={signatureClient}
          onClear={() => {
            if (readOnly) return;
            setSignatureClient(null);
          }}
          onEnd={(dataUrl) => {
            if (readOnly) return;
            setSignatureClient(dataUrl);
          }}
          disabled={readOnly}
        />

        {/* BOTÓN – DISPARADOR (entrega: disponible sin firma — el cliente firma el remito) */}
        {!readOnly && (signatureClient || esEntrega) && (
          <button
            onClick={onConfirmClientAndFinalize}
            disabled={isGenerating}
            className="w-full bg-green-600 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (generationStep || 'Finalizando…') : (signatureClient ? 'Confirmar firma del cliente' : 'Finalizar sin firma (firma en remito)')}
          </button>
        )}
        {!readOnly && esEntrega && !signatureClient && (
          <p className="text-[10px] text-slate-400 text-center">
            Entrega de materiales: la firma del cliente queda en el remito adjunto — no es obligatoria acá.
          </p>
        )}
        {!readOnly && assetProgress && assetProgress.total > 0 && !assetReady && (
          <p className="text-[10px] text-amber-600 text-center">
            Precargando assets… ({assetProgress.loaded}/{assetProgress.total})
          </p>
        )}
        <input
          type="text"
          value={aclaracionCliente}
          onChange={e => {
            if (readOnly) return;
            setAclaracionCliente(e.target.value);
          }}
          disabled={readOnly}
          data-required-field="aclaracionCliente"
          placeholder="Nombre y Cargo del responsable"
          className={`w-full bg-white text-slate-900 border border-slate-300 rounded-md px-3 py-2 text-[11px] font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            ${
              readOnly
                ? 'bg-white text-slate-400 cursor-not-allowed border-slate-300'
                : ''
            }
          `}
        />
      </div>

      {/* ================= FIRMA ESPECIALISTA ================= */}
      <div
        className={`space-y-4 ${
          readOnly ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <div data-required-field="engineerSignature">
          <SignaturePad
            ref={engineerPadRef}
            label="Firma del Especialista AGS"
            initialValue={signatureEngineer}
            onClear={() => {
              if (readOnly) return;
              setSignatureEngineer(null);
            }}
            onEnd={(dataUrl) => {
              if (readOnly) return;
              setSignatureEngineer(dataUrl);
            }}
          />
        </div>

        <input
          type="text"
          value={aclaracionEspecialista}
          onChange={e => {
            if (readOnly) return;
            setAclaracionEspecialista(e.target.value);
          }}
          disabled={readOnly}
          data-required-field="aclaracionEspecialista"
          placeholder="Nombre del Técnico Especialista"
          className={`w-full bg-white text-slate-900 border border-slate-300 rounded-md px-3 py-2 text-[11px] font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            ${
              readOnly
                ? 'bg-white text-slate-400 cursor-not-allowed border-slate-300'
                : ''
            }
          `}
        />
      </div>
    </div>
  );
};
