import { useEffect, useState } from 'react';
import { registerNotifyHost, type NotifyItem, type NotifyKind } from '../../utils/notify';

const ESTILO: Record<NotifyKind, { barra: string; icono: string; texto: string }> = {
  success: { barra: 'bg-teal-600', icono: 'text-teal-700', texto: 'Listo' },
  error: { barra: 'bg-red-600', icono: 'text-red-600', texto: 'Error' },
  warning: { barra: 'bg-amber-500', icono: 'text-amber-600', texto: 'Atención' },
  info: { barra: 'bg-slate-500', icono: 'text-slate-600', texto: 'Aviso' },
};

const ICONO: Record<NotifyKind, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
};

const MAX_VISIBLES = 5;

/**
 * Host de los avisos de `notify` (2026-09-07). Abajo a la derecha, apilados,
 * cada uno se va solo según su tipo; los errores quedan más tiempo y se
 * pueden cerrar a mano. Se monta una vez en `App`.
 */
export function NotifyHost() {
  const [items, setItems] = useState<NotifyItem[]>([]);

  useEffect(() => {
    registerNotifyHost(item => {
      setItems(prev => [...prev.slice(-(MAX_VISIBLES - 1)), item]);
      window.setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), item.duration);
    });
    return () => registerNotifyHost(null);
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 w-full max-w-sm pointer-events-none" aria-live="polite">
      {items.map(item => {
        const e = ESTILO[item.kind];
        return (
          <div key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-slide-in">
            <div className={`w-1 shrink-0 ${e.barra}`} />
            <div className="flex items-start gap-2.5 px-3 py-2.5 flex-1 min-w-0">
              <svg className={`w-4 h-4 mt-0.5 shrink-0 ${e.icono}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO[item.kind]} />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400">{e.texto}</p>
                <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{item.message}</p>
              </div>
              <button type="button" aria-label="Cerrar"
                onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
