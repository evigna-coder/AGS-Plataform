import { describe, it, expect } from 'vitest';
import type { ProtocolTemplateDoc, ProtocolTableSection, ProtocolTableRow } from '../types';
import { normalizeProtocolTemplate } from './protocolNormalizers';

function getCellText(cell: { type: string; value?: unknown }): string {
  if (cell.type === 'text') return String(cell.value ?? '').trim();
  return '';
}

function isHeaderRow(row: ProtocolTableRow): boolean {
  const cells = row.cells ?? [];
  if (cells.length !== 4) return false;
  const t0 = getCellText(cells[0]).toLowerCase();
  const t1 = getCellText(cells[1]).toLowerCase();
  const t2 = getCellText(cells[2]).toLowerCase();
  const t3 = getCellText(cells[3]).toLowerCase();
  return (
    /parámetro|parametro/.test(t0) &&
    /resultado/.test(t1) &&
    /especificación|especificacion/.test(t2) &&
    /conclusiones/.test(t3)
  );
}

function isSubheaderRow(row: ProtocolTableRow): boolean {
  const cells = row.cells ?? [];
  if (cells.length === 6) {
    const t3 = getCellText(cells[3]).toLowerCase().trim();
    const t4 = getCellText(cells[4]).toLowerCase().trim();
    const t5 = getCellText(cells[5]).toLowerCase().trim();
    return (
      getCellText(cells[0]) === '' &&
      getCellText(cells[1]) === '' &&
      getCellText(cells[2]) === '' &&
      /^cumple$/.test(t3) &&
      /^no cumple$/.test(t4) &&
      /^no aplica$/.test(t5)
    );
  }
  if (cells.length === 3) {
    const t0 = getCellText(cells[0]).toLowerCase().trim();
    const t1 = getCellText(cells[1]).toLowerCase().trim();
    const t2 = getCellText(cells[2]).toLowerCase().trim();
    return (t0 === '' || /^cumple$/.test(t0)) && /^no cumple$/.test(t1) && /^no aplica$/.test(t2);
  }
  return false;
}

/**
 * Test: fila huérfana con placeholders en tabla descriptiva (sec_9 / Tabla 10).
 * La última subfila trae [checkbox false, checkbox false, "Estabilidad de Temperatura (derecho)", ...].
 * Tras normalizar: la fila ancla (QI7.0513) debe tener rowSpan=5 y la última fila solo 3 celdas.
 */
describe('normalizeOrphanSubrowsInDescriptiveTable', () => {
  it('convierte fila con placeholders en subfila y agrupa bajo rowSpan del grupo QI7.05xx', () => {
    const template: ProtocolTemplateDoc = {
      id: 'test',
      name: 'Test',
      sections: [
        {
          id: 'sec_9',
          type: 'table',
          title: 'Tabla',
          headers: [
            'INSTRUCTIVO APLICABLE 1',
            'TEST',
            'PARÁMETRO',
            'ESPECIFICACIÓN',
            'NUEVA ESPECIFICACIÓN',
          ],
          rows: [
            {
              id: 'row_1',
              cells: [
                { type: 'text', value: 'QI7.0513' },
                { type: 'text', value: 'Ruido y Estabilidad de Temperatura (RID)' },
                { type: 'text', value: 'Ruido ASTM' },
                { type: 'text', value: '≤ 10.0 nRIU', readOnly: true, defaultValue: '≤ 10.0 nRIU' },
                { type: 'text', value: '' },
              ],
            },
            {
              id: 'row_2',
              cells: [
                { type: 'text', value: 'Wander' },
                { type: 'text', value: '≤ 80.0 nRIU', readOnly: true },
                { type: 'text', value: '' },
              ],
            },
            {
              id: 'row_3',
              cells: [
                { type: 'text', value: 'Deriva' },
                { type: 'text', value: '≤ 400.0 nRIU/h', readOnly: true },
                { type: 'text', value: '' },
              ],
            },
            {
              id: 'row_4',
              cells: [
                { type: 'text', value: 'Estabilidad de Temperatura (izquierdo)' },
                { type: 'text', value: '≤ 1.00°C', readOnly: true, defaultValue: '≤ 1.00°C' },
                { type: 'text', value: '' },
              ],
            },
            {
              id: 'row_5',
              cells: [
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
                { type: 'text', value: 'Estabilidad de Temperatura (derecho)' },
                { type: 'text', value: '≤ 1.00°C', readOnly: true, defaultValue: '≤ 1.00°C' },
                { type: 'text', value: '' },
              ],
            },
          ],
        },
      ],
    };

    const out = normalizeProtocolTemplate(template);
    const sec = out.sections[0];
    if (sec.type !== 'table') throw new Error('expected table section');
    const table = sec as ProtocolTableSection;

    const row0 = table.rows[0];
    const rowLast = table.rows[table.rows.length - 1];

    expect(row0.cells[0].rowSpan).toBe(5);
    expect(row0.cells[1].rowSpan).toBe(5);
    expect(rowLast.cells.length).toBe(3);
    expect(String(rowLast.cells[0]?.value ?? '')).toMatch(/Estabilidad de Temperatura \(derecho\)/);
  });
});

