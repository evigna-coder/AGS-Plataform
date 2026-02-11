/**
 * Utilidades de hora/fecha para reportes OT.
 * Formato 24h (DD/MM/YYYY HH:mm).
 */

/**
 * Parsea fecha ISO (YYYY-MM-DD) + hora "HH:MM" en zona Argentina y devuelve timestamp.
 */
function parseDateTimeAR(dateIso: string, timeHHMM: string): number {
  if (!dateIso || !timeHHMM) return NaN;
  const parts = timeHHMM.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  const str = `${dateIso}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  const date = new Date(str);
  if (isNaN(date.getTime())) return NaN;
  return date.getTime();
}

/**
 * Calcula horas trabajadas entre inicio y fin en zona Argentina.
 * @returns Horas con 1 decimal, o 0 si end < start (y console.warn).
 */
export function calcHours(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): number {
  const t1 = parseDateTimeAR(startDate, startTime);
  const t2 = parseDateTimeAR(endDate, endTime);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 0;
  if (t2 < t1) {
    console.warn('calcHours: end < start', { startDate, startTime, endDate, endTime });
    return 0;
  }
  const hours = (t2 - t1) / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
}

/**
 * Formatea fecha ISO + hora "HH:MM" a string DD/MM/YYYY HH:mm (24h) en zona Argentina.
 */
export function formatDateTimeAR(dateIso: string, horaHHMM: string): string {
  if (!dateIso) return '';
  const [year, month, day] = dateIso.split('-');
  if (!year || !month || !day) return dateIso;
  const datePart = `${day}/${month}/${year}`;
  if (!horaHHMM || !/^\d{1,2}:\d{2}$/.test(horaHHMM)) return datePart;
  const [h, m] = horaHHMM.split(':').map((n) => n.padStart(2, '0'));
  return `${datePart} ${h}:${m}`;
}

/** Valida formato "HH:MM" o "H:MM" 24h. */
export function isValidTimeHHMM(value: string): boolean {
  if (!value) return false;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}
