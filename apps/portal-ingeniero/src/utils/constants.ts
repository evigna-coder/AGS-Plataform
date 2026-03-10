import type { UserRole } from '@ags/shared';

export const PORTAL_ROLES: UserRole[] = ['ingeniero_soporte', 'admin'];

export const NAV_ITEMS = [
  { to: '/reportes', label: 'Reportes', mobileTab: true },
  { to: '/ordenes-trabajo', label: 'Órdenes de Trabajo', mobileTab: true },
  { to: '/equipos', label: 'Equipos', mobileTab: true },
  { to: '/agenda', label: 'Agenda', mobileTab: true },
  { to: '/leads', label: 'Leads', mobileTab: false },
  { to: '/clientes', label: 'Clientes', mobileTab: false },
  { to: '/perfil', label: 'Perfil', mobileTab: false },
] as const;
