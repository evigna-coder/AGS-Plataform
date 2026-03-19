import type { Posta } from '@ags/shared';

/** Days since a given ISO date string. */
export function getDaysOpen(createdAt: string): number {
  if (!createdAt) return 0;
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diff / 86400000);
}

/** Days since the last posta (most recent activity). null if no postas. */
export function getDaysSinceLastActivity(postas: Posta[]): number | null {
  if (!postas.length) return null;
  const last = postas[postas.length - 1];
  if (!last.fecha) return null;
  const diff = Date.now() - new Date(last.fecha).getTime();
  return Math.floor(diff / 86400000);
}

/** Days until próximo contacto. Negative = overdue, 0 = today, positive = future. null if no date. */
export function getDaysUntilContacto(proximoContacto: string | null | undefined): number | null {
  if (!proximoContacto) return null;
  const target = new Date(proximoContacto + 'T23:59:59');
  const diff = target.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

/** Format number as ARS currency: $XX.XXX */
export function formatCurrencyARS(value: number | null | undefined): string {
  if (value == null || value === 0) return '';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

/** Tailwind color classes for days-open badge. */
export function getAgeBadgeColor(days: number): string {
  if (days <= 3) return 'text-green-600';
  if (days <= 7) return 'text-amber-600';
  return 'text-red-600';
}

/** Tailwind color classes for próximo contacto status. */
export function getContactoStatusColor(daysUntil: number): string {
  if (daysUntil < 0) return 'text-red-600';
  if (daysUntil === 0) return 'text-amber-600';
  return 'text-green-600';
}

/** Relative text for próximo contacto. */
export function getContactoStatusText(daysUntil: number): string {
  if (daysUntil < 0) return `hace ${Math.abs(daysUntil)}d`;
  if (daysUntil === 0) return 'hoy';
  return `en ${daysUntil}d`;
}
