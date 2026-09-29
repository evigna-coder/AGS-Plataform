import * as XLSX from 'xlsx';
import type { FilaInventario } from '../inventarioAnual';

/**
 * Excel del inventario anual (2026-09-29): un archivo prolijo para trabajar
 * afuera del sistema, no un volcado de columnas.
 *
 *  - Hoja "Inventario": título, fecha y filtros arriba; encabezado fijo; una
 *    fila por artículo (cantidad UNIFICADA de todas las posiciones) con precio
 *    EXW promedio (vacío si nadie lo tiene, para completarlo a mano) y el total
 *    como FÓRMULA cantidad × precio, así al cargar los que faltan se recalcula
 *    solo. Total al pie con SUM. Sin depósito ni marca: eso queda en pantalla.
 *  - Hoja "No vendibles (a confirmar)": lo excluido por sufijo B/C o por
 *    condición, con el motivo, para que el usuario confirme uno por uno.
 */
export function exportInventarioAnual(args: {
  vendibles: FilaInventario[];
  excluidas: FilaInventario[];
  filtros: string[];
  filename?: string;
}): void {
  const hoy = new Date();
  const fecha = hoy.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const wb = XLSX.utils.book_new();

  // ── Hoja principal: artículo, descripción, cantidad unificada, precio, total ──
  // Sin depósito ni marca (2026-09-29): la cantidad ya viene sumada de todas las
  // posiciones; el usuario cruza este listado con sus listas de precios.
  const headers = ['Código', 'Descripción', 'Cantidad', 'Precio EXW (USD)', 'Total (USD)'];
  const aoa: (string | number | null | { f: string; t?: string })[][] = [
    [`Inventario anual valorizado — ${fecha}`],
    [`Filtros: ${args.filtros.join(' · ')}`],
    ['Cantidad = suma de todas las posiciones. Precio EXW = costo sin importación, promedio ponderado; vacío = completar a mano, el total se recalcula solo.'],
    [],
    headers,
  ];
  const primeraFila = aoa.length + 1; // 1-based en Excel
  args.vendibles.forEach((f, i) => {
    const r = primeraFila + i;
    aoa.push([
      f.codigo, f.descripcion, f.cantidad,
      f.precioExw == null ? null : Math.round(f.precioExw * 100) / 100,
      { f: `IF(D${r}="","",C${r}*D${r})` },
    ]);
  });
  const ultimaFila = primeraFila + args.vendibles.length - 1;
  aoa.push([]);
  aoa.push(['TOTAL', `${args.vendibles.filter(f => f.precioExw == null).length} artículos sin precio`,
    { f: `SUM(C${primeraFila}:C${ultimaFila})` }, null, { f: `SUM(E${primeraFila}:E${ultimaFila})` }]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [18, 56, 12, 18, 18].map(wch => ({ wch }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws['!views'] = [{ state: 'frozen', ySplit: primeraFila - 1 } as any];
  ws['!autofilter'] = { ref: `A${primeraFila - 1}:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(ultimaFila, primeraFila)}` };
  for (let c = 0; c < headers.length; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: primeraFila - 2, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  const titulo = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (titulo) titulo.s = { font: { bold: true, sz: 14 } };
  // Formato numérico de precio y total.
  for (let r = primeraFila - 1; r <= ultimaFila + 2; r++) {
    for (const c of [3, 4]) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && (cell.t === 'n' || cell.f)) cell.z = '#,##0.00';
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

  // ── Hoja de no vendibles ──────────────────────────────────────────────────
  const aoa2: (string | number | null)[][] = [
    [`No vendibles a confirmar — ${fecha}`],
    ['Excluidos del inventario por sufijo B/C en el código, por la condición cargada al alta o quitados a mano. Marcá en la última columna si corresponde.'],
    [],
    ['Código', 'Descripción', 'Marca', 'Ubicaciones', 'Cantidad', 'Condiciones', 'Motivo', 'Precio EXW (USD)', 'Confirmado (S/N)'],
  ];
  for (const f of args.excluidas) {
    aoa2.push([
      f.codigo, f.descripcion, f.marca, f.ubicaciones.join(' | '), f.cantidad,
      f.condiciones.join(', '),
      f.excluida === 'sufijo' ? 'Código termina en B/C' : f.excluida === 'manual' ? 'Quitado a mano' : 'Condición de la unidad',
      f.precioExw == null ? null : Math.round(f.precioExw * 100) / 100,
      null,
    ]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  ws2['!cols'] = [16, 44, 14, 34, 10, 22, 24, 16, 16].map(wch => ({ wch }));
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws2['!views'] = [{ state: 'frozen', ySplit: 4 } as any];
  for (let c = 0; c < 9; c++) {
    const cell = ws2[XLSX.utils.encode_cell({ r: 3, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'No vendibles (a confirmar)');

  XLSX.writeFile(wb, `${args.filename ?? `inventario-anual-${hoy.toISOString().slice(0, 10)}`}.xlsx`);
}
