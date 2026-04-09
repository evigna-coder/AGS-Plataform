import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export function InstallBanner() {
  const { canShow, install, dismiss } = useInstallPrompt();

  if (!canShow) return null;

  return (
    <div className="mx-4 mt-3 mb-1 bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-3 animate-slide-in">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-indigo-900">Instalar Portal AGS</p>
        <p className="text-xs text-indigo-700">Acceso directo y notificaciones push.</p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={dismiss}
          className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1"
        >
          Ahora no
        </button>
        <button
          onClick={install}
          className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
