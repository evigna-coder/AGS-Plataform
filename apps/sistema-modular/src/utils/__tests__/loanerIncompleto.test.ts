/**
 * Loaner incompleto: derivación de "le falta una pieza" a partir de las
 * extracciones. Se testea porque de este booleano depende el aviso que evita
 * prestar un equipo que no funciona.
 */
import {
  extraccionesQueFaltanReponer, loanerEstaIncompleto, loanerPartesFaltantes,
  prestamoModuloActivo, prestamosDeParteActivos, partesPrestadasQueFaltan,
} from '@ags/shared';
import type { ExtraccionLoaner, PrestamoLoaner } from '@ags/shared';

let fallos = 0;
const check = (nombre: string, cond: boolean, detalle = '') => {
  if (!cond) { fallos++; console.error(`  ✗ ${nombre} ${detalle}`); }
};

const ext = (over: Partial<ExtraccionLoaner>): ExtraccionLoaner => ({
  id: crypto.randomUUID(), fecha: '2026-08-20T10:00:00.000Z',
  descripcion: 'Pieza', destino: 'Stock', extraidoPor: 'Test', ...over,
});

// Sin extracciones → completo.
check('sin extracciones', !loanerEstaIncompleto({ extracciones: [] }));
check('extracciones ausentes', !loanerEstaIncompleto({}));
check('extracciones null', !loanerEstaIncompleto({ extracciones: null }));

// Una extracción que NO deja inoperativo no lo marca (repuesto de acompañamiento).
check('no inoperativo', !loanerEstaIncompleto({ extracciones: [ext({ dejaInoperativo: false })] }));

// Legacy: las extracciones viejas no tienen el campo → no marcan nada.
// Es deliberado: no inventamos que 20 loaners estaban rotos desde siempre.
check('legacy sin campo', !loanerEstaIncompleto({ extracciones: [ext({})] }));

// Una inoperativa sin reponer → incompleto.
check('inoperativa pendiente', loanerEstaIncompleto({
  extracciones: [ext({ dejaInoperativo: true, descripcion: 'Inyector' })],
}));

// Repuesta → deja de contar.
check('repuesta', !loanerEstaIncompleto({
  extracciones: [ext({ dejaInoperativo: true, fechaReposicion: '2026-08-25T10:00:00.000Z' })],
}));

// Varias: solo cuentan las pendientes, y el resumen las lista todas.
const varias = {
  extracciones: [
    ext({ dejaInoperativo: true, descripcion: 'Inyector' }),
    ext({ dejaInoperativo: true, descripcion: 'Loop 100 uL' }),
    ext({ dejaInoperativo: true, descripcion: 'Ya vuelta', fechaReposicion: '2026-08-25T10:00:00.000Z' }),
    ext({ dejaInoperativo: false, descripcion: 'No hace al funcionamiento' }),
  ],
};
check('cuenta solo pendientes', extraccionesQueFaltanReponer(varias).length === 2,
  `dio ${extraccionesQueFaltanReponer(varias).length}`);
check('resumen lista las pendientes',
  loanerPartesFaltantes(varias) === 'Inyector · Loop 100 uL',
  `dio "${loanerPartesFaltantes(varias)}"`);
check('resumen vacío si está completo', loanerPartesFaltantes({ extracciones: [] }) === '');

// ── Préstamo por PARTES (2026-09-04) ──────────────────────────────────────
const prestamo = (over: Partial<PrestamoLoaner>): PrestamoLoaner => ({
  id: crypto.randomUUID(), clienteId: 'c1', clienteNombre: 'ACME',
  fechaSalida: '2026-09-01T10:00:00.000Z', estado: 'activo', ...over,
});
const modulo = prestamo({});
const parteInop = prestamo({ alcance: 'parte', parte: { descripcion: 'Detector FID', dejaInoperativo: true } });
const parteSuelta = prestamo({ alcance: 'parte', parte: { descripcion: 'Cable', dejaInoperativo: false }, clienteNombre: 'Beta' });
const parteVuelta = prestamo({ alcance: 'parte', parte: { descripcion: 'Loop', dejaInoperativo: true }, estado: 'devuelto' });

// Legacy sin `alcance` = módulo.
check('legacy es modulo', prestamoModuloActivo({ prestamos: [modulo] })?.id === modulo.id);
check('una parte NO es prestamo del modulo', prestamoModuloActivo({ prestamos: [parteInop] }) === undefined);
check('partes activas', prestamosDeParteActivos({ prestamos: [modulo, parteInop, parteSuelta, parteVuelta] }).length === 2);
check('solo las que dejan inoperativo faltan', partesPrestadasQueFaltan({ prestamos: [parteInop, parteSuelta] }).length === 1);
check('parte inoperativa afuera = incompleto', loanerEstaIncompleto({ prestamos: [parteInop] }));
check('parte que no hace al funcionamiento no marca', !loanerEstaIncompleto({ prestamos: [parteSuelta] }));
check('parte devuelta no marca', !loanerEstaIncompleto({ prestamos: [parteVuelta] }));
check('resumen suma extracciones y partes',
  loanerPartesFaltantes({ extracciones: [ext({ dejaInoperativo: true, descripcion: 'Inyector' })], prestamos: [parteInop] })
    === 'Inyector · Detector FID (prestado a ACME)',
  `dio "${loanerPartesFaltantes({ extracciones: [ext({ dejaInoperativo: true, descripcion: 'Inyector' })], prestamos: [parteInop] })}"`);

if (fallos === 0) console.log('✅ loanerIncompleto: 18 checks OK');
else { console.error(`❌ ${fallos} fallos`); process.exit(1); }
