import type { ItemAsignacion, UnidadStock } from '@ags/shared';
import { unidadesService } from '../services/stockService';

/** unidadId → N° de serie. Solo entra lo que TIENE serie. */
export type SeriesPorUnidad = Record<string, string>;

/**
 * N° de serie visible de un item asignado (2026-08-14).
 *
 * El pedido: "necesito ver los números de serie, sobre todo para saber qué
 * devolver y qué no". Dos piezas del mismo artículo son indistinguibles en la
 * lista, así que al devolver no hay forma de saber cuál es cuál.
 *
 * La serie de un artículo de stock NO vive en el item de la asignación: vive en
 * el doc de `unidades`, y hay que ir a buscarla. La del dispositivo sí está en
 * el item desde 2026-08-08, pero ninguna pantalla la pintaba.
 *
 * Deliberadamente NO devuelve el lote del patrón ni la serie de la columna:
 * esos ya salen dentro de la descripción (`descripcionItemAsignacion`) y
 * repetirlos ensucia una fila que ya es angosta.
 */
export function serieDeItemAsignacion(
  item: Pick<ItemAsignacion, 'unidadId' | 'dispositivoSerie'>,
  series: SeriesPorUnidad,
): string | null {
  if (item.unidadId && series[item.unidadId]) return series[item.unidadId];
  return item.dispositivoSerie?.trim() || null;
}

/** Índice unidadId → serie a partir de unidades ya cargadas en memoria. */
export function seriesDesdeUnidades(unidades: UnidadStock[]): SeriesPorUnidad {
  const map: SeriesPorUnidad = {};
  for (const u of unidades) if (u.nroSerie) map[u.id] = u.nroSerie;
  return map;
}

/**
 * Lee las unidades de los items que tienen una, solo para sacarles la serie.
 *
 * Para las pantallas que no cargan el stock del ingeniero (el detalle de una
 * asignación, por ejemplo). Una lectura por unidad —son pocas por asignación— y
 * lo que falla se omite: la fila se muestra sin serie, nunca se cae la pantalla.
 */
export async function cargarSeriesDeItems(items: Pick<ItemAsignacion, 'unidadId'>[]): Promise<SeriesPorUnidad> {
  const ids = [...new Set(items.map(i => i.unidadId).filter((v): v is string => !!v))];
  if (ids.length === 0) return {};
  const unidades = await Promise.all(ids.map(id => unidadesService.getById(id).catch(() => null)));
  return seriesDesdeUnidades(unidades.filter((u): u is UnidadStock => !!u));
}
