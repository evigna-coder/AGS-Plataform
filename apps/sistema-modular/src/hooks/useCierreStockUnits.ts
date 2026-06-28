import { useEffect, useState } from 'react';
import type { Part, Articulo, UnidadStock, TipoUbicacionStock } from '@ags/shared';
import { articulosService, unidadesService } from '../services/stockService';

/** Ubicación con stock disponible agregado (para elegir posición de descarga). */
export interface StockPosicion {
  key: string;
  tipo: TipoUbicacionStock;
  referenciaId: string;
  referenciaNombre: string;
  cantidad: number;
}

/** Info de stock resuelta para una parte del cierre. */
export interface PartStockInfo {
  /** Artículo de catálogo resuelto (por stockArticuloId o, en su defecto, por código). */
  articulo: Articulo | null;
  /** El artículo maneja nº de serie y/o lote → hay que elegir una unidad puntual. */
  requiereTrazabilidad: boolean;
  /** Unidades disponibles (estado 'disponible'). Para traceables: elegir unidad puntual. */
  unidades: UnidadStock[];
  /** Posiciones con stock disponible (agregado por ubicación). Para no-traceables: elegir descarga. */
  posiciones: StockPosicion[];
}

const EMPTY: PartStockInfo = { articulo: null, requiereTrazabilidad: false, unidades: [], posiciones: [] };

/** Agrupa unidades disponibles por ubicación, sumando cantidad. */
function agruparPosiciones(unidades: UnidadStock[]): StockPosicion[] {
  const byUbic = new Map<string, StockPosicion>();
  for (const u of unidades) {
    const key = `${u.ubicacion.tipo}:${u.ubicacion.referenciaId}`;
    const prev = byUbic.get(key) ?? {
      key, tipo: u.ubicacion.tipo, referenciaId: u.ubicacion.referenciaId,
      referenciaNombre: u.ubicacion.referenciaNombre, cantidad: 0,
    };
    prev.cantidad += u.cantidad ?? 1;
    byUbic.set(key, prev);
  }
  return [...byUbic.values()];
}

/**
 * Para cada parte del cierre, resuelve el artículo de catálogo y —si maneja
 * serie/lote— carga las UnidadStock disponibles para que el cierre permita
 * elegir la unidad puntual a deducir. Las partes sin trazabilidad caen en
 * `requiereTrazabilidad: false` y siguen con el selector de origen clásico.
 */
export function useCierreStockUnits(articulos: Part[]): {
  info: Record<string, PartStockInfo>;
  loading: boolean;
  get: (partId: string) => PartStockInfo;
} {
  const [info, setInfo] = useState<Record<string, PartStockInfo>>({});
  const [loading, setLoading] = useState(false);

  // Key estable: re-resolver solo si cambia el set de partes (id+codigo).
  const key = articulos.map(p => `${p.id}:${p.stockArticuloId ?? ''}:${p.codigo ?? ''}`).join('|');

  useEffect(() => {
    if (articulos.length === 0) { setInfo({}); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result: Record<string, PartStockInfo> = {};
      await Promise.all(articulos.map(async part => {
        let articulo: Articulo | null = null;
        if (part.stockArticuloId) {
          articulo = await articulosService.getById(part.stockArticuloId).catch(() => null);
        }
        if (!articulo && part.codigo) {
          articulo = await articulosService.getByCodigo(part.codigo).catch(() => null);
        }
        const requiereTrazabilidad = !!(articulo?.requiereNumeroSerie || articulo?.requiereNumeroLote);
        let unidades: UnidadStock[] = [];
        if (articulo) {
          const todas = await unidadesService.getByArticulo(articulo.id).catch(() => []);
          unidades = todas.filter(u => u.estado === 'disponible');
        }
        result[part.id] = { articulo, requiereTrazabilidad, unidades, posiciones: agruparPosiciones(unidades) };
      }));
      if (!cancelled) { setInfo(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { info, loading, get: (partId: string) => info[partId] ?? EMPTY };
}
