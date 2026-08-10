import type { AgendaEntry } from '@ags/shared';
import { esAgendaInterior } from '@ags/shared';

/** Un día del viaje, con las OTs que el ingeniero tuvo agendadas ese día. */
export interface DiaViaje {
  fecha: string;                 // 'YYYY-MM-DD'
  ots: { otNumber: string; clienteNombre: string; establecimientoNombre: string | null }[];
}

/**
 * Bloque de días CONSECUTIVOS en el interior = un viaje. Es la unidad que se
 * paga: el desarraigo se cuenta por noche fuera de casa.
 */
export interface Viaje {
  ingenieroId: string;
  ingenieroNombre: string;
  desde: string;
  hasta: string;
  dias: DiaViaje[];
  /**
   * Noches fuera = días del viaje − 1. Lunes a miércoles son 3 días agendados y
   * 2 desarraigos: duerme lunes y martes, el miércoles vuelve (regla del
   * usuario, 2026-08-08).
   */
  desarraigos: number;
}

export interface ResumenIngeniero {
  ingenieroId: string;
  ingenieroNombre: string;
  desarraigos: number;
  diasEnInterior: number;
  viajes: Viaje[];
}

/** Suma días a 'YYYY-MM-DD' sin pasar por Date (evita corrimientos de zona). */
function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Todos los días que cubre una entrada (puede abarcar varios). */
function diasDeEntrada(e: AgendaEntry): string[] {
  const out: string[] = [];
  let cursor = e.fechaInicio;
  const fin = e.fechaFin || e.fechaInicio;
  // Tope de seguridad: una entrada con fechas invertidas no debe colgar el loop.
  for (let i = 0; i < 60 && cursor <= fin; i++) {
    out.push(cursor);
    cursor = sumarDias(cursor, 1);
  }
  return out;
}

/**
 * Arma los viajes al interior a partir de la agenda y cuenta los desarraigos
 * que caen en `mes` (2026-08-08).
 *
 * Solo cuentan las entradas con estado INTERIOR: esa marca la pone la
 * coordinadora (o la hereda del establecimiento a +200 km) y sobrevive todo el
 * ciclo, incluso cuando la visita queda completada.
 *
 * Los días consecutivos de un mismo ingeniero se agrupan en un viaje: si hizo
 * lunes-martes-miércoles en Santa Fe, es UN viaje de 2 desarraigos, no tres
 * visitas sueltas.
 *
 * IMPORTANTE — el viaje se arma COMPLETO y recién después se filtra por mes.
 * Lo que se cuenta es la NOCHE (cada día del viaje salvo el último, que es
 * cuando vuelve) y se asigna al mes en que se duerme. Si se recortara el viaje
 * al mes primero, uno del 28/07 al 02/08 daría 3 noches en julio y 1 en agosto
 * = 4, cuando son 5: se perdía la noche del 31 al 1.
 *
 * @param entries agenda de un rango que EXCEDA el mes (±15 días), para que los
 *                viajes a caballo entre meses queden completos
 * @param mes 'YYYY-MM'
 */
export function calcularDesarraigo(entries: AgendaEntry[], mes: string): ResumenIngeniero[] {
  // 1) fecha → OTs, por ingeniero. Sin filtrar por mes: el viaje va entero.
  const porIngeniero = new Map<string, { nombre: string; dias: Map<string, DiaViaje> }>();

  for (const e of entries) {
    if (!esAgendaInterior(e.estadoAgenda)) continue;
    if (e.estadoAgenda === 'cancelado') continue;
    const reg = porIngeniero.get(e.ingenieroId)
      ?? { nombre: e.ingenieroNombre, dias: new Map<string, DiaViaje>() };
    for (const fecha of diasDeEntrada(e)) {
      const dia = reg.dias.get(fecha) ?? { fecha, ots: [] };
      if (e.otNumber && !dia.ots.some(o => o.otNumber === e.otNumber)) {
        dia.ots.push({
          otNumber: e.otNumber,
          clienteNombre: e.clienteNombre,
          establecimientoNombre: e.establecimientoNombre ?? null,
        });
      }
      reg.dias.set(fecha, dia);
    }
    porIngeniero.set(e.ingenieroId, reg);
  }

  // 2) Agrupar días consecutivos en viajes y contar las noches del mes.
  const out: ResumenIngeniero[] = [];
  for (const [ingenieroId, reg] of porIngeniero) {
    const fechas = Array.from(reg.dias.keys()).sort();
    const viajes: Viaje[] = [];
    let bloque: string[] = [];

    const cerrarBloque = () => {
      if (bloque.length === 0) return;
      // Noches = todos los días salvo el último (ese vuelve).
      const noches = bloque.slice(0, -1);
      const nochesDelMes = noches.filter(f => f.startsWith(mes));
      // El viaje entra al reporte del mes solo si durmió alguna noche en él.
      if (nochesDelMes.length > 0) {
        viajes.push({
          ingenieroId,
          ingenieroNombre: reg.nombre,
          desde: bloque[0],
          hasta: bloque[bloque.length - 1],
          dias: bloque.map(f => reg.dias.get(f)!),
          desarraigos: nochesDelMes.length,
        });
      }
      bloque = [];
    };

    for (const f of fechas) {
      if (bloque.length === 0 || sumarDias(bloque[bloque.length - 1], 1) === f) bloque.push(f);
      else { cerrarBloque(); bloque = [f]; }
    }
    cerrarBloque();

    if (viajes.length === 0) continue;
    out.push({
      ingenieroId,
      ingenieroNombre: reg.nombre,
      desarraigos: viajes.reduce((s, v) => s + v.desarraigos, 0),
      diasEnInterior: fechas.filter(f => f.startsWith(mes)).length,
      viajes,
    });
  }

  return out.sort((a, b) => b.desarraigos - a.desarraigos || a.ingenieroNombre.localeCompare(b.ingenieroNombre));
}
