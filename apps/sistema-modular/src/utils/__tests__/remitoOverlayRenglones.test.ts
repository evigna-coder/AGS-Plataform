/**
 * Corte de los campos del header del remito preimpreso: 54 caracteres por
 * renglón, dos renglones por casilla. Se testea acá y no a ojo contra el papel
 * porque cada verificación real cuesta una impresión.
 */
import { partirEnRenglones } from '../../components/remitos/pdf/RemitoOverlayPDF';

let fallos = 0;
const check = (nombre: string, cond: boolean, detalle = '') => {
  if (!cond) { fallos++; console.error(`  ✗ ${nombre} ${detalle}`); }
};

const MAX = 54;

// Nunca más de 2 renglones, nunca más de 54 caracteres por renglón.
const textos = [
  'Laboratorios Bagó S.A.',
  'a'.repeat(MAX),
  'a'.repeat(MAX + 1),
  'x'.repeat(200),
  'Instituto Nacional de Tecnologia Industrial - Centro de Investigacion',
  'Av. Presidente General Juan Domingo Peron 1234 Piso 5 Depto B entre Callao y Rodriguez Pena, CABA',
  '',
  '   ',
];
for (const t of textos) {
  const r = partirEnRenglones(t);
  check(`<=2 renglones "${t.slice(0, 24)}"`, r.length <= 2, `dio ${r.length}`);
  for (const l of r) check(`<=${MAX} chars "${l.slice(0, 24)}"`, l.length <= MAX, `dio ${l.length}`);
}

// Un texto que entra entero va en UN solo renglón, sin tocarlo.
const corto = 'Laboratorios Bagó S.A.';
check('texto corto intacto', JSON.stringify(partirEnRenglones(corto)) === JSON.stringify([corto]));

// Vacío no imprime nada (si no, react-pdf dibuja un Text vacío por campo).
check('vacío = sin renglones', partirEnRenglones('').length === 0);
check('solo espacios = sin renglones', partirEnRenglones('   ').length === 0);

// El corte cae entre palabras, no al medio de una.
const largo = 'Instituto Nacional de Tecnologia Industrial Centro de Investigacion y Desarrollo';
const r = partirEnRenglones(largo);
check('corta entre palabras', !r[0].endsWith(' ') && largo.startsWith(r[0]));
check('segundo renglón continúa', largo.replace(r[0], '').trim().startsWith(r[1].slice(0, 10)));

// Una palabra sola más larga que el renglón se parte igual (no se pierde).
const palabrota = 'B'.repeat(70);
const rp = partirEnRenglones(palabrota);
check('palabra larga se parte', rp.length === 2 && rp[0].length === MAX);

if (fallos === 0) console.log(`✅ remitoOverlayRenglones: ${textos.length + 6} checks OK`);
else { console.error(`❌ ${fallos} fallos`); process.exit(1); }
