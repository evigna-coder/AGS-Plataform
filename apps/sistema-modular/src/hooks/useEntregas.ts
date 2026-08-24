import { useCallback, useEffect, useState } from 'react';
import type { Presupuesto, PresupuestoItem, RequerimientoCompra, Importacion, UnidadStock, OrdenCompraCliente, DireccionEntrega } from '@ags/shared';
import { presupuestosService } from '../services/presupuestosService';
import { unidadesService } from '../services/stockService';
import { requerimientosService, importacionesService } from '../services/importacionesService';
import { ordenesCompraService, condicionesPagoService } from '../services/presupuestosService';
import { clientesService } from '../services/clientesService';
import { ordenesCompraClienteService } from '../services/ordenesCompraClienteService';
import { direccionesEntregaService } from '../services/direccionesEntregaService';
import { buildEntregaRows } from '../utils/entregasResolver';
import type { EntregaRow } from '../utils/entregasResolver';
import { deepCleanForFirestore } from '../services/firebase';

type EstadoPresupuestoActivo = 'aceptado' | 'en_ejecucion' | 'finalizado';
const ESTADOS_ACTIVOS: EstadoPresupuestoActivo[] = ['aceptado', 'en_ejecucion', 'finalizado'];

/** Campos del item editables inline desde /entregas. */
export type EntregaItemPatch = Partial<
  Pick<PresupuestoItem,
    'otNumeroVinculada' | 'fechaComprometida' | 'entregadoManual' | 'disponibilidad'
    | 'direccionEntregaId' | 'direccionEntregaTexto'>
>;

interface UseEntregasReturn {
  rows: EntregaRow[];
  /** Direcciones de entrega por cliente, para el selector de cada fila. */
  direccionesPorCliente: Map<string, DireccionEntrega[]>;
  /** Recarga solo las direcciones — al volver del modal de gestión. */
  reloadDirecciones: () => Promise<void>;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  /** Patch parcial de un item del presupuesto (OT#, fecha comprometida, entregado, disponibilidad). */
  updateItem: (presupuestoId: string, itemId: string, patch: EntregaItemPatch) => Promise<void>;
}

