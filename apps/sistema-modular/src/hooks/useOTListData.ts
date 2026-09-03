import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, usuariosService } from '../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, UsuarioAGS } from '@ags/shared';
import { otSinAgenda } from '@ags/shared';
import { sortByField, type SortDir } from '../components/ui/SortableHeader';
import { resolveEstadoOT } from '../components/ordenes-trabajo/OTStatusBadge';
import { fechaLocalYMD } from '../utils/formatFecha';
import { matchesSearch } from '../utils/searchTerms';
import { useEstablecimientoNombreById } from './useEstablecimientoSuffix';

/** WorkOrder + fecha de asignación = la fecha AGENDADA del servicio (fechaServicioAprox,
 *  la que se setea al asignar en agenda — definición de Esteban, UAT 2026-07-17).
 *  Se adjunta al cargar el snapshot para que el sort (sortByField) y el filtro por
 *  tipoFecha la traten como un campo más. Tipo local — no va a @ags/shared. */
type WorkOrderConAsignacion = WorkOrder & { fechaAsignacion: string };

export interface OTListFilters {
  clienteId: string;
  sistemaId: string;
  estadoAdmin: string;
  tipoServicio: string;
  ingenieroId: string;
  fechaDesde: string;
  fechaHasta: string;
  /** Campo del WorkOrder a usar para el rango de fechas. */
  tipoFecha: string;
  soloFacturable: boolean;
  soloContrato: boolean;
  soloGarantia: boolean;
  sortField: string;
  sortDir: string;
  /** Buscador unificado (cliente, N° OT, equipo, módulo, serie, sistema, servicio).
   *  Ya debounced por el caller — el grouping no aplica debouncing él mismo. */
  busqueda: string;
  /** Búsqueda específica en la descripción (problema inicial + reporte técnico). Debounced. */
  busquedaDescripcion: string;
}

export interface GroupedOT {
  ot: WorkOrder;
  isItem: boolean;
  hasItems: boolean;
}

/**
 * Subscribe a OTs + carga de reference data (clientes, sistemas, tipos servicio,
 * ingenieros). Computa el grouping (parent/items/orphans) y los KPIs.
 *
 * Antes vivía inline en OTList.tsx — ~150 líneas de useState + useMemo + useEffect.
 */
