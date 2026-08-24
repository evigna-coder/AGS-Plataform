/**
 * Unit tests — progresión de estados de una importación (2026-08-24).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:estado-importacion
 *
 * Por qué existe: `derivarEstadoImportacion` mapeaba los campos cargados a
 * ÍNDICES LITERALES del array de orden (1 = embarcado, 4 = despachado, 5 =
 * recibido). Al insertar 'en_origen' entre 'preparacion' y 'embarcado' todos
 * esos números pasaron a apuntar al estado siguiente —un despacho cargado
 * hubiera dejado la importación "en aduana"— y nada lo hubiera avisado.
 *
 * Ahora se resuelve por posición. Estos tests fijan el comportamiento para que
 * el próximo estado que se agregue no vuelva a correr todo un lugar.
 */

import assert from 'node:assert/strict';
import { derivarEstadoImportacion, ESTADO_IMPORTACION_LABELS } from '@ags/shared';

// ── Cada campo lleva al estado que le corresponde, no al de al lado ─────────
{
  assert.equal(derivarEstadoImportacion({}), 'preparacion', 'sin datos: preparación');

  assert.equal(
    derivarEstadoImportacion({ fechaEmbarque: '2026-08-01', numeroGuia: 'AWB-1' }),
    'embarcado',
    'fecha de embarque + guía = embarcada',
  );

  assert.equal(
    derivarEstadoImportacion({ despachoNumero: '26 001 IC04 000123 X' }),
    'despachado',
    'número de despacho = oficializada, NO en aduana',
  );

  assert.equal(
    derivarEstadoImportacion({ fechaRecepcion: '2026-08-20' }),
    'recibido',
    'fecha de recepción = recibida',
  );

  assert.equal(derivarEstadoImportacion({ stockIngresado: true }), 'recibido');
}

// ── El embarque necesita las DOS cosas ─────────────────────────────────────
{
  assert.equal(derivarEstadoImportacion({ fechaEmbarque: '2026-08-01' }), 'preparacion',
    'sin guía todavía no está embarcada');
  assert.equal(derivarEstadoImportacion({ numeroGuia: 'AWB-1' }), 'preparacion',
    'sin fecha tampoco');
  assert.equal(derivarEstadoImportacion({ fechaEmbarque: '   ', numeroGuia: 'AWB-1' }), 'preparacion',
    'un espacio en blanco no es una fecha');
}

// ── Nunca retrocede ────────────────────────────────────────────────────────
{
  assert.equal(
    derivarEstadoImportacion({}, 'en_aduana'), 'en_aduana',
    'sin datos nuevos conserva el estado actual',
  );
  assert.equal(
    derivarEstadoImportacion({ fechaEmbarque: '2026-08-01', numeroGuia: 'AWB-1' }, 'en_transito'),
    'en_transito',
    'cargar el embarque no baja una importación que ya está en tránsito',
  );
  assert.equal(
    derivarEstadoImportacion({ despachoNumero: 'X' }, 'recibido'), 'recibido',
    'gana el más avanzado de los dos',
  );
}

// ── 'en_origen' (2026-08-24) ───────────────────────────────────────────────
{
  // La importación se crea temprano para estimar arribo y costeo: el usuario la
  // marca a mano y el derivador NO la pisa mientras no haya embarque real.
  assert.equal(derivarEstadoImportacion({}, 'en_origen'), 'en_origen',
    'sin embarque cargado, se queda en origen');

  assert.equal(
    derivarEstadoImportacion({ fechaEmbarque: '2026-08-01', numeroGuia: 'AWB-1' }, 'en_origen'),
    'embarcado',
    'al confirmarse el embarque avanza sola',
  );

  // Está entre preparación y embarcada, no después.
  assert.equal(derivarEstadoImportacion({}, 'preparacion'), 'preparacion');
  assert.equal(ESTADO_IMPORTACION_LABELS.en_origen, 'En origen');
}

// ── Cancelado es terminal ──────────────────────────────────────────────────
{
  assert.equal(
    derivarEstadoImportacion({ fechaRecepcion: '2026-08-20', stockIngresado: true }, 'cancelado'),
    'cancelado',
    'una importación cancelada no revive porque alguien cargue una fecha',
  );
}

console.log('✅ estadoImportacion: 16/16 OK');
