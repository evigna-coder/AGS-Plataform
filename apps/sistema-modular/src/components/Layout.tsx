import { useEffect, useRef, useState } from 'react';
import { usePreferenciaUsuario } from '../hooks/usePreferenciaUsuario';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/authService';
import { MinimizedModalsBar } from './ui/Modal';
import { useLayoutKeyboardShortcuts } from './layout/useLayoutKeyboardShortcuts';
import { TabBar } from './layout/TabBar';
import { SidebarNav } from './layout/SidebarNav';
import { BackgroundTasksIndicator } from './layout/BackgroundTasksIndicator';
import { FloatingPresupuesto } from './layout/FloatingPresupuesto';
import { TabContentManager } from './layout/TabContentManager';
import { ContentOverlayScope } from '../contexts/TabOverlayContext';
import { NotificationButton } from './notifications/NotificationButton';

export const Layout: React.FC = () => {
  const { usuario } = useAuth();
  // Auto-ocultar (2026-09-29, preferencia del usuario): con el tilde puesto el
  // menú arranca contraído a los íconos, se expande al pasar el mouse y se
  // vuelve a contraer 2 s después de salir. El botón de la hamburguesa sigue
  // funcionando como siempre.
  const [pref, setPref] = usePreferenciaUsuario('sidebar', { autoOcultar: false });
  const autoOcultar = pref.autoOcultar === true;
  const [collapsed, setCollapsed] = useState(autoOcultar);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  useEffect(() => { setCollapsed(autoOcultar); cancelarTimer(); }, [autoOcultar]);
  useEffect(() => cancelarTimer, []);
  const onSidebarEnter = () => { if (!autoOcultar) return; cancelarTimer(); setCollapsed(false); };
  const onSidebarLeave = () => {
    if (!autoOcultar) return;
    cancelarTimer();
    timerRef.current = setTimeout(() => { setCollapsed(true); timerRef.current = null; }, 2000);
  };

  useLayoutKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
            title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setPref({ autoOcultar: !autoOcultar })}
            className={`p-1 rounded transition-colors ${autoOcultar ? 'text-teal-600 bg-teal-50 hover:bg-teal-100' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
            title={autoOcultar ? 'El menú se oculta solo al salir (click para dejarlo fijo)' : 'Ocultar el menú automáticamente al salir con el mouse'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 4h4m0 0v4m0-4l-6 6M9 20H5m0 0v-4m0 4l6-6" />
            </svg>
          </button>
          <span className="text-teal-600 font-bold text-base tracking-tight">AGS</span>
          <span className="text-slate-300 text-sm">|</span>
          <span className="text-slate-600 text-sm font-medium">Sistema Modular</span>
          {window.electronAPI && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-medium">
              Desktop
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <NotificationButton />
          {usuario?.photoURL && (
            <img src={usuario.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
          )}
          <span className="text-xs text-slate-600 font-medium max-w-[120px] truncate">{usuario?.displayName}</span>
          <button onClick={() => signOut()} className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
            Salir
          </button>
        </div>
      </header>

      <TabBar />

      <div className="flex flex-1 overflow-hidden">
        <div className="shrink-0 flex" onMouseEnter={onSidebarEnter} onMouseLeave={onSidebarLeave}>
          <SidebarNav collapsed={collapsed} onCollapse={setCollapsed} />
        </div>
        {/* relative: ancla del ContentOverlayScope — el presupuesto flotante
            cubre solo el área de contenido, dejando header/TabBar/sidebar
            clickeables (UAT 2026-07-31). */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-slate-50 relative">
          <TabContentManager />
          <ContentOverlayScope>
            <FloatingPresupuesto />
          </ContentOverlayScope>
        </main>
      </div>

      <BackgroundTasksIndicator />
      <MinimizedModalsBar />
    </div>
  );
};
