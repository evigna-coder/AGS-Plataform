import React from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print transition-all duration-300 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
              {title}
            </h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Cerrar"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  onConfirm?: () => void;
  confirmText?: string;
  showCancel?: boolean;
  cancelText?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  onConfirm,
  confirmText = 'Aceptar',
  showCancel = false,
  cancelText = 'Cancelar'
}) => {
  const typeStyles = {
    info: 'bg-blue-600 hover:bg-blue-700',
    warning: 'bg-orange-600 hover:bg-orange-700',
    error: 'bg-red-600 hover:bg-red-700',
    success: 'bg-emerald-600 hover:bg-emerald-700'
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} showCloseButton={!onConfirm}>
      <div className="space-y-6">
        <p className="text-sm text-slate-700 whitespace-pre-line">{message}</p>
        <div className={`flex gap-3 ${showCancel ? '' : 'justify-end'}`}>
          {showCancel && (
            <button
              onClick={onClose}
              className="flex-1 bg-slate-200 text-slate-700 font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-slate-300"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`flex-1 ${typeStyles[type]} text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'info' | 'warning' | 'error' | 'success';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmType = 'warning'
}) => {
  const typeStyles = {
    info: 'bg-blue-600 hover:bg-blue-700',
    warning: 'bg-orange-600 hover:bg-orange-700',
    error: 'bg-red-600 hover:bg-red-700',
    success: 'bg-emerald-600 hover:bg-emerald-700'
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} showCloseButton={false}>
      <div className="space-y-6">
        <p className="text-sm text-slate-700 whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-700 font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-slate-300"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 ${typeStyles[confirmType]} text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
