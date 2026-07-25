import { useState, useEffect, useMemo } from 'react';
import {
  asignacionesService, clientesService, sistemasService, ordenesTrabajoService,
} from '../services/firebaseService';
import { movimientosService } from '../services/stockService';
import type { Cliente, Sistema, WorkOrder, MovimientoStock } from '@ags/shared';

/**
 * Fuentes de un consumo (verificado contra el código 2026-07-20):
 *  - 'cierre_ot':      MovimientoStock tipo 'egreso' CON otNumber — lo crea la deducción
 *                      de stock del cierre administrativo (stockService.entregar /
 *                      deducirUnidadDisponible, destinoTipo 'cliente'). Se excluye
 *                      subtipo 'venta_loaner' (es una venta, no un consumo de OT).
 *  - 'consumo_manual': MovimientoStock tipo 'consumo' — registrado a mano desde
 *                      Movimientos (destino consumo_ot) o por consumo de componentes
 *                      de patrón (entidadTipo 'patron', patronesConsumirHelpers).
 *  - 'asignacion':     ItemAsignacion con cantidadConsumida > 0 (asignacionesService
 *                      .consumirItems). Este camino NO genera MovimientoStock, por lo
 *                      que las fuentes son disjuntas y no hace falta dedupe. Si a
 *                      futuro el consumo de asignación empezara a espejar un
 *                      movimiento, preferir el movimiento y descartar el item
 *                      equivalente por (otNumber, articuloCodigo, cantidad).
 */
export type OrigenConsumo = 'cierre_ot' | 'consumo_manual' | 'asignacion';

export const ORIGEN_CONSUMO_LABELS: Record<OrigenConsumo, string> = {
  cierre_ot: 'Cierre de OT',
  consumo_manual: 'Consumo manual',
  asignacion: 'Asignación',
};

export const ORIGEN_CONSUMO_COLORS: Record<OrigenConsumo, string> = {
  cierre_ot: 'bg-teal-100 text-teal-700',
  consumo_manual: 'bg-slate-100 text-slate-600',
  asignacion: 'bg-amber-100 text-amber-700',
};

export interface ConsumoRow {
  id: string;
  /** ISO. Para asignaciones es la fecha de asignación (la fecha exacta de consumo no se persiste). */
  fecha: string;
  otNumber: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  sistemaId: string | null;
  sistemaNombre: string | null;
  /** Código interno del equipo asignado por el cliente (Sistema.codigoInternoCliente).
   *  Resuelto por sistemaId → sistema; null si el consumo no resuelve equipo. */
  sistemaCodigoInterno: string | null;
  /** Resuelto vía OT.establecimientoId, o sistemaId → sistema.establecimientoId. */
  establecimientoId: string | null;
  articuloCodigo: string | null;
  articuloDescripcion: string | null;
  cantidad: number;
  origen: OrigenConsumo;
}

/**
 * OT padre de un item hijo: "29562.01" → "29562"; null si no es hijo.
 * Los OTs hijo pueden no denormalizar `sistemaId`/`clienteId` (vive en el padre); reportes-ot
 * resuelve con este mismo fallback (services/firebaseService.ts). Sin esto, un consumo cargado
 * contra una OT hija no se atribuía al equipo/cliente en los históricos embebidos.
 */
function parentOtNumber(n: string): string | null {
  const i = n.lastIndexOf('.');
  return i > 0 ? n.slice(0, i) : null;
}

function movToRow(m: MovimientoStock, origen: OrigenConsumo): ConsumoRow {
  const ot = m.otNumber || (m.destinoTipo === 'consumo_ot' ? m.destinoId : '') || null;
  return {
    id: `mov-${m.id}`,
    fecha: m.createdAt,
    otNumber: ot,
    // Fallback si la OT no resuelve: la deducción del cierre denormaliza el cliente
    // en destino (destinoTipo 'cliente'). Se pisa con los datos de la OT más abajo.
    clienteId: m.destinoTipo === 'cliente' && m.destinoId !== ot ? m.destinoId || null : null,
    clienteNombre: m.destinoTipo === 'cliente' ? m.destinoNombre || null : null,
    sistemaId: null,
    sistemaNombre: null,
    sistemaCodigoInterno: null,
    establecimientoId: null,
    articuloCodigo: m.articuloCodigo || m.codigoComponente || null,
    articuloDescripcion: m.articuloDescripcion
      || (m.entidadTipo === 'patron' ? `Componente de patrón${m.lote ? ` · lote ${m.lote}` : ''}` : null),
    cantidad: m.cantidad ?? 0,
    origen,
  };
}

/**
 * Cruce en memoria: movimientos de consumo + items de asignación consumidos, con join a OT.
 *
 * `enabled` (default true) permite carga LAZY para los embeds en detalles
 * (ConsumosSection): con `enabled: false` el hook NO dispara ninguna consulta.
 * La carga arranca cuando `enabled` es (o pasa a) true; el `[enabled]` del efecto
 * garantiza que se ejecute una sola vez y no se repita en re-renders. NO se usa un
 * ref-latch: un latch que sobrevive al cleanup + el guard `alive` dejaban `loading`
 * pegado en true si el efecto se limpiaba antes de terminar el async (StrictMode en
 * dev, o cualquier remount) — era el "Consumos por equipo colgado para siempre".
 */
