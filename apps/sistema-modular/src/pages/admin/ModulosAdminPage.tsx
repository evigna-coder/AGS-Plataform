import { useMemo } from 'react';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { getAllModulePaths, isMvpDefault } from '../../components/layout/navigation';
import { setModuleEnabled } from '../../services/featureFlagsService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * UI admin `/admin/modulos` — toggles por módulo con reactividad live.
 *
 * - Source of truth del catálogo de módulos: `getAllModulePaths()` (navigation.ts).
 * - Default de cada toggle (cuando no hay override en Firestore): `isMvpDefault(path)`.
 *   El set MVP vive en UN SOLO lugar (navigation.ts) y se consume via ese helper.
 * - Click en toggle → `setModuleEnabled(path, enabled, uid)` → writes a Firestore con
 *   setDoc merge → onSnapshot del provider propaga → sidebar se actualiza sin recarga.
 * - Shape de auth: `useAuth()` devuelve `{ firebaseUser, usuario }`; usamos
 *   `firebaseUser.uid` para el campo `updatedBy` (uid real de Firebase Auth).
 */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        checked ? 'bg-teal-700' : 'bg-slate-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={checked}
      aria-label={checked ? 'Desactivar módulo' : 'Activar módulo'}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transform transition ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

interface ModuleRowProps {
  mod: { path: string; name: string; icon: string };
  flag: { enabled: boolean; updatedBy: string } | undefined;
  defaultEnabled: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}

function ModuleRow({ mod, flag, defaultEnabled, disabled, onToggle }: ModuleRowProps) {
  const effectiveEnabled = flag ? flag.enabled : defaultEnabled;
  const isOverride = !!flag;
  return (
    <div className="flex items-center justify-between py-2.5 px-3 border-b border-slate-100 hover:bg-slate-50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0">{mod.icon}</span>
        <div className="min-w-0">
          <div className="text-sm text-slate-900 truncate">{mod.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
            {mod.path}
            {isOverride && <span className="ml-2 text-teal-700">· OVERRIDE</span>}
          </div>
        </div>
      </div>
      <Toggle
        checked={effectiveEnabled}
        onChange={() => onToggle(!effectiveEnabled)}
        disabled={disabled}
      />
    </div>
  );
}

export default function ModulosAdminPage() {
  const flags = useFeatureFlags();
  const { firebaseUser } = useAuth();
  const modules = useMemo(() => getAllModulePaths(), []);
  const isDesktopMvp = import.meta.env.VITE_DESKTOP_MVP === 'true';

  async function handleToggle(path: string, next: boolean) {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    await setModuleEnabled(path, next, uid);
    // El onSnapshot del provider refleja el cambio; no hace falta estado local.
  }

  if (flags === null) {
    return (
      <div className="p-6">
        <p className="text-xs text-slate-400">Cargando feature flags…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="font-serif text-2xl text-slate-900 mb-1">Módulos</h1>
      <p className="text-sm text-slate-600 mb-6">
        Togglear módulos sin rebuild. Los overrides de Firestore tienen prioridad sobre el build flag{' '}
        {isDesktopMvp
          ? '(VITE_DESKTOP_MVP=true — default: solo módulos MVP)'
          : '(VITE_DESKTOP_MVP=false — default: todos los módulos visibles)'}.
      </p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {modules.map(mod => {
          const flag = flags.modules[mod.path];
          const defaultEnabled = isMvpDefault(mod.path);
          return (
            <ModuleRow
              key={mod.path}
              mod={mod}
              flag={flag}
              defaultEnabled={defaultEnabled}
              disabled={!firebaseUser?.uid}
              onToggle={next => handleToggle(mod.path, next)}
            />
          );
        })}
      </div>
    </div>
  );
}
