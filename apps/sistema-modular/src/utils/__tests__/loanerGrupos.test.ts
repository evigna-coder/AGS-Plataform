/**
 * Resumen catalogado de loaners: agrupación categoría de equipo → tipo de
 * módulo con sus totales. Se testea porque el número que sale acá es el que la
 * dirección usa para saber cuántos equipos de cada tipo hay disponibles: un
 * total mal sumado o un loaner que cae en el grupo equivocado no se nota
 * leyendo el PDF.
 */
import { buildLoanerGrupos, type LoanerExportRow } from '../exports/exportLoaners';
import type { Loaner } from '@ags/shared';

let fallos = 0;
const check = (nombre: string, cond: boolean, detalle = '') => {
  if (!cond) { fallos++; console.error(`  ✗ ${nombre} ${detalle}`); }
};

const row = (
  codigo: string,
  categoriaEquipo: string | null,
  categoriaModuloNombre: string | null,
): LoanerExportRow => ({
  loaner: { codigo, categoriaEquipo, categoriaModuloNombre } as unknown as Loaner,
  ubicacion: 'AGS Base',
});

// ── Caso base: dos categorías, tres tipos ───────────────────────────────────
const grupos = buildLoanerGrupos([
  row('LNR-0031', 'HPLC', 'Bomba cuaternaria'),
  row('LNR-0008', 'HPLC', 'Detector DAD'),
  row('LNR-0012', 'HPLC', 'Bomba cuaternaria'),
  row('LNR-0027', 'GC', 'Inyector split/splitless'),
  row('LNR-0044', 'HPLC', 'Bomba cuaternaria'),
]);

check('dos categorías', grupos.length === 2, `→ ${grupos.length}`);
check('HPLC primero (orden del catálogo, no alfabético)', grupos[0].titulo === 'HPLC', `→ ${grupos[0]?.titulo}`);
check('GC segundo', grupos[1].titulo === 'GC', `→ ${grupos[1]?.titulo}`);

const hplc = grupos[0];
check('total de HPLC suma sus subgrupos', hplc.total === 4, `→ ${hplc.total}`);
check('HPLC tiene 2 tipos', hplc.subgrupos.length === 2, `→ ${hplc.subgrupos.length}`);
check('subgrupos alfabéticos', hplc.subgrupos[0].titulo === 'Bomba cuaternaria', `→ ${hplc.subgrupos[0]?.titulo}`);
check('total del tipo', hplc.subgrupos[0].total === 3, `→ ${hplc.subgrupos[0]?.total}`);
check('filas ordenadas por código',
  hplc.subgrupos[0].rows.map(r => r.loaner.codigo).join(',') === 'LNR-0012,LNR-0031,LNR-0044',
  `→ ${hplc.subgrupos[0]?.rows.map(r => r.loaner.codigo).join(',')}`);

const totalGeneral = grupos.reduce((a, g) => a + g.total, 0);
check('total general = filas de entrada', totalGeneral === 5, `→ ${totalGeneral}`);

// ── Sin categoría / sin tipo: no se pierden ─────────────────────────────────
// Un loaner cargado a medias tiene que aparecer igual en el resumen; si se
// filtrara en silencio, el total dejaría de cerrar contra el listado.
const conHuecos = buildLoanerGrupos([
  row('LNR-0100', null, null),
  row('LNR-0101', 'HPLC', null),
  row('LNR-0102', '', 'Bomba'),
]);
check('sin categoría cae en su propio grupo',
  conHuecos.some(g => g.titulo === 'Sin categoría'), `→ ${conHuecos.map(g => g.titulo).join('|')}`);
check('sin tipo cae en su propio subgrupo',
  conHuecos.flatMap(g => g.subgrupos).some(s => s.titulo === 'Sin tipo de módulo'));
check('ninguna fila se pierde',
  conHuecos.reduce((a, g) => a + g.total, 0) === 3,
  `→ ${conHuecos.reduce((a, g) => a + g.total, 0)}`);
check('categorías desconocidas van al final',
  conHuecos[conHuecos.length - 1].titulo === 'Sin categoría',
  `→ ${conHuecos.map(g => g.titulo).join('|')}`);

// ── Lista vacía ─────────────────────────────────────────────────────────────
check('lista vacía → sin grupos', buildLoanerGrupos([]).length === 0);

if (fallos > 0) { console.error(`\n❌ loanerGrupos: ${fallos} fallo(s)`); process.exit(1); }
console.log('✅ loanerGrupos: 14 checks OK');
