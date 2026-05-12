import { useEffect, useState } from 'react';

type UpdateAPI = {
  onAvailable: (cb: (info: { version?: string }) => void) => () => void;
  onProgress: (cb: (info: { percent: number; bytesPerSecond: number }) => void) => () => void;
  onDownloaded: (cb: (info: { version?: string }) => void) => () => void;
  quitAndInstall: () => Promise<{ ok?: boolean; error?: string }>;
};

declare global {
  interface Window {
    updateAPI?: UpdateAPI;
  }
}

/**
 * Banner no-modal que avisa cuando hay una actualización lista para instalar.
 * Reemplaza al `dialog.showMessageBoxSync` bloqueante que tapaba la app cuando
 * terminaba la descarga. Ahora el download es silencioso de fondo y el user
 * decide cuándo reiniciar.
 *
 * No hace nada si window.updateAPI no existe (web / dev sin Electron).
 */
export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.updateAPI;
    if (!api) return;
    const unsubDownloaded = api.onDownloaded((info) => {
      setVersion(info.version || '');
      setDismissed(false);
    });
    return () => { unsubDownloaded(); };
  }, []);

  if (!version || dismissed) return null;

  const handleRestart = async () => {
    setInstalling(true);
    const api = window.updateAPI;
    if (!api) { setInstalling(false); return; }
    const res = await api.quitAndInstall();
    if (res?.error) {
      console.error('[UpdateBanner] quitAndInstall error:', res.error);
      setInstalling(false);
    }
    // Si ok, el proceso se cierra — no hace falta limpiar estado.
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] max-w-sm bg-white border border-teal-200 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3"
      role="status"
    >
      <div className="shrink-0 mt-0.5">
        <span className="inline-flex w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800">
          Actualización lista{version ? ` · v${version}` : ''}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Reiniciá la app cuando puedas para aplicar los cambios.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleRestart}
            disabled={installing}
            className="text-[11px] font-medium px-3 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {installing ? 'Reiniciando…' : 'Reiniciar ahora'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-[11px] font-medium px-3 py-1 rounded-md text-slate-500 hover:bg-slate-100"
          >
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
