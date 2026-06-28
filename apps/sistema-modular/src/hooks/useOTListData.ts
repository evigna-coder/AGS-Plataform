import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, usuariosService } from '../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, UsuarioAGS } from '@ags/shared';
import { sortByField, type SortDir } from '../components/ui/SortableHeader';
import { resolveEstadoOT } from '../components/ordenes-trabajo/OTStatusBadge';
import { fechaLocalYMD } from '../utils/formatFecha';

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
  const [ordenes, setOrdenes] = useState<WorkOrder[]>([]);
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
      (data) => { setOrdenes(data); setLoading(false); },
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

  // Mapa sistemaId → nombre, para que el buscador unificado matchee por nombre de
  // sistema aunque el WorkOrder solo tenga el sistemaId (no el string `sistema`).
  const sistemaNombreById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sistemas) m.set(s.id, s.nombre);
    return m;
  }, [sistemas]);

  // Grouping: parents + sus items + orphans.
  const grouped = useMemo<GroupedOT[]>(() => {
    let list = ordenes;
    if (filters.estadoAdmin === '__pendientes__') {
      list = list.filter(ot => resolveEstadoOT(ot) !== 'FINALIZADO');
    } else if (filters.estadoAdmin) {
      list = list.filter(ot => resolveEstadoOT(ot) === filters.estadoAdmin);
    }
    const q = filters.busqueda.trim().toLowerCase();
    const hasSearch = !!q;
    if (hasSearch) {
      // Buscador unificado: matchea contra cliente, N° OT, equipo, módulo, serie,
      // sistema (string o nombre resuelto), tipo servicio e ingeniero.
      list = list.filter(ot =>
        ot.otNumber.toLowerCase().includes(q) ||
        (ot.razonSocial || '').toLowerCase().includes(q) ||
        (ot.codigoInternoCliente || '').toLowerCase().includes(q) ||
        (ot.moduloModelo || '').toLowerCase().includes(q) ||
        (ot.moduloDescripcion || '').toLowerCase().includes(q) ||
        (ot.moduloSerie || '').toLowerCase().includes(q) ||
        (ot.sistema || '').toLowerCase().includes(q) ||
        (ot.sistemaId ? (sistemaNombreById.get(ot.sistemaId) || '') : '').toLowerCase().includes(q) ||
        (ot.tipoServicio || '').toLowerCase().includes(q) ||
        (ot.ingenieroAsignadoNombre || '').toLowerCase().includes(q)
      );
    } else {
      // Sin búsqueda: ocultar parents que tengan al menos 1 child.
      list = list.filter(ot => !parentsWithChildren.has(ot.otNumber));
    }
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
      const campo = (filters.tipoFecha || 'createdAt') as keyof WorkOrder;
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
  }, [
    ordenes, parentsWithChildren, sistemaNombreById,
    filters.estadoAdmin, filters.tipoServicio, filters.ingenieroId,
    filters.fechaDesde, filters.fechaHasta, filters.tipoFecha,
    filters.soloFacturable, filters.soloContrato, filters.soloGarantia,
    filters.busqueda, filters.busquedaDescripcion,
    filters.sortField, filters.sortDir,
  ]);

  // KPIs sobre todas las OTs (no filtradas).
  const kpis = useMemo(() => {
    const byEstado: Record<string, number> = {};
    let totalHsLab = 0, totalHsViaje = 0, facturables = 0;
    ordenes.forEach(ot => {
      const est = resolveEstadoOT(ot);
      byEstado[est] = (byEstado[est] || 0) + 1;
      totalHsLab += Number(ot.horasTrabajadas) || 0;
      totalHsViaje += Number(ot.tiempoViaje) || 0;
      if (ot.esFacturable) facturables++;
    });
    const pendientes = ordenes.filter(ot => resolveEstadoOT(ot) !== 'FINALIZADO').length;
    return { byEstado, totalHsLab, totalHsViaje, pendientes, facturables, total: ordenes.length };
  }, [ordenes]);

  return {
    ordenes, clientes, sistemas, tiposServicioList, ingenierosList,
    loading, grouped, kpis,
    reloadReferenceData: loadData,
  };
}
