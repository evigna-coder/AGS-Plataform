/**
 * Antigüedad y arrastre del control semanal (2026-09-02, pedido dirección).
 *
 * Lo que se verifica es lo que el director va a leer: hace cuántos días está
 * trabada cada fila, y que ninguna OT abierta se caiga de la foto.
 */
import type { OTEstadoAdmin, WorkOrder } from '@ags/shared';
import {
  anclaAntiguedadOT, arrastraDeSemanaAnterior, classifyOT, diasDesdeISO, fechaEnEstado,
  fechaReferenciaOT,
} from '../controlSemanalAntiguedad';

let ok = 0;
let fail = 0;
function eq(nombre: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) === JSON.stringify(b)) { ok++; return; }
  fail++;
  console.error(`  ❌ ${nombre}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}
function check(nombre: string, cond: boolean) {
  if (cond) { ok++; } else { fail++; console.error(`  ❌ ${nombre}`); }
}

const ot = (p: Partial<WorkOrder>): WorkOrder => ({ otNumber: '30000.01', ...p }) as WorkOrder;
const hist = (pares: [OTEstadoAdmin, string][]) => pares.map(([estado, fecha]) => ({ estado, fecha }));

console.log('controlSemanalAntiguedad');

// ── diasDesdeISO ──
const AHORA = new Date('2026-09-02T12:00:00Z').getTime();
eq('mismo dia = 0', diasDesdeISO('2026-09-02T09:00:00Z', AHORA), 0);
eq('un dia', diasDesdeISO('2026-09-01T09:00:00Z', AHORA), 1);
eq('treinta dias', diasDesdeISO('2026-08-03T12:00:00Z', AHORA), 30);
eq('sin fecha', diasDesdeISO(null, AHORA), null);
eq('fecha basura', diasDesdeISO('no-es-fecha', AHORA), null);
eq('futuro no da negativo', diasDesdeISO('2026-09-10T12:00:00Z', AHORA), 0);

// ── fechaEnEstado ──
const conHistorial = ot({
  estadoAdmin: 'CIERRE_TECNICO',
  estadoHistorial: hist([
    ['CREADA', '2026-08-01T10:00:00Z'],
    ['ASIGNADA', '2026-08-02T10:00:00Z'],
    ['CIERRE_TECNICO', '2026-08-20T10:00:00Z'],
  ]),
});
eq('lee del historial', fechaEnEstado(conHistorial, 'ASIGNADA'), '2026-08-02T10:00:00Z');
eq('estado ausente da null', fechaEnEstado(conHistorial, 'COORDINADA'), null);
eq('sin OT da null', fechaEnEstado(null, 'ASIGNADA'), null);

// Reabierta: gana la ULTIMA vez que entro al estado, no la primera.
const reabierta = ot({
  estadoAdmin: 'CIERRE_TECNICO',
  estadoHistorial: hist([
    ['CIERRE_TECNICO', '2026-07-01T10:00:00Z'],
    ['CIERRE_ADMINISTRATIVO', '2026-07-05T10:00:00Z'],
    ['CIERRE_TECNICO', '2026-08-25T10:00:00Z'],
  ]),
});
eq('reabierta cuenta desde la reapertura',
  fechaEnEstado(reabierta, 'CIERRE_TECNICO'), '2026-08-25T10:00:00Z');

// OT vieja sin historial: `estadoAdminFecha` sirve mientras siga en ese estado.
const legacy = ot({ estadoAdmin: 'CIERRE_TECNICO', estadoAdminFecha: '2026-08-10T10:00:00Z' });
eq('fallback al estado actual', fechaEnEstado(legacy, 'CIERRE_TECNICO'), '2026-08-10T10:00:00Z');
eq('el fallback NO aplica a otro estado', fechaEnEstado(legacy, 'ASIGNADA'), null);

// ── anclaAntiguedadOT: la definicion del user ──
eq('sin cierre admin cuenta desde el cierre tecnico',
  anclaAntiguedadOT(conHistorial, 'sin_cierre_admin'),
  { fecha: '2026-08-20T10:00:00Z', que: 'cierre técnico' });
eq('sin realizar cuenta desde asignada',
  anclaAntiguedadOT(conHistorial, 'sin_realizar'),
  { fecha: '2026-08-02T10:00:00Z', que: 'asignada' });
eq('cerrada no tiene reloj',
  anclaAntiguedadOT(conHistorial, 'cerrada'), { fecha: null, que: null });
eq('sin historial cae a fechaAsignacion',
  anclaAntiguedadOT(ot({ estadoAdmin: 'EN_CURSO', fechaAsignacion: '2026-08-11' }), 'sin_realizar'),
  { fecha: '2026-08-11', que: 'asignada' });

// ── classifyOT ──
eq('finalizada es cerrada', classifyOT(ot({ estadoAdmin: 'FINALIZADO' })).estado, 'cerrada');
eq('cierre admin es cerrada', classifyOT(ot({ estadoAdmin: 'CIERRE_ADMINISTRATIVO' })).estado, 'cerrada');
eq('cierre tecnico falta admin', classifyOT(ot({ estadoAdmin: 'CIERRE_TECNICO' })).estado, 'sin_cierre_admin');
eq('reporte FINALIZADO sin estadoAdmin tambien',
  classifyOT(ot({ estadoAdmin: 'EN_CURSO', status: 'FINALIZADO' as WorkOrder['status'] })).estado, 'sin_cierre_admin');
eq('sin ingeniero lo dice',
  classifyOT(ot({ estadoAdmin: 'ASIGNADA' })).motivos, ['Sin IST asignado']);
eq('con ingeniero y sin arrancar',
  classifyOT(ot({ estadoAdmin: 'ASIGNADA', ingenieroAsignadoId: 'i1' })).motivos,
  ['Reporte sin finalizar']);
eq('con reporte arrancado',
  classifyOT(ot({ estadoAdmin: 'EN_CURSO', ingenieroAsignadoId: 'i1', fechaInicio: '2026-08-20' })).motivos,
  ['Reporte iniciado, sin finalizar']);

// ── arrastraDeSemanaAnterior ──
const SEMANA = '2026-08-31'; // lunes de la semana visible

check('agendada la semana pasada y abierta: arrastra',
  arrastraDeSemanaAnterior(ot({ estadoAdmin: 'ASIGNADA' }), '2026-08-25', SEMANA));
check('agendada a futuro NO arrastra',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'ASIGNADA' }), '2026-09-10', SEMANA));
check('agendada en la semana visible NO arrastra (ya esta en la seccion 1)',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'ASIGNADA' }), SEMANA, SEMANA));
check('nunca agendada y sin trabajo NO arrastra',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'CREADA' }), null, SEMANA));
check('trabajo hecho sin agenda SI arrastra (por su fecha de cierre tecnico)',
  arrastraDeSemanaAnterior(
    ot({ estadoAdmin: 'CIERRE_TECNICO', estadoAdminFecha: '2026-08-20T10:00:00Z' }), null, SEMANA));
check('sin agenda y sin ninguna fecha NO arrastra (no se sabe de que semana es)',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'CIERRE_TECNICO' }), null, SEMANA));

// El bug que reporto el user: el arrastre iba tambien hacia ATRAS. Una OT de
// agosto aparecia en el control de julio, donde todavia no existia.
const SEMANA_VIEJA = '2026-07-06';
check('OT de agosto NO aparece en una semana de julio (agenda)',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'ASIGNADA' }), '2026-08-25', SEMANA_VIEJA));
check('OT de agosto NO aparece en una semana de julio (trabajo hecho)',
  !arrastraDeSemanaAnterior(
    ot({ estadoAdmin: 'CIERRE_TECNICO', estadoAdminFecha: '2026-08-20T10:00:00Z' }), null, SEMANA_VIEJA));
check('pero SI aparece en una semana posterior a la suya',
  arrastraDeSemanaAnterior(ot({ estadoAdmin: 'ASIGNADA' }), '2026-08-25', '2026-09-07'));

// ── fechaReferenciaOT ──
eq('la agenda manda', fechaReferenciaOT(ot({ estadoAdmin: 'ASIGNADA' }), '2026-08-25'), '2026-08-25');
eq('sin agenda cae al cierre tecnico',
  fechaReferenciaOT(conHistorial, null), '2026-08-20');
eq('sin agenda ni cierre cae a la asignacion',
  fechaReferenciaOT(ot({ estadoAdmin: 'ASIGNADA', fechaAsignacion: '2026-08-11' }), null), '2026-08-11');
eq('sin nada da null', fechaReferenciaOT(ot({ estadoAdmin: 'CREADA' }), null), null);
check('cerrada administrativamente no arrastra',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'CIERRE_ADMINISTRATIVO' }), '2026-08-25', SEMANA));
check('finalizada no arrastra',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'FINALIZADO' }), '2026-08-25', SEMANA));
check('cancelada no arrastra',
  !arrastraDeSemanaAnterior(ot({ estadoAdmin: 'CANCELADA' }), '2026-08-25', SEMANA));
check('sacada a mano de esta semana no arrastra',
  !arrastraDeSemanaAnterior(
    ot({ estadoAdmin: 'ASIGNADA', controlSemanalExcluidoSemanas: [SEMANA] }), '2026-08-25', SEMANA));
check('sacada de OTRA semana sigue arrastrando en esta',
  arrastraDeSemanaAnterior(
    ot({ estadoAdmin: 'ASIGNADA', controlSemanalExcluidoSemanas: ['2026-08-24'] }), '2026-08-25', SEMANA));

// El caso que motivo la seccion: abierta hace tres semanas, se caia de la foto.
const olvidada = ot({
  estadoAdmin: 'CIERRE_TECNICO',
  estadoHistorial: hist([['ASIGNADA', '2026-08-05T10:00:00Z'], ['CIERRE_TECNICO', '2026-08-08T10:00:00Z']]),
});
check('la OT olvidada arrastra', arrastraDeSemanaAnterior(olvidada, '2026-08-06', SEMANA));
check('y NO se cuela en el control de una semana anterior a la suya',
  !arrastraDeSemanaAnterior(olvidada, '2026-08-06', '2026-07-27'));
eq('y muestra los dias desde el cierre tecnico',
  diasDesdeISO(anclaAntiguedadOT(olvidada, classifyOT(olvidada).estado).fecha, AHORA), 25);

console.log(fail === 0
  ? `✅ controlSemanalAntiguedad: ${ok}/${ok} OK`
  : `❌ controlSemanalAntiguedad: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
