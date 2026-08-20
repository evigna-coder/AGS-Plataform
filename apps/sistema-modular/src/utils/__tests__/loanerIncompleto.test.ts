/**
 * Loaner incompleto: derivación de "le falta una pieza" a partir de las
 * extracciones. Se testea porque de este booleano depende el aviso que evita
 * prestar un equipo que no funciona.
 */
import {
  extraccionesQueFaltanReponer, loanerEstaIncompleto, loanerPartesFaltantes,
} from '@ags/shared';
import type { ExtraccionLoaner } from '@ags/shared';

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

if (fallos === 0) console.log('✅ loanerIncompleto: 10 checks OK');
else { console.error(`❌ ${fallos} fallos`); process.exit(1); }
