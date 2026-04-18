import * as XLSX from 'xlsx';
import type { VentasInsumosReportRow, VentasInsumosRangeLabel } from './ventasInsumosReport';
import { fmtDateShort } from './ventasInsumosReport';

const AUTO_HEADERS = [
  'Ticket',
  'Fecha creación',
  'Razón social',
  'Contacto',
  'Creado por',
  'Responsable',
  'Estado actual',
  'Último movimiento',
  'Valor estimado',
  'Descripción',
  'Resultado',
];

const MANUAL_HEADERS = [
  'N° Presupuesto',
  'Monto final',
  'N° OC',
  'Fecha entrega',
  'Observaciones',
];

export function exportVentasInsumosExcel(
  rows: VentasInsumosReportRow[],
  range: VentasInsumosRangeLabel,
): void {
  const headers = [...AUTO_HEADERS, ...MANUAL_HEADERS];

  const aoa: (string | number | null)[][] = [headers];
  for (const r of rows) {
    aoa.push([
      r.ticketId.slice(-6).toUpperCase(),
      fmtDateShort(r.fechaCreacion),
      r.razonSocial,
      r.contacto,
      r.creadoPor,
      r.responsable,
      r.estadoActual,
      fmtDateShort(r.ultimoMovimiento),
      r.valorEstimado,
      r.descripcion,
      r.resultado,
      // Manual columns — vacías para completar a mano
      '', '', '', '', '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths (auto: 11, manual: 5)
  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 12 },
    { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];

  // Header styling — teal fill for auto columns, yellow for manual
  // Note: xlsx free version applies cell styles only if written as objects.
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell) continue;
    const isManual = c >= AUTO_HEADERS.length;
    cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: isManual ? 'B45309' : '0D6E6E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // Yellow tint on manual cells (body rows) so user sees where to write
  for (let r = 1; r < aoa.length; r++) {
    for (let c = AUTO_HEADERS.length; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = { fill: { fgColor: { rgb: 'FFFBEB' } } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas Insumos');

  const filename = `ventas-insumos_${range.label.replace(/\s+/g, '-').toLowerCase()}_${fmtDateShort(new Date().toISOString()).replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
