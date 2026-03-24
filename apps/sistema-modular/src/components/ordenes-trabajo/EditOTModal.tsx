import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import {
  ordenesTrabajoService, clientesService, sistemasService,
  tiposServicioService, contactosService, modulosService, usuariosService,
} from '../../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, ContactoCliente, ModuloSistema, UsuarioAGS, OTEstadoAdmin } from '@ags/shared';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';

interface Props {
  open: boolean;
  otNumber: string;
  onClose: () => void;
  onSaved: () => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';
const selectClass = 'w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
};

export const EditOTModal: React.FC<Props> = ({ open, otNumber, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Catálogos
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [ingenieros, setIngenieros] = useState<UsuarioAGS[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);

  // OT original (para historial)
  const [otOriginal, setOtOriginal] = useState<WorkOrder | null>(null);

  // Formulario
  const [form, setForm] = useState({
    clienteId: '',
    sistemaId: '',
    moduloId: '',
    tipoServicio: '',
    contactoId: '',
    ingenieroId: '',
    presupuestos: [''],
    ordenCompra: '',
    fechaServicioAprox: '',
    problemaFallaInicial: '',
    estadoAdmin: 'CREADA' as OTEstadoAdmin,
    esFacturable: true,
    tieneContrato: false,
    esGarantia: false,
  });

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  // Cargar OT + catálogos al abrir
  useEffect(() => {
    if (!open || !otNumber) return;
    setLoading(true);

    Promise.all([
      ordenesTrabajoService.getByOtNumber(otNumber),
      clientesService.getAll(true),
      sistemasService.getAll(),
      tiposServicioService.getAll(),
      usuariosService.getAll(),
    ]).then(async ([ot, c, s, ts, u]) => {
      if (!ot) { alert('OT no encontrada'); onClose(); return; }
      setOtOriginal(ot);
      setClientes(c);
      setSistemas(s);
      setTiposServicio(ts);
      setIngenieros(u.filter(usr => usr.role === 'ingeniero_soporte' && usr.status === 'activo'));

      // Filtrar sistemas por cliente
      if (ot.clienteId) {
        setSistemasFiltrados(s.filter(si => si.clienteId === ot.clienteId));
        try { setContactos(await contactosService.getByCliente(ot.clienteId)); } catch { setContactos([]); }
      }
      // Cargar módulos por sistema
      if (ot.sistemaId) {
        try { setModulos(await modulosService.getBySistema(ot.sistemaId)); } catch { setModulos([]); }
      }

      // Buscar contactoId por nombre
      let contactoId = '';
      if (ot.clienteId && ot.contacto) {
        try {
          const cts = await contactosService.getByCliente(ot.clienteId);
          setContactos(cts);
          contactoId = cts.find(ct => ct.nombre === ot.contacto)?.id || '';
        } catch { /* ignore */ }
      }

      setForm({
        clienteId: ot.clienteId || '',
        sistemaId: ot.sistemaId || '',
        moduloId: ot.moduloId || '',
        tipoServicio: ot.tipoServicio || '',
        contactoId,
        ingenieroId: ot.ingenieroAsignadoId || '',
        presupuestos: ot.budgets && ot.budgets.length > 0 ? ot.budgets : [''],
        ordenCompra: ot.ordenCompra || '',
        fechaServicioAprox: ot.fechaServicioAprox || '',
        problemaFallaInicial: ot.problemaFallaInicial || '',
        estadoAdmin: ot.estadoAdmin || (ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'CREADA'),
        esFacturable: ot.esFacturable ?? true,
        tieneContrato: ot.tieneContrato ?? false,
        esGarantia: ot.esGarantia ?? false,
      });
      setLoading(false);
    }).catch(() => { alert('Error al cargar la OT'); onClose(); });
  }, [open, otNumber]);

  // Cascada: cliente → sistemas + contactos
  useEffect(() => {
    if (!open || loading) return;
    if (form.clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
    } else {
      setSistemasFiltrados([]);
      setContactos([]);
    }
  }, [form.clienteId, sistemas, open, loading]);

  // Cascada: sistema → módulos
  useEffect(() => {
    if (!open || loading) return;
    if (form.sistemaId) {
      modulosService.getBySistema(form.sistemaId).then(setModulos).catch(() => setModulos([]));
    } else {
      setModulos([]);
    }
  }, [form.sistemaId, open, loading]);

  const readOnly = form.estadoAdmin === 'FINALIZADO';

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.tipoServicio) { alert('Seleccione un tipo de servicio'); return; }
    if (form.estadoAdmin !== 'CREADA' && !form.ingenieroId) { alert('Seleccione un ingeniero para estado "Asignada" o superior'); return; }

    const cliente = clientes.find(c => c.id === form.clienteId);
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId);
    const modulo = modulos.find(m => m.id === form.moduloId);
    const contacto = contactos.find(c => c.id === form.contactoId);
    const ingeniero = ingenieros.find(u => u.id === form.ingenieroId);

    if (!cliente) { alert('Cliente no encontrado'); return; }

    // Construir historial de estado si cambió
    let estadoHistorial = otOriginal?.estadoHistorial || [];
    let estadoAdminFecha = otOriginal?.estadoAdminFecha || '';
    let status = otOriginal?.status || 'BORRADOR';

    if (form.estadoAdmin !== otOriginal?.estadoAdmin) {
      const ahora = new Date().toISOString();
      estadoHistorial = [...estadoHistorial, { estado: form.estadoAdmin, fecha: ahora }];
      estadoAdminFecha = ahora;
      if (form.estadoAdmin === 'FINALIZADO') status = 'FINALIZADO';
    }

    setSaving(true);
    try {
      await ordenesTrabajoService.update(otNumber, {
        tipoServicio: form.tipoServicio,
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre ?? otOriginal?.contacto ?? '',
        emailPrincipal: contacto?.email ?? otOriginal?.emailPrincipal ?? '',
        sistema: sistema?.nombre ?? '',
        moduloModelo: modulo?.nombre ?? otOriginal?.moduloModelo ?? '',
        moduloDescripcion: modulo?.descripcion ?? otOriginal?.moduloDescripcion ?? '',
        moduloSerie: modulo?.serie ?? otOriginal?.moduloSerie ?? '',
        codigoInternoCliente: sistema?.codigoInternoCliente ?? '',
        clienteId: form.clienteId,
        sistemaId: form.sistemaId || null,
        moduloId: form.moduloId || null,
        ingenieroAsignadoId: ingeniero?.id ?? null,
        ingenieroAsignadoNombre: ingeniero?.displayName ?? null,
        budgets: form.presupuestos.filter(b => b.trim() !== ''),
        ordenCompra: form.ordenCompra || null,
        fechaServicioAprox: form.fechaServicioAprox || null,
        problemaFallaInicial: form.problemaFallaInicial || '',
        estadoAdmin: form.estadoAdmin,
        estadoAdminFecha: estadoAdminFecha || null,
        estadoHistorial,
        esFacturable: form.esFacturable,
        tieneContrato: form.tieneContrato,
        esGarantia: form.esGarantia,
        status,
      } as Partial<WorkOrder>);
      onSaved();
      onClose();
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const openInReportesOT = () => {
    const url = `http://localhost:3000?reportId=${otNumber}`;
    if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
    else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
    else window.open(url, '_blank');
  };

  const estadoColor = ESTADO_COLORS[form.estadoAdmin] ?? 'bg-slate-100 text-slate-600';

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg"
      title={`OT-${otNumber}`}
      subtitle={loading ? 'Cargando...' : `${OT_ESTADO_LABELS[form.estadoAdmin] ?? form.estadoAdmin}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={openInReportesOT}>Abrir reporte</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || loading || readOnly}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </>}>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-400 text-sm">Cargando orden de trabajo...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Estado admin */}
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoColor}`}>
              {OT_ESTADO_LABELS[form.estadoAdmin] ?? form.estadoAdmin}
            </span>
            {!readOnly && (
              <select
                value={form.estadoAdmin}
                onChange={e => set('estadoAdmin', e.target.value)}
                className="border rounded-lg px-2 py-0.5 text-xs text-slate-600 border-slate-300"
              >
                {OT_ESTADO_ORDER.map(e => (
                  <option key={e} value={e}>{OT_ESTADO_LABELS[e]}</option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            <div className="flex flex-wrap gap-x-3">
              {[
                ['esFacturable', form.esFacturable, 'Facturable'],
                ['tieneContrato', form.tieneContrato, 'Contrato'],
                ['esGarantia', form.esGarantia, 'Garantía'],
              ].map(([field, checked, text]) => (
                <label key={field as string} className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={checked as boolean}
                    onChange={e => set(field as string, e.target.checked)}
                    disabled={readOnly} className="w-3 h-3" />
                  <span className="text-[10px] text-slate-600">{text as string}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fila 1: Tipo de Servicio */}
          <div>
            <label className={lbl}>Tipo de servicio *</label>
            <SearchableSelect value={form.tipoServicio}
              onChange={v => set('tipoServicio', v)}
              options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
              placeholder="Seleccionar tipo..." disabled={readOnly} />
          </div>

          {/* Fila 2: Cliente */}
          <div>
            <label className={lbl}>Cliente *</label>
            <SearchableSelect value={form.clienteId}
              onChange={v => { set('clienteId', v); set('sistemaId', ''); set('moduloId', ''); set('contactoId', ''); }}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder="Seleccionar cliente..." disabled={readOnly} />
          </div>

          {/* Fila 3: Sistema + Módulo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Sistema / Equipo</label>
              <SearchableSelect value={form.sistemaId}
                onChange={v => { set('sistemaId', v); set('moduloId', ''); }}
                options={[
                  { value: '', label: 'Sin sistema' },
                  ...sistemasFiltrados.map(s => ({
                    value: s.id,
                    label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`,
                  })),
                ]}
                placeholder={form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'}
                disabled={readOnly} />
            </div>
            <div>
              <label className={lbl}>Módulo</label>
              <select value={form.moduloId} onChange={e => set('moduloId', e.target.value)}
                className={selectClass} disabled={readOnly || !form.sistemaId || modulos.length === 0}>
                <option value="">{modulos.length === 0 ? 'Sin módulos' : 'Sistema completo'}</option>
                {modulos.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}{m.serie ? ` (${m.serie})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 4: Contacto + Ingeniero */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Contacto</label>
              <select value={form.contactoId} onChange={e => set('contactoId', e.target.value)}
                className={selectClass} disabled={readOnly || contactos.length === 0}>
                <option value="">Sin contacto</option>
                {contactos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.cargo ? ` — ${c.cargo}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`${lbl}${form.estadoAdmin !== 'CREADA' && !form.ingenieroId ? ' text-amber-600' : ''}`}>
                Ingeniero asignado{form.estadoAdmin !== 'CREADA' ? ' *' : ''}
              </label>
              <select value={form.ingenieroId} onChange={e => {
                  set('ingenieroId', e.target.value);
                  if (e.target.value && form.estadoAdmin === 'CREADA') set('estadoAdmin', 'ASIGNADA');
                }}
                className={`${selectClass}${form.estadoAdmin !== 'CREADA' && !form.ingenieroId ? ' ring-1 ring-amber-400 border-amber-400' : ''}`} disabled={readOnly}>
                <option value="">Sin asignar</option>
                {ingenieros.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 5: Presupuesto + OC + Fecha servicio */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-medium text-slate-500">Presupuesto</label>
                {!readOnly && form.presupuestos.length < 5 && (
                  <button onClick={() => set('presupuestos', [...form.presupuestos, ''])}
                    className="text-[10px] text-teal-600 hover:underline">+</button>
                )}
              </div>
              {form.presupuestos.map((b, idx) => (
                <div key={idx} className="flex gap-1 mb-1">
                  <Input value={b}
                    onChange={e => {
                      const u = [...form.presupuestos];
                      u[idx] = e.target.value.substring(0, 15);
                      set('presupuestos', u);
                    }}
                    inputSize="sm" placeholder="PRE-XXXX" disabled={readOnly} />
                  {!readOnly && form.presupuestos.length > 1 && (
                    <button onClick={() => set('presupuestos', form.presupuestos.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 text-xs px-1">x</button>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label className={lbl}>Orden de compra</label>
              <Input value={form.ordenCompra} onChange={e => set('ordenCompra', e.target.value)}
                inputSize="sm" placeholder="OC cliente" disabled={readOnly} />
            </div>
            <div>
              <label className={lbl}>Fecha aprox. servicio</label>
              <input type="date" value={form.fechaServicioAprox}
                onChange={e => set('fechaServicioAprox', e.target.value)}
                className={selectClass} disabled={readOnly} />
            </div>
          </div>

          {/* Fila 6: Falla inicial */}
          <div>
            <label className={lbl}>Problema / Falla inicial</label>
            <textarea value={form.problemaFallaInicial}
              onChange={e => set('problemaFallaInicial', e.target.value)}
              rows={2} placeholder="Descripción del problema o motivo de la OT..."
              disabled={readOnly}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 disabled:bg-slate-100 disabled:text-slate-400" />
          </div>

          {/* Historial de estados */}
          {otOriginal?.estadoHistorial && otOriginal.estadoHistorial.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[11px] font-medium text-slate-400 mb-1">Historial de estados</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {otOriginal.estadoHistorial.map((h, i) => (
                  <div key={i} className="text-[10px]">
                    <span className="text-slate-600 font-medium">{OT_ESTADO_LABELS[h.estado] ?? h.estado}</span>
                    <span className="text-slate-400 ml-1">{h.fecha ? new Date(h.fecha).toLocaleDateString('es-AR') : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
