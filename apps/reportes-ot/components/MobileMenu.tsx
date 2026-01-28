import React, { useState } from 'react';

interface MobileMenuProps {
  isPreviewMode: boolean;
  status: 'BORRADOR' | 'FINALIZADO';
  isGenerating: boolean;
  isSharing: boolean;
  hasPdfBlob: boolean;
  hasSignatures: boolean;
  onNewReport: () => void;
  onDuplicateOT: () => void;
  onReview: () => void;
  onFinalSubmit: () => void;
  onSharePDF: () => void;
  onDownloadPDF: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isPreviewMode,
  status,
  isGenerating,
  isSharing,
  hasPdfBlob,
  hasSignatures,
  onNewReport,
  onDuplicateOT,
  onReview,
  onFinalSubmit,
  onSharePDF,
  onDownloadPDF
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Detectar si es móvil
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // En desktop, mostrar botones normales
  if (!isMobile) {
    return (
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 no-print z-50">
        {!isPreviewMode && (
          <div className="flex flex-col gap-2">
            <button 
              onClick={onNewReport} 
              className="bg-slate-600 text-white font-black px-6 py-3 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 shadow-slate-500/50"
            >
              Nuevo reporte
            </button>
            <button 
              onClick={onDuplicateOT} 
              className="bg-purple-600 text-white font-black px-6 py-3 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 shadow-purple-500/50"
            >
              Duplicar OT
            </button>
          </div>
        )}
        {!isPreviewMode ? (
          <>
            {status === 'FINALIZADO' && hasPdfBlob ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={onSharePDF}
                  disabled={isSharing}
                  className="bg-purple-600 text-white font-black px-8 py-3 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSharing ? 'Compartiendo...' : 'Compartir / Enviar PDF'}
                </button>
                <button
                  onClick={onDownloadPDF}
                  className="bg-blue-600 text-white font-black px-8 py-3 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 shadow-blue-500/50"
                >
                  Descargar PDF
                </button>
              </div>
            ) : status === 'FINALIZADO' ? (
              <button 
                onClick={onFinalSubmit} 
                disabled={isGenerating}
                className="bg-emerald-600 text-white font-black px-12 py-4 rounded-full shadow-2xl uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generando PDF...' : 'Generar PDF'}
              </button>
            ) : (
              <button onClick={onReview} className="bg-blue-600 text-white font-black px-12 py-4 rounded-full shadow-2xl uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-blue-500/50">Revisar y Continuar</button>
            )}
          </>
        ) : (
          <button 
            onClick={onFinalSubmit} 
            disabled={isGenerating || !hasSignatures} 
            className={`font-black px-12 py-4 rounded-full shadow-2xl uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 ${!hasSignatures ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/50'}`}
          >
            {isGenerating ? 'Generando PDF...' : 'Finalizar y Descargar PDF'}
          </button>
        )}
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
                    {isGenerating ? 'Generando...' : 'Generar PDF'}
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
              <button 
                onClick={() => {
                  setIsOpen(false);
                  onFinalSubmit();
                }} 
                disabled={isGenerating || !hasSignatures} 
                className={`font-black px-4 py-2.5 rounded-full shadow-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 whitespace-nowrap ${
                  !hasSignatures ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/50'
                }`}
              >
                {isGenerating ? 'Generando...' : 'Finalizar PDF'}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
};