export function useEntregas(): UseEntregasReturn {
  const [rows, setRows] = useState<EntregaRow[]>([]);
  const [direccionesPorCliente, setDirecciones] = useState<Map<string, DireccionEntrega[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar presupuestos por estado en paralelo, luego flatten.
      const [pptosBuckets, reqs, ocs, imps, clientes, unidades, condicionesPago, ocsCliente] = await Promise.all([
        Promise.all(ESTADOS_ACTIVOS.map(e => presupuestosService.getAll({ estado: e }))),
        requerimientosService.getAll().catch(() => [] as RequerimientoCompra[]),
        ordenesCompraService.getAll().catch(() => [] as any[]),
        importacionesService.getAll().catch(() => [] as Importacion[]),
        clientesService.getAll().catch(() => [] as any[]),
        // Stock de HOY (2026-08-13): una sola lectura de unidades para toda la
        // grilla, en vez de una consulta por fila.
        unidadesService.getAll({ activoOnly: true }).catch(() => [] as UnidadStock[]),
        condicionesPagoService.getAll().catch(() => [] as { id: string; nombre: string }[]),
        // OCs del CLIENTE (2026-08-24): una sola lectura para toda la grilla,
        // igual que las unidades. La alternativa era una consulta por fila.
        ordenesCompraClienteService.getAll().catch(() => [] as OrdenCompraCliente[]),
      ]);
      const ocClienteById = new Map(
        (ocsCliente as OrdenCompraCliente[]).map(oc => [oc.id, oc]),
      );

      /**
       * Condiciones que se cobran POR ADELANTADO (2026-08-24).
       *
       * Se resuelven por nombre contra el catálogo y no por un id fijo: el
       * registro "Anticipado" lo puede renombrar o duplicar cualquiera desde
       * la administración, y hardcodear su id dejaría la bandera muda sin que
       * nadie se entere.
       */
      const condicionesAnticipadas = new Set(
        (condicionesPago as { id: string; nombre?: string }[])
          .filter(c => /anticip/i.test(c.nombre ?? ''))
          .map(c => c.id),
      );
      const presupuestos = pptosBuckets.flat() as Presupuesto[];

      const clienteNombreById = new Map<string, string>(
        clientes.map((c: any) => [c.id as string, ((c.razonSocial ?? c.nombre ?? c.id) as string)]),
      );

      // Normalizar OC shape para el resolver (id + numero + items[{id, requerimientoId}])
      const ocsForResolver = ocs.map((oc: any) => ({
        id: oc.id as string,
        numero: oc.numero as string,
        estado: (oc.estado ?? null) as string | null,
        items: ((oc.items ?? []) as any[]).map((it: any) => ({
          id: it.id as string,
          requerimientoId: (it.requerimientoId ?? null) as string | null,
        })),
      }));

      // Stock real por artículo: lo LIBRE en estante y lo ya RESERVADO para
      // cada presupuesto. Se excluye lo parado en un remito (ya salió) y lo que
      // vive en un minikit o con un ingeniero (no está para entregar en mostrador).
      const stockLibrePorArticulo = new Map<string, number>();
      const stockReservadoPorPptoArticulo = new Map<string, number>();
      for (const u of unidades as UnidadStock[]) {
        if (u.activo === false || !u.articuloId) continue;
        const cant = u.cantidad ?? 1;
        if (u.estado === 'disponible' && u.ubicacion?.tipo !== 'remito') {
          stockLibrePorArticulo.set(u.articuloId, (stockLibrePorArticulo.get(u.articuloId) ?? 0) + cant);
        } else if (u.estado === 'reservado' && u.reservadoParaPresupuestoId) {
          const k = `${u.reservadoParaPresupuestoId}:${u.articuloId}`;
          stockReservadoPorPptoArticulo.set(k, (stockReservadoPorPptoArticulo.get(k) ?? 0) + cant);
        }
      }

      const built = buildEntregaRows({
        presupuestos,
        requerimientos: reqs as RequerimientoCompra[],
        ordenesCompra: ocsForResolver,
        importaciones: imps as Importacion[],
        clienteNombreById,
        stockLibrePorArticulo,
        stockReservadoPorPptoArticulo,
        condicionesAnticipadas,
        ocClienteById,
      });

      setRows(built);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('[useEntregas] load failed', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Direcciones de entrega, agrupadas por cliente. Van por su propio camino y
   * no dentro de `load`: el modal de gestión las cambia sin que haya cambiado
   * nada del resto de la grilla, y recargar todo por una dirección nueva es
   * varios segundos de espera.
   */
  const reloadDirecciones = useCallback(async () => {
    try {
      const todas = await direccionesEntregaService.getAll();
      const mapa = new Map<string, DireccionEntrega[]>();
      for (const d of todas) {
        if (!d.clienteId) continue;
        const lista = mapa.get(d.clienteId) ?? [];
        lista.push(d);
        mapa.set(d.clienteId, lista);
      }
      setDirecciones(mapa);
    } catch (err) {
      // Sin direcciones el visor funciona igual: la celda ofrece cargarlas.
      console.error('[useEntregas] direcciones de entrega', err);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void reloadDirecciones(); }, [reloadDirecciones]);

  const updateItem = useCallback(async (
    presupuestoId: string,
    itemId: string,
    patch: EntregaItemPatch,
  ) => {
    const pres = await presupuestosService.getById(presupuestoId);
    if (!pres) throw new Error('Presupuesto no encontrado');
    const newItems: PresupuestoItem[] = (pres.items ?? []).map((it: PresupuestoItem) =>
      it.id === itemId ? { ...it, ...patch } : it,
    );
    // presupuestosService.update usa writes desde './firebase' (convención repo — fix Electron keyboard router).
    // Envolvemos con deepCleanForFirestore para strip undefined en campos opcionales de PresupuestoItem.
    await presupuestosService.update(presupuestoId, deepCleanForFirestore({ items: newItems }) as Partial<Presupuesto>);
    await load();
  }, [load]);

  return { rows, direccionesPorCliente, reloadDirecciones, loading, error, reload: load, updateItem };
}
