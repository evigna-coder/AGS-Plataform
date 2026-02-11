import { describe, it, expect, vi } from 'vitest';
import { calcHours, formatDateTimeAR, isValidTimeHHMM } from './time';

describe('time', () => {
  describe('calcHours', () => {
    it('calcula horas mismo día (08:00 a 17:00)', () => {
      expect(calcHours('2026-01-20', '08:00', '2026-01-20', '17:00')).toBe(9);
    });

    it('calcula horas con decimal (08:00 a 17:30)', () => {
      expect(calcHours('2026-01-20', '08:00', '2026-01-20', '17:30')).toBe(9.5);
    });

    it('cruze de medianoche: mismo día siguiente', () => {
      expect(calcHours('2026-01-20', '22:00', '2026-01-21', '06:00')).toBe(8);
    });

    it('devuelve 0 y hace console.warn cuando end < start', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(calcHours('2026-01-20', '17:00', '2026-01-20', '08:00')).toBe(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('devuelve 0 cuando end date es anterior a start date', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(calcHours('2026-01-21', '08:00', '2026-01-20', '17:00')).toBe(0);
      warn.mockRestore();
    });

    it('devuelve 0 con fechas u horas vacías o inválidas', () => {
      expect(calcHours('', '08:00', '2026-01-20', '17:00')).toBe(0);
      expect(calcHours('2026-01-20', '', '2026-01-20', '17:00')).toBe(0);
      expect(calcHours('2026-01-20', '08:00', '2026-01-20', '25:00')).toBe(0);
    });

    it('redondea a 1 decimal', () => {
      expect(calcHours('2026-01-20', '08:00', '2026-01-20', '17:06')).toBe(9.1);
    });
  });

  describe('formatDateTimeAR', () => {
    it('formatea fecha e hora a DD/MM/YYYY HH:mm', () => {
      expect(formatDateTimeAR('2026-01-20', '08:30')).toBe('20/01/2026 08:30');
    });

    it('solo fecha si hora vacía o inválida', () => {
      expect(formatDateTimeAR('2026-01-20', '')).toBe('20/01/2026');
      expect(formatDateTimeAR('2026-01-20', '8:30')).toBe('20/01/2026 08:30');
    });

    it('devuelve vacío si fecha vacía', () => {
      expect(formatDateTimeAR('', '08:00')).toBe('');
    });
  });

  describe('isValidTimeHHMM', () => {
    it('acepta HH:MM 24h válidos', () => {
      expect(isValidTimeHHMM('00:00')).toBe(true);
      expect(isValidTimeHHMM('23:59')).toBe(true);
      expect(isValidTimeHHMM('09:30')).toBe(true);
      expect(isValidTimeHHMM('9:30')).toBe(true);
    });

    it('rechaza inválidos', () => {
      expect(isValidTimeHHMM('')).toBe(false);
      expect(isValidTimeHHMM('24:00')).toBe(false);
      expect(isValidTimeHHMM('12:60')).toBe(false);
      expect(isValidTimeHHMM('abc')).toBe(false);
    });
  });
});
