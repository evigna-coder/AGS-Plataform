import type { Presupuesto, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';

/** Days until expiry. Uses validUntil if set, otherwise fechaEnvio + validezDias. null if not sent. */
export function getDaysUntilExpiry(validUntil?: string | null, fechaEnvio?: string | null, validezDias?: number): number | null {
  let target: Date | null = null;
  if (validUntil) {
    target = new Date(validUntil + (validUntil.includes('T') ? '' : 'T23:59:59'));
  } else if (fechaEnvio && validezDias) {
    target = new Date(fechaEnvio);
    target.setDate(target.getDate() + validezDias);
  }
  if (!target) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

/** Days since presupuesto was sent. null if not sent. */
export function getDaysSinceEnvio(fechaEnvio?: string | null): number | null {
  if (!fechaEnvio) return null;
  return Math.floor((Date.now() - new Date(fechaEnvio).getTime()) / 86400000);
}

/** Days until próximo contacto. Negative = overdue. */
export function getDaysUntilContacto(proximoContacto?: string | null): number | null {
  if (!proximoContacto) return null;
  const target = new Date(proximoContacto + 'T23:59:59');
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

/** Color for expiry status. */
export function getExpiryStatusColor(daysUntil: number): string {
  if (daysUntil < 0) return 'text-red-600';
  if (daysUntil <= 5) return 'text-amber-600';
  return 'text-green-600';
}

/** Text for expiry status. */
export function getExpiryStatusText(daysUntil: number): string {
  if (daysUntil < 0) return `Vencido hace ${Math.abs(daysUntil)}d`;
  if (daysUntil === 0) return 'Vence hoy';
  return `Vence en ${daysUntil}d`;
}

/** Color for contacto follow-up. */
export function getContactoStatusColor(daysUntil: number): string {
  if (daysUntil < 0) return 'text-red-600';
  if (daysUntil === 0) return 'text-amber-600';
  return 'text-green-600';
}

/** Text for contacto follow-up. */
export function getContactoStatusText(daysUntil: number): string {
  if (daysUntil < 0) return `hace ${Math.abs(daysUntil)}d`;
  if (daysUntil === 0) return 'hoy';
  return `en ${daysUntil}d`;
}

/** Format money with currency symbol. */
export function formatMoney(value: number | null | undefined, moneda: MonedaPresupuesto = 'USD'): string {
  if (value == null || value === 0) return '';
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  return `${sym} ${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

/** Whether the presupuesto is expired (sent and past validity). */
export function isExpired(p: Presupuesto): boolean {
  const days = getDaysUntilExpiry(p.validUntil, p.fechaEnvio, p.validezDias);
  return days !== null && days < 0;
}

/** Whether the presupuesto needs follow-up (sent >7d without activity, or contacto overdue). */
export function needsFollowUp(p: Presupuesto): boolean {
  const ACTIVE_STATES = ['enviado', 'aceptado'];
  if (!ACTIVE_STATES.includes(p.estado)) return false;
  const daysSent = getDaysSinceEnvio(p.fechaEnvio);
  if (daysSent !== null && daysSent > 7) return true;
  const daysContact = getDaysUntilContacto(p.proximoContacto);
  if (daysContact !== null && daysContact < 0) return true;
  return false;
}

/** Whether the presupuesto is anulado. */
export function isAnulado(p: Presupuesto): boolean {
  return p.estado === 'anulado';
}

/** Extract base number: PRE-0001.02 → 'PRE-0001', PRE-0001 (legacy) → 'PRE-0001' */
export function extractBase(numero: string): string {
  const match = numero.match(/(PRE-\d+)/);
  return match ? match[1] : numero;
}

/** Extract revision number: PRE-0001.02 → 2, PRE-0001 (legacy) → null */
export function extractVersion(numero: string): number | null {
  const match = numero.match(/PRE-\d+\.(\d+)/);
  return match ? parseInt(match[1]) : null;
}
