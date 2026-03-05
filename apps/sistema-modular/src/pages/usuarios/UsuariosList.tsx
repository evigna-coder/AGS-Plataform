import { useState, useEffect } from 'react';
import { usuariosService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { UsuarioAGS, UserRole } from '@ags/shared';
import { USER_ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_COLORS } from '@ags/shared';

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
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Usuarios" subtitle="Gestion de usuarios y roles del sistema" count={users.length} />

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : users.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay usuarios registrados.</p></div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4 w-10"></th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Email</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Rol</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Estado</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Ultimo login</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50/50 ${u.status === 'deshabilitado' ? 'opacity-50' : ''}`}>
                    <td className="py-2 px-4">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-medium">
                          {u.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </td>
                    <td className="text-xs py-2 px-4 font-medium text-slate-900">{u.displayName}</td>
                    <td className="text-xs py-2 px-4 text-slate-500">{u.email}</td>
                    <td className="text-xs py-2 px-4">
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
                    <td className="text-xs py-2 px-4">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${USER_STATUS_COLORS[u.status]}`}>
                        {USER_STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    <td className="text-xs py-2 px-4 text-slate-500">{formatDate(u.lastLoginAt)}</td>
                    <td className="text-xs py-2 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        {u.status === 'pendiente' && (
                          <button
                            onClick={() => { setShowApprove(u); setSelectedRole('ingeniero_soporte'); }}
                            className="text-[11px] text-green-600 hover:underline font-medium"
                          >
                            Aprobar
                          </button>
                        )}
                        {u.status !== 'pendiente' && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`text-[11px] font-medium hover:underline ${u.status === 'activo' ? 'text-amber-600' : 'text-green-600'}`}
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
