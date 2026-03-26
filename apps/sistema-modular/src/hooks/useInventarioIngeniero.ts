import { useState, useEffect, useCallback } from 'react';
import {
  ingenierosService, asignacionesService, unidadesService, clientesService,
  instrumentosService, dispositivosService, vehiculosService, minikitsService,
} from '../services/firebaseService';
import type { Ingeniero, Asignacion, ItemAsignacion, UnidadStock, Cliente } from '@ags/shared';

export interface InventarioItem extends ItemAsignacion {
  asignacionId: string;
  asignacionNumero: string;
}

export function useInventarioIngeniero(ingenieroId: string | undefined) {
  const [ingeniero, setIngeniero] = useState<Ingeniero | null>(null);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!ingenieroId) return;
    if (!silent) setLoading(true);
    try {
      const [ing, ings, cls, asg, units] = await Promise.all([
        ingenierosService.getById(ingenieroId),
        ingenierosService.getAll(true),
        clientesService.getAll(),
        asignacionesService.getByIngeniero(ingenieroId),
        unidadesService.getByUbicacion('ingeniero', ingenieroId),
      ]);
      setIngeniero(ing);
      setIngenieros(ings.filter(i => i.id !== ingenieroId));
      setClientes(cls);
      setAsignaciones(asg);
      setUnidades(units);
    } catch (err) { console.error('Error:', err); }
    finally { if (!silent) setLoading(false); }
  }, [ingenieroId]);

  useEffect(() => { loadData(); }, [loadData]);

  const allItems: InventarioItem[] = asignaciones.flatMap(asg =>
    asg.items.filter(i => i.estado === 'asignado').map(i => ({
      ...i, asignacionId: asg.id, asignacionNumero: asg.numero,
    }))
  );
  const temporales = allItems.filter(i => !i.permanente);
  const permanentes = allItems.filter(i => i.permanente);

  const itemLabel = (item: InventarioItem) =>
    item.articuloCodigo || item.minikitCodigo || item.instrumentoNombre || item.dispositivoDescripcion || item.vehiculoPatente || item.tipo;

  // ── Devolver: revert entity status + mark asignacion item ──
  const handleDevolver = async (item: InventarioItem) => {
    if (!confirm(`¿Devolver "${itemLabel(item)}"?`)) return;
    setSaving(true);
    try {
      const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
      await asignacionesService.devolverItems(item.asignacionId, [{ itemId: item.id, cantidad: remaining }]);
      if (item.unidadId) await unidadesService.update(item.unidadId, { estado: 'disponible', ubicacion: { tipo: 'posicion', referenciaId: '', referenciaNombre: 'Stock' } });
      if (item.minikitId) await minikitsService.update(item.minikitId, { estado: 'en_base', asignadoA: null });
      if (item.instrumentoId) await instrumentosService.update(item.instrumentoId, { asignadoAId: null, asignadoANombre: null });
      if (item.dispositivoId) await dispositivosService.update(item.dispositivoId, { asignadoAId: null, asignadoANombre: null });
      if (item.vehiculoId) await vehiculosService.update(item.vehiculoId, { asignadoA: '' });
      await loadData(true);
    } catch { alert('Error al devolver'); }
    finally { setSaving(false); }
  };

  // ── Consumir: mark as used (linked to OT) ──
  const handleConsumir = async (item: InventarioItem) => {
    const ot = prompt('Número de OT (opcional):');
    setSaving(true);
    try {
      const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
      await asignacionesService.consumirItems(item.asignacionId, [{ itemId: item.id, cantidad: remaining, otNumber: ot || undefined }]);
      await loadData(true);
    } catch { alert('Error al consumir'); }
    finally { setSaving(false); }
  };

  // ── Reasignar cliente (solo metadata, sin mover stock) ──
  const handleReasignarCliente = async (item: InventarioItem, clienteId: string, clienteNombre: string) => {
    setSaving(true);
    try {
      await asignacionesService.reasignarCliente(item.asignacionId, [item.id], clienteId, clienteNombre);
      await loadData(true);
    } catch { alert('Error al reasignar cliente'); }
    finally { setSaving(false); }
  };

  // ── Transferir a otro IST: devolver + crear nueva asignacion + mover entidad ──
  const handleTransferir = async (item: InventarioItem, targetIngId: string, targetIngNombre: string) => {
    setSaving(true);
    try {
      // 1. Mark devuelto in source
      const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
      await asignacionesService.devolverItems(item.asignacionId, [{ itemId: item.id, cantidad: remaining }]);

      // 2. Build clean item for new asignacion
      const newItem: ItemAsignacion = {
        id: crypto.randomUUID(), tipo: item.tipo,
        unidadId: item.unidadId, articuloId: item.articuloId,
        articuloCodigo: item.articuloCodigo, articuloDescripcion: item.articuloDescripcion,
        cantidad: remaining, cantidadDevuelta: 0, cantidadConsumida: 0,
        minikitId: item.minikitId, minikitCodigo: item.minikitCodigo,
        loanerId: item.loanerId, loanerCodigo: item.loanerCodigo,
        instrumentoId: item.instrumentoId, instrumentoNombre: item.instrumentoNombre,
        instrumentoTipo: item.instrumentoTipo,
        dispositivoId: item.dispositivoId, dispositivoDescripcion: item.dispositivoDescripcion,
        vehiculoId: item.vehiculoId, vehiculoPatente: item.vehiculoPatente,
        clienteId: item.clienteId, clienteNombre: item.clienteNombre,
        otNumber: null, proposito: null,
        estado: 'asignado', permanente: item.permanente,
        fechaAsignacion: new Date().toISOString(), fechaDevolucion: null,
      };

      await asignacionesService.create({
        ingenieroId: targetIngId, ingenieroNombre: targetIngNombre,
        items: [newItem],
        clienteId: item.clienteId, clienteNombre: item.clienteNombre,
        observaciones: `Transferido desde ${ingeniero?.nombre || 'otro IST'}`,
        estado: 'activa', remitoId: null,
      });

      // 3. Update entity location
      if (item.unidadId) await unidadesService.update(item.unidadId, { ubicacion: { tipo: 'ingeniero', referenciaId: targetIngId, referenciaNombre: targetIngNombre } });
      if (item.minikitId) await minikitsService.update(item.minikitId, { asignadoA: { tipo: 'ingeniero', id: targetIngId, nombre: targetIngNombre, desde: new Date().toISOString() } });
      if (item.instrumentoId) await instrumentosService.update(item.instrumentoId, { asignadoAId: targetIngId, asignadoANombre: targetIngNombre });
      if (item.dispositivoId) await dispositivosService.update(item.dispositivoId, { asignadoAId: targetIngId, asignadoANombre: targetIngNombre });
      if (item.vehiculoId) await vehiculosService.update(item.vehiculoId, { asignadoA: targetIngNombre });

      await loadData(true);
    } catch (err) {
      console.error('Error al transferir:', err);
      alert('Error al transferir');
    }
    finally { setSaving(false); }
  };

  return {
    ingeniero, ingenieros, clientes, unidades,
    loading, saving, allItems, temporales, permanentes,
    handleDevolver, handleConsumir, handleReasignarCliente, handleTransferir,
  };
}
