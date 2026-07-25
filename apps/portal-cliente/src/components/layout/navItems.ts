import { House, Boxes, History, FileText, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', shortLabel: 'Inicio', icon: House },
  { to: '/equipos', label: 'Mis equipos', shortLabel: 'Equipos', icon: Boxes },
  { to: '/historial', label: 'Historial', shortLabel: 'Historial', icon: History },
  { to: '/documentos', label: 'Documentos', shortLabel: 'Docs', icon: FileText },
];
