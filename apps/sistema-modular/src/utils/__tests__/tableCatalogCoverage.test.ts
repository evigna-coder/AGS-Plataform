/**
 * Unit tests — cobertura de modelos / servicios de un proyecto de la Biblioteca de Tablas
 * (2026-10-01).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:tablas-cobertura
 *
 * Lo que fija: la discrepancia "19 tablas cubren 15 modelos y 1 cubre 14" se detecta y
 * señala la tabla; una tabla con lista vacía aplica a todo y no se toca; aplicar cambios
 * escribe la grafía del catálogo y solo las tablas que cambian.
 */

import assert from 'node:assert/strict';
import type { TableCatalogEntry } from '@ags/shared';
import {
  computeCoverage, planCoverageUpdates, fullyCovered, tableDiff, referenceFor, groupByRole, coverageKey, majorityOn, tableLabel,
} from '../tableCatalogCoverage';

const t = (id: string, modelos: string[], extra: Partial<TableCatalogEntry> = {}): TableCatalogEntry =>
  ({ id, name: id, modelos, tipoServicio: [], status: 'published', tableType: 'informational', orden: 0, columns: [], templateRows: [], validationRules: [], sysType: 'HPLC', isDefault: false, createdAt: '', updatedAt: '', createdBy: '', ...extra } as TableCatalogEntry);

const MODELOS = ['HPLC 1100', 'HPLC 1200', 'HPLC 1260 Infinity'];

// ── Discrepancia: una tabla con un modelo de menos ────────────────────────────
{
  const tablas = [t('a', MODELOS), t('b', MODELOS), t('c', ['HPLC 1100', 'HPLC 1200'])];
  const cov = computeCoverage(tablas, 'modelos', MODELOS);
  const r1260 = cov.rows.find(r => r.value === 'HPLC 1260 Infinity')!;
  assert.equal(r1260.status, 'partial');
  assert.deepEqual(r1260.missingIn.map(x => x.id), ['c'], 'señala la tabla que falta');
  assert.equal(cov.partialCount, 1);
  assert.deepEqual(fullyCovered(cov), ['HPLC 1100', 'HPLC 1200']);
  // Referencia por mayoría: el 1260 está en 2 de 3 → es esperado; a "c" le falta.
  const ref = referenceFor(tablas, 'modelos');
  assert.deepEqual(tableDiff(tablas[2], 'modelos', ref).faltan, ['HPLC 1260 Infinity']);
}

// ── Lista vacía = aplica a todo: no cuenta ni se escribe ──────────────────────
{
  const tablas = [t('a', ['HPLC 1100']), t('todas', [])];
  const cov = computeCoverage(tablas, 'modelos', MODELOS);
  assert.equal(cov.appliesToAll.length, 1);
  assert.equal(cov.rows.find(r => r.value === 'HPLC 1100')!.status, 'full');
  const plan = planCoverageUpdates(tablas, 'modelos', new Map([[coverageKey('HPLC 1200'), { value: 'HPLC 1200', on: true }]]));
  assert.deepEqual(plan, [{ id: 'a', values: ['HPLC 1100', 'HPLC 1200'] }]);
}

// ── Igualar, quitar y grafía del catálogo ─────────────────────────────────────
{
  const tablas = [t('a', ['hplc 1100', 'HPLC 1200']), t('b', ['HPLC 1100'])];
  const plan = planCoverageUpdates(tablas, 'modelos', new Map([
    [coverageKey('HPLC 1200'), { value: 'HPLC 1200', on: true }],
    [coverageKey('HPLC 1100'), { value: 'HPLC 1100', on: false }],
  ]));
  assert.deepEqual(plan, [{ id: 'a', values: ['HPLC 1200'] }, { id: 'b', values: ['HPLC 1200'] }]);
}

// ── Sin cambios reales → sin escrituras; archivadas fuera ─────────────────────
{
  const tablas = [t('a', ['HPLC 1100']), t('vieja', ['GC 6890'], { status: 'archived' })];
  assert.deepEqual(planCoverageUpdates(tablas, 'modelos', new Map([[coverageKey('HPLC 1100'), { value: 'HPLC 1100', on: true }]])), []);
  assert.equal(computeCoverage(tablas, 'modelos', []).rows.some(r => r.value === 'GC 6890'), false);
}

// ── Valores fuera del catálogo se marcan ──────────────────────────────────────
{
  const cov = computeCoverage([t('a', [], { tipoServicio: ['Calificación de software'] })], 'tipoServicio', ['Calificación de operación']);
  assert.equal(cov.rows.find(r => r.value === 'Calificación de software')!.inCatalog, false);
}

// ── Agrupado por rol ──────────────────────────────────────────────────────────
{
  const g = groupByRole([
    t('caratula', [], { tableType: 'cover' }), t('cliente', []),
    t('ensayo1', [], { tableType: 'validation' }), t('titulo', [], { tableType: 'text' }), t('ensayo2', [], { tableType: 'validation' }),
    t('conclusion', []), t('firmas', [], { tableType: 'signatures' }),
  ]);
  assert.deepEqual(g.map(x => [x.group, x.tables.map(y => y.id)]), [
    ['encabezado', ['caratula', 'cliente']],
    ['ensayos', ['ensayo1', 'titulo', 'ensayo2']],
    ['cierre', ['conclusion', 'firmas']],
  ]);
  assert.deepEqual(groupByRole([t('x', [])]).map(x => x.group), ['encabezado']);
}

// ── Resolver por mayoría y nombre de tablas sin título ───────────────────────
{
  const muchas = Array.from({ length: 23 }, (_, i) => t(`t${i}`, i === 0 ? ['UV 8453 (G1103A)', 'UV- VIS Cary 50'] : ['UV 8453 (G1103A)']));
  const cov = computeCoverage(muchas, 'modelos', []);
  assert.equal(majorityOn(cov.rows.find(r => r.value === 'UV- VIS Cary 50')!), false, '1 de 23 → quitar');
  const casi = [...muchas.slice(1).map(x => ({ ...x, modelos: ['A', 'B'] })), t('z', ['A'])];
  assert.equal(majorityOn(computeCoverage(casi, 'modelos', []).rows.find(r => r.value === 'B')!), true, '22 de 23 → agregar');
  assert.equal(tableLabel(t('', [], { name: '', orden: 8, tableType: 'text' })), '#8 (texto sin título)');
}

// Revisión 2026-10-01: quitar el ÚNICO valor de una tabla no la deja vacía
// (en reportes-ot vacía = aplica a todos los equipos).
{
  const t = (id: string, modelos: string[]) => ({ id, status: 'published', modelos, tipoServicio: [] } as unknown as Parameters<typeof planCoverageUpdates>[0][number]);
  const ups = planCoverageUpdates([t('a', ['HPLC 1260']), t('b', ['GC 7890'])], 'modelos', new Map([['gc 7890', { value: 'GC 7890', on: false }]]));
  assert.equal(ups.some(u => u.id === 'b'), false, 'la tabla de GC no queda con lista vacía');
}
console.log('tableCatalogCoverage: OK');
