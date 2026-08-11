import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  unidadesService, minikitsService, ingenierosService, clientesService,
  asignacionesService, movimientosService, remitosService, instrumentosService,
  dispositivosService, vehiculosService,
} from '../services/firebaseService';
import { useDebounce } from './useDebounce';
import { matchesSearch } from '../utils/searchTerms';
import { patronesService } from '../services/patronesService';
import { proveedoresService } from '../services/personalService';
import { EMPTY_PARTY } from '../components/remitos/RemitoTransportistaPicker';
import type { DatosTransportista } from '../services/stockService';
import type { UnidadStock, Minikit, Ingeniero, Cliente, ItemAsignacion, TipoItemAsignacion, InstrumentoPatron, Dispositivo, Vehiculo, UbicacionStock, Patron, Proveedor } from '@ags/shared';

/**
 * Un LOTE de patrón presentado como item asignable (2026-08-07). El patrón es
 * el kit; el lote es lo que el IST se lleva físicamente, con su vencimiento y
 * su certificado — por eso la unidad asignable es el lote, no el patrón.
 */
export interface LotePatronDisponible {
  patronId: string;
  codigo: string;
  descripcion: string;
  marca: string;
  lote: string;
  vencimiento: string | null;
  cantidad: number;
  /** true si el lote ya venció — se puede asignar igual, pero se avisa. */
  vencido: boolean;
}

export interface CartItem {
  id: string;
  tipo: TipoItemAsignacion;
  label: string;
  codigo: string;
  ingenieroId: string;
  ingenieroNombre: string;
  unidadId?: string;
  minikitId?: string;
  loanerId?: string;
  instrumentoId?: string;
  instrumentoTipo?: 'instrumento' | 'patron';
  dispositivoId?: string;
  vehiculoId?: string;
  articuloId?: string;
  articuloDescripcion?: string;
  /** Patrón (kit con lote): se asigna un LOTE concreto (2026-08-07). */
  patronId?: string;
  patronLote?: string;
  patronVencimiento?: string | null;
  cantidad: number;
  permanente: boolean;
}

/** Data shape for an item being dragged — no engineer info yet */
export interface DragPayload {
  tipo: TipoItemAsignacion;
  label: string;
  codigo: string;
  unidadId?: string;
  minikitId?: string;
  loanerId?: string;
  instrumentoId?: string;
  instrumentoTipo?: 'instrumento' | 'patron';
  dispositivoId?: string;
  vehiculoId?: string;
  articuloId?: string;
  articuloDescripcion?: string;
  patronId?: string;
  patronLote?: string;
  patronVencimiento?: string | null;
  permanente: boolean;
}

export interface IngenieroGroup {
  nombre: string;
  clienteId: string;
  items: CartItem[];
}

