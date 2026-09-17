import type { PresentacionUsada, UnidadStock } from '@ags/shared';

/**
 * Envase de una unidad de stock (2026-09-17). Una unidad que entró como
 * paquete cerrado ("1 × 5185-5820 ×5") guarda `presentacion`; su cantidad
 * sigue en unidades base (5) para valuación, pero SOLO sirve para vender o
 * consumir ese envase: no son 5 packs de 100 sueltos. Una unidad sin envase
 * (o con factor 1) es una unidad suelta del artículo base.
 *
 * Regla en todo el sistema: lo pedido en un envase se cubre con unidades de
 * ese envase; lo pedido en unidad base, con unidades sueltas. El único paso
 * de un envase a sueltas es "Abrir paquete" (unidadesService.abrirPaquete).
 */

type ConEnvase = Pick<UnidadStock, 'presentacion'>;

/** Código del envase de la unidad, o null si es suelta. */
export function envaseDeUnidad(u: ConEnvase): string | null {
  return u.presentacion?.factor && u.presentacion.factor > 1 ? u.presentacion.codigoParte : null;
}

/** Código del envase que pide un ítem (presupuesto, parte), o null si pide unidad base. */
export function envasePedido(p: PresentacionUsada | null | undefined): string | null {
  return p?.factor && p.factor > 1 ? p.codigoParte : null;
}

/** ¿La unidad sirve para lo pedido? Base solo con sueltas; envase X solo con X. */
export function unidadSirveParaEnvase(u: ConEnvase, envase: string | null): boolean {
  return envaseDeUnidad(u) === envase;
}

export function filtrarPorEnvase<T extends ConEnvase>(unidades: T[], envase: string | null): T[] {
  return unidades.filter(u => unidadSirveParaEnvase(u, envase));
}

export interface DesgloseEnvase {
  /** null = sueltas (unidad base). */
  envase: string | null;
  factor: number;
  cantidadBase: number;
  /** Paquetes enteros (cantidadBase / factor); para sueltas, = cantidadBase. */
  paquetes: number;
}

/** Cuánto hay de cada envase en una lista de unidades (en base y en paquetes). */
export function desglosePorEnvase(unidades: Array<ConEnvase & Pick<UnidadStock, 'cantidad'>>): DesgloseEnvase[] {
  const por = new Map<string, DesgloseEnvase>();
  for (const u of unidades) {
    const envase = envaseDeUnidad(u);
    const factor = envase ? (u.presentacion?.factor ?? 1) : 1;
    const key = envase ?? '';
    const d = por.get(key) ?? { envase, factor, cantidadBase: 0, paquetes: 0 };
    d.cantidadBase += u.cantidad ?? 1;
    d.paquetes = Math.round((d.cantidadBase / factor) * 1000) / 1000;
    por.set(key, d);
  }
  return [...por.values()].sort((a, b) => (a.envase === null ? -1 : b.envase === null ? 1 : a.envase.localeCompare(b.envase)));
}

/** "1 × 5185-5820 (×5) · 20 sueltas" para mostrar al lado del total en base. */
export function textoDesgloseEnvases(unidades: Array<ConEnvase & Pick<UnidadStock, 'cantidad'>>, unidadBase = 'sueltas'): string | null {
  const d = desglosePorEnvase(unidades);
  if (!d.some(x => x.envase)) return null;
  return d.map(x => x.envase ? `${x.paquetes} × ${x.envase} (×${x.factor})` : `${x.cantidadBase} ${unidadBase}`).join(' · ');
}