export function useOTListData(filters: OTListFilters) {
  const [ordenes, setOrdenes] = useState<WorkOrderConAsignacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicioList, setTiposServicioList] = useState<TipoServicio[]>([]);
  const [ingenierosList, setIngenierosList] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [clientesData, sistemasData, tiposData, usersData] = await Promise.all([
        clientesService.getAll(true),
        sistemasService.getAll(),
        tiposServicioService.getAll(),
        usuariosService.getAll(),
      ]);
      setClientes(clientesData);
      setSistemas(sistemasData);
      setTiposServicioList(tiposData);
      setIngenierosList(usersData.filter(u => u.role === 'ingeniero_soporte' && u.status === 'activo'));
    } catch {
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga reference data una vez al montar.
  useEffect(() => { loadData(); }, [loadData]);

  // Firestore query filters para suscripción de OTs.
  const otQueryFilters = useMemo(() => {
    const f: { clienteId?: string; sistemaId?: string } = {};
    if (filters.clienteId) f.clienteId = filters.clienteId;
    if (filters.sistemaId) f.sistemaId = filters.sistemaId;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters.clienteId, filters.sistemaId]);

  // Real-time OT subscription
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = ordenesTrabajoService.subscribe(
      otQueryFilters,
      // Adjuntar la fecha de asignación (= agendada) una vez por snapshot: la usan
      // la columna "Asignada" (sort) y el filtro por tipoFecha.
      (data) => { setOrdenes(data.map(ot => ({ ...ot, fechaAsignacion: ot.fechaServicioAprox ?? '' }))); setLoading(false); },
      (err) => { console.error('Error OTs:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [otQueryFilters]);

  // Parents con al menos 1 child. Estructural — no depende de filtros.
  const parentsWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const ot of ordenes) {
      if (ot.otNumber.includes('.')) {
        set.add(ot.otNumber.split('.')[0]);
      }
    }
    return set;
  }, [ordenes]);

  /**
   * Mapa sistemaId → datos buscables del equipo.
   *
   * Los campos `codigoInternoCliente`, `sistema`, `modulo*` del WorkOrder son
   * COPIAS desnormalizadas que se estampan cuando el técnico completa el
   * reporte. Una OT recién asignada solo tiene el `sistemaId`, así que buscar
   * por el código interno del cliente traía únicamente las finalizadas
   * (2026-09-03: buscar "CILP" parado en Pendientes no devolvía nada).
   * Resolviendo contra el catálogo, el equipo se encuentra desde que la OT
   * existe, sin depender de que alguien la haya trabajado.
   */
  // El nombre de la planta entra a la búsqueda (2026-09-03) — ver el hook.
  const establecimientoNombreById = useEstablecimientoNombreById();

  const sistemaBuscableById = useMemo(() => {
    const m = new Map<string, { nombre: string; codigo: string | null; serie: string | null }>();
    for (const s of sistemas) {
      m.set(s.id, {
        nombre: s.nombre,
        codigo: s.codigoInternoCliente ?? null,
        serie: (s as { serie?: string | null }).serie ?? null,
      });
    }
    return m;
  }, [sistemas]);

  /**
   * "Sin agenda" ACCIONABLE (2026-08-21): entrega, proveedor externo o alquiler
   * que todavía hay que reclamar.
   *
   * Quedan afuera:
   *  - Cierre técnico en adelante: el trabajo ya se hizo y se controla desde el
   *    cierre técnico, no desde acá (criterio del usuario).
   *  - Canceladas: no hay nada que reclamar.
   *  - Padres con hijas: son contenedores no accionables. Eran 13 de 38 — el
   *    grueso de la diferencia contra la cola de la agenda, que ya los excluye.
   */
  const padresConHijas = useMemo(() => {
    const set = new Set<string>();
    for (const ot of ordenes) {
      if (ot.otNumber.includes('.')) set.add(ot.otNumber.split('.')[0]);
    }
    return set;
  }, [ordenes]);

  const ES_SIN_AGENDA_CERRADA = ['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO', 'CANCELADA'];
  const esSinAgendaAccionable = useCallback((ot: WorkOrder) => {
    if (!otSinAgenda(ot)) return false;
    if (ES_SIN_AGENDA_CERRADA.includes(resolveEstadoOT(ot))) return false;
    if (!ot.otNumber.includes('.') && padresConHijas.has(ot.otNumber)) return false;
    return true;
  }, [padresConHijas]);

  // Universo filtrado por TODO menos estadoAdmin (2026-08-31): las cards de KPI
  // deben reflejar los filtros activos (fechas, contrato, facturable, tipo de
  // servicio, ingeniero, búsquedas) — antes se calculaban sobre todas las OTs y
  // "seguían enumerando como si no existieran los filtros". estadoAdmin queda
  // afuera A PROPÓSITO: las cards son el selector de estado, y elegir una no
  // debe vaciar los contadores de las demás.
  const filtradasBase = useMemo<WorkOrderConAsignacion[]>(() => {
    let list = ordenes;
    const q = filters.busqueda.trim();
    const hasSearch = !!q;
    if (hasSearch) {
      // Buscador unificado multi-término ("mant 7890"): todos los términos deben
      // aparecer entre cliente, N° OT, equipo, módulo, serie, sistema (string o
      // nombre resuelto), tipo servicio e ingeniero.
      list = list.filter(ot => matchesSearch(q,
        ot.otNumber,
        ot.razonSocial,
        ot.establecimientoId ? establecimientoNombreById.get(ot.establecimientoId) : null,
        ot.codigoInternoCliente,
        ot.moduloModelo,
        ot.moduloDescripcion,
        ot.moduloSerie,
        ot.sistema,
        // Del catálogo, no de la copia en la OT: encuentra también las que
        // todavía nadie trabajó.
        ot.sistemaId ? sistemaBuscableById.get(ot.sistemaId)?.nombre : null,
        ot.sistemaId ? sistemaBuscableById.get(ot.sistemaId)?.codigo : null,
        ot.sistemaId ? sistemaBuscableById.get(ot.sistemaId)?.serie : null,
        ot.tipoServicio,
        ot.ingenieroAsignadoNombre,
      ));
    }
    // Parents con al menos 1 hija NUNCA se muestran — son contenedores, solo
    // existen las hijas (UAT 2026-07-18, Fanely: verlos al filtrar confundía).
    // Los parents sin hijas (legacy) siguen visibles o desaparecerían OTs enteras.
    list = list.filter(ot => !parentsWithChildren.has(ot.otNumber));
    const qDesc = filters.busquedaDescripcion.trim().toLowerCase();
    if (qDesc) {
      list = list.filter(ot =>
        (ot.problemaFallaInicial || '').toLowerCase().includes(qDesc) ||
        (ot.reporteTecnico || '').toLowerCase().includes(qDesc)
      );
    }
    if (filters.tipoServicio) list = list.filter(ot => ot.tipoServicio === filters.tipoServicio);
    if (filters.ingenieroId) list = list.filter(ot => ot.ingenieroAsignadoId === filters.ingenieroId);
    if (filters.fechaDesde || filters.fechaHasta) {
      const campo = (filters.tipoFecha || 'createdAt') as keyof WorkOrderConAsignacion;
      // Normalizar el campo a 'YYYY-MM-DD' local: createdAt llega como Timestamp (objeto),
      // comparar el objeto como string descartaba TODO. fechaDesde/Hasta ya son días locales.
      list = list.filter(ot => {
        const ymd = fechaLocalYMD(ot[campo]);
        if (!ymd) return false;
        if (filters.fechaDesde && ymd < filters.fechaDesde) return false;
        if (filters.fechaHasta && ymd > filters.fechaHasta) return false;
        return true;
      });
    }
    if (filters.soloFacturable) list = list.filter(ot => ot.esFacturable);
    if (filters.soloContrato) list = list.filter(ot => ot.tieneContrato);
    if (filters.soloGarantia) list = list.filter(ot => ot.esGarantia);
    return list;
  }, [
    ordenes, parentsWithChildren, sistemaBuscableById, establecimientoNombreById,
    filters.tipoServicio, filters.ingenieroId,
    filters.fechaDesde, filters.fechaHasta, filters.tipoFecha,
    filters.soloFacturable, filters.soloContrato, filters.soloGarantia,
    filters.busqueda, filters.busquedaDescripcion,
  ]);

  // Grouping: parents + sus items + orphans. Sobre el universo filtrado, con el
  // filtro de estado encima.
  const grouped = useMemo<GroupedOT[]>(() => {
    let list: WorkOrderConAsignacion[] = filtradasBase;
    if (filters.estadoAdmin === '__pendientes__') {
      list = list.filter(ot => resolveEstadoOT(ot) !== 'FINALIZADO');
    } else if (filters.estadoAdmin === '__sin_agenda__') {
      list = list.filter(esSinAgendaAccionable);
    } else if (filters.estadoAdmin) {
      list = list.filter(ot => resolveEstadoOT(ot) === filters.estadoAdmin);
    }

    const parents: WorkOrder[] = [];
    const itemsByParent: Record<string, WorkOrder[]> = {};
    const parentNumbers = new Set<string>();

    list.forEach(ot => {
      if (!ot.otNumber.includes('.')) {
        parents.push(ot);
        parentNumbers.add(ot.otNumber);
      }
    });

    const orphans: WorkOrder[] = [];
    list.forEach(ot => {
      if (ot.otNumber.includes('.')) {
        const parentNum = ot.otNumber.split('.')[0];
        if (parentNumbers.has(parentNum)) {
          if (!itemsByParent[parentNum]) itemsByParent[parentNum] = [];
          itemsByParent[parentNum].push(ot);
        } else {
          orphans.push(ot);
        }
      }
    });

    const sortedParents = sortByField(parents, filters.sortField, filters.sortDir as SortDir);
    const sortedOrphans = sortByField(orphans, filters.sortField, filters.sortDir as SortDir);

    const result: GroupedOT[] = [];

    sortedParents.forEach(parent => {
      const items = itemsByParent[parent.otNumber];
      const hasItems = !!(items && items.length > 0);
      result.push({ ot: parent, isItem: false, hasItems });
      if (items) {
        items.sort((a, b) => {
          const ia = parseInt(a.otNumber.split('.')[1]);
          const ib = parseInt(b.otNumber.split('.')[1]);
          return ia - ib;
        });
        items.forEach(item => result.push({ ot: item, isItem: true, hasItems: false }));
      }
    });

    sortedOrphans.forEach(ot => result.push({ ot, isItem: false, hasItems: false }));

    return result;
  }, [filtradasBase, esSinAgendaAccionable, filters.estadoAdmin, filters.sortField, filters.sortDir]);

  // KPIs sobre el universo FILTRADO (sin el filtro de estado — ver filtradasBase):
  // las cards acompañan a la tabla, no al total histórico.
  const kpis = useMemo(() => {
    const byEstado: Record<string, number> = {};
    let totalHsLab = 0, totalHsViaje = 0, facturables = 0;
    filtradasBase.forEach(ot => {
      const est = resolveEstadoOT(ot);
      byEstado[est] = (byEstado[est] || 0) + 1;
      totalHsLab += Number(ot.horasTrabajadas) || 0;
      totalHsViaje += Number(ot.tiempoViaje) || 0;
      if (ot.esFacturable) facturables++;
    });
    const pendientes = filtradasBase.filter(ot => resolveEstadoOT(ot) !== 'FINALIZADO').length;
    const sinAgenda = filtradasBase.filter(esSinAgendaAccionable).length;
    return { byEstado, totalHsLab, totalHsViaje, pendientes, sinAgenda, facturables, total: filtradasBase.length };
  }, [filtradasBase, esSinAgendaAccionable]);

  return {
    ordenes, clientes, sistemas, tiposServicioList, ingenierosList,
    loading, grouped, kpis,
    reloadReferenceData: loadData,
  };
}
