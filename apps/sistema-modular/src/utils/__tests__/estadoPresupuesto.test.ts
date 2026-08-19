/**
 * Unit tests — hasta dónde avanza un presupuesto según el estado de la plata
 * (2026-08-18).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:estado-presupuesto
 *
 * Por qué existe: `finalizado` es la palabra más fuerte de la máquina de
 * estados y se estaba usando con el cobro pendiente. En los pagos anticipados
 * el cobro es la condición para arrancar el trabajo, así que dar por cerrado
 * un presupuesto sin cobrar esconde justo lo que Administración tiene que
 * perseguir.
 *
 * La regla se replica acá como función pura para poder fijarla; el service
 * `trySyncFinalizacion` aplica la misma después de verificar las OTs.
 */

import assert from 'node:assert/strict';
import { ESTADO_PRESUPUESTO_LABELS } from '@ags/shared';

type EstadoSol = 'pendiente' | 'enviada' | 'facturada' | 'cobrada' | 'anulada';

/** Misma decisión que la rama legacy de trySyncFinalizacion. */
function estadoDestino(sols: EstadoSol[]): 'finalizado' | 'facturado' | null {
  const activas = sols.filter(s => s !== 'anulada');
  if (activas.length === 0) return 'finalizado';
  if (activas.every(s => s === 'cobrada')) return 'finalizado';
  if (activas.every(s => s === 'facturada' || s === 'cobrada')) return 'facturado';
  return null;
}

// ── El caso que motivó el cambio: facturado sin cobrar NO es finalizado ──
assert.equal(estadoDestino(['facturada']), 'facturado',
  'con la factura emitida y el cobro pendiente va a facturado, no a finalizado');
assert.equal(estadoDestino(['cobrada']), 'finalizado', 'cobrado sí cierra');

// ── Mezclas ──
assert.equal(estadoDestino(['cobrada', 'facturada']), 'facturado',
  'basta una sin cobrar para que no cierre');
assert.equal(estadoDestino(['cobrada', 'cobrada']), 'finalizado');
assert.equal(estadoDestino(['facturada', 'pendiente']), null,
  'con una sin facturar no avanza a ningún lado');
assert.equal(estadoDestino(['enviada']), null);

// ── Las anuladas no cuentan ──
assert.equal(estadoDestino(['cobrada', 'anulada']), 'finalizado',
  'una solicitud anulada no traba el cierre');
assert.equal(estadoDestino(['anulada']), 'finalizado',
  'solo anuladas = como si no hubiera facturación');
assert.equal(estadoDestino([]), 'finalizado',
  'sin facturación de por medio cierra por las OTs');

// ── El estado nuevo tiene label y dice lo que pasa ──
assert.ok(ESTADO_PRESUPUESTO_LABELS.facturado.toLowerCase().includes('cobro'),
  'el label tiene que decir que falta cobrar, si no repite la confusión vieja');

// ── Ningún estado válido puede perderse al leer de Firestore (2026-08-18) ───
// El bug: `migrateEstado` era `MAPA[estado] || 'borrador'`, así que un estado
// que no estuviera en el mapa de LEGADO se convertía en borrador en silencio.
// Al agregar 'facturado' al enum y olvidar el mapa, tres presupuestos ya
// facturados aparecieron como borradores — el dato estaba bien, la lectura lo
// rompía. Este test falla si alguien agrega un estado y no lo contempla.
const { PRESUPUESTO_ESTADO_MIGRATION } = await import('@ags/shared');
for (const estado of Object.keys(ESTADO_PRESUPUESTO_LABELS)) {
  assert.equal(PRESUPUESTO_ESTADO_MIGRATION[estado], estado,
    `'${estado}' no se mapea a sí mismo: al leerlo de Firestore se convierte en otra cosa`);
}

console.log('✅ estadoPresupuesto: 21/21 OK');
