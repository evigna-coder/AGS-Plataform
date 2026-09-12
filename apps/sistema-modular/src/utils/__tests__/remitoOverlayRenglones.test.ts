/**
 * Corte de los campos del header del remito preimpreso: 54 caracteres por
 * renglón, dos renglones por casilla. Se testea acá y no a ojo contra el papel
 * porque cada verificación real cuesta una impresión.
 */
import { partirEnRenglones, componerDescripcionRemito, MAX_DESC_CARACTERES } from '../../components/remitos/pdf/RemitoOverlayPDF';

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


// ── componerDescripcionRemito (2026-09-11): corte fijo, detalle entero al final ──
{
  const larga = 'Detector de arreglo de diodos con celda de flujo estándar de 10 mm';
  check('corta sin detalle intacta', componerDescripcionRemito('Bomba cuaternaria') === 'Bomba cuaternaria');
  const soloLarga = componerDescripcionRemito(larga);
  check('larga sin detalle se corta al tope', soloLarga.length <= MAX_DESC_CARACTERES && soloLarga.endsWith('…'));
  const conSerie = componerDescripcionRemito(`${larga} · S/N DE12345678`);
  check('la serie queda entera al final', conSerie.endsWith(' · S/N DE12345678'));
  check('la cabeza se corta al tope con serie', conSerie.indexOf(' · S/N') <= MAX_DESC_CARACTERES);
  const loaner = componerDescripcionRemito(`${larga} · S/N DE12345678 · Equipo AGS`);
  check('detalle de loaner entero', loaner.endsWith(' · S/N DE12345678 · Equipo AGS'));
  check('línea total acotada', loaner.length <= 65);
  const parte = componerDescripcionRemito(`Placa principal del detector de fluorescencia completa (de G1321B · S/N X1)`);
  check('"(de …)" de una parte queda entero', parte.endsWith(' (de G1321B · S/N X1)'));
  check('cabeza corta con "(de …)"', parte.indexOf(' (de ') <= MAX_DESC_CARACTERES);
  const detalleLargo = componerDescripcionRemito(`${larga} · S/N DE12345678 · Reparación en garantía por falla de lámpara`);
  check('detalle muy largo: la cabeza baja al mínimo antes de tocar el detalle', detalleLargo.length <= 65 && detalleLargo.startsWith('Detector de a') && detalleLargo.includes('S/N DE12345678'), detalleLargo);
  check('vacío = vacío', componerDescripcionRemito('') === '');
}

if (fallos === 0) console.log(`✅ remitoOverlayRenglones: ${textos.length + 6 + 10} checks OK`);
else { console.error(`❌ ${fallos} fallos`); process.exit(1); }