/**
 * sec_19: mismo formato que Tabla 20 — sin thead global; estructura en TBODY (fila gris, header, subheader, datos).
 */
describe('sec_19 conclusiones table', () => {
  const sec19Template: ProtocolTemplateDoc = {
    id: 'test-sec19',
    name: 'Test',
    sections: [
      {
        id: 'sec_19',
        type: 'table',
        title: 'Tabla',
        headers: ['Test de Composición de Gradiente Canales C/D', 'Ver especificación del cliente'],
        rows: [
          {
            id: 'row_1',
            cells: [
              { type: 'text', value: 'Parámetro' },
              { type: 'text', value: 'Resultado' },
              { type: 'text', value: 'Especificación' },
              { type: 'text', value: 'Conclusiones' },
            ],
          },
          {
            id: 'row_2',
            cells: [
              { type: 'checkbox', value: false },
              { type: 'text', value: 'No cumple' },
              { type: 'text', value: 'No aplica' },
            ],
          },
          {
            id: 'row_3',
            cells: [
              { type: 'text', value: 'Ripple' },
              { type: 'text', value: '%' },
              { type: 'text', value: '≤ 0.500 %', readOnly: true, defaultValue: '≤ 0.500 %' },
              { type: 'checkbox', value: false },
              { type: 'checkbox', value: false },
              { type: 'checkbox', value: false },
            ],
          },
          {
            id: 'row_4',
            cells: [
              { type: 'text', value: 'Exactitud' },
              { type: 'text', value: '%' },
              { type: 'text', value: '≤ 1.500 %', readOnly: true },
            ],
          },
        ],
      },
    ],
  };

  it('sec_19 has headers empty so ProtocolTable does not render global THEAD', () => {
    const out = normalizeProtocolTemplate(sec19Template);
    const sec = out.sections.find((s) => s.type === 'table' && s.id === 'sec_19');
    expect(sec).toBeDefined();
    if (sec?.type !== 'table') return;
    expect(sec.headers).toEqual([]);
  });

  it('body contains header row Parámetro|Resultado|Especificación|Conclusiones and subheader Cumple|No cumple|No aplica (like Tabla 20)', () => {
    const out = normalizeProtocolTemplate(sec19Template);
    const sec = out.sections.find((s) => s.type === 'table' && s.id === 'sec_19');
    expect(sec).toBeDefined();
    if (sec?.type !== 'table') return;
    const rows = sec.rows ?? [];
    const headerRows = rows.filter(isHeaderRow);
    const subheaderRows = rows.filter(isSubheaderRow);
    expect(headerRows.length).toBeGreaterThanOrEqual(1);
    expect(subheaderRows.length).toBeGreaterThanOrEqual(1);
  });

  it('first row grey uses test title, not Parámetro', () => {
    const out = normalizeProtocolTemplate(sec19Template);
    const sec = out.sections.find((s) => s.type === 'table' && s.id === 'sec_19') as ProtocolTableSection | undefined;
    expect(sec?.type).toBe('table');
    const firstRow = (sec?.rows ?? [])[0];
    const titleText = String(firstRow?.cells?.[0]?.type === 'text' ? firstRow.cells[0].value ?? '' : '').trim();
    expect(titleText.toLowerCase()).toContain('composición');
    expect(titleText).not.toBe('Parámetro');
  });

  it('converts defective subheader row ["", "No cumple", "No aplica"] to proper Cumple|No cumple|No aplica subheader', () => {
    const templateWithDefectiveSubheader: ProtocolTemplateDoc = {
      id: 'test-sec19-defective',
      name: 'Test',
      sections: [
        {
          id: 'sec_19',
          type: 'table',
          title: 'Tabla',
          headers: ['Test', 'Ver especificación del cliente'],
          rows: [
            {
              id: 'row_1',
              cells: [
                { type: 'text', value: 'Parámetro' },
                { type: 'text', value: 'Resultado' },
                { type: 'text', value: 'Especificación' },
                { type: 'text', value: 'Conclusiones' },
              ],
            },
            {
              id: 'row_2',
              cells: [
                { type: 'text', value: '' },
                { type: 'text', value: 'No cumple' },
                { type: 'text', value: 'No aplica' },
              ],
            },
            {
              id: 'row_3',
              cells: [
                { type: 'text', value: 'Param' },
                { type: 'text', value: 'Val' },
                { type: 'text', value: 'Spec' },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
              ],
            },
          ],
        },
      ],
    };
    const out = normalizeProtocolTemplate(templateWithDefectiveSubheader);
    const sec = out.sections.find((s) => s.type === 'table' && s.id === 'sec_19');
    expect(sec?.type).toBe('table');
    const subheaderRows = (sec?.rows ?? []).filter(isSubheaderRow);
    expect(subheaderRows.length).toBeGreaterThanOrEqual(1);
    const sub = subheaderRows[0];
    expect(sub?.cells).toHaveLength(6);
    expect(getCellText(sub!.cells![3])).toMatch(/^cumple$/i);
    expect(getCellText(sub!.cells![4])).toMatch(/^no cumple$/i);
    expect(getCellText(sub!.cells![5])).toMatch(/^no aplica$/i);
  });

  it('sec_19 normalizada contiene múltiples filas *_grey, cada una con 2 celdas y segunda type checkbox con label Ver especificación', () => {
    const templateMultiBlock: ProtocolTemplateDoc = {
      id: 'test-sec19-multi',
      name: 'Test',
      sections: [
        {
          id: 'sec_19',
          type: 'table',
          title: 'Tabla',
          headers: [],
          rows: [
            {
              id: 'title1',
              cells: [
                { type: 'text', value: 'Test de Exactitud canal B', colSpan: 4, variant: 'header' },
              ],
            },
            {
              id: 'h1',
              cells: [
                { type: 'text', value: 'Parámetro' },
                { type: 'text', value: 'Resultado' },
                { type: 'text', value: 'Especificación' },
                { type: 'text', value: 'Conclusiones' },
              ],
            },
            {
              id: 's1',
              cells: [
                { type: 'text', value: '' },
                { type: 'text', value: 'No cumple' },
                { type: 'text', value: 'No aplica' },
              ],
            },
            {
              id: 'data1',
              cells: [
                { type: 'text', value: 'Ripple' },
                { type: 'text', value: '%' },
                { type: 'text', value: '≤ 0.500 %' },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
              ],
            },
            {
              id: 'title2',
              cells: [
                { type: 'text', value: 'Test de Holmio', colSpan: 4, variant: 'header' },
                { type: 'checkbox', value: false, checkboxLabel: 'Ver especificación del cliente' },
              ],
            },
            {
              id: 'h2',
              cells: [
                { type: 'text', value: 'Parámetro' },
                { type: 'text', value: 'Resultado' },
                { type: 'text', value: 'Especificación' },
                { type: 'text', value: 'Conclusiones' },
              ],
            },
            {
              id: 's2',
              cells: [
                { type: 'text', value: 'Cumple' },
                { type: 'text', value: 'No cumple' },
                { type: 'text', value: 'No aplica' },
              ],
            },
            {
              id: 'data2',
              cells: [
                { type: 'text', value: 'Exactitud' },
                { type: 'text', value: '%' },
                { type: 'text', value: '≤ 1.500 %' },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
              ],
            },
          ],
        },
      ],
    };
    const out = normalizeProtocolTemplate(templateMultiBlock);
    const sec = out.sections.find((s) => s.type === 'table' && s.id === 'sec_19') as ProtocolTableSection | undefined;
    expect(sec?.type).toBe('table');
    const greyRows = (sec?.rows ?? []).filter((r) => r.id?.endsWith('_grey'));
    expect(greyRows.length).toBeGreaterThanOrEqual(2);
    for (const grey of greyRows) {
      expect(grey.cells).toHaveLength(2);
      const second = grey.cells?.[1];
      expect(second?.type).toBe('checkbox');
      const label = String((second as { checkboxLabel?: string })?.checkboxLabel ?? '').trim();
      expect(label).toMatch(/ver\s+especificaci/i);
    }
  });

  it('ninguna fila header cruda con rowSpan=2 sobrevive en sec_19 (evitar doble alto)', () => {
    const templateWithRowSpanHeader: ProtocolTemplateDoc = {
      id: 'test-sec19-rowspan',
      name: 'Test',
      sections: [
        {
          id: 'sec_19',
          type: 'table',
          title: 'Tabla',
          headers: ['Test de Composición', 'Ver especificación del cliente'],
          rows: [
            {
              id: 'header-raw',
              cells: [
                { type: 'text', value: 'Parámetro' },
                { type: 'text', value: 'Resultado' },
                { type: 'text', value: 'Especificación', rowSpan: 2 },
                { type: 'text', value: 'Conclusiones' },
              ],
            },
            {
              id: 'subheader-raw',
              cells: [
                { type: 'text', value: '' },
                { type: 'text', value: 'No cumple' },
                { type: 'text', value: 'No aplica' },
              ],
            },
            {
              id: 'data1',
              cells: [
                { type: 'text', value: 'Ripple' },
                { type: 'text', value: '%' },
                { type: 'text', value: 'Spec' },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
                { type: 'checkbox', value: false },
              ],
            },
          ],
        },
      ],
    };
    const out = normalizeProtocolTemplate(templateWithRowSpanHeader);
    const sec = out.sections.find((s) => s.type === 'table' && s.id === 'sec_19') as ProtocolTableSection | undefined;
    expect(sec?.type).toBe('table');
    const rows = sec?.rows ?? [];
    const headerWithRowSpan2 = rows.some((r) => {
      const cells = r.cells ?? [];
      return cells.some((c) => (c as { rowSpan?: number }).rowSpan === 2);
    });
    expect(headerWithRowSpan2).toBe(false);
  });
});

/**
 * Regresión: sec_20 (y otras secciones) no se ven afectadas por el normalizador de sec_19.
 */
describe('sec_19 normalizer does not affect other sections', () => {
  it('sec_20 remains unchanged when present in template', () => {
    const template: ProtocolTemplateDoc = {
      id: 'test',
      name: 'Test',
      sections: [
        {
          id: 'sec_20',
          type: 'table',
          title: 'Tabla',
          headers: ['Calificación'],
          rows: [
            { id: 'row_1', cells: [{ type: 'text', value: 'Tipo' }, { type: 'text', value: 'Inicial Recalificación' }] },
            { id: 'row_2', cells: [{ type: 'text', value: 'Fecha de realización' }, { type: 'checkbox', value: false }] },
          ],
        },
      ],
    };
    const out = normalizeProtocolTemplate(template);
    const sec20 = out.sections.find((s) => s.type === 'table' && s.id === 'sec_20');
    expect(sec20).toBeDefined();
    if (sec20?.type !== 'table') return;
    expect(sec20.headers).toEqual(['Calificación']);
    expect(sec20.rows).toHaveLength(2);
  });
});
