/**
 * Presentaciones (envases) en los presupuestos (2026-10-01).
 *
 * El ítem sigue guardando el código del artículo BASE en `codigoProducto`
 * (requerimientos, reservas y entregas lo usan) y el envase aparte en
 * `presentacion`. Lo que VE el cliente —pantalla y los tres PDF— es el código
 * del envase. El stock se compromete siempre en unidades base.
 */
import { promedioCostoFactor } from '@ags/shared';
import type { PresentacionUsada, PresupuestoItem, PromedioCostoFactor, UnidadStock } from '@ags/shared';

/** Código que se muestra e imprime: el del envase si la línea se cotiza por uno. */
export function codigoVisibleItem(item: Pick<PresupuestoItem, 'codigoProducto'> & { presentacion?: PresentacionUsada | null }): string | null {
  return item.presentacion?.codigoParte || item.codigoProducto || null;
}

/** Envase "real" (factor > 1); el ×1 es la unidad base. */
const envaseDe = (p: PresentacionUsada | null | undefined): PresentacionUsada | null =>
  p && p.factor > 1 && p.codigoParte ? p : null;

/** Descripción por defecto: la del artículo base más el envase ("… — Kit x 1000"). */
export function descripcionConEnvase(descripcionBase: string, p: { descripcion?: string | null; factor: number } | null | undefined): string {
  if (!p || p.factor <= 1) return descripcionBase;
  return `${descripcionBase} — ${p.descripcion?.trim() || `envase ×${p.factor}`}`;
}

const redondear = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Cambio de envase en una línea: se conserva lo que se compromete (unidades
 * base) y el importe, así que cantidad y precio se convierten ("1 kit de 1000"
 * pasa a "10 × 100" a un décimo del precio). El descuento por volumen lo ajusta
 * el usuario sobre el precio. La descripción se cambia solo si era la de
 * defecto del envase anterior: una escrita a mano no se pisa.
 *
 * Si la conversión no da envases enteros (2 packs de 100 → 0,02 kits de 10000,
 * caso P1-005316-01, 2026-10-02) se interpreta que cambia lo que se vende: la
 * cantidad queda igual y el precio se escala por el factor.
 */
export function cambiarEnvase(
  item: Pick<PresupuestoItem, 'cantidad' | 'precioUnitario' | 'descripcion'> & { presentacion?: PresentacionUsada | null },
  nueva: { codigoParte: string; factor: number; descripcion?: string | null } | null,
  articulo: { descripcion: string; presentaciones?: Array<{ codigoParte: string; descripcion?: string | null; factor: number }> | null },
): Pick<PresupuestoItem, 'cantidad' | 'precioUnitario' | 'descripcion'> & { presentacion: PresentacionUsada | null } {
  const anterior = envaseDe(item.presentacion);
  const siguiente = nueva && nueva.factor > 1 ? nueva : null;
  const fAnt = anterior?.factor ?? 1;
  const fSig = siguiente?.factor ?? 1;
  const presAnt = anterior ? (articulo.presentaciones ?? []).find(p => p.codigoParte === anterior.codigoParte) ?? anterior : null;
  const descAuto = descripcionConEnvase(articulo.descripcion, presAnt);
  const descripcionManual = !!item.descripcion?.trim() && item.descripcion.trim() !== descAuto
    && item.descripcion.trim() !== articulo.descripcion;
  const convertida = (item.cantidad || 0) * fAnt / fSig;
  const entera = Number.isInteger(redondear(convertida));
  return {
    presentacion: siguiente ? { codigoParte: siguiente.codigoParte, factor: siguiente.factor } : null,
    cantidad: entera ? redondear(convertida) : (item.cantidad || 0),
    precioUnitario: redondear((item.precioUnitario || 0) * fSig / fAnt),
    descripcion: descripcionManual ? item.descripcion : descripcionConEnvase(articulo.descripcion, siguiente),
  };
}

export interface CostoEnvase extends PromedioCostoFactor {
  /** Factor del envase (1 = unidad base). El costo ya viene multiplicado. */
  factorEnvase: number;
  /**
   * 'envase' = promedio de lo que ingresó en ESTE envase (el precio de compra
   * baja con el volumen: el kit de 1000 rinde distinto que 10 × 100);
   * 'general' = no hay ingresos en ese envase, promedio de todo el stock.
   */
  fuente: 'envase' | 'general';
}

type UnidadCosto = Parameters<typeof promedioCostoFactor>[0][number] & Pick<UnidadStock, 'presentacion'>;

/** Costo de referencia por ENVASE para cotizar (por unidad base × factor). */
export function costoParaEnvase(unidades: UnidadCosto[], presentacion: PresentacionUsada | null | undefined): CostoEnvase | null {
  const envase = envaseDe(presentacion);
  const factorEnvase = envase?.factor ?? 1;
  const clave = (p: PresentacionUsada | null | undefined) => envaseDe(p)?.codigoParte ?? null;
  const mismas = unidades.filter(u => clave(u.presentacion) === (envase?.codigoParte ?? null));
  let prom = promedioCostoFactor(mismas);
  let fuente: CostoEnvase['fuente'] = 'envase';
  if (!prom || prom.costo == null) {
    prom = promedioCostoFactor(unidades);
    fuente = 'general';
  }
  if (!prom) return null;
  return { ...prom, costo: prom.costo != null ? prom.costo * factorEnvase : null, factorEnvase, fuente };
}
