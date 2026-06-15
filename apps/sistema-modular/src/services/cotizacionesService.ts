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

export const cotizacionesService = {
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
   * Pase EUR→USD (USD por EUR) derivado del cross oficial ARS/EUR ÷ ARS/USD.
   * Sólo una **sugerencia**: el pase real lo fija el banco/despachante. Null si falla.
   */
  async paseEurUsd(): Promise<number | null> {
    try {
      const [eurRes, usdRes] = await Promise.all([
        fetch('https://dolarapi.com/v1/cotizaciones/eur', { cache: 'no-store' }),
        fetch('https://dolarapi.com/v1/dolares/oficial', { cache: 'no-store' }),
      ]);
      if (!eurRes.ok || !usdRes.ok) return null;
      const eur = await eurRes.json();
      const usd = await usdRes.json();
      const eurArs = Number(eur?.venta) || Number(eur?.compra);
      const usdArs = Number(usd?.venta) || Number(usd?.compra);
      if (!eurArs || !usdArs || isNaN(eurArs) || isNaN(usdArs)) return null;
      return eurArs / usdArs;
    } catch (err) {
      console.warn('[cotizacionesService] no se pudo obtener el pase EUR/USD:', err);
      return null;
    }
  },
};
