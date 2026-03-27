import { useState, useRef, useCallback } from 'react';
import type { WorkOrder, Part, OTEstadoAdmin, OTEstadoHistorial, CierreAdministrativo } from '@ags/shared';

export interface OTFormState {
  razonSocial: string;
  contacto: string;
  direccion: string;
  localidad: string;
  provincia: string;
  emailPrincipal: string;
  sistemaNombre: string;
  codigoInternoCliente: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloSerie: string;
  tipoServicio: string;
  fechaInicio: string;
  fechaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  reporteTecnico: string;
  accionesTomar: string;
  articulos: Part[];
  budgets: string[];
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;
  status: 'BORRADOR' | 'FINALIZADO';
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  materialesParaServicio: string;
  problemaFallaInicial: string;
  estadoAdmin: OTEstadoAdmin;
  estadoAdminFecha: string;
  estadoHistorial: OTEstadoHistorial[];
  ordenCompra: string;
  fechaServicioAprox: string;
  ingenieroAsignadoId: string | null;
  ingenieroAsignadoNombre: string | null;
  cierreAdmin: CierreAdministrativo;
  clienteId?: string;
  sistemaId?: string;
  moduloId?: string;
  leadId?: string | null;
  presupuestoOrigenId?: string | null;
}

const DEFAULT_CIERRE: CierreAdministrativo = {
  horasConfirmadas: false, partesConfirmadas: false,
  stockDeducido: false, avisoAdminEnviado: false,
};

const INITIAL_FORM: OTFormState = {
  razonSocial: '', contacto: '', direccion: '', localidad: '', provincia: '', emailPrincipal: '',
  sistemaNombre: '', codigoInternoCliente: '', moduloModelo: '', moduloDescripcion: '', moduloSerie: '',
  tipoServicio: '', fechaInicio: '', fechaFin: '', horasTrabajadas: '', tiempoViaje: '',
  reporteTecnico: '', accionesTomar: '', articulos: [], budgets: [''],
  esFacturable: false, tieneContrato: false, esGarantia: false, status: 'BORRADOR',
  aclaracionCliente: '', aclaracionEspecialista: '', materialesParaServicio: '', problemaFallaInicial: '',
  estadoAdmin: 'CREADA', estadoAdminFecha: '', estadoHistorial: [],
  ordenCompra: '', fechaServicioAprox: '',
  ingenieroAsignadoId: null, ingenieroAsignadoNombre: null,
  cierreAdmin: { ...DEFAULT_CIERRE },
  clienteId: undefined, sistemaId: undefined, moduloId: undefined,
  leadId: null, presupuestoOrigenId: null,
};

