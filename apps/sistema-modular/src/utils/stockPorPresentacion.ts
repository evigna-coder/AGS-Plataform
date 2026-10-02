/**
 * Stock de un artículo abierto por presentación (2026-10-02), para el cartel
 * del ícono de presentaciones. Todo en unidades BASE (la unidad más chica):
 * cuánto entró en cada envase y el total expresado en cada uno.
 */
import type { Presentacion, UnidadStock } from '@ags/shared';

/** Estados que siguen siendo stock de AGS (en depósito, reservado o en poder de un ingeniero). */
const EN_STOCK = new Set(['disponible', 'reservado', 'asignado']);

export interface FilaPresentacion {
  codigoParte: string;
  descripcion: string | null;
  factor: number;
  /** Unidades base que ingresaron en este envase y siguen en stock. */
  unidadesBase: number;
  /** Total del artículo expresado en este envase (total / factor). */
  totalEnEnvases: number;
}

export interface StockPorPresentacion {
  total: number;
  /** Unidades base sueltas (ingresaron sin envase o en uno que ya no está declarado). */
  sueltas: number;
  filas: FilaPresentacion[];
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function stockPorPresentacion(
  unidades: Array<Pick<UnidadStock, 'cantidad' | 'estado' | 'activo' | 'presentacion'>>,
  presentaciones: Presentacion[],
): StockPorPresentacion {
  const activas = presentaciones.filter(p => p.activo !== false && p.codigoParte && p.factor > 0);
  const porCodigo = new Map<string, number>();
  let total = 0;
  for (const u of unidades) {
    if (u.activo === false || !EN_STOCK.has(u.estado)) continue;
    const cant = u.cantidad ?? 1;
    total += cant;
    const cod = u.presentacion && u.presentacion.factor > 1 ? u.presentacion.codigoParte : null;
    if (cod && activas.some(p => p.codigoParte === cod)) porCodigo.set(cod, (porCodigo.get(cod) ?? 0) + cant);
  }
  const filas = activas.map(p => ({
    codigoParte: p.codigoParte,
    descripcion: p.descripcion ?? null,
    factor: p.factor,
    unidadesBase: porCodigo.get(p.codigoParte) ?? 0,
    totalEnEnvases: redondear(total / p.factor),
  }));
  const enEnvases = filas.reduce((s, f) => s + f.unidadesBase, 0);
  return { total, sueltas: total - enEnvases, filas };
}

/** "3", "0,5" — sin decimales de más. */
export const fmtCant = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
