import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import {
  fichasService,
  clientesService,
  establecimientosService,
  ingenierosService,
  articulosService,
} from '../../services/firebaseService';
import { ensureTicketForFicha } from '../../utils/ensureTicketForFicha';
import type {
  Cliente,
  Establecimiento,
  Articulo,
  Ingeniero,
  ItemFicha,
  ViaIngreso,
  FichaPropiedad,
} from '@ags/shared';
import { VIA_INGRESO_LABELS } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ItemDraft {
  tempId: string;
  articuloId: string;
  descripcionLibre: string;
  serie: string;
  descripcionProblema: string;
}

const newDraft = (): ItemDraft => ({
  tempId: crypto.randomUUID(),
  articuloId: '',
  descripcionLibre: '',
  serie: '',
  descripcionProblema: '',
});

export function CreateFichaModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [viaIngreso, setViaIngreso] = useState<ViaIngreso>('ingeniero');
  const [traidoPor, setTraidoPor] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
  const [otReferencia, setOtReferencia] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([newDraft()]);

  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(setClientes);
    ingenierosService.getAll(true).then(setIngenieros);
    articulosService.getAll({ activoOnly: true }).then(setArticulos);
  }, [open]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); setEstablecimientoId(''); return; }
    establecimientosService.getByCliente(clienteId).then(setEstablecimientos);
  }, [clienteId]);

  useEffect(() => { setTraidoPor(''); }, [viaIngreso]);

  const resetForm = () => {
    setClienteId(''); setEstablecimientoId('');
    setViaIngreso('ingeniero'); setTraidoPor('');
    setFechaIngreso(new Date().toISOString().split('T')[0]);
    setOtReferencia('');
    setItems([newDraft()]);
    setErrors({});
  };

  const handleClose = () => { resetForm(); onClose(); };

  const setItemField = <K extends keyof ItemDraft>(idx: number, k: K, v: ItemDraft[K]) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  };
  const addItem = () => setItems(prev => [...prev, newDraft()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteId) e.clienteId = 'Requerido';
    if (!traidoPor.trim()) e.traidoPor = 'Requerido';
    if (!fechaIngreso) e.fechaIngreso = 'Requerido';
    items.forEach((it, idx) => {
      if (!it.articuloId && !it.descripcionLibre.trim()) {
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

      const itemsPayload: Omit<ItemFicha, 'subId'>[] = items.map(d => {
        const art = articulos.find(a => a.id === d.articuloId);
        return {
          id: crypto.randomUUID(),
          articuloId: d.articuloId || null,
          articuloCodigo: art?.codigo ?? null,
          articuloDescripcion: art?.descripcion ?? null,
          descripcionLibre: d.descripcionLibre.trim() || null,
          serie: d.serie.trim() || null,
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
        };
      });

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

  const articuloOptions = articulos.map(a => ({
    value: a.id,
    label: `${a.codigo} — ${a.descripcion}`,
  }));

  return (
    <Modal open={open} onClose={handleClose} title="Nueva ficha propiedad del cliente" subtitle="Registrar ingreso de modulo/equipo" maxWidth="xl">
      <div className="space-y-5 p-5">
        {/* Cliente y origen */}
        <section>
          <h3 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Cliente y origen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente *</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Seleccionar cliente</option>
                {clientes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
              </select>
              {errors.clienteId && <p className="text-[10px] text-red-500 mt-0.5">{errors.clienteId}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Establecimiento</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={establecimientoId} onChange={e => setEstablecimientoId(e.target.value)} disabled={!clienteId}>
                <option value="">Seleccionar</option>
                {establecimientos.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Via de ingreso</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={viaIngreso} onChange={e => setViaIngreso(e.target.value as ViaIngreso)}>
                {(Object.keys(VIA_INGRESO_LABELS) as ViaIngreso[]).map(v => <option key={v} value={v}>{VIA_INGRESO_LABELS[v]}</option>)}
              </select>
            </div>
            {viaIngreso === 'ingeniero' ? (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Traido por *</label>
                <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={traidoPor} onChange={e => setTraidoPor(e.target.value)}>
                  <option value="">Seleccionar ingeniero</option>
                  {ingenieros.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
                </select>
                {errors.traidoPor && <p className="text-[10px] text-red-500 mt-0.5">{errors.traidoPor}</p>}
              </div>
            ) : (
              <Input label="Traido por *" value={traidoPor} onChange={e => setTraidoPor(e.target.value)} error={errors.traidoPor} placeholder={viaIngreso === 'envio' ? 'Empresa de transporte' : 'Quien lo trajo'} />
            )}
            <Input label="Fecha de ingreso *" type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} error={errors.fechaIngreso} />
            <Input label="OT de referencia" value={otReferencia} onChange={e => setOtReferencia(e.target.value)} placeholder="Ej: 25660" />
          </div>
        </section>

        {/* Items */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Items recibidos</h3>
            <Button variant="secondary" size="sm" onClick={addItem}>+ Agregar item</Button>
          </div>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.tempId} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500">Item #{idx + 1}</p>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-[11px] text-red-500 hover:text-red-700">Eliminar</button>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Artículo (catálogo)</label>
                    <SearchableSelect
                      value={it.articuloId}
                      onChange={v => setItemField(idx, 'articuloId', v)}
                      options={articuloOptions}
                      placeholder="Buscar por código o descripción..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input label="Descripción libre (si no está en catálogo)" value={it.descripcionLibre} onChange={e => setItemField(idx, 'descripcionLibre', e.target.value)} placeholder="Ej: Bomba cuaternaria G1311A" />
                    <Input label="N° de serie" value={it.serie} onChange={e => setItemField(idx, 'serie', e.target.value)} />
                  </div>
                  {errors[`item-${idx}-id`] && <p className="text-[10px] text-red-500">{errors[`item-${idx}-id`]}</p>}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Problema reportado *</label>
                    <textarea className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs min-h-[50px]" value={it.descripcionProblema} onChange={e => setItemField(idx, 'descripcionProblema', e.target.value)} placeholder="Falla observada en este item" />
                    {errors[`item-${idx}-problema`] && <p className="text-[10px] text-red-500 mt-0.5">{errors[`item-${idx}-problema`]}</p>}
                  </div>
                </div>
              </div>
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
