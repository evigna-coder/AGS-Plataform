import type { Contrato, WorkOrder } from '@ags/shared';
import { anioDeContrato } from '@ags/shared';

/**
 * Cupo anual por servicio y equipo de un contrato (2026-08-17).
 *
 * DERIVADO de las OTs, no de un contador guardado. La decisión es deliberada:
 * el contador global `visitasUsadas` se desincronizó desde el día uno porque
 * subía al crear la OT y no bajaba al cancelarla. Un valor que se calcula no
 * puede desviarse — cancelar una OT la saca de la cuenta sola, y no hay
 * backfill que correr sobre los contratos que ya existen.
 *
 * El costo es una lectura de las OTs del contrato. Son decenas por contrato,
 * no miles.
 *
 * Función pura: se testea sin Firestore.
 */

/** Una OT cancelada no consume cupo: no se hizo. */
const CUENTA_PARA_CUPO = (ot: WorkOrder) => ot.estadoAdmin !== 'CANCELADA';

/** Clave de consumo: un cupo por equipo y por servicio. */
export function claveCupo(sistemaId: string, tipoServicio: string): string {
  return `${sistemaId}|${tipoServicio.trim().toLowerCase()}`;
}

export interface CupoServicioEquipo {
  sistemaId: string;
  tipoServicioNombre: string;
  /** Cupo anual declarado en el contrato. `null` = sin límite. */
  cupo: number | null;
  usadas: number;
  /** `null` cuando no hay cupo declarado. */
  restantes: number | null;
  otNumbers: string[];
}

/**
 * Consumo del AÑO DE CONTRATO al que pertenece `fecha` (por defecto, hoy).
 *
 * Devuelve una fila por combinación equipo × servicio del contrato, incluyendo
 * las que todavía no se usaron: el valor de esta vista es poder responder
 * "¿cuánto le queda a este equipo?", y para eso hace falta ver los ceros.
 */
export function consumoDelAnio(
  contrato: Pick<Contrato, 'fechaInicio' | 'sistemaIds' | 'serviciosIncluidos'>,
  ots: WorkOrder[],
  fecha: string = new Date().toISOString().slice(0, 10),
): CupoServicioEquipo[] {
  const anio = anioDeContrato(contrato.fechaInicio, fecha);

  const usoPorClave = new Map<string, string[]>();
  for (const ot of ots) {
    if (!CUENTA_PARA_CUPO(ot)) continue;
    const sistemaId = ot.sistemaId;
    const servicio = ot.tipoServicio;
    if (!sistemaId || !servicio) continue;
    // La OT cuenta en el año de contrato de su fecha de servicio; si no la
    // tiene todavía, en el de su creación.
    const fechaOt = (ot.fechaServicioAprox || ot.fechaInicio || ot.createdAt || fecha).slice(0, 10);
    if (anioDeContrato(contrato.fechaInicio, fechaOt) !== anio) continue;
    const k = claveCupo(sistemaId, servicio);
    const arr = usoPorClave.get(k) ?? [];
    arr.push(ot.otNumber);
    usoPorClave.set(k, arr);
  }

  const filas: CupoServicioEquipo[] = [];
  for (const sistemaId of contrato.sistemaIds ?? []) {
    for (const s of contrato.serviciosIncluidos ?? []) {
      const k = claveCupo(sistemaId, s.tipoServicioNombre);
      const otNumbers = (usoPorClave.get(k) ?? []).sort();
      const cupo = s.cantidadAnualPorEquipo ?? null;
      filas.push({
        sistemaId,
        tipoServicioNombre: s.tipoServicioNombre,
        cupo,
        usadas: otNumbers.length,
        restantes: cupo == null ? null : Math.max(0, cupo - otNumbers.length),
        otNumbers,
      });
    }
  }
  return filas;
}

export interface ResultadoCupo {
  allowed: boolean;
  reason?: string;
  /** Cuántas quedan después de crear esta OT. `null` = sin cupo declarado. */
  restantesTrasCrear?: number | null;
}

/**
 * ¿Se puede crear una OT de este servicio, para este equipo, bajo este contrato?
 *
 * Chequea vigencia, que el servicio esté incluido y el cupo anual del equipo.
 * NO mira el contador global `visitasUsadas`: es el que se desincronizó y el
 * cupo por equipo lo reemplaza con un criterio más fino.
 */
export function puedeCrearOTBajoContrato(
  contrato: Pick<Contrato, 'estado' | 'fechaInicio' | 'fechaFin' | 'sistemaIds' | 'serviciosIncluidos'>,
  ots: WorkOrder[],
  destino: { sistemaId?: string | null; tipoServicio?: string | null; fecha?: string },
): ResultadoCupo {
  const fecha = (destino.fecha ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (contrato.estado !== 'activo') return { allowed: false, reason: 'El contrato no está activo' };
  if (contrato.fechaFin && fecha > contrato.fechaFin) {
    return { allowed: false, reason: `El contrato venció el ${contrato.fechaFin}` };
  }

  const servicio = destino.tipoServicio?.trim();
  if (!servicio) return { allowed: true };

  const incluido = (contrato.serviciosIncluidos ?? []).find(
    s => s.tipoServicioNombre.trim().toLowerCase() === servicio.toLowerCase());
  if (!incluido) {
    return { allowed: false, reason: `"${servicio}" no está incluido en el contrato` };
  }
  // Sin cupo declarado: incluido y sin tope (correctivos, por ejemplo).
  if (incluido.cantidadAnualPorEquipo == null) return { allowed: true, restantesTrasCrear: null };
  // Sin equipo no se puede imputar el cupo — no se bloquea, pero tampoco cuenta.
  if (!destino.sistemaId) return { allowed: true, restantesTrasCrear: null };

  const fila = consumoDelAnio(contrato, ots, fecha)
    .find(f => f.sistemaId === destino.sistemaId
      && f.tipoServicioNombre.trim().toLowerCase() === servicio.toLowerCase());
  const usadas = fila?.usadas ?? 0;
  const cupo = incluido.cantidadAnualPorEquipo;

  if (usadas >= cupo) {
    return {
      allowed: false,
      reason: `Este equipo ya consumió su cupo de "${servicio}" para este año de contrato `
        + `(${usadas} de ${cupo}${fila?.otNumbers.length ? ` — ${fila.otNumbers.join(', ')}` : ''})`,
      restantesTrasCrear: 0,
    };
  }
  return { allowed: true, restantesTrasCrear: cupo - usadas - 1 };
}
