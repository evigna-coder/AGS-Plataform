/**
 * Reversión de la OT al borrar una entrada de agenda (2026-09-02, caso 30234.02).
 *
 * Borrar una entrada le sacaba SIEMPRE el ingeniero y la fecha a la OT. El
 * estado tenía guard, los campos no. Dos consecuencias reales:
 *   - una OT ya trabajada perdía quién la hizo y cuándo;
 *   - mover una visita (borrar + crear) podía limpiar la OT recién estampada.
 */
import type { OTEstadoAdmin } from '@ags/shared';
import { debeRevertirOTAlBorrarEntrada } from '../agendaRevertOT';

let ok = 0;
let fail = 0;
function check(nombre: string, cond: boolean) {
  if (cond) { ok++; } else { fail++; console.error(`  ❌ ${nombre}`); }
}

console.log('agendaRevertOT');

// ── Se revierte: la visita se desprogramó y no habia empezado nada ──
check('CREADA sin entradas: revierte',
  debeRevertirOTAlBorrarEntrada('CREADA', 0));
check('ASIGNADA sin entradas: revierte',
  debeRevertirOTAlBorrarEntrada('ASIGNADA', 0));
check('COORDINADA sin entradas: revierte',
  debeRevertirOTAlBorrarEntrada('COORDINADA', 0));
check('sin estado: revierte (no hay nada que preservar)',
  debeRevertirOTAlBorrarEntrada(undefined, 0));
check('null tambien',
  debeRevertirOTAlBorrarEntrada(null, 0));

// ── NO se revierte: el trabajo ya paso, es un hecho historico ──
const AVANZADOS: OTEstadoAdmin[] = [
  'EN_CURSO', 'CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO',
];
for (const e of AVANZADOS) {
  check(`${e} NO revierte`, !debeRevertirOTAlBorrarEntrada(e, 0));
}
check('CANCELADA NO revierte',
  !debeRevertirOTAlBorrarEntrada('CANCELADA', 0));

// El caso exacto: 30234.02 estaba en CIERRE_TECNICO y quedo sin ingeniero ni
// fecha, con su entrada de agenda del 01/09 intacta.
check('30234.02: CIERRE_TECNICO no se toca',
  !debeRevertirOTAlBorrarEntrada('CIERRE_TECNICO', 0));

// ── NO se revierte: quedan otras entradas (fue un MOVIMIENTO) ──
check('quedan entradas: no revierte aunque este en CREADA',
  !debeRevertirOTAlBorrarEntrada('CREADA', 1));
check('quedan entradas: no revierte aunque este en ASIGNADA',
  !debeRevertirOTAlBorrarEntrada('ASIGNADA', 2));
check('quedan entradas y estado avanzado: tampoco',
  !debeRevertirOTAlBorrarEntrada('CIERRE_TECNICO', 1));
check('la ultima entrada de una ASIGNADA si revierte',
  debeRevertirOTAlBorrarEntrada('ASIGNADA', 0));

console.log(fail === 0
  ? `✅ agendaRevertOT: ${ok}/${ok} OK`
  : `❌ agendaRevertOT: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
