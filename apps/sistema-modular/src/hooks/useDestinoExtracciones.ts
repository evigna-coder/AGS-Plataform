import { useState, useEffect } from 'react';
import type { ExtraccionLoaner } from '@ags/shared';
import { unidadesService, movimientosService } from '../services/stockService';

/**
 * Qué pasó con cada pieza extraída de un loaner (2026-08-23).
 *
 * La cadena existía en el dato pero no en ninguna pantalla: la extracción
 * guarda la unidad que creó, y el movimiento de consumo guarda esa unidad y su
 * OT. Faltaba recorrerla para poder responder, parado en el loaner, "¿esta
 * pieza ya se usó?".
 *
 * OJO con el modelo: la OT de la extracción y la del consumo **no son la
 * misma**. La primera es el trabajo de sacar la pieza; la segunda, dónde
 * terminó. Por eso el destino se descubre acá y no se declara al extraer.
 */

export type DestinoPieza =
  | { estado: 'consumida'; otNumber: string | null; fecha: string }
  | { estado: 'en_stock'; ubicacion: string; cantidad: number; reservadaPara: string | null }
  | { estado: 'baja' }
  | { estado: 'desconocido' };

export function useDestinoExtracciones(extracciones: ExtraccionLoaner[]) {
  const [destinos, setDestinos] = useState<Map<string, DestinoPieza>>(new Map());

  // Las extracciones vienen del doc del loaner: se re-arma la clave para no
  // reconsultar en cada render por identidad del array.
  const clave = extracciones.map(e => e.unidadId ?? '').join('|');

  useEffect(() => {
    const ids = extracciones.map(e => e.unidadId).filter((x): x is string => !!x);
    if (ids.length === 0) { setDestinos(new Map()); return; }

    let cancelado = false;
    (async () => {
      const mapa = new Map<string, DestinoPieza>();
      await Promise.all(ids.map(async unidadId => {
        try {
          // El consumo manda: si se gastó, ya no importa dónde estaba.
          const movs = await movimientosService.getAll({ unidadId, tipo: 'consumo' });
          if (movs.length > 0) {
            const ultimo = movs[movs.length - 1];
            mapa.set(unidadId, {
              estado: 'consumida',
              otNumber: ultimo.otNumber ?? null,
              fecha: ultimo.createdAt,
            });
            return;
          }
          const u = await unidadesService.getById(unidadId);
          if (!u || u.activo === false || u.estado === 'baja') {
            mapa.set(unidadId, { estado: 'baja' });
            return;
          }
          mapa.set(unidadId, {
            estado: 'en_stock',
            ubicacion: u.ubicacion?.referenciaNombre ?? 'sin ubicación',
            cantidad: u.cantidad ?? 1,
            // Reservada DE VERDAD es tener presupuesto, no estar en un estante
            // que se llame RESERVA.
            reservadaPara: u.estado === 'reservado'
              ? (u.reservadoParaPresupuestoNumero ?? 'sin identificar')
              : null,
          });
        } catch (err) {
          console.warn('[useDestinoExtracciones] no se pudo resolver', unidadId, err);
          mapa.set(unidadId, { estado: 'desconocido' });
        }
      }));
      if (!cancelado) setDestinos(mapa);
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return destinos;
}
