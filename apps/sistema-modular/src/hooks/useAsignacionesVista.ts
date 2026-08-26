import { useState, useEffect, useCallback, useMemo } from 'react';
import { ingenierosService, asignacionesService, remitosService } from '../services/firebaseService';
import { instrumentosService } from '../services/catalogService';
import { matchesSearch } from '../utils/searchTerms';
import type { Ingeniero, Asignacion, ItemAsignacion, InstrumentoPatron, Remito } from '@ags/shared';

/** Estados de remito cuya mercadería todavía está afuera (= useInventarioIngeniero). */
const REMITO_ESTADOS_EN_CAMPO = new Set(['confirmado', 'en_transito', 'en_proveedor', 'completado_parcial']);

/** Un item de asignación activa todavía en poder del ingeniero. */
export interface ItemEnCampo extends ItemAsignacion {
  asignacionId: string;
  asignacionNumero: string;
  asignacionCreatedAt: string;
  /** Unidades todavía en campo: cantidad − devuelta − consumida. */
  neto: number;
  /** Patrón cuyo lote venció estando en campo. */
  vencido: boolean;
}

export interface IngenieroConMaterial {
  ingeniero: Ingeniero;
  /** Items en campo, más recientes primero. */
  items: ItemEnCampo[];
  /** createdAt de la asignación activa más reciente. */
  ultimaAsignacion: string | null;
  patronesVencidos: ItemEnCampo[];
}

/** Código visible de un item en campo (mismo orden de fallback que el label). */
export function codigoItemEnCampo(i: ItemEnCampo): string {
  return i.articuloCodigo || i.patronCodigo || i.columnaCodigo || i.minikitCodigo
    // El nombre del instrumento ES su código (TER-07): va en la columna de código,
    // y la descripción queda para la marca/modelo (2026-08-25).
    || i.loanerCodigo || i.vehiculoPatente || i.dispositivoSerie || i.instrumentoNombre || '—';
}

/** Marca + modelo de un instrumento del catálogo, para la columna de descripción. */
function detalleInstrumento(i: InstrumentoPatron): string {
  return [i.marca, i.modelo].map(v => v?.trim()).filter(Boolean).join(' ');
}

function itemMatchesBusqueda(query: string, i: ItemEnCampo): boolean {
  return matchesSearch(query,
    i.articuloCodigo, i.articuloDescripcion,
    i.minikitCodigo, i.loanerCodigo,
    i.instrumentoNombre, i.instrumentoDetalle, i.dispositivoDescripcion, i.dispositivoSerie,
    i.vehiculoPatente,
    i.patronCodigo, i.patronDescripcion, i.patronLote,
    i.columnaCodigo, i.columnaDescripcion, i.columnaSerie,
  );
}

/**
 * Vista "qué tiene cada ingeniero" (rediseño 2026-08-11): deriva el material en
 * campo de TODAS las asignaciones activas de una sola query — mismo neto que
 * useInventarioIngeniero (cantidad − devuelta − consumida) pero para todos los
 * IST a la vez. Los remitos solo alimentan el KPI de salidas abiertas.
 */
export function useAsignacionesVista() {
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [instrumentos, setInstrumentos] = useState<InstrumentoPatron[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Los instrumentos se traen para resolver marca/modelo de las asignaciones
      // viejas, que solo guardaron el nombre interno. Catálogo chico y cacheado.
      const [ings, asgs, rems, instr] = await Promise.all([
        ingenierosService.getAll(true),
        asignacionesService.getAll({ estado: 'activa' }),
        remitosService.getAll({ tipo: 'salida_campo' }).catch(() => [] as Remito[]),
        instrumentosService.getAll().catch(() => [] as InstrumentoPatron[]),
      ]);
      setIngenieros(ings);
      setAsignaciones(asgs);
      setRemitos(rems);
      setInstrumentos(instr);
    } catch (err) { console.error('Error cargando asignaciones:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cards = useMemo<IngenieroConMaterial[]>(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const detallePorInstrumento = new Map(instrumentos.map(i => [i.id, detalleInstrumento(i)]));
    const porIngeniero = new Map<string, { items: ItemEnCampo[]; ultima: string | null }>();
    for (const a of asignaciones) {
      for (const it of a.items ?? []) {
        if (it.estado !== 'asignado') continue;
        const neto = (it.cantidad ?? 1) - (it.cantidadDevuelta ?? 0) - (it.cantidadConsumida ?? 0);
        if (neto <= 0) continue;
        const entry = porIngeniero.get(a.ingenieroId) ?? { items: [], ultima: null };
        entry.items.push({
          ...it,
          // Fallback para asignaciones anteriores a `instrumentoDetalle`: se
          // resuelve del catálogo por id (no hay migración de datos).
          instrumentoDetalle: it.instrumentoDetalle
            || (it.instrumentoId ? detallePorInstrumento.get(it.instrumentoId) : null)
            || null,
          asignacionId: a.id, asignacionNumero: a.numero, asignacionCreatedAt: a.createdAt,
          neto,
          vencido: it.tipo === 'patron' && !!it.patronVencimiento && it.patronVencimiento.slice(0, 10) < hoy,
        });
        if (!entry.ultima || a.createdAt > entry.ultima) entry.ultima = a.createdAt;
        porIngeniero.set(a.ingenieroId, entry);
      }
    }
    return ingenieros.map(ing => {
      const entry = porIngeniero.get(ing.id);
      const items = (entry?.items ?? [])
        .sort((x, y) => (y.fechaAsignacion ?? '').localeCompare(x.fechaAsignacion ?? ''));
      return {
        ingeniero: ing,
        items,
        ultimaAsignacion: entry?.ultima ?? null,
        patronesVencidos: items.filter(i => i.vencido),
      };
    });
  }, [ingenieros, asignaciones, instrumentos]);

  /** Cards visibles: con búsqueda activa, solo IST con items que matchean (filtrados). */
  const q = search.trim();
  const visibleCards = useMemo(() => {
    if (!q) return cards;
    return cards
      .map(c => ({ ...c, items: c.items.filter(i => itemMatchesBusqueda(q, i)) }))
      .filter(c => c.items.length > 0);
  }, [cards, q]);

  const kpis = useMemo(() => ({
    itemsEnCampo: cards.reduce((s, c) => s + c.items.reduce((t, i) => t + i.neto, 0), 0),
    conMaterial: cards.filter(c => c.items.length > 0).length,
    totalIngenieros: ingenieros.length,
    patronesVencidos: cards.reduce((s, c) => s + c.patronesVencidos.length, 0),
    remitosAbiertos: remitos.filter(r => REMITO_ESTADOS_EN_CAMPO.has(r.estado)).length,
  }), [cards, remitos, ingenieros]);

  return { loading, cards: visibleCards, kpis, search, setSearch, searchActive: q.length > 0, loadData };
}
