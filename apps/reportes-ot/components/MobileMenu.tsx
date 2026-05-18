import React, { useState } from 'react';

interface MobileMenuProps {
  isPreviewMode: boolean;
  status: 'BORRADOR' | 'FINALIZADO';
  isGenerating: boolean;
  generationStep?: string;
  isSharing: boolean;
  hasPdfBlob: boolean;
  hasSignatures: boolean;
  onNewReport: () => void;
  onDuplicateOT: () => void;
  onReview: () => void;
  onFinalSubmit: () => void;
  /** Confirma y envía por mail en vez de descargar. Misma validación que onFinalSubmit. */
  onFinalSubmitAndEmail?: () => void;
  isSendingEmail?: boolean;
  onSharePDF: () => void;
  onDownloadPDF: () => void;
  onSignOut: () => void;
  onBackToEdit?: () => void;
  /** Modo "Protocolo en blanco" — para enviar protocolo vacío a cliente. */
  blankPreviewMode?: boolean;
  onStartBlankPreview?: () => void;
  onDownloadBlankProtocol?: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isPreviewMode,
  status,
  isGenerating,
  generationStep,
  isSharing,
  hasPdfBlob,
  hasSignatures,
  onNewReport,
  onDuplicateOT,
  onReview,
  onFinalSubmit,
  onFinalSubmitAndEmail,
  isSendingEmail = false,
  onSharePDF,
  onDownloadPDF,
  onSignOut,
  onBackToEdit,
  blankPreviewMode = false,
  onStartBlankPreview,
  onDownloadBlankProtocol,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Detectar si es móvil
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // En desktop, mostrar botones normales (compactos)
  if (!isMobile) {
    // ── Modo "Protocolo en blanco": menú simplificado ──
    if (blankPreviewMode) {
      return (
        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 no-print z-50">
          <button
            onClick={onDownloadBlankProtocol}
            disabled={isGenerating}
            className="bg-blue-600 text-white font-bold px-5 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (generationStep || 'Generando…') : 'Descargar PDF en blanco'}
          </button>
          <button
            onClick={onNewReport}
            className="bg-slate-600 text-white font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide text-[10px] transition-all hover:scale-105 active:scale-95"
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return (
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 no-print z-50">
        {!isPreviewMode && (
          <>
            <button
              onClick={onNewReport}
              className="bg-slate-600 text-white font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide text-[10px] transition-all hover:scale-105 active:scale-95"
            >
              Nuevo reporte
            </button>
            {onStartBlankPreview && (
              <button
                onClick={onStartBlankPreview}
                className="bg-teal-600 text-white font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide text-[10px] transition-all hover:scale-105 active:scale-95"
                title="Generar PDF del protocolo vacío para enviar al cliente"
              >
                Protocolo en blanco
              </button>
            )}
            <button
              onClick={onDuplicateOT}
              className="bg-purple-600 text-white font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide text-[10px] transition-all hover:scale-105 active:scale-95"
            >
              Duplicar OT
            </button>
          </>
        )}
        {!isPreviewMode ? (
          <>
            {status === 'FINALIZADO' && hasPdfBlob ? (
              <div className="flex flex-col gap-2 items-end">
                <button
                  onClick={onSharePDF}
                  disabled={isSharing}
                  className="bg-purple-600 text-white font-bold px-4 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSharing ? 'Compartiendo...' : 'Compartir / Enviar PDF'}
                </button>
                <button
                  onClick={onDownloadPDF}
                  className="bg-blue-600 text-white font-bold px-4 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95"
                >
                  Descargar PDF
                </button>
              </div>
            ) : status === 'FINALIZADO' ? (
              <button
                onClick={onFinalSubmit}
                disabled={isGenerating}
                className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (generationStep || 'Generando PDF…') : 'Generar PDF'}
              </button>
            ) : (
              <button
                onClick={onReview}
                className="bg-blue-600 text-white font-bold px-5 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95"
              >
                Revisar y continuar
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2 items-end">
            {onBackToEdit && (
              <button
                onClick={onBackToEdit}
                className="bg-slate-700 text-white font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide text-[10px] transition-all hover:scale-105 active:scale-95"
              >
                Volver a Editar
              </button>
            )}
            <button
              onClick={onFinalSubmit}
              disabled={isGenerating || isSendingEmail || !hasSignatures}
              className={`font-bold px-5 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95 ${!hasSignatures ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white'} disabled:opacity-50`}
            >
              {isGenerating ? 'Generando PDF...' : 'Finalizar y Descargar PDF'}
            </button>
            {onFinalSubmitAndEmail && (
              <button
                onClick={onFinalSubmitAndEmail}
                disabled={isGenerating || isSendingEmail || !hasSignatures}
                className={`font-bold px-5 py-2 rounded-full shadow-md uppercase tracking-wide text-[11px] transition-all hover:scale-105 active:scale-95 ${!hasSignatures ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-teal-700 text-white hover:bg-teal-800'} disabled:opacity-50`}
                title="Confirma y envía por mail (al contacto principal + contactos adicionales)"
              >
                {isSendingEmail ? (generationStep || 'Enviando…') : 'Finalizar y Enviar por Mail'}
              </button>
            )}
          </div>
        )}
        <button
          onClick={onSignOut}
          className="bg-slate-500/80 text-white font-bold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide text-[10px] transition-all hover:bg-slate-600 hover:scale-105 active:scale-95"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  // En móvil, mostrar menú colapsable
  return (
    <>
      {/* Botón flotante principal - siempre visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 bg-slate-800 text-white font-black p-4 rounded-full shadow-2xl uppercase tracking-widest text-xs transition-all z-50 no-print ${
          isOpen ? 'bg-slate-700 scale-110' : 'hover:scale-105 active:scale-95'
        }`}
        aria-label="Menú de acciones"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Menú expandido */}
      {isOpen && (
        <>
          {/* Overlay para cerrar al tocar fuera */}
          <div
            className="fixed inset-0 bg-black/20 z-40 no-print"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Contenedor del menú */}
          <div className="fixed bottom-20 right-6 flex flex-col items-end gap-2 no-print z-50 animate-in slide-in-from-bottom-2 duration-200">
            {!isPreviewMode && (
              <>
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    onNewReport();
                  }} 
                  className="bg-slate-600 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-slate-500/50 whitespace-nowrap"
                >
                  Nuevo reporte
                </button>
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    onDuplicateOT();
                  }} 
                  className="bg-purple-600 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-purple-500/50 whitespace-nowrap"
                >
                  Duplicar OT
                </button>
              </>
            )}
            
            {!isPreviewMode ? (
              <>
                {status === 'FINALIZADO' && hasPdfBlob ? (
                  <>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onSharePDF();
                      }}
                      disabled={isSharing}
                      className="bg-purple-600 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isSharing ? 'Compartiendo...' : 'Compartir PDF'}
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onDownloadPDF();
                      }}
                      className="bg-blue-600 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-blue-500/50 whitespace-nowrap"
                    >
                      Descargar PDF
                    </button>
                  </>
                ) : status === 'FINALIZADO' ? (
                  <button 
                    onClick={() => {
                      setIsOpen(false);
                      onFinalSubmit();
                    }} 
                    disabled={isGenerating}
                    className="bg-emerald-600 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isGenerating ? (generationStep || 'Generando…') : 'Generar PDF'}
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setIsOpen(false);
                      onReview();
                    }} 
                    className="bg-blue-600 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-blue-500/50 whitespace-nowrap"
                  >
                    Revisar
                  </button>
                )}
              </>
            ) : (
              <>
                {onBackToEdit && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onBackToEdit();
                    }}
                    className="bg-slate-700 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 whitespace-nowrap"
                  >
                    Volver a Editar
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onFinalSubmit();
                  }}
                  disabled={isGenerating || isSendingEmail || !hasSignatures}
                  className={`font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 whitespace-nowrap ${
                    !hasSignatures ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/50'
                  } disabled:opacity-50`}
                >
                  {isGenerating ? (generationStep || 'Finalizando…') : 'Finalizar PDF'}
                </button>
                {onFinalSubmitAndEmail && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onFinalSubmitAndEmail();
                    }}
                    disabled={isGenerating || isSendingEmail || !hasSignatures}
                    className={`font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 whitespace-nowrap ${
                      !hasSignatures ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-teal-700 text-white shadow-teal-500/50'
                    } disabled:opacity-50`}
                  >
                    {isSendingEmail ? (generationStep || 'Enviando…') : 'Finalizar y Enviar Mail'}
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="mt-2 bg-slate-500/90 text-white font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 whitespace-nowrap"
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </>
  );
};
