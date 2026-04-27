import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  fichasService,
  clientesService,
  establecimientosService,
  sistemasService,
  modulosService,
  ingenierosService,
} from '../../services/firebaseService';
import type {
  FichaPropiedad,
  ViaIngreso,
  Cliente,
  Establecimiento,
  Sistema,
  ModuloSistema,
  Ingeniero,
  AccesorioFicha,
} from '@ags/shared';
import { VIA_INGRESO_LABELS } from '@ags/shared';
import { FichaAccesoriosSection } from './FichaAccesoriosSection';

interface Props {
  open: boolean;
  onClose: () => void;
  ficha: FichaPropiedad;
}

/** Modal para editar una ficha existente. La creación sigue en CreateFichaModal. */
export function EditFichaModal({ open, onClose, ficha }: Props) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  const [clienteId, setClienteId] = useState(ficha.clienteId);
  const [establecimientoId, setEstablecimientoId] = useState(ficha.establecimientoId ?? '');
  const [sistemaId, setSistemaId] = useState(ficha.sistemaId ?? '');
  const [moduloId, setModuloId] = useState(ficha.moduloId ?? '');
  const [descripcionLibre, setDescripcionLibre] = useState(ficha.descripcionLibre ?? '');
  const [codigoArticulo, setCodigoArticulo] = useState(ficha.codigoArticulo ?? '');
  const [serie, setSerie] = useState(ficha.serie ?? '');
  const [condicionFisica, setCondicionFisica] = useState(ficha.condicionFisica ?? '');
  const [viaIngreso, setViaIngreso] = useState<ViaIngreso>(ficha.viaIngreso);
  const [traidoPor, setTraidoPor] = useState(ficha.traidoPor);
  const [fechaIngreso, setFechaIngreso] = useState(ficha.fechaIngreso?.split('T')[0] ?? '');
  const [otReferencia, setOtReferencia] = useState(ficha.otReferencia ?? '');
  const [descripcionProblema, setDescripcionProblema] = useState(ficha.descripcionProblema);
  const [sintomasReportados, setSintomasReportados] = useState(ficha.sintomasReportados ?? '');
  const [accesorios, setAccesorios] = useState<AccesorioFicha[]>(ficha.accesorios ?? []);

  // Carga catálogos al abrir
  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(setClientes);
    ingenierosService.getAll(true).then(setIngenieros);
  }, [open]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); return; }
    establecimientosService.getByCliente(clienteId).then(setEstablecimientos);
  }, [clienteId]);

  useEffect(() => {
    if (!establecimientoId) { setSistemas([]); return; }
    sistemasService.getAll({ establecimientoId }).then(setSistemas);
  }, [establecimientoId]);

  useEffect(() => {
    if (!sistemaId) { setModulos([]); return; }
    modulosService.getBySistema(sistemaId).then(setModulos);
  }, [sistemaId]);

  // Si cambia la vía, limpiamos traidoPor para que no quede un valor incompatible
  // (texto libre arrastrado a select, o nombre de ingeniero al cambiar a envío).
  const prevVia = ficha.viaIngreso;
  useEffect(() => {
    if (viaIngreso !== prevVia) setTraidoPor('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaIngreso]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteId) e.clienteId = 'Requerido';
    if (!traidoPor.trim()) e.traidoPor = 'Requerido';
    if (!fechaIngreso) e.fechaIngreso = 'Requerido';
    if (!descripcionProblema.trim()) e.descripcionProblema = 'Requerido';
    if (!sistemaId && !descripcionLibre.trim()) e.descripcionLibre = 'Indicar sistema o descripcion';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const selectedCliente = clientes.find(c => c.id === clienteId);
      const selectedEstab = establecimientos.find(e => e.id === establecimientoId);
      const selectedSistema = sistemas.find(s => s.id === sistemaId);
      const selectedModulo = modulos.find(m => m.id === moduloId);

      await fichasService.update(ficha.id, {
        clienteId,
        clienteNombre: selectedCliente?.razonSocial ?? ficha.clienteNombre,
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre ?? null,
        sistemaId: sistemaId || null,
        sistemaNombre: selectedSistema?.nombre ?? null,
        moduloId: moduloId || null,
        moduloNombre: selectedModulo?.nombre ?? null,
        descripcionLibre: descripcionLibre.trim() || null,
        codigoArticulo: codigoArticulo.trim() || null,
        serie: serie.trim() || null,
        accesorios,
        condicionFisica: condicionFisica.trim() || null,
        viaIngreso,
        traidoPor: traidoPor.trim(),
        fechaIngreso: new Date(fechaIngreso).toISOString(),
        otReferencia: otReferencia.trim() || null,
        descripcionProblema: descripcionProblema.trim(),
        sintomasReportados: sintomasReportados.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error('Error guardando ficha:', err);
      alert('Error al guardar la ficha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar ficha ${ficha.numero}`}
      subtitle={ficha.clienteNombre}
      maxWidth="xl"
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
        <section>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Cliente y origen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente *</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={clienteId} onChange={e => { setClienteId(e.target.value); setEstablecimientoId(''); setSistemaId(''); setModuloId(''); }}>
                <option value="">Seleccionar cliente</option>
                {clientes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
              </select>
              {errors.clienteId && <p className="text-[10px] text-red-500 mt-0.5">{errors.clienteId}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Establecimiento</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={establecimientoId} onChange={e => { setEstablecimientoId(e.target.value); setSistemaId(''); setModuloId(''); }} disabled={!clienteId}>
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

        <section>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Identificacion del modulo/equipo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Sistema/Equipo</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={sistemaId} onChange={e => { setSistemaId(e.target.value); setModuloId(''); }} disabled={!establecimientoId}>
                <option value="">Seleccionar</option>
                {sistemas.filter(s => s.activo).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Modulo</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={moduloId} onChange={e => setModuloId(e.target.value)} disabled={!sistemaId}>
                <option value="">Seleccionar</option>
                {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.serie ? ` (S/N: ${m.serie})` : ''}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Input label="Descripcion libre (si no esta en el sistema)" value={descripcionLibre} onChange={e => setDescripcionLibre(e.target.value)} error={errors.descripcionLibre} />
            </div>
            <Input label="Codigo de articulo" value={codigoArticulo} onChange={e => setCodigoArticulo(e.target.value)} placeholder="Ej: G1311A" />
            <Input label="Numero de serie" value={serie} onChange={e => setSerie(e.target.value)} />
            <div className="md:col-span-2">
              <Input label="Condicion fisica" value={condicionFisica} onChange={e => setCondicionFisica(e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Accesorios</h3>
          <FichaAccesoriosSection accesorios={accesorios} onChange={setAccesorios} />
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Problema / Falla</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Descripcion del problema *</label>
              <textarea className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs min-h-[60px]" value={descripcionProblema} onChange={e => setDescripcionProblema(e.target.value)} />
              {errors.descripcionProblema && <p className="text-[10px] text-red-500 mt-0.5">{errors.descripcionProblema}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Sintomas reportados</label>
              <textarea className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs min-h-[50px]" value={sintomasReportados} onChange={e => setSintomasReportados(e.target.value)} />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
