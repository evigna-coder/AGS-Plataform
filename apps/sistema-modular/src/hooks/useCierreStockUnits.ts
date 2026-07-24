import { useEffect, useState } from 'react';
import type { Part, Articulo, Patron, UnidadStock, TipoUbicacionStock } from '@ags/shared';
import { articulosService, unidadesService } from '../services/stockService';
import { patronesService } from '../services/patronesService';

/** Ubicación con stock disponible agregado (para elegir posición de descarga). */
export interface StockPosicion {
  key: string;
  tipo: TipoUbicacionStock;
  referenciaId: string;
  referenciaNombre: string;
  cantidad: number;
}

/** Lote de un patrón (activo) ofrecido como origen de descarga en el cierre. */
export interface PatronLoteOrigen {
  patronId: string;
  patronCodigo: string;
  lote: string;
  /** Saldo del lote (unidades/viales). `null` = cantidad no trackeada (se consume igual, sin decrementar). */
  cantidad: number | null;
  fechaVencimiento: string | null;
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
  /** Patrón (activo) que matchea el código de la parte, si existe. */
  patron: Patron | null;
  /** Lotes del patrón con saldo, FIFO por vencimiento — origen alternativo de descarga. */
  patronLotes: PatronLoteOrigen[];
}

const EMPTY: PartStockInfo = {
  articulo: null, requiereTrazabilidad: false, unidades: [], posiciones: [], patron: null, patronLotes: [],
};

/** Normaliza un código para el match parte↔patrón (trim; case-insensitive por las dudas). */
const normCodigo = (c?: string | null) => (c ?? '').trim().toUpperCase();

/** Lotes del patrón ofrecibles como origen: excluye los explícitamente en 0, FIFO por vencimiento. */
function patronLotesDisponibles(patron: Patron): PatronLoteOrigen[] {
  return (patron.lotes ?? [])
    .filter(l => (l.cantidad ?? Infinity) > 0)
    .map(l => ({
      patronId: patron.id,
      patronCodigo: patron.codigoArticulo,
      lote: l.lote,
      cantidad: l.cantidad ?? null,
      fechaVencimiento: l.fechaVencimiento ?? null,
    }))
    .sort((a, b) => (a.fechaVencimiento ?? '9999-12-31').localeCompare(b.fechaVencimiento ?? '9999-12-31'));
}

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
      // Patrones (activos) — colección chica de estándares/materiales de referencia.
      // Se cargan una vez y se matchean por código contra las partes del cierre.
      const patrones = await patronesService.getAll({ activoOnly: true }).catch(() => []);
      const patronPorCodigo = new Map<string, Patron>();
      for (const p of patrones) patronPorCodigo.set(normCodigo(p.codigoArticulo), p);

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
        const patron = patronPorCodigo.get(normCodigo(part.codigo)) ?? null;
        result[part.id] = {
          articulo, requiereTrazabilidad, unidades, posiciones: agruparPosiciones(unidades),
          patron, patronLotes: patron ? patronLotesDisponibles(patron) : [],
        };
      }));
      if (!cancelled) { setInfo(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { info, loading, get: (partId: string) => info[partId] ?? EMPTY };
}
