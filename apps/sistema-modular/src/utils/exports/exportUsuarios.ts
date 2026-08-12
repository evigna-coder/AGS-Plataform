import type { UsuarioAGS } from '@ags/shared';
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Usuarios (Excel + PDF vía ExportarButton).
 * "Último login" lleva fecha y hora (igual que la columna en pantalla).
 */

function fmtFechaHora(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export const USUARIOS_EXPORT_COLUMNS: ExportColumn<UsuarioAGS>[] = [
  { header: 'Nombre',            width: 24, get: u => u.displayName || '' },
  { header: 'Email',             width: 30, get: u => u.email || '' },
  { header: 'Rol',               width: 18, get: u => (u.role ? USER_ROLE_LABELS[u.role] : 'Sin rol') },
  { header: 'Roles adicionales', width: 24, get: u => (u.roles ?? []).map(r => USER_ROLE_LABELS[r]).join(', ') },
  { header: 'Estado',            width: 13, get: u => USER_STATUS_LABELS[u.status] },
  { header: 'Último login',      width: 15, get: u => fmtFechaHora(u.lastLoginAt) },
];
