import { useState, useCallback } from 'react';

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  onConfirm?: () => void;
  confirmText?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'info' | 'warning' | 'error' | 'success';
}

export interface UseModalReturn {
  // Estados
  alertModal: {
    isOpen: boolean;
    options: AlertOptions | null;
  };
  confirmModal: {
    isOpen: boolean;
    options: ConfirmOptions | null;
  };

  // Funciones
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  closeAlert: () => void;
  closeConfirm: () => void;
}

/**
 * Hook para manejar modales de alerta y confirmación
 * Reemplaza window.alert() y window.confirm()
 */
export const useModal = (): UseModalReturn => {
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    options: AlertOptions | null;
  }>({
    isOpen: false,
    options: null
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
  }>({
    isOpen: false,
    options: null
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertModal({
      isOpen: true,
      options
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        options: {
          ...options,
          onConfirm: () => {
            if (options.onConfirm) {
              options.onConfirm();
            }
            resolve(true);
          },
          onCancel: () => {
            if (options.onCancel) {
              options.onCancel();
            }
            resolve(false);
          }
        }
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModal({
      isOpen: false,
      options: null
    });
  }, []);

  const closeConfirm = useCallback(() => {
    if (confirmModal.options?.onCancel) {
      confirmModal.options.onCancel();
    }
    setConfirmModal({
      isOpen: false,
      options: null
    });
  }, [confirmModal.options]);

  return {
    alertModal,
    confirmModal,
    showAlert,
    showConfirm,
    closeAlert,
    closeConfirm
  };
};