export function useConsumos(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  const [movConsumos, setMovConsumos] = useState<MovimientoStock[]>([]);
  const [movEgresos, setMovEgresos] = useState<MovimientoStock[]>([]);
  const [asgRows, setAsgRows] = useState<ConsumoRow[]>([]);
  const [otsByNumber, setOtsByNumber] = useState<Map<string, WorkOrder>>(new Map());
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [consumos, egresos, asignaciones, cls, sis] = await Promise.all([
          movimientosService.getAll({ tipo: 'consumo' }),
          movimientosService.getAll({ tipo: 'egreso' }),
          asignacionesService.getAll(),
          clientesService.getAll(true),
          sistemasService.getAll(),
        ]);
        if (!alive) return;

        const egresosOT = egresos.filter(m => !!m.otNumber && m.subtipo !== 'venta_loaner');
        const itemsConsumidos: ConsumoRow[] = [];
        for (const a of asignaciones) {
          if (a.estado === 'cancelada') continue;
          for (const it of a.items) {
            if ((it.cantidadConsumida ?? 0) <= 0) continue;
            itemsConsumidos.push({
              id: `asg-${a.id}-${it.id}`,
              fecha: it.fechaAsignacion || a.createdAt,
              otNumber: it.otNumber || null,
              clienteId: it.clienteId ?? a.clienteId ?? null,
              clienteNombre: it.clienteNombre ?? a.clienteNombre ?? null,
              sistemaId: null,
              sistemaNombre: null,
              sistemaCodigoInterno: null,
              establecimientoId: null,
              articuloCodigo: it.articuloCodigo || it.minikitCodigo || it.instrumentoNombre || null,
              articuloDescripcion: it.articuloDescripcion ?? null,
              cantidad: it.cantidadConsumida,
              origen: 'asignacion',
            });
          }
        }

        setMovConsumos(consumos);
        setMovEgresos(egresosOT);
        setAsgRows(itemsConsumidos);
        setClientes(cls);
        setSistemas(sis);

        // Join OT → cliente/equipo: solo las OTs referenciadas (getByOtNumber puntual,
        // no getAll de toda la colección reportes).
        const nums = new Set<string>();
        for (const m of [...consumos, ...egresosOT]) {
          const ot = m.otNumber || (m.destinoTipo === 'consumo_ot' ? m.destinoId : '');
          if (ot) nums.add(ot);
        }
        for (const r of itemsConsumidos) if (r.otNumber) nums.add(r.otNumber);
        // Traer también los OT padre de los hijos, para el fallback de sistemaId/clienteId.
        for (const n of [...nums]) {
          const p = parentOtNumber(n);
          if (p) nums.add(p);
        }
        const fetched = await Promise.all(
          Array.from(nums).map(async n => [n, await ordenesTrabajoService.getByOtNumber(n)] as const),
        );
        if (!alive) return;
        const map = new Map<string, WorkOrder>();
        for (const [n, ot] of fetched) if (ot) map.set(n, ot);
        setOtsByNumber(map);
      } catch (err) {
        console.error('[useConsumos] error cargando consumos:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [enabled]);

  const rows = useMemo<ConsumoRow[]>(() => {
    const base = [
      // Egresos con OT: data VIEJA de cierres (antes de 2026-07-23 el cierre asentaba 'egreso').
      ...movEgresos.map(m => movToRow(m, 'cierre_ot')),
      // Consumos: los del cierre llevan subtipo 'cierre_ot'; el resto es consumo manual.
      ...movConsumos.map(m => movToRow(m, m.subtipo === 'cierre_ot' ? 'cierre_ot' : 'consumo_manual')),
      ...asgRows,
    ];
    const clienteNombreById = new Map(clientes.map(c => [c.id, c.razonSocial]));
    const estabBySistema = new Map(sistemas.map(s => [s.id, s.establecimientoId ?? null]));
    const codigoBySistema = new Map(sistemas.map(s => [s.id, s.codigoInternoCliente ?? null]));
    return base.map(r => {
      const ot = r.otNumber ? otsByNumber.get(r.otNumber) : undefined;
      // Fallback al OT padre cuando el hijo no denormaliza cliente/equipo.
      const parentNum = r.otNumber ? parentOtNumber(r.otNumber) : null;
      const padre = parentNum ? otsByNumber.get(parentNum) : undefined;
      const clienteId = ot?.clienteId || padre?.clienteId || r.clienteId;
      const sistemaId = ot?.sistemaId || padre?.sistemaId || null;
      return {
        ...r,
        clienteId: clienteId ?? null,
        clienteNombre: ot?.razonSocial || padre?.razonSocial || r.clienteNombre || (clienteId ? clienteNombreById.get(clienteId) ?? null : null),
        sistemaId,
        sistemaNombre: ot?.sistema || padre?.sistema || null,
        sistemaCodigoInterno: sistemaId ? codigoBySistema.get(sistemaId) ?? null : null,
        // El scope por establecimiento se resuelve por la OT (o el padre) si lo denormaliza,
        // sino por el sistema (sistemas tienen establecimientoId).
        establecimientoId: ot?.establecimientoId || padre?.establecimientoId || (sistemaId ? estabBySistema.get(sistemaId) ?? null : null),
      };
    }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [movConsumos, movEgresos, asgRows, otsByNumber, clientes, sistemas]);

  return { rows, clientes, sistemas, loading };
}
