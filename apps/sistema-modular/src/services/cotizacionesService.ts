/**
 * Cotizaciones de dólar. Fuente: dolarapi.com (pública, CORS habilitado).
 * El endpoint `mayorista` expone la cotización mayorista (Com. A 3500), que es
 * la referencia del tipo de cambio mayorista comprador/vendedor del BNA.
 *
 * NOTA (Electron/CSP): el dominio `dolarapi.com` debe estar permitido en
 * `connect-src` de `electron/main.cjs` (ourCsp) para que el fetch no se bloquee.
 */
export interface CotizacionDolar {
  /** Mayorista comprador (ARS por USD). */
  compra: number;
  /** Mayorista vendedor (ARS por USD). */
  venta: number;
  /** ISO de última actualización informada por la fuente. */
  fecha: string | null;
}

// Cache 10' del oficial: es referencial (pizarra BNA) y lo consultan los forms
// de presupuesto al montar — sin cache, cada apertura de modal pega a la API.
const OFICIAL_TTL_MS = 10 * 60_000;
let _oficialCache: { at: number; data: CotizacionDolar } | null = null;

/** Punto medio de una cotización compra/venta; cae a la punta que exista. */
function puntoMedio(compra: unknown, venta: unknown): number | null {
  const c = Number(compra);
  const v = Number(venta);
  const okC = !!c && !isNaN(c);
  const okV = !!v && !isNaN(v);
  if (okC && okV) return (c + v) / 2;
  if (okV) return v;
  if (okC) return c;
  return null;
}

export const cotizacionesService = {
  /**
   * Oficial (pizarra BNA). `compra` = BNA comprador — referencia pedida para el
   * tipo de cambio de presupuestos (UAT 2026-07-15). Null si la fuente no responde.
   */
  async oficial(): Promise<CotizacionDolar | null> {
    if (_oficialCache && Date.now() - _oficialCache.at < OFICIAL_TTL_MS) return _oficialCache.data;
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
      if (!res.ok) return null;
      const d = await res.json();
      const compra = Number(d?.compra);
      const venta = Number(d?.venta);
      if (!compra || isNaN(compra)) return null;
      const data: CotizacionDolar = { compra, venta: isNaN(venta) ? compra : venta, fecha: d?.fechaActualizacion ?? null };
      _oficialCache = { at: Date.now(), data };
      return data;
    } catch (err) {
      console.warn('[cotizacionesService] no se pudo obtener el oficial:', err);
      return null;
    }
  },

  /** Mayorista (Com. A 3500). Devuelve null si la fuente no responde. */
  async mayorista(): Promise<CotizacionDolar | null> {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/mayorista', { cache: 'no-store' });
      if (!res.ok) return null;
      const d = await res.json();
      const compra = Number(d?.compra);
      const venta = Number(d?.venta);
      if (!compra || isNaN(compra)) return null;
      return { compra, venta: isNaN(venta) ? compra : venta, fecha: d?.fechaActualizacion ?? null };
    } catch (err) {
      console.warn('[cotizacionesService] no se pudo obtener el mayorista:', err);
      return null;
    }
  },

  /**
   * Pase EUR→USD (USD por EUR) derivado del cross ARS/EUR ÷ ARS/USD.
   * Sólo una **sugerencia**: el pase real de una importación lo fija AFIP al
   * oficializar el despacho, y ninguna cotización de mercado lo replica.
   *
   * Se calcula con PUNTOS MEDIOS y contra el MAYORISTA (2026-09-01). Antes
   * dividía `EUR.venta / USD_oficial.venta`, y eso no cancela los spreads
   * cuando los dos instrumentos los tienen muy distintos: el dólar oficial
   * cotiza con ~3,4% de spread y el euro con ~0,8%, así que el cociente salía
   * sistemáticamente bajo (1,1430 medido contra 1,1631 de aduana, −1,7%).
   * Con puntos medios el desvío baja a ~0,4%.
   *
   * Además se apoya en el MISMO instrumento que el tipo de cambio del
   * formulario (el mayorista): así convertir EUR→USD→ARS reproduce la
   * cotización directa del euro, que antes no pasaba (daba 1,6% menos).
   */
  async paseEurUsd(): Promise<number | null> {
    try {
      const [eurRes, usdRes] = await Promise.all([
        fetch('https://dolarapi.com/v1/cotizaciones/eur', { cache: 'no-store' }),
        fetch('https://dolarapi.com/v1/dolares/mayorista', { cache: 'no-store' }),
      ]);
      if (!eurRes.ok || !usdRes.ok) return null;
      const eur = await eurRes.json();
      const usd = await usdRes.json();
      const eurArs = puntoMedio(eur?.compra, eur?.venta);
      const usdArs = puntoMedio(usd?.compra, usd?.venta);
      if (!eurArs || !usdArs) return null;
      return eurArs / usdArs;
    } catch (err) {
      console.warn('[cotizacionesService] no se pudo obtener el pase EUR/USD:', err);
      return null;
    }
  },
};
