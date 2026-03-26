import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  unidadesService, minikitsService, ingenierosService, clientesService,
  asignacionesService, movimientosService, remitosService, instrumentosService,
  dispositivosService, vehiculosService,
} from '../services/firebaseService';
import { useDebounce } from './useDebounce';
import type { UnidadStock, Minikit, Ingeniero, Cliente, ItemAsignacion, TipoItemAsignacion, InstrumentoPatron, Dispositivo, Vehiculo } from '@ags/shared';

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
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteByIng, setClienteByIng] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'articulos' | 'minikits' | 'instrumentos' | 'dispositivos' | 'vehiculos'>('articulos');
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

  const debouncedQuery = useDebounce(searchQuery, 300);
  const q = debouncedQuery.toLowerCase();
  const filteredUnits = q ? availableUnits.filter(u =>
    u.articuloCodigo.toLowerCase().includes(q) || u.articuloDescripcion.toLowerCase().includes(q) ||
    (u.nroSerie?.toLowerCase().includes(q))
  ) : availableUnits;
  const filteredMinikits = q ? availableMinikits.filter(mk =>
    mk.codigo.toLowerCase().includes(q) || mk.nombre.toLowerCase().includes(q)
  ) : availableMinikits;
  const filteredInstrumentos = q ? availableInstrumentos.filter(i =>
    i.nombre.toLowerCase().includes(q) || i.marca.toLowerCase().includes(q) ||
    i.modelo.toLowerCase().includes(q) || i.serie.toLowerCase().includes(q)
  ) : availableInstrumentos;
  const filteredDispositivos = q ? availableDispositivos.filter(d =>
    d.marca.toLowerCase().includes(q) || d.modelo.toLowerCase().includes(q) || d.serie.toLowerCase().includes(q)
  ) : availableDispositivos;
  const filteredVehiculos = q ? availableVehiculos.filter(v =>
    v.patente.toLowerCase().includes(q) || v.marca.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q)
  ) : availableVehiculos;

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
    setCart(prev => [...prev, {
      ...payload,
      id: crypto.randomUUID(),
      ingenieroId,
      ingenieroNombre,
      cantidad: 1,
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

        const items: ItemAsignacion[] = group.items.map(c => ({
          id: c.id, tipo: c.tipo,
          unidadId: c.unidadId ?? null, articuloId: c.articuloId ?? null,
          articuloCodigo: c.tipo === 'articulo' ? c.codigo : null,
          articuloDescripcion: c.articuloDescripcion ?? null,
          cantidad: c.cantidad, cantidadDevuelta: 0, cantidadConsumida: 0,
          minikitId: c.minikitId ?? null, minikitCodigo: c.tipo === 'minikit' ? c.codigo : null,
          loanerId: c.loanerId ?? null, loanerCodigo: c.tipo === 'loaner' ? c.codigo : null,
          instrumentoId: c.instrumentoId ?? null,
          instrumentoNombre: c.tipo === 'instrumento' ? c.label : null,
          instrumentoTipo: c.instrumentoTipo ?? null,
          dispositivoId: c.dispositivoId ?? null,
          dispositivoDescripcion: c.tipo === 'dispositivo' ? c.label : null,
          vehiculoId: c.vehiculoId ?? null,
          vehiculoPatente: c.tipo === 'vehiculo' ? c.codigo : null,
          clienteId,
          clienteNombre,
          otNumber: null, proposito: null,
          estado: 'asignado', permanente: c.permanente,
          fechaAsignacion: new Date().toISOString(), fechaDevolucion: null,
        }));

        const remitoId = await remitosService.create({
          tipo: 'salida_campo', ingenieroId: ing.id, ingenieroNombre: ing.nombre,
          clienteId, clienteNombre,
          estado: 'en_transito',
          items: items.filter(i => i.tipo === 'articulo').map(i => ({
            id: crypto.randomUUID(), unidadId: i.unidadId ?? '', articuloId: i.articuloId ?? '',
            articuloCodigo: i.articuloCodigo ?? '', articuloDescripcion: i.articuloDescripcion ?? '',
            cantidad: i.cantidad, tipoItem: 'sale_y_vuelve' as const, devuelto: false, fechaDevolucion: null,
          })),
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
            await unidadesService.update(c.unidadId, {
              estado: 'asignado',
              ubicacion: { tipo: 'ingeniero', referenciaId: ing.id, referenciaNombre: ing.nombre },
            });
            await movimientosService.create({
              tipo: 'egreso', unidadId: c.unidadId, articuloId: c.articuloId ?? '',
              articuloCodigo: c.codigo, articuloDescripcion: c.articuloDescripcion ?? '',
              cantidad: c.cantidad, origenTipo: 'posicion', origenId: '', origenNombre: 'Stock',
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
    filteredUnits, filteredMinikits, filteredInstrumentos, filteredDispositivos, filteredVehiculos,
    cartByIngeniero, assignToIngeniero, setIngenieroCliente,
    removeFromCart, updateCartItem, handleConfirm, loadData,
  };
}
