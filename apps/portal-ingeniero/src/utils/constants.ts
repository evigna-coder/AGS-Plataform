import type { UserRole } from '@ags/shared';

export const PORTAL_ROLES: UserRole[] = ['ingeniero_soporte', 'admin'];

/**
 * URL de la app reportes-ot.
 * En desarrollo: localhost:3000 (Vite dev server).
 * En producción: dominio Vercel.
 */
export const REPORTES_OT_URL =
  import.meta.env.VITE_REPORTES_OT_URL || 'https://ags-plataform.vercel.app';

export const NAV_ITEMS = [
  { to: '/reportes', label: 'Reportes', mobileTab: true },
  { to: '/ordenes-trabajo', label: 'Órdenes de Trabajo', mobileTab: true },
  { to: '/equipos', label: 'Equipos', mobileTab: true },
  { to: '/agenda', label: 'Agenda', mobileTab: true },
  { to: '/leads', label: 'Leads', mobileTab: false },
  { to: '/clientes', label: 'Clientes', mobileTab: false },
  { to: '/perfil', label: 'Perfil', mobileTab: false },
] as const;
