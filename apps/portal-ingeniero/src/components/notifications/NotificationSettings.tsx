import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fcmTokensService, notificationPrefsService } from '../../services/firebaseService';
import {
  requestNotificationPermission,
  getPermissionStatus,
  getCurrentToken,
  getLastNotificationError,
} from '../../services/notificationService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { NotificationPreferences } from '@ags/shared';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@ags/shared';

const ADMIN_ROLES = ['admin', 'admin_soporte', 'admin_ing_soporte'];

export function NotificationSettings() {
  const { usuario, firebaseUser } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = usuario?.role ? ADMIN_ROLES.includes(usuario.role) : false;

  useEffect(() => {
    setPermissionStatus(getPermissionStatus());
    if (!firebaseUser?.uid) return;
    notificationPrefsService.get(firebaseUser.uid).then(saved => {
      if (saved) setPrefs(saved);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [firebaseUser?.uid]);

  const savePrefs = useCallback(async (newPrefs: NotificationPreferences) => {
    if (!firebaseUser?.uid) return;
    setSaving(true);
    setMessage(null);
    try {
      await notificationPrefsService.save(firebaseUser.uid, newPrefs);
      setPrefs(newPrefs);
      setMessage({ type: 'success', text: 'Preferencias guardadas.' });
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar preferencias.' });
    } finally {
      setSaving(false);
    }
  }, [firebaseUser?.uid]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    savePrefs(newPrefs);
  };

  const handleScopeChange = (scope: 'mine' | 'all') => {
    const newPrefs = { ...prefs, scope };
    setPrefs(newPrefs);
    savePrefs(newPrefs);
  };

  const handleActivate = async () => {
    setMessage(null);
    const token = await requestNotificationPermission();
    if (token && firebaseUser?.uid) {
      await fcmTokensService.saveToken(firebaseUser.uid, token);
      setPermissionStatus('granted');
      // Asegurar que pushEnabled está activo
      if (!prefs.pushEnabled) {
        const newPrefs = { ...prefs, pushEnabled: true };
        await savePrefs(newPrefs);
      }
      setMessage({ type: 'success', text: 'Notificaciones activadas para este dispositivo.' });
    } else {
      setPermissionStatus(getPermissionStatus());
      const err = getLastNotificationError();
      if (getPermissionStatus() === 'denied') {
        setMessage({ type: 'error', text: 'Permiso denegado. Revisá la configuración del navegador.' });
      } else if (err) {
        setMessage({ type: 'error', text: `No se pudo activar: ${err}` });
      } else {
        setMessage({ type: 'error', text: 'No se pudo activar (motivo desconocido — revisá la consola).' });
      }
    }
  };

  const handleDeactivate = async () => {
    if (!firebaseUser?.uid) return;
    const token = getCurrentToken();
    if (token) {
      await fcmTokensService.removeToken(firebaseUser.uid, token);
    }
    const newPrefs = { ...prefs, pushEnabled: false };
    await savePrefs(newPrefs);
    setMessage({ type: 'success', text: 'Notificaciones desactivadas.' });
  };

  if (loading) {
    return (
      <Card>
        <div className="h-20 flex items-center justify-center">
          <p className="text-xs text-slate-400 animate-pulse">Cargando preferencias...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
          {permissionStatus === 'granted' && prefs.pushEnabled && (
            <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Activas
            </span>
          )}
        </div>

        {permissionStatus === 'unsupported' ? (
          <p className="text-xs text-slate-500">
            Tu navegador no soporta notificaciones push.
          </p>
        ) : permissionStatus !== 'granted' || !prefs.pushEnabled ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Recibí notificaciones cuando te asignan tickets, te derivan uno, o hay comentarios nuevos.
            </p>
            {permissionStatus === 'denied' ? (
              <p className="text-xs text-amber-600">
                Las notificaciones están bloqueadas en el navegador. Para activarlas, revisá la configuración del sitio en tu navegador.
              </p>
            ) : (
              <Button size="sm" onClick={handleActivate}>
                Activar notificaciones
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Toggles individuales */}
            <div className="space-y-2">
              <Toggle
                label="Ticket asignado"
                description="Cuando me asignan un ticket"
                checked={prefs.notifyOnAssigned}
                onChange={() => handleToggle('notifyOnAssigned')}
                disabled={saving}
              />
              <Toggle
                label="Ticket derivado"
                description="Cuando me derivan un ticket"
                checked={prefs.notifyOnDerived}
                onChange={() => handleToggle('notifyOnDerived')}
                disabled={saving}
              />
              <Toggle
                label="Comentarios"
                description="Comentario nuevo en mis tickets"
                checked={prefs.notifyOnComment}
                onChange={() => handleToggle('notifyOnComment')}
                disabled={saving}
              />
              <Toggle
                label="Finalización"
                description="Ticket cerrado donde participo"
                checked={prefs.notifyOnFinalized}
                onChange={() => handleToggle('notifyOnFinalized')}
                disabled={saving}
              />
              <Toggle
                label="Urgentes"
                description="Tickets marcados como urgente"
                checked={prefs.notifyOnUrgent}
                onChange={() => handleToggle('notifyOnUrgent')}
                disabled={saving}
              />
            </div>

            {/* Scope (solo admins) */}
            {isAdmin && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-2">
                  Alcance
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScopeChange('mine')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      prefs.scope === 'mine'
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    disabled={saving}
                  >
                    Solo mis tickets
                  </button>
                  <button
                    onClick={() => handleScopeChange('all')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      prefs.scope === 'all'
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    disabled={saving}
                  >
                    Todos los tickets
                  </button>
                </div>
              </div>
            )}

            {/* Desactivar */}
            <div className="pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={saving}>
                Desactivar notificaciones
              </Button>
            </div>
          </div>
        )}

        {message && (
          <p className={`text-xs font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Toggle Component ────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer group">
      <div>
        <p className="text-sm text-slate-800 group-hover:text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
          checked ? 'bg-teal-600' : 'bg-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
