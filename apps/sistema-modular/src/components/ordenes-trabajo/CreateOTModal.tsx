import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import {
  ordenesTrabajoService, clientesService, establecimientosService, sistemasService,
  tiposServicioService, contactosService, modulosService, usuariosService, presupuestosService,
} from '../../services/firebaseService';
import type { Cliente, Establecimiento, Sistema, TipoServicio, ContactoCliente, ModuloSistema, UsuarioAGS, WorkOrder, Presupuesto } from '@ags/shared';
import { MONEDA_PRESUPUESTO_LABELS } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';
const selectClass = 'w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

export const CreateOTModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Catálogos
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [ingenieros, setIngenieros] = useState<UsuarioAGS[]>([]);
  const [establecimientosFiltrados, setEstablecimientosFiltrados] = useState<Establecimiento[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [presupuestosCliente, setPresupuestosCliente] = useState<Presupuesto[]>([]);

  // Formulario
  const [form, setForm] = useState({
    clienteId: '',
    establecimientoId: '',
    sistemaId: '',
    moduloId: '',
    tipoServicioId: '',
    contactoId: '',
    ingenieroId: '',
    presupuestoId: '',
    presupuestoNumero: '',
    ordenCompra: '',
    fechaServicioAprox: '',
    problemaFallaInicial: '',
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // Cargar catálogos al abrir
  useEffect(() => {
    if (!open) return;
    setLoadError('');

    const loadCatalogos = async () => {
      try {
        const [c, est, s, ts, u] = await Promise.all([
          clientesService.getAll(true),
          establecimientosService.getAll(),
          sistemasService.getAll(),
          tiposServicioService.getAll(),
          usuariosService.getAll(),
        ]);
        setClientes(c);
        setEstablecimientos(est);
        setSistemas(s);
        setTiposServicio(ts);
        setIngenieros(u.filter(usr => usr.role === 'ingeniero_soporte' && usr.status === 'activo'));
      } catch (err) {
        console.error('Error cargando catálogos para OT:', err);
        setLoadError('Error al cargar datos. Verifique la conexión e intente nuevamente.');
      }
    };

    loadCatalogos();
  }, [open]);

  // Cascada: cliente → establecimientos + contactos + presupuestos
  useEffect(() => {
    if (form.clienteId) {
      setEstablecimientosFiltrados(establecimientos.filter(e => e.clienteCuit === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
      // Cargar presupuestos del cliente (solo aprobados/enviados, no borradores/anulados)
      presupuestosService.getAll({ clienteId: form.clienteId }).then(pres => {
        setPresupuestosCliente(pres.filter(p => p.estado !== 'anulado'));
      }).catch(() => setPresupuestosCliente([]));
    } else {
      setEstablecimientosFiltrados([]);
      setContactos([]);
      setPresupuestosCliente([]);
    }
    set('establecimientoId', '');
    set('sistemaId', '');
    set('moduloId', '');
    set('contactoId', '');
    set('presupuestoId', '');
    set('presupuestoNumero', '');
    set('ordenCompra', '');
  }, [form.clienteId, establecimientos]);

  // Cascada: establecimiento → sistemas
  useEffect(() => {
    if (form.establecimientoId) {
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId === form.establecimientoId));
    } else if (form.clienteId) {
      const estIds = new Set(establecimientosFiltrados.map(e => e.id));
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId && estIds.has(s.establecimientoId)));
    } else {
      setSistemasFiltrados([]);
    }
    set('sistemaId', '');
    set('moduloId', '');
  }, [form.establecimientoId, form.clienteId, sistemas, establecimientosFiltrados]);

  // Cascada: sistema → módulos
  useEffect(() => {
    if (form.sistemaId) {
      modulosService.getBySistema(form.sistemaId).then(setModulos).catch(() => setModulos([]));
    } else {
      setModulos([]);
    }
    set('moduloId', '');
  }, [form.sistemaId]);

  // Cuando selecciona presupuesto, auto-completar OC si hay
  const handlePresupuestoChange = (presupuestoId: string) => {
    set('presupuestoId', presupuestoId);
    const pres = presupuestosCliente.find(p => p.id === presupuestoId);
    if (pres) {
      set('presupuestoNumero', pres.numero);
      // Si el presupuesto tiene OC vinculadas, poner la primera como referencia
      if (pres.ordenesCompraIds?.length > 0) {
        set('ordenCompra', pres.ordenesCompraIds[0]);
      }
    } else {
      set('presupuestoNumero', '');
    }
  };

  const handleClose = () => {
    onClose();
    setForm({
      clienteId: '', establecimientoId: '', sistemaId: '', moduloId: '',
      tipoServicioId: '', contactoId: '', ingenieroId: '',
      presupuestoId: '', presupuestoNumero: '', ordenCompra: '', fechaServicioAprox: '',
      problemaFallaInicial: '',
    });
    setModulos([]);
    setContactos([]);
    setPresupuestosCliente([]);
    setLoadError('');
  };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.tipoServicioId) { alert('Seleccione un tipo de servicio'); return; }

    const cliente = clientes.find(c => c.id === form.clienteId);
    const establecimiento = establecimientosFiltrados.find(e => e.id === form.establecimientoId);
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId);
    const modulo = modulos.find(m => m.id === form.moduloId);
    const tipoServ = tiposServicio.find(t => t.id === form.tipoServicioId);
    const contacto = contactos.find(c => c.id === form.contactoId);
    const ingeniero = ingenieros.find(u => u.id === form.ingenieroId);

    if (!cliente || !tipoServ) { alert('Datos incompletos'); return; }

    setSaving(true);
    try {
      // Generar número de OT al momento de confirmar (no al abrir el modal)
      const otNum = await ordenesTrabajoService.getNextOtNumber();
      const otData = {
        otNumber: otNum,
        status: 'BORRADOR' as const,
        estadoAdmin: (ingeniero ? 'ASIGNADA' : 'CREADA') as 'ASIGNADA' | 'CREADA',
        estadoAdminFecha: new Date().toISOString(),
        estadoHistorial: [
          { estado: 'CREADA' as const, fecha: new Date().toISOString() },
          ...(ingeniero ? [{ estado: 'ASIGNADA' as const, fecha: new Date().toISOString() }] : []),
        ] as WorkOrder['estadoHistorial'],
        budgets: form.presupuestoNumero ? [form.presupuestoNumero] : [],
        ordenCompra: form.ordenCompra || '',
        tipoServicio: tipoServ.nombre,
        esFacturable: true,
        tieneContrato: false,
        esGarantia: false,
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre ?? '',
        direccion: establecimiento?.direccion ?? '',
        localidad: establecimiento?.localidad ?? '',
        provincia: establecimiento?.provincia ?? '',
        establecimientoId: form.establecimientoId || undefined,
        sistema: sistema?.nombre ?? '',
        moduloModelo: modulo?.nombre ?? '',
        moduloDescripcion: modulo?.descripcion ?? '',
        moduloSerie: modulo?.serie ?? '',
        codigoInternoCliente: sistema?.codigoInternoCliente ?? '',
        fechaInicio: '',
        fechaFin: '',
        fechaServicioAprox: form.fechaServicioAprox || '',
        horasTrabajadas: '',
        tiempoViaje: '',
        reporteTecnico: '',
        accionesTomar: '',
        articulos: [],
        emailPrincipal: contacto?.email ?? '',
        signatureEngineer: null,
        aclaracionEspecialista: '',
        signatureClient: null,
        aclaracionCliente: '',
        updatedAt: new Date().toISOString(),
        clienteId: form.clienteId,
        sistemaId: form.sistemaId || undefined,
        moduloId: form.moduloId || undefined,
        ingenieroAsignadoId: ingeniero?.id ?? null,
        ingenieroAsignadoNombre: ingeniero?.displayName ?? null,
        problemaFallaInicial: form.problemaFallaInicial || '',
      };
      // Crear padre (contenedor administrativo)
      await ordenesTrabajoService.create(otData);
      // Auto-crear primer item .01 (el reporte real)
      await ordenesTrabajoService.create({
        ...otData,
        otNumber: `${otNum}.01`,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
      });
      handleClose();
      onCreated();
    } catch (err) {
      console.error('Error creando OT:', err);
      alert('Error al crear la orden de trabajo');
    }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg" title="Nueva orden de trabajo"
      subtitle="El número de OT se asigna automáticamente al confirmar"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear OT'}
        </Button>
      </>}>

      <div className="space-y-3">
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {loadError}
            <button onClick={() => window.location.reload()} className="ml-2 underline">Recargar</button>
          </div>
        )}

        {/* Fila 1: Tipo de Servicio */}
        <div>
          <label className={lbl}>Tipo de servicio *</label>
          <SearchableSelect value={form.tipoServicioId}
            onChange={v => set('tipoServicioId', v)}
            options={tiposServicio.map(t => ({ value: t.id, label: t.nombre }))}
            placeholder="Seleccionar tipo..." />
        </div>

        {/* Fila 2: Cliente */}
        <div>
          <label className={lbl}>Cliente *</label>
          <SearchableSelect value={form.clienteId}
            onChange={v => set('clienteId', v)}
            options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Seleccionar cliente..." />
        </div>

        {/* Fila 3: Establecimiento */}
        <div>
          <label className={lbl}>Establecimiento</label>
          <SearchableSelect value={form.establecimientoId}
            onChange={v => set('establecimientoId', v)}
            options={[
              { value: '', label: 'Todos los establecimientos' },
              ...establecimientosFiltrados.map(e => ({
                value: e.id,
                label: `${e.nombre}${e.localidad ? ` — ${e.localidad}` : ''}`,
              })),
            ]}
            placeholder={form.clienteId ? 'Seleccionar establecimiento...' : 'Seleccione cliente primero'}
            disabled={!form.clienteId} />
        </div>

        {/* Fila 4: Sistema + Módulo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Sistema / Equipo</label>
            <SearchableSelect value={form.sistemaId}
              onChange={v => set('sistemaId', v)}
              options={[
                { value: '', label: 'Sin sistema' },
                ...sistemasFiltrados.map(s => ({
                  value: s.id,
                  label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`,
                })),
              ]}
              placeholder={form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'} />
          </div>
          <div>
            <label className={lbl}>Módulo</label>
            <SearchableSelect value={form.moduloId}
              onChange={v => set('moduloId', v)}
              options={[
                { value: '', label: modulos.length === 0 ? 'Sin módulos' : 'Sistema completo' },
                ...modulos.map(m => ({
                  value: m.id,
                  label: `${m.nombre}${m.descripcion ? ` — ${m.descripcion}` : ''}${m.serie ? ` (${m.serie})` : ''}`,
                })),
              ]}
              placeholder={form.sistemaId ? 'Seleccionar...' : 'Seleccione sistema primero'}
              disabled={!form.sistemaId || modulos.length === 0} />
          </div>
        </div>

        {/* Fila 5: Contacto + Ingeniero */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Contacto</label>
            <SearchableSelect value={form.contactoId}
              onChange={v => set('contactoId', v)}
              options={[
                { value: '', label: 'Sin contacto' },
                ...contactos.map(c => ({
                  value: c.id,
                  label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}`,
                })),
              ]}
              placeholder="Seleccionar contacto..."
              disabled={contactos.length === 0} />
          </div>
          <div>
            <label className={lbl}>Ingeniero asignado</label>
            <SearchableSelect value={form.ingenieroId}
              onChange={v => set('ingenieroId', v)}
              options={[
                { value: '', label: 'Sin asignar' },
                ...ingenieros.map(u => ({ value: u.id, label: u.displayName || u.email })),
              ]}
              placeholder="Seleccionar ingeniero..." />
          </div>
        </div>

        {/* Fila 6: Presupuesto + OC + Fecha servicio */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Presupuesto</label>
            <SearchableSelect value={form.presupuestoId}
              onChange={handlePresupuestoChange}
              options={[
                { value: '', label: 'Sin presupuesto' },
                ...presupuestosCliente.map(p => ({
                  value: p.id,
                  label: `${p.numero} — ${MONEDA_PRESUPUESTO_LABELS[p.moneda]} $${p.total?.toLocaleString('es-AR') ?? '0'}`,
                })),
              ]}
              placeholder={form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'}
              disabled={!form.clienteId} />
          </div>
          <div>
            <label className={lbl}>Orden de compra</label>
            <Input value={form.ordenCompra} onChange={e => set('ordenCompra', e.target.value)}
              inputSize="sm" placeholder="OC cliente" />
          </div>
          <div>
            <label className={lbl}>Fecha aprox. servicio</label>
            <input type="date" value={form.fechaServicioAprox}
              onChange={e => set('fechaServicioAprox', e.target.value)}
              className={selectClass} />
          </div>
        </div>

        {/* Fila 7: Falla inicial */}
        <div>
          <label className={lbl}>Problema / Falla inicial</label>
          <textarea value={form.problemaFallaInicial}
            onChange={e => set('problemaFallaInicial', e.target.value)}
            rows={2} placeholder="Descripción del problema o motivo de la OT..."
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
        </div>
      </div>
    </Modal>
  );
};
