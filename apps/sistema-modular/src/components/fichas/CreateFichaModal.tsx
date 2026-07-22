import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  fichasService,
  clientesService,
  establecimientosService,
  ingenierosService,
} from '../../services/firebaseService';
import { ensureTicketForFicha } from '../../utils/ensureTicketForFicha';
import type {
  Cliente,
  Establecimiento,
  Ingeniero,
  ItemFicha,
  ViaIngreso,
  FichaPropiedad,
} from '@ags/shared';
import { establecimientoUnicoId } from '@ags/shared';
import { useFichaItemOptions, newItemDraft, draftIdentityFields, type ItemFichaDraft } from './useFichaItemOptions';
import { FichaItemDraftFields } from './FichaItemDraftFields';
import { FichaClienteOrigenSection } from './FichaClienteOrigenSection';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateFichaModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [viaIngreso, setViaIngreso] = useState<ViaIngreso>('ingeniero');
  const [traidoPor, setTraidoPor] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
  const [otReferencia, setOtReferencia] = useState('');
  const [items, setItems] = useState<ItemFichaDraft[]>([newItemDraft()]);

  const { equipoOptions, getItemOptions, applySeleccion, applyEquipo } = useFichaItemOptions(open, clienteId);

  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(setClientes);
    ingenierosService.getAll(true).then(setIngenieros);
  }, [open]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); setEstablecimientoId(''); return; }
    establecimientosService.getByCliente(clienteId).then(ests => {
      setEstablecimientos(ests);
      // Regla del proyecto: cliente con un único establecimiento (activo) → autoseleccionarlo.
      const unico = establecimientoUnicoId(ests.filter(e => e.activo));
      if (unico) setEstablecimientoId(unico);
    });
  }, [clienteId]);

  useEffect(() => { setTraidoPor(''); }, [viaIngreso]);

  const resetForm = () => {
    setClienteId(''); setEstablecimientoId('');
    setViaIngreso('ingeniero'); setTraidoPor('');
    setFechaIngreso(new Date().toISOString().split('T')[0]);
    setOtReferencia('');
    setItems([newItemDraft()]);
    setErrors({});
  };

  const handleClose = () => { resetForm(); onClose(); };

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
    items.forEach((it, idx) => {
      if (!it.articuloId && !it.moduloId && !it.articuloCodigo.trim() && !it.descripcionLibre.trim()) {
        e[`item-${idx}-id`] = 'Indicar artículo o descripción';
      }
      if (!it.descripcionProblema.trim()) {
        e[`item-${idx}-problema`] = 'Requerido';
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

      const itemsPayload: Omit<ItemFicha, 'subId'>[] = items.map(d => ({
        id: crypto.randomUUID(),
        ...draftIdentityFields(d),
        parentItemId: null,
        estado: 'recibido',
        historial: [{
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          estadoAnterior: 'recibido',
          estadoNuevo: 'recibido',
          nota: 'Item recibido',
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
      }));

      const data: Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt' | 'estado'> & { estado?: never } = {
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre || null,
        viaIngreso,
        traidoPor: traidoPor.trim(),
        fechaIngreso: new Date(fechaIngreso).toISOString(),
        otReferencia: otReferencia.trim() || null,
        items: itemsPayload as ItemFicha[],
        historial: [{
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          estadoAnterior: 'recibido',
          estadoNuevo: 'recibido',
          nota: 'Ficha creada',
          creadoPor: 'admin',
        }],
        repuestosPendientes: [],
        fotos: [],
        loanerId: null,
        loanerCodigo: null,
        leadId: null,
        otIds: otReferencia.trim() ? [otReferencia.trim()] : [],
      };

      const fichaId = await fichasService.create(data as Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt'>);
      // Si los items vienen completos en la creación, disparamos el ticket ahora.
      const fichaCreada = await fichasService.getById(fichaId);
      if (fichaCreada) await ensureTicketForFicha(fichaCreada);
      resetForm();
      onCreated();
      onClose();
      navigate(`/fichas/${fichaId}`);
    } catch (err) {
      console.error('Error creando ficha:', err);
      alert('Error al crear la ficha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nueva ficha propiedad del cliente" subtitle="Registrar ingreso de modulo/equipo" maxWidth="xl">
      <div className="space-y-5 p-5">
        <FichaClienteOrigenSection
          clientes={clientes}
          establecimientos={establecimientos}
          ingenieros={ingenieros}
          clienteId={clienteId}
          onClienteChange={setClienteId}
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
          otReferenciaPlaceholder="Ej: 25660"
        />

        {/* Items */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Items recibidos</h3>
            <Button variant="secondary" size="sm" onClick={addItem}>+ Agregar item</Button>
          </div>
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
                onRemove={items.length > 1 ? removeItem : undefined}
                errorId={errors[`item-${idx}-id`]}
                errorProblema={errors[`item-${idx}-problema`]}
                problemaRequired
              />
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
        <Button variant="secondary" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear ficha'}
        </Button>
      </div>
    </Modal>
  );
}
