/**
 * presupuestoPdfData — Construcción del objeto `PresupuestoPDFData` (impuestos,
 * netos y totales por moneda, monto en letras). PURA: sin fetch, sin IO, sin React.
 *
 * FUENTE ÚNICA DE VERDAD compartida por:
 *   - `generatePresupuestoPDF` (la app, browser) — pasa modulos/fotos ya fetcheados.
 *   - el backup `ops/backup/pdf-regen` (Node) — regenera los PDF desde el dump.
 *
 * Antes esta lógica estaba duplicada a mano en el backup y driftó (2026-08-07: la
 * app agregó `porMoneda`/`totalesPorMoneda`/`netoPorMoneda` y el espejo quedó viejo
 * → rompió el render). Con este módulo compartido no puede volver a pasar.
 *
 * `numberToWords` se importa del subpath `@ags/shared/utils` (NO del barrel
 * `@ags/shared`, que re-exporta services→firebase y contamina el bundle Node).
 */
import { numberToWords } from '@ags/shared/utils';
import { LOGO_SRC, ISO_LOGO_SRC } from './logos';
import type {
  Presupuesto, Cliente, Establecimiento, ContactoEstablecimiento,
  CondicionPago, CategoriaPresupuesto, ModuloSistema,
} from '@ags/shared';
import type { PresupuestoPDFData } from './PresupuestoPDFEstandar';

export interface GeneratePDFParams {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  establecimiento: Establecimiento | null;
  contacto: ContactoEstablecimiento | null;
  condicionPago: CondicionPago | null;
  categorias: CategoriaPresupuesto[];
}

export interface BuildDataExtras {
  modulosBySistema?: Record<string, ModuloSistema[]>;
  fotosDataUrls?: Record<string, string>;
}

/**
 * Calcula impuestos desglosados por categoría.
 *
 * `porMoneda` acumula el total de impuestos de cada moneda (para presupuestos
 * MIXTA, donde el TOTAL se muestra por moneda). En un presupuesto de una sola
 * moneda todo cae en `monedaBase`.
 */
export function calcularImpuestos(
  items: Presupuesto['items'],
  categorias: CategoriaPresupuesto[],
  monedaBase: string,
) {
  const catMap = new Map(categorias.map(c => [c.id, c]));
  let iva21 = 0;
  let iva105 = 0;
  let ganancias = 0;
  let iibb = 0;
  const porMoneda: Record<string, number> = {};

  for (const item of items) {
    const cat = item.categoriaPresupuestoId ? catMap.get(item.categoriaPresupuestoId) : null;
    if (!cat) continue;
    const base = item.subtotal || 0;
    const m = item.moneda || monedaBase;
    let delItem = 0;

    if (cat.incluyeIva && cat.porcentajeIva) {
      const v = cat.porcentajeIva === 10.5 ? base * 0.105 : base * (cat.porcentajeIva / 100);
      if (cat.porcentajeIva === 10.5) iva105 += v; else iva21 += v;
      delItem += v;
    }
    if (cat.ivaReduccion && cat.porcentajeIvaReduccion) {
      const v = base * (cat.porcentajeIvaReduccion / 100);
      iva105 += v;
      delItem += v;
    }
    if (cat.incluyeGanancias && cat.porcentajeGanancias) {
      const v = base * (cat.porcentajeGanancias / 100);
      ganancias += v;
      delItem += v;
    }
    if (cat.incluyeIIBB && cat.porcentajeIIBB) {
      const v = base * (cat.porcentajeIIBB / 100);
      iibb += v;
      delItem += v;
    }

    if (delItem) porMoneda[m] = (porMoneda[m] || 0) + delItem;
  }

  return { iva21, iva105, ganancias, iibb, porMoneda };
}

/**
 * Arma el `PresupuestoPDFData` completo. `extras` trae lo que requiere fetch en
 * la app (módulos de contrato, fotos de equipos); el backup los pasa desde el dump
 * o vacíos.
 */
export function buildPresupuestoPDFData(params: GeneratePDFParams, extras: BuildDataExtras = {}): PresupuestoPDFData {
  const { presupuesto, cliente, establecimiento, contacto, condicionPago, categorias } = params;

  const isMixta = presupuesto.moneda === 'MIXTA';
  const impuestos = calcularImpuestos(presupuesto.items, categorias, isMixta ? 'USD' : presupuesto.moneda);

  // Netos por moneda — SIEMPRE sumando los subtotales de los ítems, nunca
  // `presupuesto.total` (que el editor guarda como subtotal+impuestos).
  const totalsByCurrency: Record<string, number> = {};
  for (const i of presupuesto.items) {
    const m = isMixta ? (i.moneda || 'USD') : presupuesto.moneda;
    totalsByCurrency[m] = (totalsByCurrency[m] || 0) + (i.subtotal || 0);
  }
  if (Object.keys(totalsByCurrency).length === 0 && !isMixta) {
    totalsByCurrency[presupuesto.moneda] = presupuesto.total || 0;
  }

  // Totales FINALES por moneda = neto + impuestos de esa moneda.
  const totalesPorMoneda: Record<string, number> = Object.fromEntries(
    Object.entries(totalsByCurrency).map(([m, t]) => [m, t + (impuestos.porMoneda[m] || 0)]),
  );

  const montoEnLetras = isMixta
    ? Object.entries(totalesPorMoneda).map(([m, t]) => `${numberToWords(t, m)} (${m})`).join(' + ')
    : numberToWords(totalesPorMoneda[presupuesto.moneda] ?? presupuesto.total ?? 0, presupuesto.moneda);

  return {
    presupuesto,
    cliente,
    establecimiento,
    contacto,
    condicionPago,
    categorias,
    montoEnLetras,
    logoSrc: LOGO_SRC,
    isoLogoSrc: ISO_LOGO_SRC,
    impuestos,
    modulosBySistema: extras.modulosBySistema,
    totalsByCurrency: isMixta ? totalsByCurrency : undefined,
    totalesPorMoneda,
    netoPorMoneda: totalsByCurrency,
    fotosDataUrls: extras.fotosDataUrls,
  };
}
