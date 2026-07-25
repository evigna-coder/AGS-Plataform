import { House, Inbox, ClipboardList, Truck, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', shortLabel: 'Inicio', icon: House },
  { to: '/requerimientos', label: 'Requerimientos', shortLabel: 'Requer.', icon: Inbox },
  { to: '/ordenes', label: 'Órdenes de compra', shortLabel: 'OCs', icon: ClipboardList },
  { to: '/entregas', label: 'Entregas', shortLabel: 'Entregas', icon: Truck },
];
