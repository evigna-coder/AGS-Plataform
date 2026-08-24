import { useEffect, useState } from 'react';
import { unidadCuentaComoDisponible } from '@ags/shared';
import type { Part, Articulo, Patron, Remito, UnidadStock, TipoUbicacionStock } from '@ags/shared';
import { articulosService, remitosService, unidadesService } from '../services/stockService';
import { patronesService } from '../services/patronesService';
import { dedupPorUnidad, type RemitoItemOrigen } from '../utils/origenRemitoDedup';
export type { RemitoItemOrigen };

/** Ubicación con stock disponible agregado (para elegir posición de descarga). */
export interface StockPosicion {
  key: string;
  tipo: TipoUbicacionStock;
  referenciaId: string;
  referenciaNombre: string;
  cantidad: number;
  /**
   * Para quién están apartadas las unidades reservadas de esta posición
   * (2026-08-20), como "Cliente (P2-005099)". Vacío si no hay ninguna.
   *
   * Sin esto la opción decía solo "RESERVAS (×1)" y no había forma de saber a
   * qué presupuesto le estabas gastando la pieza.
   */
  reservas: string[];
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

/** Item de un remito en campo ofrecido como origen de descarga (2026-08-04):
 *  el material ya salió con un remito de salida y está en poder del ingeniero —
 *  al cerrar la OT se consume desde ahí y el remito se resuelve/cierra. */
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
  /** Items de remitos en campo que matchean el artículo — origen "Remito N° xxx". */
  remitoOrigenes: RemitoItemOrigen[];
}

const EMPTY: PartStockInfo = {
  articulo: null, requiereTrazabilidad: false, unidades: [], posiciones: [], patron: null, patronLotes: [],
  remitoOrigenes: [],
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

/** Estados de remito con items posiblemente aún en campo. */
const REMITO_ESTADOS_EN_CAMPO = new Set(['confirmado', 'en_transito', 'completado_parcial']);

/** Items 'sale y vuelve' pendientes de los remitos en campo que matchean el artículo. */
export function remitoOrigenesDe(remitos: Remito[], articulo: Articulo | null, codigo?: string | null): RemitoItemOrigen[] {
  const cod = normCodigo(codigo);
  const out: RemitoItemOrigen[] = [];
  for (const r of remitos) {
    for (const it of r.items ?? []) {
      // Las dos clases de línea se descargan contra la OT (2026-08-18). Antes
      // esto filtraba a 'sale_y_vuelve' y por eso una entrega al cliente nunca
      // aparecía como origen en el cierre: no había forma de imputarla.
      if (it.devuelto || it.consumido) continue;
      const matchArticulo = (articulo && it.articuloId === articulo.id)
        || (!!cod && normCodigo(it.articuloCodigo) === cod);
      if (!matchArticulo) continue;
      const pendiente = it.cantidad - (it.cantidadConsumida ?? 0);
      if (pendiente <= 0) continue;
      out.push({
        remitoId: r.id,
        remitoNumero: r.numero,
        itemId: it.id,
        ingenieroNombre: r.ingenieroNombre || 'Ingeniero',
        cantidad: pendiente,
        serie: it.serie ?? null,
        unidadId: it.salidaUnidadId ?? it.unidadId ?? null,
      });
    }
  }
  return dedupPorUnidad(out);
}

/** Etiqueta de la reserva de una unidad: "Cliente (P2-005099)". */
function etiquetaReserva(u: UnidadStock): string | null {
  if (u.estado !== 'reservado') return null;
  const cliente = u.reservadoParaClienteNombre?.trim();
  const ppto = u.reservadoParaPresupuestoNumero?.trim();
  if (!cliente && !ppto) return 'sin identificar';
  return [cliente, ppto ? `(${ppto})` : null].filter(Boolean).join(' ');
}

/** Agrupa unidades disponibles por ubicación, sumando cantidad. */
function agruparPosiciones(unidades: UnidadStock[]): StockPosicion[] {
  const byUbic = new Map<string, StockPosicion>();
  for (const u of unidades) {
    const key = `${u.ubicacion.tipo}:${u.ubicacion.referenciaId}`;
    const prev = byUbic.get(key) ?? {
      key, tipo: u.ubicacion.tipo, referenciaId: u.ubicacion.referenciaId,
      referenciaNombre: u.ubicacion.referenciaNombre, cantidad: 0, reservas: [],
    };
    prev.cantidad += u.cantidad ?? 1;
    const reserva = etiquetaReserva(u);
    // Una misma posición puede juntar reservas de varios presupuestos.
    if (reserva && !prev.reservas.includes(reserva)) prev.reservas.push(reserva);
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
      // Índice por FK (2026-08-18): es el vínculo declarado y es el que manda.
      // El índice por código de abajo queda como respaldo para los patrones que
      // todavía no tienen el artículo cargado — atarlos por texto se rompía
      // solo cuando alguien corregía el catálogo.
      const patronPorArticulo = new Map<string, Patron>();
      for (const pt of patrones) if (pt.articuloId) patronPorArticulo.set(pt.articuloId, pt);
      const patronPorCodigo = new Map<string, Patron>();
      for (const p of patrones) patronPorCodigo.set(normCodigo(p.codigoArticulo), p);

      // Remitos en campo (2026-08-04): sus items pendientes se ofrecen como
      // origen "Remito N° xxx" — el material ya salió, se consume desde ahí.
      const remitosEnCampo = (await remitosService.getAll().catch(() => []))
        .filter(r => REMITO_ESTADOS_EN_CAMPO.has(r.estado));

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
          // Lo que está en un remito NO se ofrece como stock de depósito: se elige
          // por la opción "Remito N° …" de abajo, que descuenta del remito.
          //
          // Las RESERVADAS sí se ofrecen (2026-08-20): el aviso del cierre ya dice
          // que se pueden seleccionar —"si las seleccionás igual, se descuenta la
          // reserva, no una unidad extra"— pero el desplegable no las listaba, así
          // que la única pieza en stock aparecía como "Sin stock disponible" y la
          // OT no se podía cerrar contra ella. El consumo desde 'reservado' ya
          // estaba soportado río abajo (ver movimientosAplicar).
          unidades = todas.filter(u =>
            unidadCuentaComoDisponible(u)
            || (u.activo !== false && u.estado === 'reservado' && u.ubicacion?.tipo !== 'remito'));
        }
        const patron = (articulo ? patronPorArticulo.get(articulo.id) : null)
          ?? patronPorCodigo.get(normCodigo(part.codigo))
          ?? null;
        result[part.id] = {
          articulo, requiereTrazabilidad, unidades, posiciones: agruparPosiciones(unidades),
          patron, patronLotes: patron ? patronLotesDisponibles(patron) : [],
          remitoOrigenes: remitoOrigenesDe(remitosEnCampo, articulo, part.codigo),
        };
      }));
      if (!cancelled) { setInfo(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { info, loading, get: (partId: string) => info[partId] ?? EMPTY };
}
