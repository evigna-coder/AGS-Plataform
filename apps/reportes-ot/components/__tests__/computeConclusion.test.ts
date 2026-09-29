import { describe, it, expect } from 'vitest';
import { computeConclusion } from '../CatalogTableView';

// Caso real (Boeco S-220, exactitud fotométrica 313 nm): 51.1 - 50.3 en binario da
// 0.8000000000000043 y con "± 0.8 %T" la conclusión salía FAIL en el límite exacto.
describe('computeConclusion ± con referencia', () => {
  it('acepta un resultado exactamente en el límite (ruido de punto flotante)', () => {
    expect(computeConclusion('50.3', '± 0.8 %T', '51.1')).toBe('PASS');
    expect(computeConclusion('51.9', '± 0.8 %T', '51.1')).toBe('PASS');
  });
  it('sigue rechazando lo que supera el límite', () => {
    expect(computeConclusion('50.29', '± 0.8 %T', '51.1')).toBe('FAIL');
    expect(computeConclusion('52', '± 0.8 %T', '51.1')).toBe('FAIL');
  });
  it('sin referencia trata el resultado como desvío', () => {
    expect(computeConclusion('0.8', '± 0.8 %T')).toBe('PASS');
    expect(computeConclusion('-0.8', '± 0.8 %T')).toBe('PASS');
    expect(computeConclusion('0.81', '± 0.8 %T')).toBe('FAIL');
  });
  it('nominal inline en la spec también tolera el límite', () => {
    expect(computeConclusion('0.9', '1.0 ± 0.1', undefined)).toBe('PASS');
    expect(computeConclusion('1.1', '1.0 ± 0.1', undefined)).toBe('PASS');
  });
  it('N/A y comparaciones simples no cambian', () => {
    expect(computeConclusion('N/A', '± 0.8 %T', '51.1')).toBe('NA');
    expect(computeConclusion('0.004', '≤ 0.004 AU')).toBe('PASS');
    expect(computeConclusion('0.39', '< 0.4 %T')).toBe('PASS');
    expect(computeConclusion('0.4', '< 0.4 %T')).toBe('FAIL');
  });
});
