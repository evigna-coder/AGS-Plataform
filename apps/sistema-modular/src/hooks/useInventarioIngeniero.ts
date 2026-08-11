import { useState, useEffect, useCallback } from 'react';
import {
  ingenierosService, asignacionesService, unidadesService, clientesService,
  instrumentosService, dispositivosService, vehiculosService, minikitsService,
} from '../services/firebaseService';
import { movimientosService, remitosService } from '../services/stockService';
import { nombreUsuarioActual } from '../services/asignacionesStockHelpers';
import { descripcionItemAsignacion } from '../utils/itemAsignacionLabel';
import type { Ingeniero, Asignacion, ItemAsignacion, UnidadStock, Cliente } from '@ags/shared';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { usePrompt } from '../components/ui/PromptDialog';

export interface InventarioItem extends ItemAsignacion {
  asignacionId: string;
  asignacionNumero: string;
}

/** Unidad parada en la posición provisoria de un remito del ingeniero. */
export interface UnidadEnRemito {
  unidad: UnidadStock;
  remitoId: string;
  remitoNumero: string;
}

/** Estados de remito cuya mercadería todavía está afuera. */
const REMITO_ESTADOS_EN_CAMPO = new Set(['confirmado', 'en_transito', 'en_proveedor', 'completado_parcial']);

