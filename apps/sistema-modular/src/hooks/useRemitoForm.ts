import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Remito, RemitoItem, TipoRemito, Cliente, Establecimiento, Ingeniero, UnidadStock } from '@ags/shared';
import { establecimientoPerteneceACliente, establecimientoUnicoId } from '@ags/shared';
import {
  remitosService, ingenierosService, clientesService, establecimientosService,
  unidadesService, ordenesTrabajoService,
} from '../services/firebaseService';

export interface RemitoFormState {
  tipo: TipoRemito;
  ingenieroId: string;
  clienteId: string;
  establecimientoId: string;
  otNumbers: string[];
  fechaSalida: string;
  observaciones: string;
}

const INITIAL: RemitoFormState = {
  tipo: 'entrega_cliente',
  ingenieroId: '', clienteId: '', establecimientoId: '',
  otNumbers: [], fechaSalida: new Date().toISOString().slice(0, 10), observaciones: '',
};

/**
 * Form de remito de stock — crear y editar en el MISMO modal (rework 2026-07-31):
 * ingeniero OPCIONAL (no siempre lo lleva un ingeniero), cliente → establecimiento
 * con autoselección de único, OTs del cliente, items inline con serie/cantidad/
 * observaciones. Editable solo en borrador y sin imprimir.
 */
