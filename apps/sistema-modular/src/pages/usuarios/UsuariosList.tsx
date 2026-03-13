import { useState, useEffect } from 'react';
import { usuariosService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { UsuarioAGS, UserRole } from '@ags/shared';
import { USER_ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_COLORS } from '@ags/shared';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const ROLES: UserRole[] = ['admin', 'ingeniero_soporte', 'admin_soporte', 'administracion'];

export const UsuariosList = () => {
  const [users, setUsers] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprove, setShowApprove] = useState<UsuarioAGS | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('ingeniero_soporte');

  const reload = async () => {
    setLoading(true);
    try { setUsers(await usuariosService.getAll()); }
    catch (err) { console.error('Error cargando usuarios:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  const handleApprove = async () => {
    if (!showApprove) return;
    try {
      await usuariosService.approveUser(showApprove.id, selectedRole);
      setShowApprove(null);
      reload();
    } catch { alert('Error al aprobar usuario'); }
  };

  const handleChangeRole = async (uid: string, role: UserRole) => {
    try { await usuariosService.updateRole(uid, role); reload(); }
    catch { alert('Error al cambiar rol'); }
  };

  const handleToggleStatus = async (u: UsuarioAGS) => {
    const newStatus = u.status === 'activo' ? 'deshabilitado' : 'activo';
    try { await usuariosService.updateStatus(u.id, newStatus); reload(); }
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
      <PageHeader title="Usuarios" subtitle="Gestion de usuarios y roles del sistema" count={users.length} />

      <div className="flex-1 min-h-0 px-5 pb-4">
        {users.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No hay usuarios registrados.</p></div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: '15%' }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={thClass}></th>
                  <th className={thClass}>Nombre</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Rol</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Ultimo login</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.status === 'deshabilitado' ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-medium">
                          {u.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-900 truncate">{u.displayName}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 truncate" title={u.email}>{u.email}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {u.status === 'activo' && u.role ? (
                        <select
                          value={u.role}
                          onChange={e => handleChangeRole(u.id, e.target.value as UserRole)}
                          className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${USER_STATUS_COLORS[u.status]}`}>
                        {USER_STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-0.5">
                        {u.status === 'pendiente' && (
                          <button
                            onClick={() => { setShowApprove(u); setSelectedRole('ingeniero_soporte'); }}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50"
                          >
                            Aprobar
                          </button>
                        )}
                        {u.status !== 'pendiente' && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                              u.status === 'activo'
                                ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                          >
                            {u.status === 'activo' ? 'Deshabilitar' : 'Habilitar'}
                          </button>
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
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ROLES.map(r => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
