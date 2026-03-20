const XLSX = require('./scripts/node_modules/xlsx');
const wb = XLSX.readFile(process.argv[2] || 'Para script.xlsx');
console.log('Hojas:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  var ref = ws['!ref'];
  if (!ref) { console.log('\n=== HOJA:', name, '=== (vacía)'); continue; }
  var range = XLSX.utils.decode_range(ref);
  console.log('\n=== HOJA:', name, '===');
  console.log('Rango:', ref, '| Filas:', range.e.r + 1, '| Columnas:', range.e.c + 1);
  // Solo headers
  var headers = [];
  for (var c = range.s.c; c <= range.e.c; c++) {
    var cell = ws[XLSX.utils.encode_cell({r:0, c:c})];
    headers.push(cell ? String(cell.v) : '(vacía col ' + c + ')');
  }
  console.log('Headers:', JSON.stringify(headers));
  // Primeras 3 filas de datos como ejemplo
  for (var r = 1; r <= Math.min(3, range.e.r); r++) {
    var row = {};
    for (var c2 = range.s.c; c2 <= range.e.c; c2++) {
      var cell2 = ws[XLSX.utils.encode_cell({r:r, c:c2})];
      if (cell2) row[headers[c2]] = cell2.v;
    }
    if (Object.keys(row).length > 0) console.log('  Fila', r, ':', JSON.stringify(row));
  }
}
