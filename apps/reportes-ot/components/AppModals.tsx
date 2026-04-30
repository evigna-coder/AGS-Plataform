import React from 'react';
import { AlertModal, ConfirmModal } from './Modal';
import type { UseModalReturn } from '../hooks/useModal';

interface AppModalsProps {
  // Share modal
  showShareModal: boolean;
  setShowShareModal: (v: boolean) => void;
  shareUrl: string | null;
  otNumber: string;
  // QR modal
  showQRModal: boolean;
  setShowQRModal: (v: boolean) => void;
  qrRef: React.RefObject<HTMLDivElement | null>;
  qrUrl: string | null;
  // New OT modal
  showNewOtModal: boolean;
  setShowNewOtModal: (v: boolean) => void;
  pendingOt: string;
  setPendingOt: (v: string) => void;
  setOtInput: (v: string) => void;
  confirmCreateNewOt: () => void;
  // Modal hook
  modal: UseModalReturn;
}

export const AppModals: React.FC<AppModalsProps> = ({
  showShareModal, setShowShareModal, shareUrl, otNumber,
  showQRModal, setShowQRModal, qrRef, qrUrl,
  showNewOtModal, setShowNewOtModal, pendingOt, setPendingOt, setOtInput, confirmCreateNewOt,
  modal,
}) => {
  return (
    <>
      {/* Modal Compartir PDF */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print transition-all duration-300 ${showShareModal ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
        onClick={() => setShowShareModal(false)}
      >
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-4">Compartir Reporte</h3>
          <p className="text-xs text-slate-600 mb-4">El PDF ha sido subido. Use una de las siguientes opciones:</p>

          {shareUrl && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Enlace del PDF:</label>
              <div className="flex gap-2">
                <input type="text" value={shareUrl} readOnly className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    modal.showAlert({ title: 'Éxito', message: 'Enlace copiado al portapapeles', type: 'success' });
                  }}
                  className="bg-slate-600 text-white font-black px-4 py-2 rounded-lg uppercase tracking-widest text-[10px] transition-all hover:bg-slate-700"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={() => { if (shareUrl) window.open(shareUrl, '_blank'); }} className="w-full bg-blue-600 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-blue-700 shadow-lg">Abrir en navegador</button>
            <button onClick={() => { if (shareUrl) { const subject = encodeURIComponent(`Reporte OT ${otNumber}`); const body = encodeURIComponent(`Adjunto el enlace al reporte: ${shareUrl}`); window.location.href = `mailto:?subject=${subject}&body=${body}`; } }} className="w-full bg-green-600 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-green-700 shadow-lg">Enviar por correo</button>
            <button onClick={() => setShowShareModal(false)} className="w-full bg-slate-200 text-slate-700 font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-slate-300">Cerrar</button>
          </div>
        </div>
      </div>

      {/* Modal QR para Firma Remota */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print transition-all duration-300 ${showQRModal ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
        onClick={() => setShowQRModal(false)}
      >
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="text-center space-y-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Firma en Móvil</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">Escanea este código con el dispositivo que el cliente usará para firmar. Al confirmar la firma en el móvil, se sincronizará automáticamente aquí.</p>

            <div className="bg-white p-4 rounded-2xl border-2 border-slate-50 flex items-center justify-center shadow-inner mx-auto overflow-hidden" style={{ width: '182px', height: '182px' }}>
              <div ref={qrRef} id="qrcode-container" className="block mx-auto" style={{ width: '150px', height: '150px' }}></div>
            </div>

            {qrUrl && (
              <div className="text-left">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">¿No podés escanear? Abrí este enlace</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrUrl}
                    readOnly
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 py-2 text-[10px] font-mono bg-slate-50 truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(qrUrl);
                      modal.showAlert({ title: 'Listo', message: 'Enlace copiado al portapapeles', type: 'success' });
                    }}
                    className="bg-slate-600 text-white font-black px-3 rounded-lg uppercase tracking-widest text-[10px] hover:bg-slate-700"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 space-y-2">
              <button onClick={() => setShowQRModal(false)} className="w-full bg-slate-100 text-slate-600 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors">Cerrar</button>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Sincronizado vía Firebase Cloud</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Confirmar Nueva OT */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print transition-all duration-300 ${showNewOtModal ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
        onClick={() => { setShowNewOtModal(false); setPendingOt(''); setOtInput(''); }}
      >
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-4">OT No Encontrada</h3>
          <p className="text-sm text-slate-600 mb-6">La OT <span className="font-black text-blue-700">{pendingOt}</span> no existe en el sistema.</p>
          <p className="text-xs text-slate-500 mb-6">¿Desea crear una nueva orden de trabajo con este número?</p>
          <div className="flex gap-3">
            <button onClick={() => { setShowNewOtModal(false); setPendingOt(''); setOtInput(''); }} className="flex-1 bg-slate-200 text-slate-700 font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-slate-300">Cancelar</button>
            <button onClick={confirmCreateNewOt} className="flex-1 bg-blue-600 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-blue-700 shadow-lg">Crear OT</button>
          </div>
        </div>
      </div>

      {/* Modales de alerta y confirmación */}
      <AlertModal
        isOpen={modal.alertModal.isOpen}
        onClose={modal.closeAlert}
        title={modal.alertModal.options?.title}
        message={modal.alertModal.options?.message || ''}
        type={modal.alertModal.options?.type || 'info'}
        onConfirm={modal.alertModal.options?.onConfirm}
        confirmText={modal.alertModal.options?.confirmText}
      />

      <ConfirmModal
        isOpen={modal.confirmModal.isOpen}
        onClose={modal.closeConfirm}
        onConfirm={() => { if (modal.confirmModal.options?.onConfirm) modal.confirmModal.options.onConfirm(); }}
        title={modal.confirmModal.options?.title}
        message={modal.confirmModal.options?.message || ''}
        confirmText={modal.confirmModal.options?.confirmText}
        cancelText={modal.confirmModal.options?.cancelText}
        confirmType={modal.confirmModal.options?.confirmType}
      />
    </>
  );
};