export function useAsignacionRapida() {
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [instrumentos, setInstrumentos] = useState<InstrumentoPatron[]>([]);
  const [patrones, setPatrones] = useState<Patron[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteByIng, setClienteByIng] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState('');
  /** Quién transporta la mercadería del remito de salida (2026-08-10). Faltaba:
   *  el remito de asignación se creaba sin transportista y el recuadro salía
   *  vacío en el papel. Mismo criterio que derivación y el form de remitos. */
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [transportistaId, setTransportistaId] = useState('');
  const [transportista, setTransportista] = useState<DatosTransportista>(EMPTY_PARTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'articulos' | 'minikits' | 'instrumentos' | 'patrones' | 'dispositivos' | 'vehiculos'>('articulos');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        unidadesService.getAll({ activoOnly: true }),
        minikitsService.getAll(true),
        instrumentosService.getAll({ activoOnly: true }),
        dispositivosService.getAll(true),
        vehiculosService.getAll(true),
        ingenierosService.getAll(true),
        clientesService.getAll(),
        patronesService.getAll({ activoOnly: true }),
        proveedoresService.getAll(true),
      ]);
      const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === 'fulfilled' ? r.value : (console.error('Error cargando:', r.reason), fallback);
      setUnidades(val(results[0], []));
      setMinikits(val(results[1], []));
      setInstrumentos(val(results[2], []));
      setDispositivos(val(results[3], []));
      setVehiculos(val(results[4], []));
      setIngenieros(val(results[5], []));
      setClientes(val(results[6], []));
      setPatrones(val(results[7], []));
      setProveedores(val(results[8], []));
    } catch (err) { console.error('Error cargando datos:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Available items ---
  const availableUnits = unidades.filter(u =>
    u.estado === 'disponible' && u.ubicacion?.tipo === 'posicion' && !cart.some(c => c.unidadId === u.id)
  );
  const availableMinikits = minikits.filter(mk =>
    mk.estado === 'en_base' && !cart.some(c => c.minikitId === mk.id)
  );
  const availableInstrumentos = instrumentos.filter(inst =>
    !inst.asignadoAId && !cart.some(c => c.instrumentoId === inst.id)
  );
  const availableDispositivos = dispositivos.filter(d =>
    !d.asignadoAId && !cart.some(c => c.dispositivoId === d.id)
  );
  const availableVehiculos = vehiculos.filter(v =>
    !v.asignadoA && !cart.some(c => c.vehiculoId === v.id)
  );
  /**
   * Lotes de patrón disponibles (2026-08-07): un item por lote, no por patrón.
   * Se listan los lotes con cantidad; los vencidos se muestran marcados en vez
   * de ocultarse — el IST a veces necesita llevarlos igual y es peor que
   * "desaparezcan" sin explicación.
   */
  const availablePatrones = useMemo<LotePatronDisponible[]>(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const out: LotePatronDisponible[] = [];
    for (const p of patrones) {
      for (const l of p.lotes ?? []) {
        if ((l.cantidad ?? 0) <= 0) continue;
        if (cart.some(c => c.patronId === p.id && c.patronLote === l.lote)) continue;
        out.push({
          patronId: p.id,
          codigo: p.codigoArticulo,
          descripcion: p.descripcion,
          marca: p.marca,
          lote: l.lote,
          vencimiento: l.fechaVencimiento ?? null,
          cantidad: l.cantidad ?? 0,
          vencido: !!l.fechaVencimiento && l.fechaVencimiento.slice(0, 10) < hoy,
        });
      }
    }
    return out;
  }, [patrones, cart]);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const q = debouncedQuery.toLowerCase();
  const filteredUnits = q ? availableUnits.filter(u =>
    matchesSearch(debouncedQuery, u.articuloCodigo, u.articuloDescripcion, u.nroSerie)
  ) : availableUnits;
  const filteredMinikits = q ? availableMinikits.filter(mk =>
    matchesSearch(debouncedQuery, mk.codigo, mk.nombre)
  ) : availableMinikits;
  const filteredInstrumentos = q ? availableInstrumentos.filter(i =>
    matchesSearch(debouncedQuery, i.nombre, i.marca, i.modelo, i.serie)
  ) : availableInstrumentos;
  const filteredDispositivos = q ? availableDispositivos.filter(d =>
    matchesSearch(debouncedQuery, d.marca, d.modelo, d.serie)
  ) : availableDispositivos;
  const filteredVehiculos = q ? availableVehiculos.filter(v =>
    matchesSearch(debouncedQuery, v.patente, v.marca, v.modelo)
  ) : availableVehiculos;
  const filteredPatrones = q ? availablePatrones.filter(p =>
    matchesSearch(debouncedQuery, p.codigo, p.descripcion, p.marca, p.lote)
  ) : availablePatrones;

  // --- Cart grouped by engineer (with per-engineer client) ---
  const cartByIngeniero = useMemo(() => {
    const map: Record<string, IngenieroGroup> = {};
    for (const item of cart) {
      if (!map[item.ingenieroId]) {
        map[item.ingenieroId] = { nombre: item.ingenieroNombre, clienteId: clienteByIng[item.ingenieroId] ?? '', items: [] };
      }
      map[item.ingenieroId].items.push(item);
    }
    return map;
  }, [cart, clienteByIng]);

  const setIngenieroCliente = (ingenieroId: string, clienteId: string) => {
    setClienteByIng(prev => ({ ...prev, [ingenieroId]: clienteId }));
  };

  const assignToIngeniero = (ingenieroId: string, ingenieroNombre: string, payload: DragPayload) => {
    // Auditoría I6: al asignar un artículo se asigna el DOC de unidad COMPLETO
    // (la unidad entera pasa a 'asignado'). Si el doc es un lote/granel de N,
    // la cantidad real asignada es N, no 1 — seedearla desde el doc para que
    // asignación, remito y movimiento queden coherentes.
    const unidad = payload.unidadId ? unidades.find(u => u.id === payload.unidadId) : undefined;
    setCart(prev => [...prev, {
      ...payload,
      id: crypto.randomUUID(),
      ingenieroId,
      ingenieroNombre,
      cantidad: unidad?.cantidad ?? 1,
    }]);
  };

  const removeFromCart = (cartId: string) => setCart(prev => prev.filter(c => c.id !== cartId));

  const updateCartItem = (cartId: string, updates: Partial<CartItem>) =>
    setCart(prev => prev.map(c => c.id === cartId ? { ...c, ...updates } : c));

  // --- Confirm: one Asignacion per engineer ---
  const handleConfirm = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      for (const [ingId, group] of Object.entries(cartByIngeniero)) {
        const ing = ingenieros.find(i => i.id === ingId);
        if (!ing) continue;

        const clienteId = group.clienteId || null;
        const cliente = clienteId ? clientes.find(c => c.cuit === clienteId) : null;
        const clienteNombre = cliente?.razonSocial || null;

        // Auditoría I6: la cantidad real de un item con unidadId es la del DOC de
        // unidad (el flujo asigna el doc completo; un lote de N son N unidades).
        // Se re-deriva acá por si el doc cambió después de armar el carrito.
        const cantidadReal = (c: CartItem): number => {
          if (!c.unidadId) return c.cantidad || 1;
          const u = unidades.find(x => x.id === c.unidadId);
          return u?.cantidad ?? c.cantidad ?? 1;
        };

        // La devolución restaura la posición ORIGINAL de la unidad — se captura
        // acá porque la asignación pisa `unidad.ubicacion` (UAT 2026-07-20).
        const origenDe = (c: CartItem): UbicacionStock | null => {
          if (!c.unidadId) return null;
          const u = unidades.find(x => x.id === c.unidadId);
          return u?.ubicacion ? { ...u.ubicacion } : null;
        };

        const items: ItemAsignacion[] = group.items.map(c => ({
          id: c.id, tipo: c.tipo,
          origenUbicacion: origenDe(c),
          unidadId: c.unidadId ?? null, articuloId: c.articuloId ?? null,
          articuloCodigo: c.tipo === 'articulo' ? c.codigo : null,
          articuloDescripcion: c.articuloDescripcion ?? null,
          cantidad: cantidadReal(c), cantidadDevuelta: 0, cantidadConsumida: 0,
          minikitId: c.minikitId ?? null, minikitCodigo: c.tipo === 'minikit' ? c.codigo : null,
          loanerId: c.loanerId ?? null, loanerCodigo: c.tipo === 'loaner' ? c.codigo : null,
          instrumentoId: c.instrumentoId ?? null,
          instrumentoNombre: c.tipo === 'instrumento' ? c.label : null,
          instrumentoTipo: c.instrumentoTipo ?? null,
          dispositivoId: c.dispositivoId ?? null,
          dispositivoDescripcion: c.tipo === 'dispositivo' ? c.label : null,
          // La serie viaja en `codigo` del carrito (ver dispositivoPayload).
          dispositivoSerie: c.tipo === 'dispositivo' && c.codigo !== '-' ? c.codigo : null,
          vehiculoId: c.vehiculoId ?? null,
          vehiculoPatente: c.tipo === 'vehiculo' ? c.codigo : null,
          // Patrón: lo que viaja es el LOTE, así que se guarda junto al código
          // del kit y su vencimiento (2026-08-07).
          patronId: c.patronId ?? null,
          patronCodigo: c.tipo === 'patron' ? c.codigo : null,
          patronDescripcion: c.tipo === 'patron' ? c.label : null,
          patronLote: c.patronLote ?? null,
          patronVencimiento: c.patronVencimiento ?? null,
          clienteId,
          clienteNombre,
          otNumber: null, proposito: null,
          estado: 'asignado', permanente: c.permanente,
          fechaAsignacion: new Date().toISOString(), fechaDevolucion: null,
        }));

        // Remito de salida a campo con TODO lo que sale (2026-08-04): antes
        // solo listaba artículos — una asignación de instrumentos/minikits
        // generaba un remito VACÍO (0 items) imposible de cerrar.
        const itemsRemito = items.map(i => ({
          id: crypto.randomUUID(),
          unidadId: i.unidadId ?? '',
          articuloId: i.articuloId ?? '',
          articuloCodigo: i.articuloCodigo ?? i.minikitCodigo ?? i.vehiculoPatente ?? i.patronCodigo ?? '',
          articuloDescripcion: [
            i.articuloDescripcion ?? i.instrumentoNombre ?? i.dispositivoDescripcion ?? i.patronDescripcion ?? i.minikitCodigo ?? i.tipo,
            i.patronLote ? `Lote ${i.patronLote}` : null,
          ].filter(Boolean).join(' · '),
          cantidad: i.cantidad,
          tipoItem: 'sale_y_vuelve' as const,
          devuelto: false,
          fechaDevolucion: null,
          minikitId: i.minikitId ?? null,
          minikitCodigo: i.minikitCodigo ?? null,
          instrumentoId: i.instrumentoId ?? null,
          dispositivoId: i.dispositivoId ?? null,
          // Sin esto la devolución no podía marcar la línea del patrón y
          // quedaba "en campo" para siempre (2026-08-08).
          patronId: i.patronId ?? null,
          patronLote: i.patronLote ?? null,
        }));
        const remitoId = itemsRemito.length === 0 ? null : await remitosService.create({
          tipo: 'salida_campo', ingenieroId: ing.id, ingenieroNombre: ing.nombre,
          transportistaId: transportistaId || null,
          transportistaNombre: transportista.razonSocial.trim() || null,
          clienteId, clienteNombre,
          estado: 'en_transito',
          items: itemsRemito,
          observaciones: observaciones || null,
          fechaSalida: new Date().toISOString(), fechaDevolucion: null,
        });

        await asignacionesService.create({
          ingenieroId: ing.id, ingenieroNombre: ing.nombre, items,
          clienteId, clienteNombre,
          observaciones: observaciones || null, estado: 'activa', remitoId,
        });

        for (const c of group.items) {
          if (c.unidadId) {
            // Auditoría I6: el egreso debe registrar la ubicación REAL de la unidad
            // como origen (no un 'Stock' genérico con id vacío) y la cantidad real
            // del doc (lotes de N cuentan N, no 1).
            const unidad = unidades.find(u => u.id === c.unidadId);
            const origen = unidad?.ubicacion;
            await unidadesService.update(c.unidadId, {
              estado: 'asignado',
              ubicacion: { tipo: 'ingeniero', referenciaId: ing.id, referenciaNombre: ing.nombre },
            });
            await movimientosService.create({
              tipo: 'egreso', unidadId: c.unidadId, articuloId: c.articuloId ?? '',
              articuloCodigo: c.codigo, articuloDescripcion: c.articuloDescripcion ?? '',
              cantidad: cantidadReal(c),
              nroSerie: unidad?.nroSerie ?? null, nroLote: unidad?.nroLote ?? null,
              // 'transito' no es un TipoOrigenDestino válido; los asignables son
              // siempre unidades en posición (ver filtro availableUnits).
              origenTipo: origen && origen.tipo !== 'transito' ? origen.tipo : 'posicion',
              origenId: origen?.referenciaId ?? '',
              origenNombre: origen?.referenciaNombre ?? 'Stock',
              destinoTipo: 'ingeniero', destinoId: ing.id, destinoNombre: ing.nombre,
              remitoId, creadoPor: 'sistema', motivo: 'Asignación rápida',
            });
          }
          if (c.minikitId) {
            await minikitsService.update(c.minikitId, {
              estado: 'en_campo',
              asignadoA: { tipo: 'ingeniero', id: ing.id, nombre: ing.nombre, desde: new Date().toISOString() },
            });
          }
          if (c.instrumentoId) {
            await instrumentosService.update(c.instrumentoId, { asignadoAId: ing.id, asignadoANombre: ing.nombre });
          }
          if (c.dispositivoId) {
            await dispositivosService.update(c.dispositivoId, { asignadoAId: ing.id, asignadoANombre: ing.nombre });
          }
          if (c.vehiculoId) {
            await vehiculosService.update(c.vehiculoId, { asignadoA: ing.nombre });
          }
        }
      }

      setCart([]);
      setClienteByIng({});
      setObservaciones('');
      await loadData();
    } catch (err) {
      console.error('Error al confirmar asignación:', err);
      alert('Error al confirmar asignación');
    } finally { setSaving(false); }
  };

  return {
    loading, saving, cart, tab, setTab, searchQuery, setSearchQuery,
    ingenieros, clientes, observaciones, setObservaciones,
    proveedores, transportistaId, transportista,
    setTransportistaSeleccion: (next: { id: string; datos: DatosTransportista }) => {
      setTransportistaId(next.id); setTransportista(next.datos);
    },
    filteredUnits, filteredMinikits, filteredInstrumentos, filteredDispositivos, filteredVehiculos,
    filteredPatrones,
    cartByIngeniero, assignToIngeniero, setIngenieroCliente,
    removeFromCart, updateCartItem, handleConfirm, loadData,
  };
}
