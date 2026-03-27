import { useState, useEffect } from 'react';
import {
  ordenesTrabajoService, clientesService, establecimientosService, sistemasService,
  tiposServicioService, contactosService, modulosService, usuariosService, presupuestosService,
} from '../services/firebaseService';
import type { Cliente, Establecimiento, Sistema, TipoServicio, ContactoCliente, ModuloSistema, UsuarioAGS, WorkOrder, Presupuesto } from '@ags/shared';

export interface CreateOTFormState {
  clienteId: string;
  establecimientoId: string;
  sistemaId: string;
  moduloId: string;
  tipoServicioId: string;
  contactoId: string;
  ingenieroId: string;
  presupuestoId: string;
  presupuestoNumero: string;
  ordenCompra: string;
  fechaServicioAprox: string;
  problemaFallaInicial: string;
}

const INITIAL_FORM: CreateOTFormState = {
  clienteId: '', establecimientoId: '', sistemaId: '', moduloId: '',
  tipoServicioId: '', contactoId: '', ingenieroId: '',
  presupuestoId: '', presupuestoNumero: '', ordenCompra: '', fechaServicioAprox: '',
  problemaFallaInicial: '',
};

export function useCreateOTForm(open: boolean, onClose: () => void, onCreated: () => void) {
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
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
  const [form, setForm] = useState<CreateOTFormState>(INITIAL_FORM);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // Load catalogs
  useEffect(() => {
    if (!open) return;
    setLoadError('');
    const loadCatalogos = async () => {
      try {
        const [c, est, s, ts, u] = await Promise.all([
          clientesService.getAll(true), establecimientosService.getAll(),
          sistemasService.getAll(), tiposServicioService.getAll(), usuariosService.getAll(),
        ]);
        setClientes(c); setEstablecimientos(est); setSistemas(s); setTiposServicio(ts);
        setIngenieros(u.filter(usr => usr.role === 'ingeniero_soporte' && usr.status === 'activo'));
      } catch (err) {
        console.error('Error cargando catálogos para OT:', err);
        setLoadError('Error al cargar datos. Verifique la conexión e intente nuevamente.');
      }
    };
    loadCatalogos();
  }, [open]);

  // Cascade: client -> establecimientos + contactos + presupuestos
  useEffect(() => {
    if (form.clienteId) {
      setEstablecimientosFiltrados(establecimientos.filter(e => e.clienteCuit === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
      presupuestosService.getAll({ clienteId: form.clienteId }).then(pres => {
        setPresupuestosCliente(pres.filter(p => p.estado !== 'anulado'));
      }).catch(() => setPresupuestosCliente([]));
    } else {
      setEstablecimientosFiltrados([]); setContactos([]); setPresupuestosCliente([]);
    }
    set('establecimientoId', ''); set('sistemaId', ''); set('moduloId', '');
    set('contactoId', ''); set('presupuestoId', ''); set('presupuestoNumero', ''); set('ordenCompra', '');
  }, [form.clienteId, establecimientos]);

  // Cascade: establecimiento -> sistemas
  useEffect(() => {
    if (form.establecimientoId) {
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId === form.establecimientoId));
    } else if (form.clienteId) {
      const estIds = new Set(establecimientosFiltrados.map(e => e.id));
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId && estIds.has(s.establecimientoId)));
    } else {
      setSistemasFiltrados([]);
    }
    set('sistemaId', ''); set('moduloId', '');
  }, [form.establecimientoId, form.clienteId, sistemas, establecimientosFiltrados]);

  // Cascade: sistema -> modulos
  useEffect(() => {
    if (form.sistemaId) {
      modulosService.getBySistema(form.sistemaId).then(setModulos).catch(() => setModulos([]));
    } else { setModulos([]); }
    set('moduloId', '');
  }, [form.sistemaId]);

  const handlePresupuestoChange = (presupuestoId: string) => {
    set('presupuestoId', presupuestoId);
    const pres = presupuestosCliente.find(p => p.id === presupuestoId);
    if (pres) {
      set('presupuestoNumero', pres.numero);
      if (pres.ordenesCompraIds?.length > 0) set('ordenCompra', pres.ordenesCompraIds[0]);
    } else {
      set('presupuestoNumero', '');
    }
  };

  const handleClose = () => {
    onClose();
    setForm(INITIAL_FORM);
    setModulos([]); setContactos([]); setPresupuestosCliente([]); setLoadError('');
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
        esFacturable: true, tieneContrato: false, esGarantia: false,
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
        fechaInicio: '', fechaFin: '',
        fechaServicioAprox: form.fechaServicioAprox || '',
        horasTrabajadas: '', tiempoViaje: '',
        reporteTecnico: '', accionesTomar: '', articulos: [],
        emailPrincipal: contacto?.email ?? '',
        signatureEngineer: null, aclaracionEspecialista: '',
        signatureClient: null, aclaracionCliente: '',
        updatedAt: new Date().toISOString(),
        clienteId: form.clienteId,
        sistemaId: form.sistemaId || undefined,
        moduloId: form.moduloId || undefined,
        ingenieroAsignadoId: ingeniero?.id ?? null,
        ingenieroAsignadoNombre: ingeniero?.displayName ?? null,
        problemaFallaInicial: form.problemaFallaInicial || '',
      };
      await ordenesTrabajoService.create(otData);
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

  return {
    saving, loadError, form, set, handleClose, handleSave, handlePresupuestoChange,
    clientes, establecimientosFiltrados, sistemasFiltrados, tiposServicio,
    contactos, modulos, ingenieros, presupuestosCliente,
  };
}