export function useInventarioIngeniero(ingenieroId: string | undefined) {
  const confirm = useConfirm();
  const promptText = usePrompt();
  const [ingeniero, setIngeniero] = useState<Ingeniero | null>(null);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [unidadesRemito, setUnidadesRemito] = useState<UnidadEnRemito[]>([]);
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

      // Lo que salió por remito ya no está en la posición del ingeniero sino en la
      // del REMITO (2026-08-09). El ingeniero igual lo tiene físicamente, así que
      // su inventario lo sigue mostrando — con el N° de remito al lado.
      const remitos = (await remitosService.getAll({ ingenieroId }).catch(() => []))
        .filter(r => REMITO_ESTADOS_EN_CAMPO.has(r.estado));
      const porRemito = await Promise.all(remitos.map(async r => {
        const us = await unidadesService.getByUbicacion('remito', r.id).catch(() => []);
        return us.map(u => ({ unidad: u, remitoId: r.id, remitoNumero: r.numero }));
      }));
      setUnidadesRemito(porRemito.flat());
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
    item.articuloCodigo || descripcionItemAsignacion(item, item.tipo);

  // ── Devolver: revert entity status + mark asignacion item ──
  const handleDevolver = async (item: InventarioItem) => {
    if (!await confirm(`¿Devolver "${itemLabel(item)}"?`)) return;
    setSaving(true);
    try {
      const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
      // devolverItems ahora revierte también el estado de la entidad
      // (asignadoAId de instrumento/dispositivo, ubicación de unidad, minikit).
      await asignacionesService.devolverItems(item.asignacionId, [{ itemId: item.id, cantidad: remaining }]);
      await loadData(true);
    } catch { alert('Error al devolver'); }
    finally { setSaving(false); }
  };

  // ── Devolver varios de una (2026-08-11): agrupa por asignación y hace UNA
  // llamada por asignación con todos sus items — pedido "devolver todo o
  // varios a la vez" en lugar de uno por uno.
  const handleDevolverVarios = async (items: InventarioItem[]) => {
    const pendientes = items.filter(i => i.cantidad - i.cantidadDevuelta - i.cantidadConsumida > 0);
    if (pendientes.length === 0) return;
    const detalle = pendientes.length <= 4
      ? pendientes.map(i => itemLabel(i)).join(', ')
      : `${pendientes.length} items`;
    if (!await confirm(`¿Devolver ${detalle}?`)) return;
    setSaving(true);
    try {
      const porAsignacion = new Map<string, { itemId: string; cantidad: number }[]>();
      for (const it of pendientes) {
        const arr = porAsignacion.get(it.asignacionId) ?? [];
        arr.push({ itemId: it.id, cantidad: it.cantidad - it.cantidadDevuelta - it.cantidadConsumida });
        porAsignacion.set(it.asignacionId, arr);
      }
      for (const [asigId, its] of porAsignacion) {
        await asignacionesService.devolverItems(asigId, its);
      }
      await loadData(true);
    } catch { alert('Error al devolver'); }
    finally { setSaving(false); }
  };

  // ── Consumir: mark as used (linked to OT) ──
  const handleConsumir = async (item: InventarioItem) => {
    // prompt() no existe en Electron. Cancelar ABORTA el consumo (antes, en
    // browser, cancelar consumia igual sin OT — semantica peligrosa).
    const ot = await promptText({
      title: `Consumir ${itemLabel(item)}`,
      label: 'Número de OT (opcional)',
      placeholder: 'Vacío = consumo sin OT',
      confirmLabel: 'Consumir',
    });
    if (ot === null) return;
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
      // 1. Mark devuelto in source — skipEntityEffects: la devolución NO debe pasar
      // la unidad por 'disponible' ni asentar un movimiento de devolución (B3);
      // el estado final de las entidades y el MovimientoStock 'transferencia' se
      // setean acá abajo, en un solo salto ingeniero A → ingeniero B.
      const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
      await asignacionesService.devolverItems(
        item.asignacionId,
        [{ itemId: item.id, cantidad: remaining }],
        { skipEntityEffects: true },
      );

      // 2. Build clean item for new asignacion — arrastra origenUbicacion para
      // que la devolución final vuelva al estante original, no al del transferido.
      const newItem: ItemAsignacion = {
        id: crypto.randomUUID(), tipo: item.tipo,
        origenUbicacion: item.origenUbicacion ?? null,
        unidadId: item.unidadId, articuloId: item.articuloId,
        articuloCodigo: item.articuloCodigo, articuloDescripcion: item.articuloDescripcion,
        cantidad: remaining, cantidadDevuelta: 0, cantidadConsumida: 0,
        minikitId: item.minikitId, minikitCodigo: item.minikitCodigo,
        loanerId: item.loanerId, loanerCodigo: item.loanerCodigo,
        instrumentoId: item.instrumentoId, instrumentoNombre: item.instrumentoNombre,
        instrumentoTipo: item.instrumentoTipo,
        dispositivoId: item.dispositivoId, dispositivoDescripcion: item.dispositivoDescripcion,
        dispositivoSerie: item.dispositivoSerie,
        vehiculoId: item.vehiculoId, vehiculoPatente: item.vehiculoPatente,
        patronId: item.patronId, patronCodigo: item.patronCodigo,
        patronDescripcion: item.patronDescripcion, patronLote: item.patronLote,
        patronVencimiento: item.patronVencimiento,
        columnaId: item.columnaId, columnaCodigo: item.columnaCodigo,
        columnaDescripcion: item.columnaDescripcion, columnaSerie: item.columnaSerie,
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

      // 3. Update entity location — mismo estado final que deja la asignación rápida
      // al asignar (unidad 'asignado' en poder del ingeniero, minikit 'en_campo').
      // El estado se fuerza explícitamente además de la ubicación para sanear
      // unidades que transferencias viejas dejaron 'disponible' colgadas de un
      // ingeniero (B3).
      if (item.unidadId) await unidadesService.update(item.unidadId, { estado: 'asignado', ubicacion: { tipo: 'ingeniero', referenciaId: targetIngId, referenciaNombre: targetIngNombre } });
      if (item.minikitId) await minikitsService.update(item.minikitId, { estado: 'en_campo', asignadoA: { tipo: 'ingeniero', id: targetIngId, nombre: targetIngNombre, desde: new Date().toISOString() } });
      if (item.instrumentoId) await instrumentosService.update(item.instrumentoId, { asignadoAId: targetIngId, asignadoANombre: targetIngNombre });
      if (item.dispositivoId) await dispositivosService.update(item.dispositivoId, { asignadoAId: targetIngId, asignadoANombre: targetIngNombre });
      if (item.vehiculoId) await vehiculosService.update(item.vehiculoId, { asignadoA: targetIngNombre });

      // 4. MovimientoStock 'transferencia' ingeniero A → ingeniero B (solo items de
      // stock). Best-effort: un fallo acá no revierte la transferencia, se loguea.
      if (item.unidadId || item.articuloId) {
        try {
          await movimientosService.create({
            tipo: 'transferencia',
            unidadId: item.unidadId ?? '',
            articuloId: item.articuloId ?? '',
            articuloCodigo: item.articuloCodigo ?? '',
            articuloDescripcion: item.articuloDescripcion ?? '',
            cantidad: remaining,
            origenTipo: 'ingeniero',
            origenId: ingenieroId ?? '',
            origenNombre: ingeniero?.nombre ?? 'Ingeniero',
            destinoTipo: 'ingeniero',
            destinoId: targetIngId,
            destinoNombre: targetIngNombre,
            remitoId: null,
            otNumber: null,
            motivo: `Transferencia entre ingenieros (asignación ${item.asignacionNumero})`,
            creadoPor: nombreUsuarioActual(),
          });
        } catch (err) {
          console.error('[handleTransferir] no se pudo crear el movimiento de transferencia:', err);
        }
      }

      await loadData(true);
    } catch (err) {
      console.error('Error al transferir:', err);
      alert('Error al transferir');
    }
    finally { setSaving(false); }
  };

  // handleReponer eliminado (I5): creaba un MovimientoStock sin tocar existencias.
  // La reposición de minikit va por el detalle del minikit, cuyo modal aplica el
  // efecto real vía movimientosAplicarService (fix B4).

  return {
    ingeniero, ingenieros, clientes, unidades, unidadesRemito,
    loading, saving, allItems, temporales, permanentes,
    handleDevolver, handleDevolverVarios, handleConsumir, handleReasignarCliente, handleTransferir,
  };
}