export function useOTFormState() {
  const [form, setForm] = useState<OTFormState>({ ...INITIAL_FORM });
  const hasUserInteracted = useRef(false);

  const setField = useCallback(<K extends keyof OTFormState>(field: K, value: OTFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFields = useCallback((partial: Partial<OTFormState>) => {
    setForm(prev => ({ ...prev, ...partial }));
  }, []);

  const markInteracted = useCallback(() => {
    if (!hasUserInteracted.current) hasUserInteracted.current = true;
  }, []);

  const loadFromOT = useCallback((ot: WorkOrder) => {
    setForm({
      razonSocial: ot.razonSocial || '', contacto: ot.contacto || '',
      direccion: ot.direccion || '', localidad: ot.localidad || '',
      provincia: ot.provincia || '', emailPrincipal: ot.emailPrincipal || '',
      sistemaNombre: ot.sistema || '', codigoInternoCliente: ot.codigoInternoCliente || '',
      moduloModelo: ot.moduloModelo || '', moduloDescripcion: ot.moduloDescripcion || '',
      moduloSerie: ot.moduloSerie || '', tipoServicio: ot.tipoServicio || '',
      fechaInicio: ot.fechaInicio || '', fechaFin: ot.fechaFin || '',
      horasTrabajadas: ot.horasTrabajadas || '', tiempoViaje: ot.tiempoViaje || '',
      reporteTecnico: ot.reporteTecnico || '', accionesTomar: ot.accionesTomar || '',
      articulos: ot.articulos || [],
      budgets: ot.budgets && ot.budgets.length > 0 ? ot.budgets : [''],
      esFacturable: ot.esFacturable || false, tieneContrato: ot.tieneContrato || false,
      esGarantia: ot.esGarantia || false, status: ot.status || 'BORRADOR',
      aclaracionCliente: ot.aclaracionCliente || '',
      aclaracionEspecialista: ot.aclaracionEspecialista || '',
      materialesParaServicio: ot.materialesParaServicio || '',
      problemaFallaInicial: ot.problemaFallaInicial || '',
      estadoAdmin: ot.estadoAdmin || (ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'CREADA'),
      estadoAdminFecha: ot.estadoAdminFecha || '',
      estadoHistorial: ot.estadoHistorial || [],
      ordenCompra: ot.ordenCompra || '', fechaServicioAprox: ot.fechaServicioAprox || '',
      ingenieroAsignadoId: ot.ingenieroAsignadoId ?? null,
      ingenieroAsignadoNombre: ot.ingenieroAsignadoNombre ?? null,
      cierreAdmin: ot.cierreAdmin ?? { ...DEFAULT_CIERRE },
      clienteId: ot.clienteId, sistemaId: ot.sistemaId, moduloId: ot.moduloId,
      leadId: ot.leadId ?? null, presupuestoOrigenId: ot.presupuestoOrigenId ?? null,
    });
    hasUserInteracted.current = false;
  }, []);

  const cleanValue = (v: any) => (v === undefined || v === '' ? null : v);

  const buildSavePayload = useCallback((): Partial<WorkOrder> => ({
    razonSocial: cleanValue(form.razonSocial), contacto: cleanValue(form.contacto),
    direccion: cleanValue(form.direccion), localidad: cleanValue(form.localidad),
    provincia: cleanValue(form.provincia), emailPrincipal: cleanValue(form.emailPrincipal),
    sistema: cleanValue(form.sistemaNombre), codigoInternoCliente: cleanValue(form.codigoInternoCliente),
    moduloModelo: cleanValue(form.moduloModelo), moduloDescripcion: cleanValue(form.moduloDescripcion),
    moduloSerie: cleanValue(form.moduloSerie), tipoServicio: cleanValue(form.tipoServicio),
    fechaInicio: cleanValue(form.fechaInicio), fechaFin: cleanValue(form.fechaFin),
    horasTrabajadas: cleanValue(form.horasTrabajadas), tiempoViaje: cleanValue(form.tiempoViaje),
    reporteTecnico: cleanValue(form.reporteTecnico), accionesTomar: cleanValue(form.accionesTomar),
    articulos: form.articulos, budgets: form.budgets.filter(b => b.trim() !== ''),
    esFacturable: form.esFacturable, tieneContrato: form.tieneContrato,
    esGarantia: form.esGarantia, status: form.status,
    aclaracionCliente: cleanValue(form.aclaracionCliente),
    aclaracionEspecialista: cleanValue(form.aclaracionEspecialista),
    materialesParaServicio: cleanValue(form.materialesParaServicio),
    problemaFallaInicial: cleanValue(form.problemaFallaInicial),
    estadoAdmin: form.estadoAdmin, estadoAdminFecha: cleanValue(form.estadoAdminFecha),
    estadoHistorial: form.estadoHistorial,
    ordenCompra: cleanValue(form.ordenCompra), fechaServicioAprox: cleanValue(form.fechaServicioAprox),
    ingenieroAsignadoId: form.ingenieroAsignadoId, ingenieroAsignadoNombre: form.ingenieroAsignadoNombre,
    cierreAdmin: form.cierreAdmin,
    clienteId: cleanValue(form.clienteId), sistemaId: cleanValue(form.sistemaId),
    moduloId: cleanValue(form.moduloId),
  }), [form]);

  /** Validate form and return field-level errors (empty = valid) */
  const validate = useCallback((requiredForEstado?: OTEstadoAdmin): Record<string, string> => {
    const errors: Record<string, string> = {};
    // Always required
    if (!form.clienteId) errors.clienteId = 'Cliente es obligatorio';
    if (!form.tipoServicio.trim()) errors.tipoServicio = 'Tipo de servicio es obligatorio';

    // Required from ASIGNADA onwards
    if (requiredForEstado && requiredForEstado !== 'CREADA') {
      if (!form.fechaInicio) errors.fechaInicio = 'Fecha de inicio es obligatoria';
    }

    // Required from COORDINADA onwards
    if (requiredForEstado && !['CREADA', 'ASIGNADA'].includes(requiredForEstado)) {
      if (!form.ingenieroAsignadoId) errors.ingenieroAsignadoId = 'Debe asignar un ingeniero';
    }

    // Required for CIERRE_TECNICO onwards
    if (requiredForEstado && ['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO'].includes(requiredForEstado)) {
      if (!form.reporteTecnico.trim()) errors.reporteTecnico = 'El reporte técnico es obligatorio';
    }

    return errors;
  }, [form]);

  return { form, setField, setFields, markInteracted, hasUserInteracted, loadFromOT, buildSavePayload, validate };
}
