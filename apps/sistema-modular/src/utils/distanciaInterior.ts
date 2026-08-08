import type { Establecimiento } from '@ags/shared';

/** Obelisco. El umbral de "interior" se mide desde acá. */
const CABA = { lat: -34.6037, lng: -58.3816 };

/**
 * Desde este límite hacia afuera, el viaje no se hace de ida y vuelta en el día
 * (definición del negocio: +200 km ≈ 4 h de viaje mínimo) y corresponde
 * desarraigo. Por debajo se va y se vuelve.
 */
export const UMBRAL_INTERIOR_KM = 200;

/**
 * Franja a revisar a mano: la distancia se calcula en LÍNEA RECTA y por ruta
 * siempre da más, así que uno a 180 en recta puede estar a 220 manejando.
 * Sólo aplica por debajo del umbral — los que dan bien lejos ya clasificaron.
 */
export const MARGEN_REVISION_KM = 30;

export type ClasificacionUbicacion = 'interior' | 'zona' | 'revisar' | 'sin_datos';

/** Distancia en km entre dos puntos (haversine). Sin API ni costo. */
export function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distancia del establecimiento a CABA, o null si no tiene coordenadas. */
export function kmDesdeCaba(est: Pick<Establecimiento, 'lat' | 'lng'> | null | undefined): number | null {
  if (!est || typeof est.lat !== 'number' || typeof est.lng !== 'number') return null;
  return Math.round(distanciaKm(CABA, { lat: est.lat, lng: est.lng }));
}

/**
 * Clasificación de un establecimiento (2026-08-08).
 *
 * Se calcula SIEMPRE al vuelo, nunca se persiste: así, corregirle la dirección
 * a un establecimiento sin coordenadas lo clasifica al instante —sin migración
 * ni backfill— y cambiar el umbral recalcula todo solo.
 */
export function clasificarUbicacion(
  est: Pick<Establecimiento, 'lat' | 'lng'> | null | undefined,
): { clasificacion: ClasificacionUbicacion; km: number | null } {
  const km = kmDesdeCaba(est);
  if (km == null) return { clasificacion: 'sin_datos', km: null };
  if (km > UMBRAL_INTERIOR_KM) return { clasificacion: 'interior', km };
  if (km >= UMBRAL_INTERIOR_KM - MARGEN_REVISION_KM) return { clasificacion: 'revisar', km };
  return { clasificacion: 'zona', km };
}

/** ¿Corresponde desarraigo por distancia? Los "revisar" NO cuentan solos. */
export function esInteriorPorDistancia(
  est: Pick<Establecimiento, 'lat' | 'lng'> | null | undefined,
): boolean {
  return clasificarUbicacion(est).clasificacion === 'interior';
}

/**
 * Estado inicial de una entrada de agenda según dónde queda el trabajo
 * (2026-08-08): si el establecimiento de la OT está a más de 200 km, la visita
 * nace marcada como interior. Antes dependía de que la coordinadora se acordara
 * de elegir el estado interior a mano, y de eso depende el desarraigo del mes.
 *
 * Best-effort: si no se puede resolver el establecimiento, cae al estado normal.
 */
export async function estadoAgendaInicialPorUbicacion(
  establecimientoId: string | null | undefined,
  getEstablecimiento: (id: string) => Promise<Pick<Establecimiento, 'lat' | 'lng'> | null>,
  estadoBase: 'tentativo' | 'confirmado' = 'tentativo',
): Promise<'tentativo' | 'confirmado' | 'tentativo_interior' | 'confirmado_interior'> {
  if (!establecimientoId) return estadoBase;
  try {
    const est = await getEstablecimiento(establecimientoId);
    if (!esInteriorPorDistancia(est)) return estadoBase;
    return estadoBase === 'confirmado' ? 'confirmado_interior' : 'tentativo_interior';
  } catch {
    return estadoBase;
  }
}

export const CLASIFICACION_LABELS: Record<ClasificacionUbicacion, string> = {
  interior: 'Interior',
  zona: 'Zona',
  revisar: 'Revisar',
  sin_datos: 'Sin coordenadas',
};

export const CLASIFICACION_COLORS: Record<ClasificacionUbicacion, string> = {
  interior: 'bg-[#cfd8e3] text-[#41546b]',   // misma familia que la agenda interior
  zona: 'bg-slate-100 text-slate-600',
  revisar: 'bg-amber-100 text-amber-700',
  sin_datos: 'bg-red-50 text-red-600',
};
