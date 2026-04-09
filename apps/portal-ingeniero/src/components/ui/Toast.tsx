import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationData } from '../../services/notificationService';

interface ToastItem {
  id: string;
  title: string;
  body: string;
  data: NotificationData;
  timestamp: number;
}

let addToastGlobal: ((toast: Omit<ToastItem, 'id' | 'timestamp'>) => void) | null = null;

/** Llamar desde cualquier parte de la app para mostrar un toast */
export function showToast(title: string, body: string, data: NotificationData) {
  addToastGlobal?.({ title, body, data });
}

const TOAST_DURATION = 5000;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const navigate = useNavigate();

  const addToast = useCallback((toast: Omit<ToastItem, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { ...toast, id, timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => Date.now() - t.timestamp < TOAST_DURATION));
    }, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleClick = (toast: ToastItem) => {
    dismiss(toast.id);
    if (toast.data.url) {
      navigate(toast.data.url);
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none sm:top-4 sm:right-4 max-sm:top-2 max-sm:right-2 max-sm:left-2 max-sm:max-w-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => handleClick(toast)}
          className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg p-3 cursor-pointer hover:bg-slate-50 transition-all animate-slide-in"
        >
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <NotificationIcon type={toast.data.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{toast.title}</p>
              <p className="text-xs text-slate-500 truncate">{toast.body}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case 'lead_urgent':
      return (
        <svg className={`${iconClass} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    case 'lead_finalized':
      return (
        <svg className={`${iconClass} text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    default:
      return (
        <svg className={`${iconClass} text-teal-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
}
