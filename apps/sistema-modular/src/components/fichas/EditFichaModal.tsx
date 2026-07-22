import { useState, useEffect } from 'react';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import {
  fichasService,
  clientesService,
  establecimientosService,
  ingenierosService,
} from '../../services/firebaseService';
import type {
  FichaPropiedad,
  ItemFicha,
  ViaIngreso,
  Cliente,
  Establecimiento,
  Ingeniero,
} from '@ags/shared';
import { establecimientoUnicoId } from '@ags/shared';
import { ensureTicketForFicha } from '../../utils/ensureTicketForFicha';
import { useFichaItemOptions, newItemDraft, draftFromItem, draftIdentityFields, type ItemFichaDraft } from './useFichaItemOptions';
import { FichaItemDraftFields } from './FichaItemDraftFields';
import { FichaClienteOrigenSection } from './FichaClienteOrigenSection';

interface Props {
  open: boolean;
  onClose: () => void;
  ficha: FichaPropiedad;
}

export function EditFichaModal({ open, onClose, ficha }: Props) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  const [clienteId, setClienteId] = useState(ficha.clienteId);
  const [establecimientoId, setEstablecimientoId] = useState(ficha.establecimientoId ?? '');
  const [viaIngreso, setViaIngreso] = useState<ViaIngreso>(ficha.viaIngreso);
  const [traidoPor, setTraidoPor] = useState(ficha.traidoPor);
  const [fechaIngreso, setFechaIngreso] = useState(ficha.fechaIngreso?.split('T')[0] ?? '');
  const [otReferencia, setOtReferencia] = useState(ficha.otReferencia ?? '');
  const [items, setItems] = useState<ItemFichaDraft[]>(() => ficha.items.map(draftFromItem));

  const { equipoOptions, getItemOptions, applySeleccion, applyEquipo } = useFichaItemOptions(open, clienteId);

  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(setClientes);
    ingenierosService.getAll(true).then(setIngenieros);
  }, [open]);

  // Al abrir, precargar TODO desde la ficha (cliente y establecimiento incluidos).
  // Sin esto, reaperturas del drawer mostraban estado viejo o selects vacíos.
  useEffect(() => {
    if (!open) return;
    setClienteId(ficha.clienteId);
    setEstablecimientoId(ficha.establecimientoId ?? '');
    setViaIngreso(ficha.viaIngreso);
    setTraidoPor(ficha.traidoPor);
    setFechaIngreso(ficha.fechaIngreso?.split('T')[0] ?? '');
    setOtReferencia(ficha.otReferencia ?? '');
    setItems(ficha.items.map(draftFromItem));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ficha.id]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); return; }
    establecimientosService.getByCliente(clienteId).then(ests => {
      setEstablecimientos(ests);
      // Autoselección de establecimiento único (regla del proyecto) — solo si el
      // form no trae uno ya elegido (no pisar el prefill de la ficha).
      setEstablecimientoId(prev => prev || (establecimientoUnicoId(ests.filter(e => e.activo)) ?? ''));
    });
  }, [clienteId]);

  const setItemField = <K extends keyof ItemFichaDraft>(idx: number, k: K, v: ItemFichaDraft[K]) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  };
  const handleSeleccion = (idx: number, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? applySeleccion(it, value) : it));
  };
  const handleEquipo = (idx: number, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? applyEquipo(it, value) : it));
  };
  const addItem = () => setItems(prev => [...prev, newItemDraft()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteId) e.clienteId = 'Requerido';
    if (!traidoPor.trim()) e.traidoPor = 'Requerido';
    if (!fechaIngreso) e.fechaIngreso = 'Requerido';
    if (items.length === 0) e.items = 'Al menos un item';
    items.forEach((it, idx) => {
      if (!it.articuloId && !it.moduloId && !it.articuloCodigo.trim() && !it.descripcionLibre.trim()) {
        e[`item-${idx}-id`] = 'Indicar artículo o descripción';
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const selectedCliente = clientes.find(c => c.id === clienteId);
      const selectedEstab = establecimientos.find(e => e.id === establecimientoId);

      // Reconstruir items: los existentes mantienen estado/historial/fotos/derivaciones,
      // los nuevos arrancan en 'recibido'. Los eliminados desaparecen.
      const mergedItems: ItemFicha[] = items.map(d => {
        const existing = d.existingId ? ficha.items.find(it => it.id === d.existingId) : null;
        if (existing) {
          return {
            ...existing,
            ...draftIdentityFields(d),
            descripcionProblema: d.descripcionProblema.trim() || null,
          };
        }
        return {
          id: crypto.randomUUID(),
          subId: '', // será asignado más abajo al detectar items sin subId
          ...draftIdentityFields(d),
          parentItemId: null,
          estado: 'recibido',
          historial: [{
            id: crypto.randomUUID(),
            fecha: new Date().toISOString(),
            estadoAnterior: 'recibido',
            estadoNuevo: 'recibido',
            nota: 'Item agregado',
            creadoPor: 'admin',
          }],
          derivaciones: [],
          remitoDevolucionId: null,
          fechaEntrega: null,
          fotos: [],
          descripcionProblema: d.descripcionProblema.trim() || null,
          sintomasReportados: null,
          accesorios: [],
          condicionFisica: null,
          createdAt: new Date().toISOString(),
        };
      });

      // Asignar subIds a los items nuevos (que tienen subId vacío)
      let nextN = mergedItems.reduce((m, it) => {
        const match = it.subId?.match(/-(\d+)$/);
        const n = match ? parseInt(match[1], 10) : 0;
        return n > m ? n : m;
      }, 0);
      const finalItems = mergedItems.map(it => {
        if (it.subId) return it;
        nextN += 1;
        return { ...it, subId: `${ficha.numero}-${nextN}` };
      });

      await fichasService.update(ficha.id, {
        clienteId,
        clienteNombre: selectedCliente?.razonSocial ?? ficha.clienteNombre,
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre ?? null,
        viaIngreso,
        traidoPor: traidoPor.trim(),
        fechaIngreso: new Date(fechaIngreso).toISOString(),
        otReferencia: otReferencia.trim() || null,
        items: finalItems,
      });
      // Disparar ticket de aviso a materiales si es la primera vez que el primer
      // item tiene información cargada. Idempotente: si ya existe leadId, no hace nada.
      const fichaActualizada = await fichasService.getById(ficha.id);
      if (fichaActualizada) await ensureTicketForFicha(fichaActualizada);
      onClose();
    } catch (err) {
      console.error('Error guardando ficha:', err);
      alert('Error al guardar la ficha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Editar ficha ${ficha.numero}`}
      subtitle={ficha.clienteNombre}
      width="640px"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <FichaClienteOrigenSection
          clientes={clientes}
          establecimientos={establecimientos}
          ingenieros={ingenieros}
          clienteId={clienteId}
          onClienteChange={id => { setClienteId(id); setEstablecimientoId(''); }}
          establecimientoId={establecimientoId}
          onEstablecimientoChange={setEstablecimientoId}
          viaIngreso={viaIngreso}
          onViaIngresoChange={setViaIngreso}
          traidoPor={traidoPor}
          onTraidoPorChange={setTraidoPor}
          fechaIngreso={fechaIngreso}
          onFechaIngresoChange={setFechaIngreso}
          otReferencia={otReferencia}
          onOtReferenciaChange={setOtReferencia}
          errors={errors}
        />

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Items</h3>
            <Button variant="secondary" size="sm" onClick={addItem}>+ Agregar item</Button>
          </div>
          {errors.items && <p className="text-[10px] text-red-500 mb-2">{errors.items}</p>}
          <div className="space-y-3">
            {items.map((it, idx) => (
              <FichaItemDraftFields
                key={it.tempId}
                idx={idx}
                draft={it}
                options={getItemOptions(it.sistemaId)}
                equipoOptions={equipoOptions}
                onEquipo={handleEquipo}
                onSeleccion={handleSeleccion}
                onField={setItemField}
                onRemove={removeItem}
                errorId={errors[`item-${idx}-id`]}
                markNew
              />
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  );
}
