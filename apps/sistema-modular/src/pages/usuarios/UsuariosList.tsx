import { useState, useEffect, useRef, useCallback } from 'react';
import { usuariosService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { UsuarioAGS, UserRole, AppId, ModuloId, UserPermissionsOverride } from '@ags/shared';
import {
  USER_ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_COLORS,
  ROLE_DEFAULTS, MODULO_LABELS, APP_LABELS, getUserPermissions,
} from '@ags/shared';

const ROLES: UserRole[] = ['admin', 'ingeniero_soporte', 'admin_soporte', 'admin_ing_soporte', 'ventas', 'admin_contable', 'administracion'];
const ALL_MODULOS = Object.keys(MODULO_LABELS) as ModuloId[];
const ALL_APPS = Object.keys(APP_LABELS) as AppId[];

export const UsuariosList = () => {
  const [users, setUsers] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprove, setShowApprove] = useState<UsuarioAGS | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('ingeniero_soporte');
  const [editUser, setEditUser] = useState<UsuarioAGS | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = usuariosService.subscribe(
      (data) => { setUsers(data); setLoading(false); },
      (err) => { console.error('Error cargando usuarios:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const reload = useCallback(() => {}, []);

  const handleApprove = async () => {
    if (!showApprove) return;
    try {
      await usuariosService.approveUser(showApprove.id, selectedRole);
      setShowApprove(null);
    } catch { alert('Error al aprobar usuario'); }
  };

  const handleToggleStatus = async (u: UsuarioAGS) => {
    const newStatus = u.status === 'activo' ? 'deshabilitado' : 'activo';
    try { await usuariosService.updateStatus(u.id, newStatus); }
    catch { alert('Error al cambiar estado'); }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading && users.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando usuarios...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Usuarios" subtitle="Gestion de usuarios, roles y permisos" count={users.length} />

      <div className="flex-1 min-h-0 px-5 pb-4">
        {users.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No hay usuarios registrados.</p></div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-10"></th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Usuario</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Rol</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Estado</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Ultimo login</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.status === 'deshabilitado' ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2.5">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] text-slate-500 font-medium">
                          {u.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{u.displayName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs text-slate-700">
                        {u.role ? USER_ROLE_LABELS[u.role] : <span className="text-slate-400 italic">Sin rol</span>}
                      </span>
                      {u.permisos && (
                        <span className="ml-1.5 text-[9px] font-medium bg-teal-100 text-teal-600 px-1 py-px rounded">custom</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${USER_STATUS_COLORS[u.status]}`}>
                        {USER_STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {u.status === 'pendiente' ? (
                          <button
                            onClick={() => { setShowApprove(u); setSelectedRole('ingeniero_soporte'); }}
                            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                          >
                            Aprobar
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditUser(u)}
                              className="text-[11px] font-medium text-teal-600 hover:text-teal-800 px-2 py-1 rounded hover:bg-teal-50 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                                u.status === 'activo'
                                  ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              {u.status === 'activo' ? 'Deshabilitar' : 'Habilitar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal aprobar usuario */}
      <Modal open={!!showApprove} onClose={() => setShowApprove(null)} title="Aprobar usuario" maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowApprove(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleApprove}>Aprobar</Button>
          </div>
        }
      >
        {showApprove && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {showApprove.photoURL && <img src={showApprove.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />}
              <div>
                <p className="text-sm font-medium text-slate-900">{showApprove.displayName}</p>
                <p className="text-xs text-slate-400">{showApprove.email}</p>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Asignar rol</label>
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value as UserRole)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
                {ROLES.map(r => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal editar usuario (rol + permisos) */}
      {editUser && (
        <EditUserModal
          usuario={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); reload(); }}
        />
      )}
    </div>
  );
};

// ─── Modal editar usuario (rol + permisos) ──────────────────────────────────

function EditUserModal({ usuario, onClose, onSaved }: {
  usuario: UsuarioAGS;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRole>(usuario.role ?? 'ingeniero_soporte');
  const [extraRoles, setExtraRoles] = useState<UserRole[]>(usuario.roles ?? []);
  const roleDefaults = ROLE_DEFAULTS[role];
  const effective = getUserPermissions({ ...usuario, role });

  const [useCustom, setUseCustom] = useState(!!usuario.permisos);
  const [apps, setApps] = useState<AppId[]>(effective.apps);
  const [modulos, setModulos] = useState<ModuloId[]>(effective.modulos);
  const [saving, setSaving] = useState(false);

  // Cuando cambia el rol, resetear permisos a defaults del nuevo rol
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (!useCustom) {
      setApps(ROLE_DEFAULTS[newRole].apps);
      setModulos(ROLE_DEFAULTS[newRole].modulos);
    }
  };

  const toggleApp = (app: AppId) => {
    setApps(prev => prev.includes(app) ? prev.filter(a => a !== app) : [...prev, app]);
  };

  const toggleModulo = (mod: ModuloId) => {
    setModulos(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const handleResetDefaults = () => {
    setUseCustom(false);
    setApps(roleDefaults.apps);
    setModulos(roleDefaults.modulos);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Guardar rol si cambió
      if (role !== usuario.role) {
        await usuariosService.updateRole(usuario.id, role);
      }
      // Guardar roles adicionales
      const rolesChanged = JSON.stringify(extraRoles) !== JSON.stringify(usuario.roles ?? []);
      if (rolesChanged) {
        await usuariosService.updateRoles(usuario.id, extraRoles);
      }
      // Guardar permisos
      const permisos: UserPermissionsOverride | null = useCustom ? { apps, modulos } : null;
      const permisosChanged = useCustom !== !!usuario.permisos ||
        (useCustom && (JSON.stringify(apps) !== JSON.stringify(usuario.permisos?.apps) || JSON.stringify(modulos) !== JSON.stringify(usuario.permisos?.modulos)));
      if (permisosChanged) {
        await usuariosService.updatePermissions(usuario.id, permisos);
      }
      onSaved();
    } catch {
      alert('Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = role === 'admin';

  return (
    <Modal open onClose={onClose} title="Editar usuario" maxWidth="md"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-slate-400">
            {isAdmin ? 'Acceso total (admin)' : useCustom ? 'Permisos personalizados' : `Permisos default de ${USER_ROLE_LABELS[role]}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Header con info del usuario */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          {usuario.photoURL ? (
            <img src={usuario.photoURL} alt="" className="w-11 h-11 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-sm text-slate-500 font-medium">
              {usuario.displayName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{usuario.displayName}</p>
            <p className="text-xs text-slate-400 truncate">{usuario.email}</p>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${USER_STATUS_COLORS[usuario.status]}`}>
            {USER_STATUS_LABELS[usuario.status]}
          </span>
        </div>

        {/* Selector de rol */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Rol</label>
          <div className="grid grid-cols-5 gap-1.5">
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => handleRoleChange(r)}
                className={`text-[11px] font-medium px-2 py-2 rounded-lg border transition-colors text-center ${
                  role === r
                    ? 'border-teal-300 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {USER_ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Roles adicionales */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Roles adicionales</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.filter(r => r !== role && r !== 'admin').map(r => (
              <label key={r} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={extraRoles.includes(r)}
                  onChange={() => setExtraRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                  className="w-3 h-3 accent-teal-600" />
                {USER_ROLE_LABELS[r]}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Permite al usuario aparecer en las áreas de derivación de estos roles.</p>
        </div>

        {/* Permisos — oculto para admin */}
        {isAdmin ? (
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-500">
            El rol Administrador tiene acceso total a todas las aplicaciones y modulos. No se puede restringir.
          </div>
        ) : (
          <>
            {/* Toggle personalizar */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={e => {
                    if (e.target.checked) {
                      setUseCustom(true);
                    } else {
                      handleResetDefaults();
                    }
                  }}
                  className="w-4 h-4 accent-teal-600 rounded"
                />
                <span className="text-xs font-medium text-slate-700">Personalizar permisos</span>
              </label>
              {useCustom && (
                <button onClick={handleResetDefaults} className="text-[10px] text-teal-600 hover:text-teal-800 font-medium">
                  Restaurar defaults
                </button>
              )}
            </div>

            {/* Apps */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Aplicaciones</p>
              <div className="grid grid-cols-3 gap-2">
                {ALL_APPS.map(app => {
                  const isChecked = isAdmin || apps.includes(app);
                  const isRoleDefault = roleDefaults.apps.includes(app);
                  return (
                    <label key={app} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      !useCustom ? 'opacity-60 cursor-not-allowed' : ''
                    } ${isChecked ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!useCustom}
                        onChange={() => toggleApp(app)}
                        className="w-3.5 h-3.5 accent-teal-600 rounded"
                      />
                      <span className="text-xs text-slate-700">{APP_LABELS[app]}</span>
                      {useCustom && isChecked !== isRoleDefault && (
                        <span className={`ml-auto text-[8px] font-bold ${isChecked ? 'text-emerald-500' : 'text-red-400'}`}>
                          {isChecked ? '+' : '-'}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modulos */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Modulos</p>
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_MODULOS.map(mod => {
                  const isChecked = modulos.includes(mod);
                  const isRoleDefault = roleDefaults.modulos.includes(mod);
                  return (
                    <label key={mod} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      !useCustom ? 'opacity-60 cursor-not-allowed' : ''
                    } ${isChecked ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!useCustom}
                        onChange={() => toggleModulo(mod)}
                        className="w-3.5 h-3.5 accent-teal-600 rounded"
                      />
                      <span className="text-[11px] text-slate-700">{MODULO_LABELS[mod]}</span>
                      {useCustom && isChecked !== isRoleDefault && (
                        <span className={`ml-auto text-[8px] font-bold ${isChecked ? 'text-emerald-500' : 'text-red-400'}`}>
                          {isChecked ? '+' : '-'}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Info sobre diferencias */}
            {useCustom && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-500">
                Los indicadores <span className="font-bold text-emerald-600">+</span> y <span className="font-bold text-red-500">-</span> muestran diferencias respecto a los defaults del rol seleccionado.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