export function useRemitoForm(open: boolean, remito: Remito | null) {
  const [form, setForm] = useState<RemitoFormState>(INITIAL);
  const [items, setItems] = useState<RemitoItem[]>([]);
  // Tope de cantidad por item (existencia de la unidad al agregarla).
  const [maxCantidad, setMaxCantidad] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [otsCliente, setOtsCliente] = useState<string[]>([]);

  const set = useCallback(<K extends keyof RemitoFormState>(k: K, v: RemitoFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v })), []);

  // Catálogos al abrir
  useEffect(() => {
    if (!open) return;
    ingenierosService.getAll().then((list: Ingeniero[]) => setIngenieros(list.filter(i => i.activo))).catch(() => setIngenieros([]));
    clientesService.getAll(true).then(setClientes).catch(() => setClientes([]));
    establecimientosService.getAll().then(setEstablecimientos).catch(() => setEstablecimientos([]));
    unidadesService.getAll({ estado: 'disponible' }).then(setUnidades).catch(() => setUnidades([]));
  }, [open]);

  // Prefill en edición / reset en alta
  useEffect(() => {
    if (!open) return;
    if (remito) {
      setForm({
        tipo: remito.tipo,
        ingenieroId: remito.ingenieroId || '',
        clienteId: remito.clienteId || '',
        establecimientoId: remito.establecimientoId || '',
        otNumbers: remito.otNumbers ?? [],
        fechaSalida: remito.fechaSalida?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        observaciones: remito.observaciones || '',
      });
      setItems(remito.items ?? []);
    } else {
      setForm(INITIAL);
      setItems([]);
    }
    setMaxCantidad({});
  }, [open, remito]);

  // Cliente → establecimientos filtrados + autoselección de único (regla del proyecto)
  const establecimientosFiltrados = useMemo(() => {
    if (!form.clienteId) return [];
    return establecimientos.filter(e => establecimientoPerteneceACliente(e, form.clienteId) && e.activo !== false);
  }, [establecimientos, form.clienteId]);

  const selectCliente = useCallback((clienteId: string) => {
    setForm(prev => {
      if (prev.clienteId === clienteId) return prev;
      const filtrados = establecimientos.filter(e => establecimientoPerteneceACliente(e, clienteId) && e.activo !== false);
      return { ...prev, clienteId, establecimientoId: establecimientoUnicoId(filtrados), otNumbers: [] };
    });
  }, [establecimientos]);

  // OTs del cliente (padres) para el selector de asociadas
  useEffect(() => {
    if (!open || !form.clienteId) { setOtsCliente([]); return; }
    let cancelled = false;
    ordenesTrabajoService.getAll({ clienteId: form.clienteId })
      .then((ots: Array<{ otNumber: string }>) => {
        if (cancelled) return;
        const padres = ots.map(o => o.otNumber).filter(n => n && !n.includes('.'));
        setOtsCliente([...new Set(padres)].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
      })
      .catch(() => { if (!cancelled) setOtsCliente([]); });
    return () => { cancelled = true; };
  }, [open, form.clienteId]);

  const addOt = useCallback((ot: string) => {
    if (!ot) return;
    setForm(prev => prev.otNumbers.includes(ot) ? prev : { ...prev, otNumbers: [...prev.otNumbers, ot] });
  }, []);
  const removeOt = useCallback((ot: string) => {
    setForm(prev => ({ ...prev, otNumbers: prev.otNumbers.filter(n => n !== ot) }));
  }, []);

  // ── Items ──
  const addUnidad = useCallback((unidadId: string) => {
    const u = unidades.find(x => x.id === unidadId);
    if (!u) return;
    const id = crypto.randomUUID();
    setItems(prev => [...prev, {
      id,
      unidadId: u.id,
      articuloId: u.articuloId,
      articuloCodigo: u.articuloCodigo,
      articuloDescripcion: u.articuloDescripcion,
      cantidad: 1,
      // Entrega a cliente / devolución: el bien queda allá. Salida a campo / interno: vuelve.
      tipoItem: (form.tipo === 'entrega_cliente' || form.tipo === 'devolucion') ? 'entrega' : 'sale_y_vuelve',
      devuelto: false,
      serie: u.nroSerie ?? null,
      observaciones: null,
    }]);
    setMaxCantidad(prev => ({ ...prev, [id]: u.cantidad ?? 1 }));
  }, [unidades, form.tipo]);

  const updateItem = useCallback((id: string, patch: Partial<RemitoItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  }, []);
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  }, []);

  const validar = useCallback((): string | null => {
    if (form.tipo === 'entrega_cliente' && !form.clienteId) return 'Seleccioná un cliente para la entrega';
    if (items.length === 0) return 'Agregá al menos un artículo';
    if (items.some(it => (it.cantidad || 0) <= 0)) return 'Hay items con cantidad 0';
    return null;
  }, [form, items]);

  /** Crea o actualiza el remito (borrador). Devuelve el Remito persistido o null. */
  const guardar = useCallback(async (): Promise<Remito | null> => {
    const error = validar();
    if (error) { alert(error); return null; }
    setSaving(true);
    try {
      const ing = ingenieros.find(i => i.id === form.ingenieroId);
      const cliente = clientes.find(c => c.id === form.clienteId);
      const est = establecimientosFiltrados.find(e => e.id === form.establecimientoId);
      const data = {
        tipo: form.tipo,
        // Ingeniero OPCIONAL (2026-07-31): la entrega no siempre la lleva un ingeniero.
        ingenieroId: ing?.id ?? '',
        ingenieroNombre: ing?.nombre ?? '',
        clienteId: form.clienteId || null,
        clienteNombre: cliente?.razonSocial ?? null,
        establecimientoId: form.establecimientoId || null,
        establecimientoNombre: est?.nombre ?? null,
        otNumbers: form.otNumbers,
        fechaSalida: form.fechaSalida || null,
        observaciones: form.observaciones || null,
        items,
      };
      if (remito) {
        await remitosService.update(remito.id, data);
        return { ...remito, ...data } as Remito;
      }
      const newId = await remitosService.create({ ...data, estado: 'borrador' } as any);
      const creado = await remitosService.getById(newId);
      return creado;
    } catch (err) {
      console.error('[useRemitoForm] guardar:', err);
      alert('Error al guardar el remito');
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, items, remito, ingenieros, clientes, establecimientosFiltrados, validar]);

  return {
    form, set, selectCliente, items, maxCantidad, saving,
    ingenieros, clientes, establecimientosFiltrados, unidades, otsCliente,
    addOt, removeOt, addUnidad, updateItem, removeItem, guardar,
  };
}
