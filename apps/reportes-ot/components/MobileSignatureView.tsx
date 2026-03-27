import React, { useState, useRef, useEffect } from 'react';
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

interface ReportPreview {
  razonSocial?: string;
  contacto?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  sistema?: string;
  moduloModelo?: string;
  moduloDescripcion?: string;
  moduloMarca?: string;
  moduloSerie?: string;
  tipoServicio?: string;
  fechaInicio?: string;
  fechaFin?: string;
  horaInicio?: string;
  horaFin?: string;
  horasTrabajadas?: string;
  reporteTecnico?: string;
  accionesTomar?: string;
  articulos?: { codigo: string; descripcion: string; cantidad: number }[];
  signatureEngineer?: string;
  aclaracionEspecialista?: string;
}

function PreviewField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <p className="text-[12px] text-slate-800 mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

export const MobileSignatureView: React.FC<MobileSignatureViewProps> = ({ ot, razonSocial, firebase, shareReportPDF, isSharing, showAlert }) => {
  const [signed, setSigned] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [report, setReport] = useState<ReportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (showPreview && !report) {
      setLoadingPreview(true);
      firebase.getReport(ot).then(data => {
        if (data) setReport(data as ReportPreview);
      }).finally(() => setLoadingPreview(false));
    }
  }, [showPreview, report, ot, firebase]);

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
      await firebase.updateSignature(ot, dataUrl);
      setSigned(true);

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

  // Vista de previsualización del reporte
  if (showPreview) {
    const r = report;
    const direccionFull = [r?.direccion, r?.localidad, r?.provincia].filter(Boolean).join(', ');
    const modeloFull = [r?.moduloModelo, r?.moduloDescripcion, r?.moduloMarca ? `Marca: ${r.moduloMarca}` : ''].filter(Boolean).join(', ');

    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Reporte de Servicio</p>
              <p className="text-lg font-black">OT N° {ot}</p>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg uppercase font-bold tracking-wide transition-colors"
            >
              Volver a firmar
            </button>
          </div>

          {loadingPreview ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-400 animate-pulse">Cargando reporte...</p>
            </div>
          ) : !r ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">No se pudo cargar el reporte.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {/* Datos del cliente */}
              <div className="px-5 py-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Datos del Cliente</h3>
                <p className="text-[14px] font-black text-slate-900 uppercase">{r.razonSocial || 'S/D'}</p>
                <PreviewField label="Contacto" value={r.contacto} />
                <PreviewField label="Dirección" value={direccionFull} />
              </div>

              {/* Equipo */}
              <div className="px-5 py-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Información del Equipo</h3>
                <PreviewField label="Sistema" value={r.sistema} />
                <PreviewField label="Módulo" value={modeloFull} />
                <PreviewField label="N° de Serie" value={r.moduloSerie} />
              </div>

              {/* Servicio */}
              <div className="px-5 py-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Datos del Servicio</h3>
                <PreviewField label="Tipo de servicio" value={r.tipoServicio} />
                <div className="flex gap-4">
                  <div className="flex-1"><PreviewField label="Fecha inicio" value={r.fechaInicio} /></div>
                  <div className="flex-1"><PreviewField label="Fecha fin" value={r.fechaFin} /></div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1"><PreviewField label="Hora inicio" value={r.horaInicio} /></div>
                  <div className="flex-1"><PreviewField label="Hora fin" value={r.horaFin} /></div>
                </div>
                <PreviewField label="Horas trabajadas" value={r.horasTrabajadas ? `${r.horasTrabajadas} hs` : undefined} />
              </div>

              {/* Informe técnico */}
              {r.reporteTecnico && (
                <div className="px-5 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Informe Técnico</h3>
                  <div
                    className="text-[11px] text-slate-700 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: r.reporteTecnico }}
                  />
                </div>
              )}

              {/* Acciones a tomar */}
              {r.accionesTomar && (
                <div className="px-5 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Acciones a Tomar</h3>
                  <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">{r.accionesTomar}</p>
                </div>
              )}

              {/* Materiales */}
              {r.articulos && r.articulos.length > 0 && (
                <div className="px-5 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Materiales / Repuestos</h3>
                  <div className="space-y-1">
                    {r.articulos.map((art, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-slate-700 py-0.5 border-b border-slate-50">
                        <span>{art.codigo} — {art.descripcion}</span>
                        <span className="font-bold ml-2">x{art.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Firma del especialista */}
              {r.signatureEngineer && (
                <div className="px-5 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Firma del Especialista</h3>
                  <img src={r.signatureEngineer} alt="Firma especialista" className="h-16 object-contain" />
                  {r.aclaracionEspecialista && (
                    <p className="text-[10px] text-slate-500 mt-1">Aclaración: {r.aclaracionEspecialista}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botón volver a firmar fijo abajo */}
          <div className="sticky bottom-0 p-4 bg-white border-t border-slate-200">
            <button
              onClick={() => setShowPreview(false)}
              className="w-full bg-slate-900 text-white font-black py-3 rounded-xl uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Proceder a firmar
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="space-y-4">
            {/* Botón para previsualizar */}
            <button
              onClick={() => setShowPreview(true)}
              className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver reporte antes de firmar
            </button>

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
