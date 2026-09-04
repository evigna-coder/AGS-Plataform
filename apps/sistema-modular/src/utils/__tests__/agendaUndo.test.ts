/**
 * Pila de deshacer de la agenda (2026-09-04): agrupado por gesto, tope de
 * pasos y valores previos que Firestore no descarte.
 */
import type { AgendaEntry } from '@ags/shared';
import {
  registrarAccion, valoresPrevios, describirPaso, datosParaRecrear,
  MAX_PASOS_DESHACER, VENTANA_AGRUPADO_MS, type PasoDeshacer,
} from '../agendaUndo';

let ok = 0;
let fail = 0;
function check(nombre: string, cond: boolean) {
  if (cond) ok++;
  else { fail++; console.error(`  ✗ ${nombre}`); }
}

const crear = (id: string) => ({ tipo: 'crear' as const, id, etiqueta: `OT ${id}`, otNumber: id });

// Agrupado: tres altas del mismo gesto = un paso
let pila: PasoDeshacer[] = [];
pila = registrarAccion(pila, crear('1'), 1000);
pila = registrarAccion(pila, crear('2'), 1000 + 50);
pila = registrarAccion(pila, crear('3'), 1000 + VENTANA_AGRUPADO_MS);
check('mismo gesto: un solo paso', pila.length === 1 && pila[0].acciones.length === 3);
pila = registrarAccion(pila, crear('4'), 1000 + VENTANA_AGRUPADO_MS + 1);
check('pasada la ventana: paso nuevo', pila.length === 2 && pila[1].acciones.length === 1);
check('la ventana se mide desde la PRIMERA accion del paso', pila[0].t === 1000);

// Tope: se olvidan los mas viejos
pila = [];
for (let i = 0; i < MAX_PASOS_DESHACER + 5; i++) pila = registrarAccion(pila, crear(String(i)), i * 10_000);
check('tope de pasos', pila.length === MAX_PASOS_DESHACER);
check('se descartan los mas viejos', pila[0].acciones[0].tipo === 'crear' && (pila[0].acciones[0] as { id: string }).id === '5');

// Valores previos
const entry = {
  id: 'e1', fechaInicio: '2026-09-07', fechaFin: '2026-09-07', quarterStart: 1, quarterEnd: 2,
  ingenieroId: 'ing1', ingenieroNombre: 'Ana', otNumber: '30001.01', clienteNombre: 'ACME',
  tipoServicio: 'PM', sistemaNombre: null, establecimientoNombre: null, estadoAgenda: 'tentativo',
  notas: null, titulo: null, createdAt: '', updatedAt: '', createdBy: null, createdByName: null,
  updatedBy: null, updatedByName: null,
} as unknown as AgendaEntry;
const antes = valoresPrevios(entry, { quarterEnd: 4, pagoAdelantado: true, id: 'x' } as Partial<AgendaEntry>);
check('campo existente: valor previo', antes.quarterEnd === 2);
check('campo que no existia: null, no undefined', 'pagoAdelantado' in antes && antes.pagoAdelantado === null);
check('id nunca entra', !('id' in antes));

// Recrear: sin id ni trazas
const datos = datosParaRecrear(entry) as Record<string, unknown>;
check('recrear sin id/trazas', !('id' in datos) && !('createdAt' in datos) && !('updatedBy' in datos) && datos.otNumber === '30001.01');

// Aviso
check('aviso de un alta', describirPaso({ t: 0, acciones: [crear('30001.01')] }) === 'Deshecho: alta de OT 30001.01');
check('aviso de muchas', describirPaso({ t: 0, acciones: [crear('1'), crear('2'), crear('3')] }) === 'Deshecho: alta de 3 entradas');
check('aviso mixto', describirPaso({ t: 0, acciones: [crear('1'), { tipo: 'borrar', entry, etiqueta: 'OT 2' }] }) === 'Deshecho: movimiento de OT 1, OT 2');

console.log(fail === 0
  ? `✅ agendaUndo: ${ok}/${ok} OK`
  : `❌ agendaUndo: ${fail} fallaron de ${ok + fail}`);
if (fail > 0) process.exit(1);
