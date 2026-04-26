// Tipos compartidos entre reportes-ot y sistema-modular

// Tipos de OT (Work Order) - Versión extendida para Sistema Modular

/** Estados del workflow administrativo de la OT */
export type OTEstadoAdmin =
  | 'CREADA'
  | 'ASIGNADA'
  | 'COORDINADA'
  | 'EN_CURSO'
  | 'CIERRE_TECNICO'
  | 'CIERRE_ADMINISTRATIVO'
  | 'FINALIZADO';

/** Entrada del historial de estados */
export interface OTEstadoHistorial {
  estado: OTEstadoAdmin;
  fecha: string;       // ISO date del cambio
  usuario?: string;    // quién cambió el estado
  nota?: string;       // comentario opcional
}

export const OT_ESTADO_LABELS: Record<OTEstadoAdmin, string> = {
  CREADA: 'Creada',
  ASIGNADA: 'Asignada',
  COORDINADA: 'Coordinada',
  EN_CURSO: 'En curso',
  CIERRE_TECNICO: 'Cierre técnico',
  CIERRE_ADMINISTRATIVO: 'Cierre administrativo',
  FINALIZADO: 'Finalizado',
};

export const OT_ESTADO_ORDER: OTEstadoAdmin[] = [
  'CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO',
  'CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO',
];

export interface WorkOrder {
  otNumber: string; // Formato: 5 dígitos + opcional .NN (ej: 25660.02)
  status: 'BORRADOR' | 'FINALIZADO'; // status técnico (reportes-ot lo usa)
  budgets: string[];
  tipoServicio: string;
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;
  razonSocial: string;
  contacto: string;
  sector?: string;
  direccion: string;
  localidad: string;
  provincia: string;
  sistema: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloMarca?: string;
  moduloSerie: string;
  codigoInternoCliente: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio?: string;
  horaFin?: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  reporteTecnico: string;
  accionesTomar: string;
  articulos: Part[];
  emailPrincipal: string;
  signatureEngineer: string | null;
  aclaracionEspecialista: string;
  signatureClient: string | null;
  aclaracionCliente: string;
  updatedAt: string;
  // --- Campos administrativos (sistema-modular) ---
  estadoAdmin?: OTEstadoAdmin;              // Estado del workflow administrativo
  estadoAdminFecha?: string;                // Fecha del último cambio de estado
  estadoHistorial?: OTEstadoHistorial[];    // Historial completo de cambios de estado
  ordenCompra?: string;                     // Número de orden de compra del cliente
  fechaServicioAprox?: string;              // Fecha aproximada del servicio (coordinación)
  // --- Referencias a entidades ---
  clienteId?: string;
  establecimientoId?: string;
  sistemaId?: string;
  moduloId?: string;
  leadId?: string | null;
  presupuestoOrigenId?: string | null;
  createdAt?: string;
  createdBy?: string;
  fechaAsignacion?: string;
  fechaCierre?: string;
  materialesParaServicio?: string;
  comentarioFacturacion?: string | null;
  contratoId?: string | null;
  problemaFallaInicial?: string;
  ingenieroAsignadoId?: string | null;
  ingenieroAsignadoNombre?: string | null;
  // --- Cierre administrativo ---
  cierreAdmin?: CierreAdministrativo;
  // --- Campos de reportes-ot (protocolo/instrumentos) ---
  protocolSelections?: Record<string, unknown>[];
  instrumentosSeleccionados?: Record<string, unknown>[];
  protocolTemplateId?: string | null;
  protocolData?: Record<string, unknown> | null;
}

/** Datos del cierre administrativo de la OT */
export interface StockSelection {
  partId: string;
  partCodigo: string;
  partDescripcion: string;
  cantidad: number;
  origenTipo: 'posicion' | 'ingeniero';
  origenId: string;
  origenNombre: string;
  unidadStockId?: string | null;
}

export interface CierreAdministrativo {
  horasConfirmadas: boolean;
  horasLabAjustadas?: string;
  horasViajeAjustadas?: string;
  partesConfirmadas: boolean;
  stockDeducido: boolean;
  stockSelections?: StockSelection[] | null;
  solicitudFacturacionId?: string | null;
  notasCierre?: string;
  avisoAdminEnviado: boolean;
  avisoAdminFecha?: string;
  fechaCierreAdmin?: string;
}

export interface Part {
  id: string;
  codigo: string;
  descripcion: string;
  nroSerie?: string;
  cantidad: number;
  origen: string;
  /** FK opcional a artículos de stock (integración futura) */
  stockArticuloId?: string | null;
  /** FK opcional a unidad específica de stock */
  stockUnidadId?: string | null;
}

// --- Condición IVA (Clientes) ---
export type CondicionIva =
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento'
  | 'consumidor_final'
  | 'otro';

// --- Tipo de servicio (Clientes) ---
export type TipoServicioCliente =
  | 'contrato'
  | 'per_incident';

// --- Módulo Clientes ---
// id del cliente = CUIT normalizado (sin guiones/espacios) o LEGACY-{uuid} si no tiene CUIT (cuit: null)

/** @deprecated Contactos pasan a estar en establecimiento; ver ContactoEstablecimiento */
export interface ContactoCliente {
  id: string;
  nombre: string;
  cargo: string;
  sector: string;
  telefono: string;
  interno?: string;
  email: string;
  esPrincipal: boolean;
}

/** Cliente: solo datos fiscales y generales. Sin contactos ni condición de pago (van en Establecimiento). */
export interface Cliente {
  /** ID del documento = CUIT normalizado, o LEGACY-{uuid} si no tiene CUIT (cuit es null) */
  id: string;
  razonSocial: string;
  /** CUIT; redundante con id cuando existe; null para legacy */
  cuit?: string | null;
  pais: string;
  /** Domicilio fiscal (opcional) */
  direccionFiscal?: string;
  localidadFiscal?: string;
  provinciaFiscal?: string;
  codigoPostalFiscal?: string;
  /** Compatibilidad: si existen en datos legacy, se mapean a *Fiscal */
  direccion?: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
  rubro: string;
  condicionIva?: CondicionIva;
  ingresosBrutos?: string;
  convenioMultilateral?: boolean;
  notas?: string;
  /** Si true, las OTs de este cliente deben incluir documentación de trazabilidad */
  requiereTrazabilidad?: boolean;
  /** Si true, el cliente tiene buen historial de pago (auto-habilita "cliente confiable") */
  pagaEnTiempo?: boolean;
  /** Tipo de servicio predominante: 'contrato' | 'per_incident' | etc. */
  tipoServicio?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// --- Contacto de Establecimiento (subcolección establecimientos/{id}/contactos) ---
export interface ContactoEstablecimiento {
  id: string;
  establecimientoId: string;
  nombre: string;
  cargo: string;
  sector: string;
  telefono?: string;
  interno?: string;
  email: string;
  esPrincipal: boolean;
}

// --- Establecimiento (sede/planta por cliente) ---
export type TipoEstablecimiento = 'planta' | 'sucursal' | 'oficina' | 'laboratorio' | 'otro';

export interface Establecimiento {
  id: string;
  clienteCuit: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  pais?: string | null;
  codigoPostal?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  tipo?: TipoEstablecimiento | null;
  /** Condición comercial a nivel establecimiento */
  condicionPagoId?: string | null;
  tipoServicio?: TipoServicioCliente | null;
  infoPagos?: string | null;
  pagaEnTiempo?: boolean;
  sueleDemorarse?: boolean;
  activo: boolean;
  /** Sectores/áreas del establecimiento (ej: "Control de Calidad", "Desarrollo", "Producción") */
  sectores?: string[];
  ubicaciones?: Ubicacion[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// --- Categorías equipo (catálogo) ---
export interface CategoriaEquipo {
  id: string;
  nombre: string; // Osmómetros, Cromatógrafos, etc.
  modelos?: string[]; // Subcategorías / modelos de sistemas (ej: HPLC 1200, HPLC 1100)
}

// --- Modelo de módulo (dentro de categoría) ---
export interface ModeloModulo {
  codigo: string; // ej: G1311A
  descripcion: string; // ej: Bomba Cuaternaria
  marca?: string; // ej: Agilent
}

// --- Categorías de módulos (catálogo) ---
export interface CategoriaModulo {
  id: string;
  nombre: string; // Bombas, Detectores, Inyectores, etc.
  modelos: ModeloModulo[]; // Lista de modelos con código y descripción
}

// --- Ubicación (sistema / módulo) ---
export type TipoUbicacion = 'cliente' | 'taller' | 'loaner' | 'transito' | 'otro';

export interface Ubicacion {
  id: string;
  lugar: string;
  tipo: TipoUbicacion;
  fechaDesde: string; // ISO
  fechaHasta: string | null;
  detalle?: string;
  esActual: boolean;
}

// --- Configuración de Cromatógrafo Gaseoso (GC) ---
// Se activa cuando el nombre del sistema contiene la palabra "gaseoso"

/** Tipos de puerto de inyección (inlet) para GC */
export type InletType =
  | 'SSL'   // Split/Splitless
  | 'COC'   // Cool on Column
  | 'PTV'   // Programmed Temperature Vaporization
  | 'PP';   // Purged Packed

/** Tipos de detector para GC */
export type DetectorType =
  | 'FID'   // Flame Ionization Detector
  | 'NCD'   // Nitrogen/Phosphorus Detector
  | 'FPD'   // Flame Photometric Detector
  | 'ECD'   // Electron Capture Detector
  | 'uECD'  // Micro Electron Capture Detector
  | 'SCD'   // Sulfur Chemiluminescence Detector
  | 'TCD'   // Thermal Conductivity Detector
  | 'MSD';  // Mass Selective Detector

export interface ConfiguracionGC {
  puertoInyeccionFront?: InletType | null;
  puertoInyeccionBack?: InletType | null;
  puertoInyeccionAux?: InletType | null;
  detectorFront?: DetectorType | null;
  detectorBack?: DetectorType | null;
  detectorAux?: DetectorType | null;
}

/** Software instalado en un sistema (un sistema puede tener varios: uno para GC, otro para MS, etc.) */
export interface SoftwareInstalado {
  nombre: string;
  revision?: string;
}

/** Helper: devuelve true si el nombre del sistema o categoría indica que es un GC */
export function esGaseoso(nombreSistema: string): boolean {
  const lower = nombreSistema.toLowerCase();
  return lower.includes('gaseoso') || lower.includes('gaseosa') || /\bgc\b/.test(lower);
}

/** Etiquetas legibles para InletType */
export const INLET_LABELS: Record<InletType, string> = {
  SSL: 'SSL (Split/Splitless)',
  COC: 'COC (Cool on Column)',
  PTV: 'PTV (Programmed Temperature Vaporization)',
  PP: 'PP (Purged Packed)',
};

/** Etiquetas legibles para DetectorType */
export const DETECTOR_LABELS: Record<DetectorType, string> = {
  FID: 'FID (Flame Ionization Detector)',
  NCD: 'NCD (Nitrogen/Phosphorus Detector)',
  FPD: 'FPD (Flame Photometric Detector)',
  ECD: 'ECD (Electron Capture Detector)',
  uECD: 'uECD (Micro Electron Capture Detector)',
  SCD: 'SCD (Sulfur Chemiluminescence Detector)',
  TCD: 'TCD (Thermal Conductivity Detector)',
  MSD: 'MSD (Mass Selective Detector)',
};

// --- Módulo de sistema ---
export interface ModuloSistema {
  id: string;
  sistemaId: string;
  nombre: string; // Bomba, Inyector, Detector
  marca?: string;
  descripcion?: string;
  serie?: string;
  firmware?: string;
  observaciones?: string;
  ubicaciones: Ubicacion[];
  otIds: string[];
}

// --- Sistema (equipo padre) ---
export interface Sistema {
  id: string;
  /** FK: establecimiento donde está el equipo. Requerido. */
  establecimientoId: string;
  /** @deprecated Mantener solo durante migración; objetivo final: solo establecimientoId */
  clienteId?: string | null;
  categoriaId: string;
  nombre: string; // ej. HPLC 1260 (ahora viene de modelos de categoría)
  descripcion?: string; // Campo eliminado - el nombre del modelo es suficiente
  codigoInternoCliente: string; // asignado por cliente o provisorio editable
  software?: string; // Legacy: primer software (se mantiene sincronizado con softwares[0])
  softwareRevision?: string; // Legacy: revisión del primer software
  softwares?: SoftwareInstalado[];
  observaciones?: string;
  /** Sector/área del establecimiento al que pertenece (ej: "Control de Calidad") */
  sector?: string | null;
  /** Solo para sistemas cuyo nombre contiene "gaseoso" (cromatógrafos GC) */
  configuracionGC?: ConfiguracionGC | null;
  activo: boolean;
  ubicaciones: Ubicacion[];
  otIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
  /** ID visible legible para uso humano (ej: AGS-EQ-1043, CC-015). Asignado manualmente o auto-generado. */
  agsVisibleId?: string | null;
  /** Si el sistema está cubierto por un contrato de servicio */
  enContrato?: boolean;
}

// --- Motivo del llamado (Tickets) ---
export type MotivoLlamado = 'soporte' | 'ventas_insumos' | 'ventas_equipos' | 'administracion' | 'otros';

export const MOTIVO_LLAMADO_LABELS: Record<MotivoLlamado, string> = {
  soporte: 'Soporte',
  ventas_insumos: 'Ventas de insumos',
  ventas_equipos: 'Ventas de equipos',
  administracion: 'Administración',
  otros: 'Otros',
};

export const MOTIVO_LLAMADO_COLORS: Record<MotivoLlamado, string> = {
  soporte: 'bg-blue-100 text-blue-700',
  ventas_insumos: 'bg-green-100 text-green-700',
  ventas_equipos: 'bg-emerald-100 text-emerald-700',
  administracion: 'bg-violet-100 text-violet-700',
  otros: 'bg-slate-100 text-slate-700',
};

// --- Áreas destino (Tickets) ---
export type TicketArea = 'admin_soporte' | 'ing_soporte' | 'administracion' | 'ventas' | 'sistema';

export const TICKET_AREA_LABELS: Record<TicketArea, string> = {
  admin_soporte: 'Administración de soporte',
  ing_soporte: 'Ing. de soporte',
  administracion: 'Administración',
  ventas: 'Ventas',
  sistema: 'Sistema (pendiente)',
};

export const TICKET_AREA_COLORS: Record<TicketArea, string> = {
  admin_soporte: 'bg-blue-100 text-blue-700',
  ing_soporte: 'bg-teal-100 text-teal-700',
  administracion: 'bg-violet-100 text-violet-700',
  ventas: 'bg-green-100 text-green-700',
  sistema: 'bg-purple-100 text-purple-700',
};

// --- Prioridad ---
export type TicketPrioridad = 'urgente' | 'alta' | 'normal' | 'baja' | 'muy_baja';

export const TICKET_PRIORIDAD_LABELS: Record<TicketPrioridad, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baja: 'Baja',
  muy_baja: 'Muy baja',
};

export const TICKET_PRIORIDAD_COLORS: Record<TicketPrioridad, string> = {
  urgente: 'bg-red-200 text-red-800',
  alta: 'bg-red-100 text-red-700',
  normal: 'bg-amber-100 text-amber-700',
  baja: 'bg-emerald-100 text-emerald-700',
  muy_baja: 'bg-slate-100 text-slate-600',
};

/** Días de próximo contacto según prioridad */
export const TICKET_PRIORIDAD_DIAS: Record<TicketPrioridad, number> = {
  urgente: 2,
  alta: 4,
  normal: 7,
  baja: 15,
  muy_baja: 30,
};

/** Mapeo de UserRole → áreas de ticket que ese rol puede gestionar */
export const ROLE_TICKET_AREAS: Record<UserRole, TicketArea[]> = {
  admin: [],
  admin_soporte: ['admin_soporte'],
  admin_ing_soporte: ['ing_soporte'],
  ingeniero_soporte: ['ing_soporte'],
  ventas: ['ventas'],
  admin_contable: ['administracion'],
  administracion: ['administracion'],
};

/** Obtiene todas las áreas de ticket que un usuario puede ver (desde rol principal + roles adicionales) */
export function getUserTicketAreas(user: { role: UserRole | null; roles?: UserRole[] }): TicketArea[] {
  const areas = new Set<TicketArea>();
  if (user.role) {
    for (const a of ROLE_TICKET_AREAS[user.role] ?? []) areas.add(a);
  }
  if (user.roles) {
    for (const r of user.roles) {
      for (const a of ROLE_TICKET_AREAS[r] ?? []) areas.add(a);
    }
  }
  return Array.from(areas);
}

/** Verifica si un usuario tiene un rol específico (principal o adicional) */
export function userHasRole(user: { role: UserRole | null; roles?: UserRole[] }, targetRole: UserRole): boolean {
  if (user.role === targetRole) return true;
  return user.roles?.includes(targetRole) ?? false;
}

/**
 * Determina si un usuario puede modificar/derivar un ticket.
 */
export function canUserModifyTicket(
  ticket: { asignadoA: string | null; areaActual?: TicketArea | null },
  user: { id: string; role: UserRole | null; roles?: UserRole[] },
): boolean {
  if (userHasRole(user, 'admin')) return true;
  if (ticket.asignadoA) return ticket.asignadoA === user.id;
  if (ticket.areaActual) {
    const areas = getUserTicketAreas(user);
    return areas.includes(ticket.areaActual);
  }
  return true;
}

// --- Estados del Ticket ---
export type TicketEstado =
  | 'nuevo'
  | 'relevamiento_pendiente'
  | 'presupuesto_pendiente'
  | 'en_seguimiento'
  | 'presupuesto_enviado'
  | 'esperando_oc'
  | 'oc_recibida'
  | 'espera_importacion'
  | 'pendiente_entrega'
  | 'en_coordinacion'
  | 'ot_creada'
  | 'ot_coordinada'
  | 'ot_realizada'
  | 'pendiente_aviso_facturacion'
  | 'pendiente_facturacion'
  | 'finalizado'
  | 'no_concretado';

export const TICKET_ESTADO_LABELS: Record<TicketEstado, string> = {
  nuevo: 'Nuevo',
  relevamiento_pendiente: 'Relevamiento pendiente',
  presupuesto_pendiente: 'Presupuesto pendiente',
  en_seguimiento: 'En seguimiento',
  presupuesto_enviado: 'Presupuesto enviado',
  esperando_oc: 'Esperando OC',
  oc_recibida: 'OC recibida',
  espera_importacion: 'Espera importación',
  pendiente_entrega: 'Pendiente entrega',
  en_coordinacion: 'En coordinación',
  ot_creada: 'OT creada',
  ot_coordinada: 'OT coordinada',
  ot_realizada: 'OT realizada',
  pendiente_aviso_facturacion: 'Pendiente aviso facturación',
  pendiente_facturacion: 'Pend. facturación',
  finalizado: 'Finalizado',
  no_concretado: 'No concretado',
};

export const TICKET_ESTADO_COLORS: Record<TicketEstado, string> = {
  nuevo: 'bg-blue-100 text-blue-800',
  relevamiento_pendiente: 'bg-indigo-100 text-indigo-800',
  presupuesto_pendiente: 'bg-purple-100 text-purple-800',
  en_seguimiento: 'bg-sky-100 text-sky-800',
  presupuesto_enviado: 'bg-violet-100 text-violet-800',
  esperando_oc: 'bg-orange-100 text-orange-800',
  oc_recibida: 'bg-orange-200 text-orange-900',
  espera_importacion: 'bg-yellow-100 text-yellow-800',
  pendiente_entrega: 'bg-lime-100 text-lime-800',
  en_coordinacion: 'bg-cyan-100 text-cyan-800',
  ot_creada: 'bg-teal-100 text-teal-800',
  ot_coordinada: 'bg-teal-200 text-teal-900',
  ot_realizada: 'bg-green-100 text-green-800',
  pendiente_aviso_facturacion: 'bg-orange-100 text-orange-800',
  pendiente_facturacion: 'bg-amber-100 text-amber-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  no_concretado: 'bg-red-100 text-red-600',
};

/** Orden para tabs y filtros */
export const TICKET_ESTADO_ORDER: TicketEstado[] = [
  'nuevo', 'relevamiento_pendiente', 'presupuesto_pendiente',
  'en_seguimiento', 'presupuesto_enviado',
  'esperando_oc', 'oc_recibida', 'espera_importacion', 'pendiente_entrega',
  'en_coordinacion', 'ot_creada', 'ot_coordinada', 'ot_realizada',
  'pendiente_aviso_facturacion', 'pendiente_facturacion', 'finalizado', 'no_concretado',
];

// --- Estados simplificados (fase actual sin módulos completos) ---
// Mostramos solo 3 estados en la UI: Nuevo / En proceso / Finalizado.
// Los estados detallados se mantienen en el modelo para cuando vuelvan los módulos.

export type TicketEstadoSimplificado = 'nuevo' | 'en_proceso' | 'finalizado';

export const TICKET_ESTADO_SIMPLIFICADO_LABELS: Record<TicketEstadoSimplificado, string> = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
};

export const TICKET_ESTADO_SIMPLIFICADO_COLORS: Record<TicketEstadoSimplificado, string> = {
  nuevo: 'bg-blue-100 text-blue-800',
  en_proceso: 'bg-sky-100 text-sky-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
};

/** Mapea cualquier TicketEstado al estado simplificado para mostrar en UI */
export function getSimplifiedEstado(estado: TicketEstado): TicketEstadoSimplificado {
  if (estado === 'nuevo') return 'nuevo';
  if (estado === 'finalizado' || estado === 'no_concretado') return 'finalizado';
  return 'en_proceso';
}

export function getSimplifiedEstadoLabel(estado: TicketEstado): string {
  return TICKET_ESTADO_SIMPLIFICADO_LABELS[getSimplifiedEstado(estado)];
}

export function getSimplifiedEstadoColor(estado: TicketEstado): string {
  return TICKET_ESTADO_SIMPLIFICADO_COLORS[getSimplifiedEstado(estado)];
}

// --- Posta (derivación) ---
export interface Posta {
  id: string;
  fecha: string; // ISO
  deUsuarioId: string;
  deUsuarioNombre: string;
  aUsuarioId: string;
  aUsuarioNombre: string;
  aArea?: TicketArea;
  comentario?: string;
  estadoAnterior: TicketEstado;
  estadoNuevo: TicketEstado;
  accionRequerida?: string;
}

// --- Backward compat aliases (will be removed eventually) ---
/** @deprecated Use TicketArea */ export type LeadArea = TicketArea;
/** @deprecated Use TicketEstado */ export type LeadEstado = TicketEstado;
/** @deprecated Use TicketPrioridad */ export type LeadPrioridad = TicketPrioridad;
/** @deprecated */ export const LEAD_PRIORIDAD_LABELS_LEGACY = { alta: 'Alta', media: 'Media', baja: 'Baja' };
/** @deprecated */ export const LEAD_AREA_LABELS = TICKET_AREA_LABELS;
/** @deprecated */ export const LEAD_AREA_COLORS = TICKET_AREA_COLORS;
/** @deprecated */ export const LEAD_PRIORIDAD_LABELS = TICKET_PRIORIDAD_LABELS;
/** @deprecated */ export const LEAD_PRIORIDAD_COLORS = TICKET_PRIORIDAD_COLORS;
/** @deprecated */ export const LEAD_ESTADO_LABELS = TICKET_ESTADO_LABELS;
/** @deprecated */ export const LEAD_ESTADO_COLORS = TICKET_ESTADO_COLORS;
/** @deprecated */ export const LEAD_ESTADO_ORDER = TICKET_ESTADO_ORDER;
/** @deprecated */ export const ROLE_LEAD_AREAS = ROLE_TICKET_AREAS;
/** @deprecated */ export const canUserModifyLead = canUserModifyTicket;


// --- Tipos de Servicio (lista simple, sin categorías) ---
export interface TipoServicio {
  id: string;
  nombre: string; // Ej: "Mantenimiento preventivo", "Calificación de operación", etc.
  activo: boolean;
  /** Si true, el flujo OT muestra el selector de tablas de protocolo (Fase 3) */
  requiresProtocol: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Adjunto Ticket ---
export interface AdjuntoTicket {
  id: string;
  nombre: string;
  url: string;
  tipo: 'imagen' | 'archivo';
  size: number; // bytes
  fechaCarga: string;
}

export const TICKET_MAX_ADJUNTOS = 10;

// --- Contacto de Ticket (array embebido en el ticket) ---
// Reusa shape de ContactoEstablecimiento pero sin establecimientoId porque
// vive embebido en el ticket (no es subcolección propia).
export interface ContactoTicket {
  id: string;
  nombre: string;
  cargo?: string;
  sector?: string;
  telefono?: string;
  interno?: string;
  email?: string;
  esPrincipal: boolean;
}

/** Devuelve el contacto marcado como principal, o el primero del array si ninguno lo está. */
export function getContactoPrincipal(contactos: ContactoTicket[] | undefined | null): ContactoTicket | null {
  if (!contactos || contactos.length === 0) return null;
  return contactos.find(c => c.esPrincipal) ?? contactos[0];
}

// --- Ticket ---
export interface Ticket {
  id: string;
  /** Numero correlativo TKT-00001. Opcional en hidratación para compat con tickets legacy sin numero asignado. */
  numero?: string;
  clienteId: string | null;
  contactoId: string | null;
  razonSocial: string;
  /** Contactos del ticket. El marcado `esPrincipal` se refleja en los campos planos `contacto/email/telefono`. */
  contactos?: ContactoTicket[];
  /** @deprecated Usar `contactos` con `esPrincipal`. Se mantiene sincronizado desde el principal para compat. */
  contacto: string;
  /** @deprecated Usar `contactos` con `esPrincipal`. Se mantiene sincronizado desde el principal para compat. */
  email: string;
  /** @deprecated Usar `contactos` con `esPrincipal`. Se mantiene sincronizado desde el principal para compat. */
  telefono: string;
  motivoLlamado: MotivoLlamado;
  motivoOtros?: string | null;
  motivoContacto: string;
  sistemaId: string | null;
  moduloId?: string | null;
  estado: TicketEstado;
  postas: Posta[];
  asignadoA: string | null;
  asignadoNombre?: string | null;
  derivadoPor: string | null;
  areaActual?: TicketArea | null;
  accionPendiente?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
  finalizadoAt?: string | null;
  descripcion?: string | null;
  prioridad?: TicketPrioridad | null;
  proximoContacto?: string | null;
  valorEstimado?: number | null;
  /** True si la migración clienteId batch no pudo resolver un único candidato. Visible en /admin/revision-clienteid. Hidratado default `false` en parseLeadDoc cuando el campo falta en Firestore. */
  pendienteClienteId?: boolean;
  /** Candidatos propuestos por el script de migración cuando hay ambigüedad. Array opcional; default `[]` en hidratación si el campo falta. `score` indica por qué criterio matcheó el candidato. */
  candidatosPropuestos?: Array<{ clienteId: string; razonSocial: string; score: 'cuit' | 'razonSocial' }>;
  /** ISO timestamp de cuando se resolvió clienteId (por script o manualmente). `null` si nunca se migró. En Firestore se persiste como Timestamp; se lee como ISO string via .toDate().toISOString(). */
  clienteIdMigradoAt?: string | null;
  /** uid del usuario que resolvió manualmente, o literal "script" si vino del batch. `null` si nunca se migró. */
  clienteIdMigradoPor?: string | null;
  /** Admin marcó el ticket como "no se puede resolver, ignorar de la lista de pendientes". Default `false` en hidratación. */
  revisionDescartada?: boolean;
  presupuestosIds?: string[];
  otIds?: string[];
  adjuntos?: AdjuntoTicket[];
  source?: 'qr' | 'portal' | 'manual' | null;
  sistemaAgsVisibleId?: string | null;
  /** Usuario que transicionó motivoLlamado a ventas_insumos. Solo se setea al cambio. */
  ventasInsumosCreadoPor?: string | null;
  /** Timestamp ISO del cambio a motivoLlamado=ventas_insumos. */
  ventasInsumosCreadoEn?: string | null;
}

// --- Backward compat aliases ---
/** @deprecated Use AdjuntoTicket */ export type AdjuntoLead = AdjuntoTicket;
/** @deprecated Use TICKET_MAX_ADJUNTOS */ export const LEAD_MAX_ADJUNTOS = TICKET_MAX_ADJUNTOS;
/** @deprecated Use Ticket */ export type Lead = Ticket;

// --- Usuario (catálogo postas) ---
export interface UsuarioPosta {
  id: string;
  nombre: string;
  email?: string;
  area?: string;
}

// --- Presupuesto: Tipos auxiliares ---
export type TipoPresupuesto = 'servicio' | 'partes' | 'ventas' | 'contrato' | 'mixto';
export type MonedaPresupuesto = 'USD' | 'ARS' | 'EUR' | 'MIXTA';
export type OrigenPresupuesto = 'lead' | 'ot' | 'requerimiento_compra' | 'directo';

export const TIPO_PRESUPUESTO_LABELS: Record<TipoPresupuesto, string> = {
  servicio: 'Servicio',
  partes: 'Partes',
  ventas: 'Ventas',
  contrato: 'Contrato',
  mixto: 'Mixto',
};

export const TIPO_PRESUPUESTO_COLORS: Record<TipoPresupuesto, string> = {
  servicio: 'bg-blue-100 text-blue-800',
  partes: 'bg-amber-100 text-amber-800',
  ventas: 'bg-green-100 text-green-800',
  contrato: 'bg-purple-100 text-purple-800',
  mixto: 'bg-slate-100 text-slate-700',
};

export const MONEDA_PRESUPUESTO_LABELS: Record<MonedaPresupuesto, string> = {
  USD: 'Dólares (USD)',
  ARS: 'Pesos (ARS)',
  EUR: 'Euros (EUR)',
  MIXTA: 'Mixta (multi-moneda)',
};

export const MONEDA_SIMBOLO: Record<string, string> = {
  USD: 'U$S',
  ARS: '$',
  EUR: '€',
  MIXTA: '',
};

export const ORIGEN_PRESUPUESTO_LABELS: Record<OrigenPresupuesto, string> = {
  lead: 'Lead',
  ot: 'Orden de trabajo',
  requerimiento_compra: 'Requerimiento de compra',
  directo: 'Directo',
};

// --- Estados de Presupuesto ---
export type PresupuestoEstado =
  | 'borrador'
  | 'enviado'
  | 'aceptado'
  | 'en_ejecucion'
  | 'anulado'
  | 'finalizado';

export const ESTADO_PRESUPUESTO_LABELS: Record<PresupuestoEstado, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  en_ejecucion: 'En ejecución',
  anulado: 'Anulado',
  finalizado: 'Finalizado',
};

export const ESTADO_PRESUPUESTO_COLORS: Record<PresupuestoEstado, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-700',
  aceptado: 'bg-emerald-100 text-emerald-700',
  en_ejecucion: 'bg-cyan-100 text-cyan-700',
  anulado: 'bg-slate-200 text-slate-500',
  finalizado: 'bg-teal-100 text-teal-700',
};

/** Mapeo de estados legacy a nuevos estados simplificados */
export const PRESUPUESTO_ESTADO_MIGRATION: Record<string, PresupuestoEstado> = {
  borrador: 'borrador',
  enviado: 'enviado',
  en_seguimiento: 'enviado',
  pendiente_oc: 'enviado',
  aguarda: 'enviado',
  aceptado: 'aceptado',
  autorizado: 'aceptado',
  pendiente_certificacion: 'aceptado',
  rechazado: 'anulado',
  vencido: 'anulado',
  en_ejecucion: 'en_ejecucion',
  anulado: 'anulado',
  finalizado: 'finalizado',
};

// --- Item de Presupuesto ---
export interface PresupuestoItem {
  id: string;
  codigoProducto?: string | null; // Part number (ej: G1312-60067)
  descripcion: string;
  cantidad: number;
  unidad: string; // 'unidad', 'hora', 'servicio', etc.
  precioUnitario: number;
  descuento?: number; // Porcentaje de descuento (0-100)
  categoriaPresupuestoId?: string; // Referencia a categoría para aplicar reglas tributarias
  subtotal: number;
  /** FK opcional a artículos de stock (integración futura) */
  stockArticuloId?: string | null;
  /** FK opcional al catálogo de conceptos de servicio */
  conceptoServicioId?: string | null;
  // --- Vinculación a equipo/módulo (para presupuestos de contrato) ---
  sistemaId?: string | null;
  sistemaCodigoInterno?: string | null;
  moduloId?: string | null;
  sistemaNombre?: string | null;
  moduloNombre?: string | null;
  moduloSerie?: string | null;
  moduloMarca?: string | null;
  /** Código de servicio interno (ej: ATI_BAS_00C, MP1_CN_60) */
  servicioCode?: string | null;
  /** Grupo numérico para agrupar items por sistema en contratos (1, 2, 3...) */
  grupo?: number | null;
  /** Numeración de sub-item dentro del grupo (ej: "1.1", "1.20") */
  subItem?: string | null;
  /** Item de bonificación (descuento 100%) */
  esBonificacion?: boolean;
  /** Moneda del item — solo relevante cuando el presupuesto es MIXTA */
  moneda?: 'USD' | 'ARS' | 'EUR' | null;
  /** Sector / área del cliente donde reside el sistema (ej: "QC", "Control de Calidad"). Usado como header de sección en presupuestos de contrato. */
  sectorNombre?: string | null;
  /** Nota inline adicional por ítem (ej: "LLEVA SELLO DE FASE REVERSA"). Se renderiza como observación en el PDF de contrato. */
  itemNotasAdicionales?: string | null;
  /** Si es true, el ítem se renderiza como "S/L" (sin cargo) en la columna de cantidad. Usado para listar componentes de un sistema para trazabilidad. */
  esSinCargo?: boolean;
  /**
   * (Phase 8 FLOW-03) Si true, el artículo vinculado (`stockArticuloId`) no tiene stock disponible
   * ni en tránsito ni reservado al momento de agregar el ítem al presupuesto. Se computa
   * automáticamente al seleccionar el artículo (ver `atpHelpers.ts`). Al aceptar el presupuesto,
   * se crea un `RequerimientoCompra` con `condicional: true` por cada item con este flag.
   *
   * NO aplica a items sin `stockArticuloId` (servicios, consumibles no-stock) — permanece `false`/undefined.
   *
   * TODO(STKP-01): el cálculo actual es suma simple de unidades por estado; Phase 9 lo
   * reemplazará con `computeStockAmplio()` (source of truth consolidada).
   */
  itemRequiereImportacion?: boolean;
}

// --- Adjunto de Presupuesto ---
export type TipoAdjuntoPresupuesto = 'orden_compra' | 'autorizacion_mail' | 'otro';

export const TIPO_ADJUNTO_LABELS: Record<TipoAdjuntoPresupuesto, string> = {
  orden_compra: 'Orden de compra',
  autorizacion_mail: 'Autorización mail',
  otro: 'Otro',
};

export interface AdjuntoPresupuesto {
  id: string;
  tipo: TipoAdjuntoPresupuesto;
  nombre: string;
  url: string;
  fechaCarga: string;
  notas?: string | null;
}

// --- Flujo Automático de Derivación (Phase 8) ---

/**
 * Acción pendiente registrada cuando una derivación automática falla o no se puede
 * completar en el momento del disparo. Se almacena en `Presupuesto.pendingActions[]` y
 * se resuelve manualmente desde `/admin/acciones-pendientes` o automáticamente cuando
 * la condición bloqueante se resuelve (ej: al resolver `clienteId` pendiente).
 */
export interface PendingAction {
  id: string;
  type: 'crear_ticket_seguimiento' | 'derivar_comex' | 'enviar_mail_facturacion' | 'notificar_coordinador_ot';
  reason: string;
  createdAt: string;
  resolvedAt?: string;
  attempts: number;
}

/**
 * Orden de compra emitida por el CLIENTE hacia AGS (FLOW-02). Separada de `OrdenCompra`
 * que son OCs internas a proveedores. Relación N:M con presupuestos via `presupuestosIds`
 * (y back-ref en `Presupuesto.ordenesCompraIds`).
 */
export interface OrdenCompraCliente {
  id: string;
  numero: string;
  fecha: string;
  clienteId: string;
  presupuestosIds: string[];
  adjuntos: Array<{ id: string; url: string; tipo: 'pdf' | 'jpg' | 'png'; nombre: string; fechaCarga: string }>;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

/**
 * Configuración global de flujos automáticos. Doc único en `adminConfig/flujos`,
 * editado desde `/admin/config-flujos`. `mailFacturacion` es required (el servicio
 * asegura default 'mbarrios@agsanalitica.com' via `ADMIN_CONFIG_DEFAULTS`).
 */
export interface AdminConfigFlujos {
  usuarioSeguimientoId?: string | null;
  usuarioCoordinadorOTId?: string | null;
  usuarioResponsableComexId?: string | null;
  /** FLOW-05: responsable de materiales/cierre administrativo. Al cerrar
   *  técnicamente una OT, el ticket se deriva automáticamente a este usuario
   *  para ejecutar el cierre administrativo (descarga de artículos + facturación). */
  usuarioMaterialesId?: string | null;
  mailFacturacion: string;
  updatedAt: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// --- Orden de Compra (OC) ---
export type EstadoOC = 'borrador' | 'pendiente_aprobacion' | 'aprobada' | 'enviada_proveedor'
  | 'confirmada' | 'en_transito' | 'recibida_parcial' | 'recibida' | 'cancelada';
export type TipoOC = 'nacional' | 'importacion';

export const ESTADO_OC_LABELS: Record<EstadoOC, string> = {
  borrador: 'Borrador',
  pendiente_aprobacion: 'Pend. aprobación',
  aprobada: 'Aprobada',
  enviada_proveedor: 'Enviada',
  confirmada: 'Confirmada',
  en_transito: 'En tránsito',
  recibida_parcial: 'Recibida parcial',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
};

export const ESTADO_OC_COLORS: Record<EstadoOC, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  pendiente_aprobacion: 'bg-yellow-100 text-yellow-700',
  aprobada: 'bg-blue-100 text-blue-700',
  enviada_proveedor: 'bg-teal-100 text-teal-700',
  confirmada: 'bg-cyan-100 text-cyan-700',
  en_transito: 'bg-amber-100 text-amber-700',
  recibida_parcial: 'bg-purple-100 text-purple-700',
  recibida: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
};

export interface ItemOC {
  id: string;
  articuloId?: string | null;
  articuloCodigo?: string | null;
  descripcion: string;
  cantidad: number;
  cantidadRecibida: number;
  unidadMedida: string;
  precioUnitario?: number | null;
  moneda?: 'ARS' | 'USD' | 'EUR' | null;
  requerimientoId?: string | null;
  notas?: string | null;
}

export interface OrdenCompra {
  id: string;
  numero: string; // OC-0001
  tipo: TipoOC;
  estado: EstadoOC;
  // Proveedor
  proveedorId: string;
  proveedorNombre: string;
  // Proforma origen
  proformaNumero?: string | null;
  proformaUrl?: string | null;
  proformaNombre?: string | null;
  fechaProforma?: string | null;
  // Items
  items: ItemOC[];
  // Valores
  subtotal?: number | null;
  impuestos?: number | null;
  total?: number | null;
  moneda: 'ARS' | 'USD' | 'EUR';
  // Condiciones
  condicionesPago?: string | null;
  fechaEntregaEstimada?: string | null;
  // Vinculaciones legacy (mantener compatibilidad)
  presupuestoIds?: string[];
  // Recepcion
  fechaRecepcion?: string | null;
  // Importacion (link, no embed)
  importacionId?: string | null;
  // Archivos
  archivoUrl?: string | null;
  archivoNombre?: string | null;
  // Audit
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// --- Categoría de Presupuesto (reglas tributarias) ---
export interface CategoriaPresupuesto {
  id: string;
  nombre: string; // Ej: "Servicios técnicos", "Reparaciones", "Calibraciones"
  descripcion?: string;
  incluyeIva: boolean;
  porcentajeIva?: number; // 21, 10.5, etc.
  incluyeGanancias: boolean;
  porcentajeGanancias?: number;
  incluyeIIBB: boolean;
  porcentajeIIBB?: number;
  ivaReduccion?: boolean; // Si aplica reducción de IVA
  porcentajeIvaReduccion?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Condición de Pago (catálogo) ---
export interface CondicionPago {
  id: string;
  nombre: string; // Ej: "Contado contra entrega", "Diferido 7 días fecha de factura"
  dias: number; // Días de plazo
  descripcion?: string;
  activo: boolean;
}

// --- Concepto de Servicio (catálogo de precios) ---
export interface ConceptoServicio {
  id: string;
  codigo?: string | null; // Código de artículo/servicio (e.g., "MP1_CN_60", "CAL_GC_01")
  descripcion: string; // "Servicio de calibración GC MSD rango 30 km"
  valorBase: number; // Valor base en la moneda indicada
  moneda: MonedaPresupuesto; // USD por defecto
  factorActualizacion: number; // Multiplicador (default 1.0)
  categoriaPresupuestoId?: string | null; // FK para reglas impositivas
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
// Precio efectivo = valorBase * factorActualizacion

// --- Secciones visibles en PDF del presupuesto ---
export interface PresupuestoSeccionesVisibles {
  notasTecnicas?: boolean;
  notasAdministrativas?: boolean;
  garantia?: boolean;
  variacionTipoCambio?: boolean;
  condicionesComerciales?: boolean;
  aceptacionPresupuesto?: boolean;
}

export const PRESUPUESTO_SECCIONES_LABELS: Record<keyof PresupuestoSeccionesVisibles, string> = {
  notasTecnicas: 'Notas Técnicas',
  notasAdministrativas: 'Notas Administrativas',
  garantia: 'Garantía',
  variacionTipoCambio: 'Variación del Tipo de Cambio',
  condicionesComerciales: 'Condiciones Comerciales',
  aceptacionPresupuesto: 'Aceptación del Presupuesto',
};

export const PRESUPUESTO_SECCIONES_DEFAULT: PresupuestoSeccionesVisibles = {
  notasTecnicas: true,
  notasAdministrativas: true,
  garantia: true,
  variacionTipoCambio: true,
  condicionesComerciales: true,
  aceptacionPresupuesto: true,
};

// --- Cuotas de Presupuesto ---
export interface PresupuestoCuota {
  numero: number;          // 1, 2, 3...
  moneda: 'USD' | 'ARS' | 'EUR';
  monto: number;
  descripcion?: string;    // ej: "Cuota 1/12"
}

/**
 * Datos de entrega e instalación — solo aplica cuando `Presupuesto.tipo === 'ventas'`.
 * Se muestra en el editor en sección dedicada (`VentasMetadataSection`) y se renderiza
 * en el PDF antes del detalle de items. Todos los campos son opcionales para permitir
 * save incremental del borrador (el vendedor completa mientras negocia).
 *
 * Phase 10 (10-01). Precedente estructural: contratoFechaInicio / contratoFechaFin
 * agrupados bajo un sub-objeto en vez de contaminar el root de Presupuesto.
 */
export interface VentasMetadata {
  /** ISO date string — fecha estimada de entrega del equipo. */
  fechaEstimadaEntrega?: string | null;
  /** Dirección libre donde se instalará. Puede diferir del establecimiento declarado. */
  lugarInstalacion?: string | null;
  /** Si el cliente requiere entrenamiento post-instalación (bench/usuario). */
  requiereEntrenamiento?: boolean;
}

// --- Presupuestos ---
export interface Presupuesto {
  id: string;
  numero: string; // PRE-0000 (generado automáticamente)
  tipo: TipoPresupuesto;
  moneda: MonedaPresupuesto;
  clienteId: string; // CUIT o LEGACY-xxx
  establecimientoId?: string | null;
  sistemaId?: string | null;
  contactoId?: string | null;
  // --- Origen ---
  origenTipo?: OrigenPresupuesto | null;
  origenId?: string | null;
  origenRef?: string | null; // Referencia visible (ej: "SC-74001", "OT-25660")
  // --- Estado y workflow ---
  estado: PresupuestoEstado;
  items: PresupuestoItem[];
  subtotal: number;
  total: number;
  tipoCambio?: number;
  condicionPagoId?: string;
  ordenesCompraIds: string[];
  ordenCompraNumero?: string | null; // Número de OC del cliente (ej: "O-000100445302")
  adjuntos: AdjuntoPresupuesto[];
  // --- Textos / Condiciones ---
  notasTecnicas?: string | null;
  notasAdministrativas?: string | null;
  garantia?: string | null;
  variacionTipoCambio?: string | null;
  condicionesComerciales?: string | null;
  aceptacionPresupuesto?: string | null;
  /** Secciones visibles en el PDF (clave=sección, valor=visible) */
  seccionesVisibles?: PresupuestoSeccionesVisibles | null;
  // --- Fechas y validez ---
  validezDias: number; // Días de validez (default 15)
  validUntil?: string;
  fechaEnvio?: string;
  // --- Seguimiento ---
  proximoContacto?: string | null; // ISO date para próximo follow-up
  responsableId?: string | null;
  responsableNombre?: string | null;
  // --- Revisiones ---
  version?: number; // Número de revisión (1, 2, 3...). Default 1.
  presupuestoOrigenId?: string | null; // ID del presupuesto desde el cual se creó esta revisión
  motivoAnulacion?: string | null; // Razón de anulación (al ser reemplazado por revisión)
  anuladoPorId?: string | null; // ID de la revisión que reemplazó a este presupuesto
  // --- OT vinculada ---
  /** @deprecated Mantener para compat: refleja la última OT creada. Usar otsVinculadasNumbers para la lista completa. */
  otVinculadaNumber?: string | null;
  /** Lista de números de OT generadas desde este presupuesto (un presupuesto contrato puede generar N OTs). */
  otsVinculadasNumbers?: string[] | null;
  // --- Facturación ---
  facturacionEstado?: 'pendiente' | 'parcial' | 'completa' | null;
  /** OTs vinculadas que llegaron a CIERRE_ADMINISTRATIVO y todavía no fueron
   *  incluidas en una solicitudFacturacion. El admin del ppto las agrupa
   *  manualmente para generar el aviso de facturación. */
  otsListasParaFacturar?: string[];
  // --- Cuotas ---
  cuotas?: PresupuestoCuota[] | null;
  cantidadCuotas?: number | null;
  /** Cantidad de cuotas por moneda. Soporta cuotas asimétricas (ej: {USD: 12, ARS: 10}). Si null, usa cantidadCuotas para todas. */
  cantidadCuotasPorMoneda?: Record<string, number> | null;
  // --- Vigencia del contrato (distinto de validezDias que es la oferta) ---
  /** Fecha de inicio de vigencia del contrato (ISO). Solo aplica para tipo === 'contrato'. */
  contratoFechaInicio?: string | null;
  /** Fecha de fin de vigencia del contrato (ISO). Solo aplica para tipo === 'contrato'. */
  contratoFechaFin?: string | null;
  /** Datos de entrega e instalación — solo aplica para tipo === 'ventas'. Ver VentasMetadata. */
  ventasMetadata?: VentasMetadata | null;
  // --- Flujo Automático de Derivación (Phase 8) ---
  /** Acciones automáticas que no pudieron completarse en el momento del disparo. Se resuelven manual/automáticamente desde `/admin/acciones-pendientes`. */
  pendingActions?: PendingAction[];
  // --- Audit ---
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Plantilla de Tipo de Equipo ---
// Usado en presupuestos de contrato para autogenerar items de sistemas
// con sus componentes S/L y servicios estándar.
// =============================================

export type TipoServicioPlantilla = 'mantenimiento' | 'regulatorio' | 'consumible' | 'otro';

/** Componente S/L de un sistema (sin cargo, solo trazabilidad). */
export interface TipoEquipoComponente {
  id: string;
  orden: number;                    // Sub-orden dentro del sistema (ej: 2 = X.2, 3 = X.3)
  codigo: string;                   // Part number Agilent (ej: "G1322A")
  descripcion: string;               // "Desgasificador Estándar - HPLC 1100"
  servicioCode?: string | null;     // Código servicio interno (ej: "AT1_DEG_11A")
}

/** Servicio estándar aplicable a un tipo de equipo (con precio editable al cotizar). */
export interface TipoEquipoServicio {
  id: string;
  orden: number;                    // Sub-orden (ej: 10 = X.10, 11 = X.11, 20 = X.20)
  servicioCode: string;             // "MP1_CN_11B"
  descripcion: string;              // "Mantenimiento Preventivo - HPLC 1100 Con ALS"
  cantidadDefault: number;          // 1, 2... (0 = S/L)
  tipo: TipoServicioPlantilla;
  precioDefault?: number | null;    // Precio sugerido (opcional)
}

/** Plantilla completa de un tipo de equipo. */
export interface TipoEquipoPlantilla {
  id: string;
  nombre: string;                   // "HPLC 1100", "UV/VIS 8453", "GC 6890"
  descripcion?: string | null;      // Descripción larga opcional
  activo: boolean;
  componentes: TipoEquipoComponente[];
  servicios: TipoEquipoServicio[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export const TIPO_SERVICIO_PLANTILLA_LABELS: Record<TipoServicioPlantilla, string> = {
  mantenimiento: 'Mantenimiento',
  regulatorio: 'Regulatorio',
  consumible: 'Consumible',
  otro: 'Otro',
};

// --- Facturación ---

export type SolicitudFacturacionEstado = 'pendiente' | 'enviada' | 'facturada' | 'cobrada' | 'anulada';

export const SOLICITUD_FACTURACION_ESTADO_LABELS: Record<SolicitudFacturacionEstado, string> = {
  pendiente: 'Pendiente',
  enviada: 'Enviada',                   // nueva — mail al contable ya fue disparado
  facturada: 'Facturada',
  cobrada: 'Cobrada',
  anulada: 'Anulada',
};

export const SOLICITUD_FACTURACION_ESTADO_COLORS: Record<SolicitudFacturacionEstado, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  enviada: 'bg-blue-100 text-blue-800',   // nueva — color neutro "en progreso"
  facturada: 'bg-blue-100 text-blue-700',
  cobrada: 'bg-emerald-100 text-emerald-700',
  anulada: 'bg-slate-200 text-slate-500',
};

export interface FacturaItem {
  id: string;
  presupuestoItemId: string;
  descripcion: string;
  cantidad: number;
  cantidadTotal: number;
  precioUnitario: number;
  subtotal: number;
}

export interface SolicitudFacturacion {
  id: string;
  presupuestoId: string;
  presupuestoNumero: string;
  clienteId: string;
  clienteNombre: string;
  condicionPago: string;
  items: FacturaItem[];
  montoTotal: number;
  moneda: MonedaPresupuesto;
  estado: SolicitudFacturacionEstado;
  observaciones?: string | null;
  otNumbers?: string[] | null;
  // Datos de la factura emitida (carga admin/contable)
  numeroFactura?: string | null;
  fechaFactura?: string | null;
  tipoComprobante?: string | null;
  puntoVenta?: string | null;
  cae?: string | null;
  fechaVencimientoCae?: string | null;
  fechaCobro?: string | null;
  // --- Phase 10 (10-01) — aviso facturación automático desde cerrarAdministrativamente ---
  /** OCs del cliente vinculadas. Back-ref al momento del cierre admin — no se mantiene sync con el ppto. */
  ordenesCompraIds?: string[] | null;
  /** ISO timestamp cuando el mail al contable fue marcado como enviado (estado 'enviada'). */
  enviadaAt?: string | null;
  // Audit
  solicitadoPor?: string | null;
  solicitadoPorNombre?: string | null;
  facturadoPor?: string | null;
  facturadoPorNombre?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  partId: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

// Alias para compatibilidad: equipo = sistema
export type Equipo = Sistema;

// --- Biblioteca de Tablas (TableCatalog) ---

export type TableCatalogColumnType =
  | 'text_input'
  | 'number_input'
  | 'checkbox'
  | 'fixed_text'
  | 'date_input'
  | 'pass_fail'
  | 'select_input'
  | 'multi_select';

export interface TableCatalogColumn {
  key: string;
  label: string;
  type: TableCatalogColumnType;
  unit?: string | null;
  required: boolean;
  expectedValue?: string | null;
  /** Admin-defined fixed value shown to techs (for type='fixed_text') */
  fixedValue?: string | null;
  /** Opciones para columnas tipo 'select_input' (menú desplegable). */
  options?: string[];
  /** Ancho de la columna en mm. Si no se define, se distribuye automáticamente. */
  width?: number | null;
  /** Alineación del texto en la columna. Por defecto 'center'. */
  align?: 'left' | 'center' | 'right' | null;
  /** Cuando es true, la columna actúa como etiqueta fija: las filas con valor vacío muestran celda en blanco. */
  isLabelColumn?: boolean;
  /**
   * Si true, la columna arranca oculta en reportes-ot. El ingeniero puede mostrarla por instancia
   * vía el toggle de visibilidad de columnas. Los datos se siguen almacenando (fórmulas funcionan).
   */
  hiddenByDefault?: boolean;
  /**
   * Para multi_select: referencia a otra tabla del protocolo para obtener opciones dinámicas.
   * tableName = nombre exacto de la tabla fuente; columnKey = key de la columna cuyos valores se usan como opciones.
   * Si no se define, usa `options[]` estáticas.
   */
  optionsFromTable?: { tableName: string; columnKey: string } | null;
  /**
   * Si true, el encabezado de la columna muestra un input editable en paréntesis.
   * El ingeniero lo completa en la ejecución del protocolo. Útil para identificar
   * compuestos químicos o identificadores específicos por columna.
   * Ejemplo visual: "Valor medido (Benzaldehído)"
   */
  headerEditable?: boolean;
  /** Max caracteres del input editable del encabezado. Default: 15. */
  headerEditableMaxLength?: number | null;
}

export interface TableCatalogRow {
  rowId: string;
  cells: Record<string, string | number | boolean | null>;
  /** True = full-width section title row; uses titleText instead of cells */
  isTitle?: boolean;
  titleText?: string | null;
  /** True = full-width selector row; shows selectorLabel + dropdown with selectorOptions */
  isSelector?: boolean;
  selectorLabel?: string | null;
  selectorOptions?: string[] | null;
  /**
   * Índice de columna donde se renderiza el dropdown del selector (0-based).
   * Default: 0 (label + dropdown juntos en la primera columna).
   * Si es > 0: la columna 0 muestra sólo el label, y selectorColumn muestra el dropdown.
   */
  selectorColumn?: number;
  /**
   * Visibilidad condicional: solo muestra esta fila cuando el headerField indicado tiene alguno de estos valores.
   * headerFieldId = fieldId de un TableHeaderField de la tabla; values = opciones que hacen visible esta fila.
   */
  visibleWhenSelector?: { headerFieldId: string; values: string[] } | null;
  /**
   * Cuando true, la fila se muestra por defecto aunque su visibleWhenSelector no matchee.
   * Útil para filas que deben aparecer siempre sin importar qué opción del selector se eligió.
   */
  defaultVisible?: boolean;
  /**
   * Variable del reporte que auto-rellena esta fila (ej. 'cliente.razonSocial').
   * Cuando está seteada, la columna de valor se resuelve automáticamente desde el contexto del reporte.
   */
  variable?: string | null;
  /**
   * Unidad de medida por columna, específica para esta fila.
   * Sobreescribe la unidad definida en la columna (col.unit).
   * Ej: { resultado: 'mAU/h' } → esa celda muestra 'mAU/h' en lugar de la unidad global.
   */
  cellUnits?: Record<string, string> | null;
  /**
   * @deprecated Usar `columnSpans` para span por columna independiente.
   * Cuántas filas consecutivas (incluyendo esta) abarcan las columnas indicadas en spanColumns.
   */
  rowSpan?: number;
  /** @deprecated Usar `columnSpans`. Column keys que se fusionan verticalmente cuando rowSpan > 1 */
  spanColumns?: string[];
  /**
   * Span por columna independiente. Cada key es un column key, cada value es cuántas filas abarca.
   * Ej: { detector: 6, valor_nominal: 2 } → "detector" abarca 6 filas, "valor_nominal" abarca 2.
   * Reemplaza rowSpan+spanColumns permitiendo spans distintos por columna en la misma fila.
   */
  columnSpans?: Record<string, number>;
  /**
   * Si es true, el técnico puede duplicar esta fila al llenar el protocolo (p.ej. agregar
   * un segundo "Inyector automático"). Las filas duplicadas se guardan en el reporte de la OT
   * y no modifican la plantilla de la biblioteca.
   */
  duplicableEnProtocolo?: boolean;
  /**
   * Si true, la celda de la columna pass_fail para esta fila se edita manualmente
   * (dropdown Cumple / No cumple / N/A), ignorando cualquier vs_spec rule que
   * pudiera aplicar. Útil para filas de observación visual donde no hay validación
   * automática posible.
   */
  manualConclusion?: boolean;
}

export interface TableCatalogRule {
  ruleId: string;
  description: string;
  sourceColumn: string;
  /**
   * '<=' | '>=' | '<' | '>' | '==' | '!=' : compare sourceColumn value against factoryThreshold
   * 'vs_spec' : compare sourceColumn (Resultado) value against the per-row value in specColumn (Especificación)
   * 'compute' : targetColumn = sourceColumn {computeOperator} operandColumn (arithmetic between columns)
   */
  operator: '<=' | '>=' | '<' | '>' | '==' | '!=' | 'vs_spec' | 'compute';
  /** Fixed numeric/string threshold. For 'vs_spec', stores the specColumn key as a human-readable reference. */
  factoryThreshold: string | number;
  /** For 'vs_spec': key of the column that holds the expected spec value per row. */
  specColumn?: string | null;
  /** For 'vs_spec' with ± specs: key of the column that holds the nominal/reference value.
   *  When spec is "±X", conclusion = |resultado - nominal| <= X instead of |resultado| <= X. */
  referenceColumn?: string | null;
  unit?: string | null;
  targetColumn: string;
  valueIfPass: string;
  valueIfFail: string;
  /** For 'compute': key of the second operand column. */
  operandColumn?: string | null;
  /** For 'compute': arithmetic operator to apply. targetColumn = sourceColumn {op} operandColumn.
   *  'abs_diff': targetColumn = |sourceColumn - operandColumn/constant| (valor absoluto de la diferencia) */
  computeOperator?: '+' | '-' | '*' | '/' | 'abs_diff' | null;
  /**
   * Override de umbral por fila. Clave = rowId, valor = umbral específico para esa fila.
   * Si un rowId no está presente, se usa factoryThreshold como fallback.
   * Aplica a operadores estándar (<=, >=, etc.) y a reglas compute con operando constante.
   */
  rowThresholds?: Record<string, string | number> | null;
  /**
   * Filas a las que aplica esta regla. Si es null/undefined/vacío, aplica a TODAS las filas.
   * Permite tener reglas distintas para subconjuntos de filas (ej. una regla para filas 1-3, otra para 4-6).
   */
  applicableRowIds?: string[] | null;
}

// --- Checklist types (para tableType: 'checklist') ---

/**
 * Tipo de interacción de cada ítem de checklist:
 * - 'checkbox'        : tarea simple para tildar
 * - 'value_input'     : campo con etiqueta y unidad opcional (ej. "Nro. de serie: ___")
 * - 'pass_fail'       : resultado con opciones CUMPLE / NO_CUMPLE / NA
 * - 'selector'        : menú desplegable con opciones predefinidas
 * - 'embedded_table'  : tabla informacional embebida (solo lectura para el técnico)
 */
export type ChecklistItemType = 'checkbox' | 'value_input' | 'pass_fail' | 'selector' | 'embedded_table';

export interface ChecklistItem {
  /** ID estable dentro del checklist (ej. "item_001") */
  itemId: string;
  /** Texto descriptivo del ítem */
  label: string;
  /** Tipo de interacción */
  itemType: ChecklistItemType;
  /** Unidad sufijo para value_input (ej. "bar", "hs.") */
  unit?: string | null;
  /**
   * Nivel de indentación visual:
   * 0 = cabecera de sección (divider bold, no interactivo)
   * 1 = sección numerada principal (ej. "1. Sistema general")
   * 2 = sub-sección (ej. "3.1 Bomba")
   * 3 = sub-sub-sección (ej. "3.2.a Inyector manual")
   */
  depth: 0 | 1 | 2 | 3 | 4;
  /** Si true, el técnico puede marcar esta sección como "No Aplica" */
  canBeNA?: boolean;
  /** Prefijo numérico visible (ej. "3.2.a") */
  numberPrefix?: string | null;
  /** Opciones para itemType 'selector' (ej. ["FID", "ECD", "FPD"]) */
  selectorOptions?: string[] | null;
  /** Condición de visibilidad:
   *  - Selector: solo se muestra si el selector referenciado tiene alguno de los valores indicados
   *  - Checkbox: solo se muestra si el checkbox referenciado tiene el estado indicado en whenChecked */
  visibleWhen?:
    | { selectorItemId: string; values: string[] }
    | { checkboxItemId: string; whenChecked: boolean }
    | null;
  /** Para checkbox: activa un campo de valor junto al checkbox. */
  showLinkedValue?: boolean;
  /** Etiqueta del campo vinculado (ej. "Cantidad"). Vacío = sin etiqueta, solo el input. */
  linkedValueLabel?: string | null;
  /** Unidad del campo vinculado (ej. "unid.", "ml") */
  linkedValueUnit?: string | null;
  /** Si true, el campo de valor se muestra siempre (no solo al tildar el checkbox). */
  alwaysShowValue?: boolean;
  /** Para checkbox: qué fecha de la OT mostrar junto al checkbox.
   *  'inicio' = fecha realización; 'fin' = fecha finalización; 'both' = ambas; null/undefined = sin fecha */
  showDate?: 'inicio' | 'fin' | 'both' | null;
  /** Etiqueta personalizada para la fecha (ej. "Fecha de calibración"). Default según modo. */
  dateLabel?: string | null;
  /** Para checkbox: qué firmas mostrar junto al checkbox.
   *  'both' = ingeniero + cliente; 'client' = solo cliente; 'engineer' = solo ingeniero; null/undefined = sin firmas */
  showSignatures?: 'both' | 'client' | 'engineer' | null;
  /** Si false, oculta el label/nombre del ítem en el protocolo impreso. Default true. */
  showLabel?: boolean;
  /** Columnas de la tabla embebida (solo para itemType 'embedded_table').
   *  Si `options` está definido, la celda se renderiza como selector en vez de texto fijo. */
  embeddedColumns?: {
    key: string;
    label: string;
    options?: string[] | null;
    /** Cómo mostrar las opciones: 'select' (desplegable) o 'radio' (botones radio inline). Default: 'select'. */
    displayAs?: 'select' | 'radio' | null;
    /** Nombre del grupo padre. Columnas con el mismo group comparten un header agrupado (colspan). */
    group?: string | null;
    /** Si true, esta columna actúa como cabecera de fila (bold, alineada a la izquierda). */
    isRowHeader?: boolean;
  }[] | null;
  /** Filas de la tabla embebida (solo para itemType 'embedded_table'). Cada entrada mapea column key → valor. */
  embeddedRows?: Record<string, string>[] | null;
}

/** Respuesta del técnico para un ítem de checklist */
export type ChecklistItemAnswer =
  | { itemType: 'checkbox'; checked: boolean; linkedValue?: string }
  | { itemType: 'value_input'; value: string }
  | { itemType: 'pass_fail'; result: 'CUMPLE' | 'NO_CUMPLE' | 'NA' | '' }
  | { itemType: 'selector'; selected: string }
  | { itemType: 'embedded_table'; cells: Record<string, string>[] };

/** Campo de encabezado que se muestra arriba de la tabla para que el técnico seleccione una opción. */
export interface TableHeaderField {
  fieldId: string;
  label: string;
  /** Opciones para inputType='select' (legacy: required si inputType omitido o 'select') */
  options: string[];
  /** Tipo de input. Default: 'select' (dropdown con options). 'number' renderiza input numérico. */
  inputType?: 'select' | 'number';
  /**
   * Permite seleccionar múltiples valores (solo aplica a inputType='select').
   * Cuando es true, el valor en headerData se guarda como JSON array.
   * Las filas con visibleWhenSelector apuntando a este field se muestran si cualquiera
   * de los valores seleccionados coincide, y se agrupan visualmente por valor.
   */
  multiSelect?: boolean;
  /**
   * Si true, este multiSelect NO actúa como agrupador visual (no muestra los dividers teal).
   * Usar cuando el multiSelect se usa como toggle de visibilidad para filas opcionales,
   * en vez de como separador de sub-tablas por instancia.
   */
  suppressGrouping?: boolean;
  /**
   * Si true, este header field NO se muestra en modo print/PDF (ni en preview de impresión).
   * Útil para selectores que solo sirven para condicionar filas durante la carga del protocolo
   * pero no deben aparecer en el documento final.
   */
  hideInPrint?: boolean;
  /** Unidad a mostrar al lado del input numérico (ej. "mAU", "%") */
  unit?: string | null;
  /** Placeholder opcional para inputs numéricos */
  placeholder?: string | null;
  /**
   * Visibilidad condicional: solo muestra este header field cuando otro headerField
   * (por fieldId) tiene alguno de estos valores. Útil ej: mostrar "Ruido" solo si
   * Combinación = SSL+ECD | SSL+µECD.
   */
  visibleWhenSelector?: { headerFieldId: string; values: string[] } | null;
}

export interface TableCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  sysType: string;
  isDefault: boolean;
  tableType: 'validation' | 'informational' | 'instruments' | 'checklist' | 'text' | 'signatures' | 'cover';
  columns: TableCatalogColumn[];
  templateRows: TableCatalogRow[];
  validationRules: TableCatalogRule[];
  /**
   * Cuando es `true`, el ingeniero puede activar "Ver especificación del cliente":
   * el valor de fábrica (templateRows) se muestra como referencia y el ingeniero
   * escribe su propia especificación, que es la que se usa para calcular Conclusión.
   */
  allowClientSpec?: boolean;
  /** Si `true`, el ingeniero puede agregar filas vacías extra durante la ejecución del protocolo. */
  allowExtraRows?: boolean;
  /**
   * Tipos de servicio con los que se asocia esta tabla (ej. "Calificación de operación").
   * Si está vacío o ausente, la tabla no se filtra por servicio y aparece siempre.
   */
  tipoServicio?: string[];
  /**
   * Modelos de equipo aplicables (ej. "HPLC 1260", "1290 Inf. II").
   * Si está vacío o ausente, la tabla aplica a todos los modelos de su sysType.
   */
  modelos?: string[];
  /**
   * Posición de la tabla en el protocolo. Menor = aparece primero.
   * Si no se asigna (0 o undefined), la tabla se ordena al final.
   */
  orden?: number;
  /**
   * Ítems del checklist (solo cuando tableType === 'checklist').
   */
  checklistItems?: ChecklistItem[];
  /**
   * Contenido de texto libre (solo cuando tableType === 'text').
   * Se usa para declarar objetivos, alcances, procedimientos, etc.
   */
  textContent?: string | null;
  /**
   * Modo de visualización del texto en el protocolo (solo tableType === 'text').
   * 'card' = con encabezado y borde (default); 'inline' = texto suelto sin recuadro.
   */
  textDisplayMode?: 'card' | 'inline';
  /**
   * Campos de encabezado que se muestran arriba de la tabla (ej. selector de inyector).
   * El técnico elige una opción por campo antes de completar la tabla.
   */
  headerFields?: TableHeaderField[];
  /**
   * Qué firmas mostrar en el bloque (solo tableType === 'signatures').
   * 'both' = ambas (default); 'client' = solo cliente; 'engineer' = solo ingeniero.
   */
  signatureMode?: 'both' | 'client' | 'engineer';
  /**
   * Qué fecha de hoja 1 mostrar en el bloque (solo tableType === 'signatures').
   * 'none' = sin fecha (default); 'inicio' = fecha inicio; 'fin' = fecha fin; 'both' = ambas.
   */
  showDate?: 'none' | 'inicio' | 'fin' | 'both';
  /** Texto personalizado que acompaña la fecha (ej. "Fecha de calibración"). */
  dateLabel?: string | null;
  /** Si false, oculta la barra de título (nombre + badges) en la vista del protocolo. Default true. */
  showTitle?: boolean;
  /** Si true, este bloque se fusiona visualmente con la tabla anterior (misma unidad de paginación). */
  attachToPrevious?: boolean;
  /** Si true, este bloque se mantiene en la misma página que la tabla siguiente. */
  attachToNext?: boolean;
  /** Título que aparece en el header de cada página del protocolo (ej. "Protocolo de verificación GC-MS"). */
  headerTitle?: string | null;
  /** Número de formulario de calidad para el footer (ej. "QF-AGS-012 Rev.01"). */
  footerQF?: string | null;
  /**
   * Modo de visualización compacto: la tabla se renderiza igual que la tabla de instrumentos
   * (text-[10px], px-2 py-1, inputs inline sin borde prominente). Ideal para tablas manuales
   * como "Solventes" que deben verse igual que las tablas auto-generadas.
   */
  compactDisplay?: boolean;
  /**
   * Tamaño de texto del contenido de las celdas (en px). Si no se define, usa el default del tipo de tabla.
   * Presets UI: 11 (Normal) / 13 (Mediano) / 15 (Grande) / 17 (Muy grande).
   */
  fontSize?: number | null;
  /**
   * Título que abarca TODAS las columnas como primera fila del header.
   * Ej: "Configuración de sistema" → <th colspan=N> en la primera fila.
   */
  columnGroupTitle?: string | null;
  /**
   * Grupos de columnas para cabeceras multi-nivel.
   * Genera una fila extra de <th> con colspan. Las columnas no agrupadas ocupan rowSpan=2.
   * Ej: [{ label: 'ALS', startCol: 4, span: 2 }] → "ALS" abarca columnas 4 y 5.
   */
  columnGroups?: { label: string; startCol: number; span: number }[];
  /** Número QF de la carátula (solo tableType === 'cover'). Ej: "QF7.0506" */
  coverQF?: string | null;
  /** Revisión de la carátula (solo tableType === 'cover'). Ej: "Rev. 09" */
  coverRevision?: string | null;
  /** Fecha de emisión de la carátula (solo tableType === 'cover'). Ej: "01/03/2026" */
  coverFecha?: string | null;
  /** FK a /tableProjects/{projectId}. Agrupa tablas en un proyecto. */
  projectId?: string | null;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Proyecto que agrupa tablas del catálogo (ej. "Calificación OQ HPLC"). */
export interface TableProject {
  id: string;
  name: string;
  description?: string | null;
  sysType?: string | null;
  /** Título del protocolo aplicable a todas las tablas del proyecto (ej. "Protocolo de verificación GC-MS"). */
  headerTitle?: string | null;
  /** Número QF aplicable a todas las tablas del proyecto (ej. "QF-AGS-012 Rev.01"). */
  footerQF?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// --- Selecciones de protocolo (tablas completadas por el técnico en una OT) ---

/** Una tabla/checklist del catálogo completada por el técnico durante la ejecución de una OT. */
export interface ProtocolSelection {
  /** FK a /tableCatalog/{tableId} */
  tableId: string;
  /** Nombre de la tabla al momento de seleccionar */
  tableName: string;
  /** Snapshot de la definición al momento de seleccionar (para renderizar sin Firestore) */
  tableSnapshot: TableCatalogEntry;
  /** Filas completadas. key = rowId, value = Record<colKey, value> (solo para tableType != 'checklist') */
  filledData: Record<string, Record<string, string>>;
  observaciones?: string | null;
  resultado: 'CONFORME' | 'NO_CONFORME' | 'PENDIENTE';
  seleccionadoAt: string;
  /** Si el cliente provee especificaciones propias (modo vs_spec con spec editable) */
  clientSpecEnabled?: boolean;
  /** Respuestas del técnico para checklists (tableType === 'checklist') */
  checklistData?: Record<string, ChecklistItemAnswer>;
  /** itemIds de secciones marcadas "No Aplica" por el técnico */
  collapsedSections?: string[];
  /** Valores seleccionados en los campos de encabezado (fieldId → valor) */
  headerData?: Record<string, string>;
  /**
   * Override de visibilidad por columna para esta instancia. Si no está la key,
   * se usa `!col.hiddenByDefault`. true = visible, false = oculta.
   */
  columnVisibility?: Record<string, boolean>;
  /**
   * Valor editable del encabezado de cada columna marcada con `headerEditable`.
   * key = col.key, value = texto que escribe el ingeniero en la ejecución.
   */
  columnHeaderData?: Record<string, string>;
  /**
   * Datos de encabezado por instancia cuando el primer header multiSelect actúa como divisor.
   * key = valor de la instancia (ej. "µECD (1Hz=1UD)"), value = headerData de esa sub-tabla.
   * Solo se usa cuando hay un header multiSelect con múltiples valores seleccionados.
   * Fallback: si no existe, se usa headerData global.
   */
  instanceHeaderData?: Record<string, Record<string, string>>;
  /**
   * Toggle de especificaciones del cliente por instancia.
   * key = valor de la instancia, value = true/false.
   */
  instanceClientSpec?: Record<string, boolean>;
}

// --- RenderSpec (especificación determinística para regenerar el PDF) ---

/**
 * Guarda todo lo necesario para regenerar el PDF de una OT sin PDF binario.
 * Colección: /workorders/{otNumber}/renderSpec/current
 */
export interface RenderSpec {
  otNumber: string;
  /** Versión del template de Hoja 1 (incrementar si hay breaking change en Layout.tsx) */
  templateVersion: string;
  /** Versión del schema de protocolo usada al guardar */
  protocolVersion: string;
  /** Versión del motor PDF (ej: "html2pdf-0.10") */
  rendererVersion: string;
  /** Snapshot completo de WorkOrder al momento del guardado (protege contra renombres) */
  workOrderSnapshot: WorkOrder;
  /** Tablas completadas por el técnico. null si el tipo de servicio no requiere protocolo */
  protocolSelections: ProtocolSelection[] | null;
  /** IDs de documentos en /adjuntos vinculados a esta OT */
  adjuntosIds: string[];
  savedAt: string;
  savedBy: string;
  updatedAt: string;
}

// --- Adjuntos (fotos y archivos vinculados a una OT) ---

/** Metadata de un adjunto. El binario vive en Firebase Storage. */
export interface Adjunto {
  id: string;
  otNumber: string;
  tipo: 'foto' | 'archivo';
  /** Ruta en Firebase Storage: "adjuntos/{otNumber}/{fileName}" */
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
  /** Orden de aparición en el PDF (Hoja 3/4) */
  orden: number;
  uploadedAt: string;
  uploadedBy: string;
}

// --- Marcas (catálogo compartido) ---

export interface Marca {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Instrumentos y Patrones (Fase 5) ---

/** Categoría funcional del instrumento */
export type CategoriaInstrumento =
  | 'termometro'
  | 'manometro'
  | 'flujimetro_gases'
  | 'flujimetro_liquidos';

export const CATEGORIA_INSTRUMENTO_LABELS: Record<CategoriaInstrumento, string> = {
  termometro: 'Termómetro',
  manometro: 'Manómetro',
  flujimetro_gases: 'Flujímetro de gases',
  flujimetro_liquidos: 'Flujímetro de líquidos',
};

/** Categoría funcional del patrón (tipo de equipo al que aplica) */
export type CategoriaPatron =
  | 'gc'
  | 'hplc'
  | 'uv'
  | 'osmometro'
  | 'polarimetro';

export const CATEGORIA_PATRON_LABELS: Record<CategoriaPatron, string> = {
  gc: 'GC',
  hplc: 'HPLC',
  uv: 'UV',
  osmometro: 'Osmómetro',
  polarimetro: 'Polarímetro',
};

/** Estado del certificado (calculado en runtime, no se persiste) */
export type EstadoCertificado = 'vigente' | 'por_vencer' | 'vencido' | 'sin_certificado';

/** Calcula el estado del certificado según la fecha de vencimiento */
export function calcularEstadoCertificado(
  vencimiento: string | null | undefined,
  diasAlerta: number = 30
): EstadoCertificado {
  if (!vencimiento) return 'sin_certificado';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(vencimiento);
  venc.setHours(0, 0, 0, 0);
  if (venc < hoy) return 'vencido';
  const diffDias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias <= diasAlerta) return 'por_vencer';
  return 'vigente';
}

/** Instrumento o Patrón de referencia con certificado vinculado */
export interface InstrumentoPatron {
  id: string;
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;
  tipo: 'instrumento' | 'patron';
  categorias: (CategoriaInstrumento | CategoriaPatron)[];
  /** URL pública del certificado PDF en Firebase Storage */
  certificadoUrl?: string | null;
  certificadoNombre?: string | null;
  /** Ruta en Storage: certificados/{instrumentoId}/{fileName} */
  certificadoStoragePath?: string | null;
  certificadoEmisor?: string | null;
  certificadoFechaEmision?: string | null;
  /** Fecha de vencimiento (ISO string, null = sin vencimiento) */
  certificadoVencimiento?: string | null;
  /** URL del documento de trazabilidad PDF */
  trazabilidadUrl?: string | null;
  trazabilidadNombre?: string | null;
  trazabilidadStoragePath?: string | null;
  /** Código de lote (para patrones/estándares) */
  lote?: string | null;
  /** ID del instrumento al que reemplaza */
  reemplazaA?: string | null;
  /** ID del instrumento que lo reemplazó */
  reemplazadoPor?: string | null;
  /** Asignación actual (ingeniero) */
  asignadoAId?: string | null;
  asignadoANombre?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Patrones (colección separada de instrumentos) ---
// =============================================

/** Lote individual de un patrón, con su propio certificado y vencimiento */
export interface PatronLote {
  /** Código de lote del fabricante */
  lote: string;
  /** Fecha de vencimiento del lote (ISO string) */
  fechaVencimiento: string | null;
  /** Emisor del certificado */
  certificadoEmisor?: string | null;
  /** URL pública del certificado PDF */
  certificadoUrl?: string | null;
  /** Ruta en Storage */
  certificadoStoragePath?: string | null;
  /** Nombre original del archivo */
  certificadoNombre?: string | null;
  /** Fecha de emisión del certificado */
  certificadoFechaEmision?: string | null;
  /** Notas u observaciones del lote */
  notas?: string | null;
}

/**
 * Patrón de referencia (estándar/material de referencia).
 * Un patrón se identifica por código de artículo + descripción.
 * Puede tener múltiples lotes simultáneos, cada uno con su propio vencimiento y certificado.
 * Colección Firestore: `patrones`
 */
export interface Patron {
  id: string;
  /** Código de artículo del fabricante (ej. "8500-6917") */
  codigoArticulo: string;
  /** Descripción del patrón (ej. "Caffeine Standards Kit for LC/MS OQ/PV") */
  descripcion: string;
  /** Marca/fabricante */
  marca: string;
  /** Categorías funcionales a las que aplica */
  categorias: CategoriaPatron[];
  /** Lotes disponibles. Cada uno es una instancia física independiente. */
  lotes: PatronLote[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Columnas cromatográficas (GC, HPLC, etc.) ---
// =============================================

/** Unidad física individual de una columna, con su propio número de serie */
export interface ColumnaSerie {
  /** Número de serie físico */
  serie: string;
  /** Fecha de vencimiento del certificado (opcional, muchas columnas no tienen) */
  fechaVencimiento?: string | null;
  /** Emisor del certificado */
  certificadoEmisor?: string | null;
  /** URL pública del certificado PDF (opcional) */
  certificadoUrl?: string | null;
  /** Ruta en Storage */
  certificadoStoragePath?: string | null;
  /** Nombre original del archivo */
  certificadoNombre?: string | null;
  /** Notas u observaciones (estado, horas de uso, etc.) */
  notas?: string | null;
}

/**
 * Columna cromatográfica (GC, HPLC).
 * Se identifica por código de artículo + descripción.
 * Puede tener múltiples unidades físicas (series) bajo el mismo código.
 * Colección Firestore: `columnas`
 */
export interface Columna {
  id: string;
  /** Código de artículo del fabricante */
  codigoArticulo: string;
  /** Descripción de la columna (dimensiones, fase, etc.) */
  descripcion: string;
  /** Marca/fabricante */
  marca: string;
  /** Categorías funcionales (normalmente 'gc' o 'hplc') */
  categorias: CategoriaPatron[];
  /** Unidades físicas disponibles, cada una con su serie */
  series: ColumnaSerie[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Módulo Stock ---
// =============================================

// --- Ingenieros (catálogo de técnicos/ingenieros de campo) ---

export type AreaIngeniero = 'campo' | 'taller' | 'electronica' | 'mecanica' | 'ventas' | 'admin';

export interface Ingeniero {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  area?: AreaIngeniero | null;
  activo: boolean;
  /** Firebase UID — vincula este ingeniero con su cuenta de Google (UsuarioAGS) */
  usuarioId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Certificado profesional de un ingeniero (PDF adjunto por categoría) */
export interface CertificadoIngeniero {
  id: string;
  ingenieroId: string;
  ingenieroNombre: string;
  categoria: CategoriaPatron;
  descripcion: string;
  certificadoUrl: string;
  certificadoNombre: string;
  certificadoStoragePath: string;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Proveedores ---

export type TipoProveedor = 'nacional' | 'internacional';

export interface Proveedor {
  id: string;
  nombre: string;
  tipo: TipoProveedor;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  pais?: string | null;
  cuit?: string | null;
  condicionesPago?: string | null;
  moneda?: 'ARS' | 'USD' | 'EUR' | null;
  // Datos bancarios (internacionales)
  banco?: string | null;
  cuentaBancaria?: string | null;
  swift?: string | null;
  iban?: string | null;
  bancoIntermediario?: string | null;
  swiftIntermediario?: string | null;
  abaIntermediario?: string | null;
  notas?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Calificación de Proveedores ---

export type EstadoCalificacion = 'aprobado' | 'condicional' | 'no_aprobado' | 'sin_datos';

export interface CriterioEvaluacion {
  id: string;
  nombre: string;
  pesoMax: number;
  puntaje: number;
}

/** Criterios estándar — pesos suman 100. */
export const CRITERIOS_DEFAULT: CriterioEvaluacion[] = [
  { id: 'conformidad', nombre: 'Conformidad técnica', pesoMax: 25, puntaje: 25 },
  { id: 'plazo', nombre: 'Plazo de entrega', pesoMax: 15, puntaje: 15 },
  { id: 'cantidad', nombre: 'Cantidad correcta', pesoMax: 10, puntaje: 10 },
  { id: 'documentacion', nombre: 'Documentación', pesoMax: 15, puntaje: 15 },
  { id: 'embalaje', nombre: 'Embalaje y presentación', pesoMax: 10, puntaje: 10 },
  { id: 'respuesta', nombre: 'Tiempo de respuesta', pesoMax: 15, puntaje: 15 },
  { id: 'precio', nombre: 'Precio facturado vs. cotizado', pesoMax: 10, puntaje: 10 },
];

export interface CalificacionProveedor {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  ordenCompraNro?: string | null;
  remitoNro?: string | null;
  /** YYYY-MM-DD */
  fechaRecepcion: string;
  criterios: CriterioEvaluacion[];
  puntajeTotal: number;
  estado: EstadoCalificacion;
  observaciones?: string | null;
  responsable: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// --- Posiciones de Stock (ubicaciones físicas) ---

export type TipoPosicionStock = 'cajonera' | 'estante' | 'deposito' | 'vitrina' | 'otro';

export interface PosicionStock {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipo: TipoPosicionStock;
  parentId?: string | null;
  zona?: string | null;
  orden?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Artículos (catálogo de partes — un registro por part number) ---

export type TipoArticulo = 'repuesto' | 'consumible' | 'equipo' | 'columna' | 'accesorio' | 'muestra' | 'otro';

export type CategoriaEquipoStock = 'HPLC' | 'GC' | 'MSD' | 'UV' | 'OSMOMETRO' | 'GENERAL';

export interface TratamientoArancelario {
  derechoImportacion?: number | null;
  estadistica?: number | null;
  iva?: number | null;
  ivaAdicional?: number | null;
  ganancias?: number | null;
  ingresosBrutos?: number | null;
}

export interface Articulo {
  id: string;
  /** Part number único */
  codigo: string;
  descripcion: string;
  categoriaEquipo: CategoriaEquipoStock;
  /** FK → marcas */
  marcaId: string;
  /** FK[] → proveedores */
  proveedorIds: string[];
  tipo: TipoArticulo;
  unidadMedida: string;
  /** Alerta cuando stock disponible < este valor */
  stockMinimo: number;
  posicionArancelaria?: string | null;
  tratamientoArancelario?: TratamientoArancelario | null;
  /** Precio de lista/referencia */
  precioReferencia?: number | null;
  monedaPrecio?: 'ARS' | 'USD' | null;
  notas?: string | null;
  /** Origen/procedencia del artículo (ej: "Nacional", "Importado") */
  origen?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
  /** Snapshot del stock extendido, poblado por Cloud Function (09-02). Optional — no breaking. */
  resumenStock?: StockAmplio | null;
}

// --- StockAmplio — 4-bucket extended stock shape (Phase 9) ---

export interface StockAmplioBreakdownEntry {
  id: string;
  cantidad: number;
  referencia?: string | null;  // presupuestoId | OC numero | null
}

export interface StockAmplio {
  disponible: number;
  enTransito: number;
  reservado: number;
  comprometido: number;
  breakdown: {
    // Reservas section deferred — kept optional so the Cloud Function / client fn
    // can omit it without breaking consumers. In v2.0 consumers render only
    // requerimientosCondicionales + ocsAbiertas sections (see 09-03 drawer).
    reservas?: StockAmplioBreakdownEntry[];
    requerimientosCondicionales: StockAmplioBreakdownEntry[];
    ocsAbiertas: StockAmplioBreakdownEntry[];
  };
  updatedAt?: string | null;  // ISO string when serialized; Timestamp.now() on CF write
}

// --- Unidades (instancia física de un artículo) ---

export type CondicionUnidad = 'nuevo' | 'bien_de_uso' | 'reacondicionado' | 'vendible' | 'scrap';

export type EstadoUnidad =
  | 'disponible'
  | 'reservado'
  | 'asignado'
  | 'en_transito'
  | 'consumido'
  | 'vendido'
  | 'baja';

export type TipoUbicacionStock = 'posicion' | 'minikit' | 'ingeniero' | 'cliente' | 'proveedor' | 'transito';

export interface UbicacionStock {
  tipo: TipoUbicacionStock;
  referenciaId: string;
  referenciaNombre: string;
}

export interface UnidadStock {
  id: string;
  /** FK → articulos */
  articuloId: string;
  /** Desnormalizado para queries rápidas */
  articuloCodigo: string;
  articuloDescripcion: string;
  nroSerie?: string | null;
  nroLote?: string | null;
  condicion: CondicionUnidad;
  estado: EstadoUnidad;
  ubicacion: UbicacionStock;
  costoUnitario?: number | null;
  monedaCosto?: 'ARS' | 'USD' | null;
  observaciones?: string | null;
  // --- Campos de reserva (añadidos Phase 01-stock-requerimientos-oc) ---
  reservadoParaPresupuestoId?: string | null;
  reservadoParaPresupuestoNumero?: string | null;
  reservadoParaClienteId?: string | null;
  reservadoParaClienteNombre?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// --- Minikits ---

export type EstadoMinikit = 'en_base' | 'en_campo' | 'en_transito' | 'en_revision';

export interface AsignacionMinikit {
  tipo: 'ingeniero' | 'ot';
  /** ingenieroId o otNumber */
  id: string;
  /** Desnormalizado para display */
  nombre: string;
  /** ISO */
  desde: string;
}

export interface Minikit {
  id: string;
  /** Código identificador (ej: "MKGC1") */
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  estado: EstadoMinikit;
  asignadoA?: AsignacionMinikit | null;
  templateId?: string | null;
  templateNombre?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// --- Plantillas de Minikit ---

export interface MinikitTemplateItem {
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  cantidadMinima: number;
  sector?: string | null;
}

export interface MinikitTemplate {
  id: string;
  nombre: string;
  descripcion?: string | null;
  sectores: string[];
  items: MinikitTemplateItem[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Asignaciones de Stock ---

export type TipoItemAsignacion = 'articulo' | 'minikit' | 'loaner' | 'instrumento' | 'dispositivo' | 'vehiculo';
export type EstadoItemAsignacion = 'asignado' | 'devuelto' | 'consumido';

export interface ItemAsignacion {
  id: string;
  tipo: TipoItemAsignacion;
  unidadId?: string | null;
  articuloId?: string | null;
  articuloCodigo?: string | null;
  articuloDescripcion?: string | null;
  cantidad: number;
  cantidadDevuelta: number;
  cantidadConsumida: number;
  minikitId?: string | null;
  minikitCodigo?: string | null;
  loanerId?: string | null;
  loanerCodigo?: string | null;
  instrumentoId?: string | null;
  instrumentoNombre?: string | null;
  instrumentoTipo?: 'instrumento' | 'patron' | null;
  dispositivoId?: string | null;
  dispositivoDescripcion?: string | null;
  vehiculoId?: string | null;
  vehiculoPatente?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  otNumber?: string | null;
  proposito?: string | null;
  estado: EstadoItemAsignacion;
  permanente: boolean;
  fechaAsignacion: string;
  fechaDevolucion?: string | null;
}

export type EstadoAsignacion = 'activa' | 'completada' | 'cancelada';

export interface Asignacion {
  id: string;
  numero: string;
  ingenieroId: string;
  ingenieroNombre: string;
  items: ItemAsignacion[];
  clienteId?: string | null;
  clienteNombre?: string | null;
  observaciones?: string | null;
  estado: EstadoAsignacion;
  remitoId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
}

// --- Movimientos de Stock (log inmutable de auditoría) ---

export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia' | 'consumo' | 'devolucion' | 'ajuste';

export type TipoOrigenDestino =
  | 'posicion'
  | 'minikit'
  | 'ingeniero'
  | 'proveedor'
  | 'cliente'
  | 'consumo_ot'
  | 'baja'
  | 'ajuste';

export interface MovimientoStock {
  id: string;
  tipo: TipoMovimiento;
  /** FK → unidades */
  unidadId: string;
  /** FK → articulos (desnormalizado) */
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  cantidad: number;
  origenTipo: TipoOrigenDestino;
  origenId: string;
  origenNombre: string;
  destinoTipo: TipoOrigenDestino;
  destinoId: string;
  destinoNombre: string;
  /** FK → remitos */
  remitoId?: string | null;
  /** FK → reportes (para consumos en OT) */
  otNumber?: string | null;
  motivo?: string | null;
  creadoPor: string;
  createdAt: string;
}

// --- Remitos (despachos digitales) ---

export type TipoRemito =
  | 'salida_campo'
  | 'entrega_cliente'
  | 'devolucion'
  | 'interno'
  | 'derivacion_proveedor'
  | 'loaner_salida';

export type EstadoRemito =
  | 'borrador'
  | 'confirmado'
  | 'en_transito'
  | 'completado'
  | 'completado_parcial'
  | 'cancelado';

export type TipoRemitoItem = 'sale_y_vuelve' | 'entrega';

export interface RemitoItem {
  id: string;
  unidadId: string;
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  cantidad: number;
  tipoItem: TipoRemitoItem;
  devuelto: boolean;
  fechaDevolucion?: string | null;
  /** Campos multi-tipo (opcionales, backward-compatible) */
  minikitId?: string | null;
  minikitCodigo?: string | null;
  instrumentoId?: string | null;
  instrumentoCodigo?: string | null;
  instrumentoDescripcion?: string | null;
  dispositivoId?: string | null;
  dispositivoCodigo?: string | null;
  dispositivoDescripcion?: string | null;
  vehiculoId?: string | null;
  vehiculoCodigo?: string | null;
  vehiculoDescripcion?: string | null;
  loanerId?: string | null;
  loanerCodigo?: string | null;
  loanerDescripcion?: string | null;
  /** Tipo de entidad origen (para display genérico) */
  tipoEntidad?: TipoItemAsignacion | null;
  /** Trazabilidad a la asignación */
  asignacionId?: string | null;
  asignacionItemId?: string | null;
}

export interface Remito {
  id: string;
  /** Número correlativo (REM-0001) */
  numero: string;
  tipo: TipoRemito;
  estado: EstadoRemito;
  /** FK → ingenieros */
  ingenieroId: string;
  /** Desnormalizado para display */
  ingenieroNombre: string;
  /** OTs asociadas */
  otNumbers?: string[];
  /** FK → clientes (para entregas) */
  clienteId?: string | null;
  clienteNombre?: string | null;
  items: RemitoItem[];
  observaciones?: string | null;
  fechaSalida?: string | null;
  fechaDevolucion?: string | null;
  /** FK → fichasPropiedad (para derivaciones o loaners) */
  fichaId?: string | null;
  fichaNumero?: string | null;
  /** FK → loaners (para salidas de loaner) */
  loanerId?: string | null;
  loanerCodigo?: string | null;
  /** FK → proveedores (para derivaciones a proveedor) */
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Ficha Propiedad del Cliente ---
// =============================================

export type EstadoFicha =
  | 'recibido'
  | 'en_diagnostico'
  | 'en_reparacion'
  | 'derivado_proveedor'
  | 'esperando_repuesto'
  | 'listo_para_entrega'
  | 'entregado';

export const ESTADO_FICHA_LABELS: Record<EstadoFicha, string> = {
  recibido: 'Recibido',
  en_diagnostico: 'En diagnóstico',
  en_reparacion: 'En reparación',
  derivado_proveedor: 'Derivado a proveedor',
  esperando_repuesto: 'Esperando repuesto',
  listo_para_entrega: 'Listo para entrega',
  entregado: 'Entregado',
};

export const ESTADO_FICHA_COLORS: Record<EstadoFicha, string> = {
  recibido: 'bg-blue-100 text-blue-800',
  en_diagnostico: 'bg-yellow-100 text-yellow-800',
  en_reparacion: 'bg-orange-100 text-orange-800',
  derivado_proveedor: 'bg-purple-100 text-purple-800',
  esperando_repuesto: 'bg-amber-100 text-amber-800',
  listo_para_entrega: 'bg-green-100 text-green-800',
  entregado: 'bg-slate-100 text-slate-600',
};

export type ViaIngreso = 'ingeniero' | 'envio' | 'cliente_directo';

export const VIA_INGRESO_LABELS: Record<ViaIngreso, string> = {
  ingeniero: 'Ingeniero de campo',
  envio: 'Envío / Transporte',
  cliente_directo: 'Cliente directo',
};

export interface AccesorioFicha {
  id: string;
  descripcion: string;
  cantidad: number;
}

export interface HistorialFicha {
  id: string;
  fecha: string;
  estadoAnterior: EstadoFicha;
  estadoNuevo: EstadoFicha;
  nota: string;
  otNumber?: string | null;
  reporteTecnico?: string | null;
  creadoPor: string;
}

export interface DerivacionProveedor {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  remitoSalidaId?: string | null;
  remitoRetornoId?: string | null;
  fechaEnvio?: string | null;
  fechaRetorno?: string | null;
  descripcion: string;
  estado: 'pendiente' | 'enviado' | 'recibido';
}

export interface RepuestoPendiente {
  id: string;
  leadId?: string | null;
  leadDescripcion?: string | null;
  ordenCompraId?: string | null;
  ordenCompraNumero?: string | null;
  descripcion: string;
  estado: 'pendiente' | 'en_proceso' | 'recibido';
}

/**
 * Momento del ciclo de vida en que se tomó la foto.
 * - 'ingreso': capturadas al recibir el equipo en planta (estado, rótulo, accesorios, daños).
 * - 'egreso': capturadas pre-embalaje, antes de imprimir el remito de devolución.
 * Optional para no romper fotos legacy.
 */
export type MomentoFotoFicha = 'ingreso' | 'egreso';

export const MOMENTO_FOTO_FICHA_LABELS: Record<MomentoFotoFicha, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
};

export interface FotoFicha {
  id: string;
  /** ID en Google Drive (sistema-modular Electron). Null si la foto vive en Firebase Storage. */
  driveFileId?: string | null;
  /** Path en Firebase Storage (portal-ingeniero móvil). Null si la foto vive en Drive. */
  storagePath?: string | null;
  nombre: string;
  /** URL directa para mostrar la imagen (thumbnail Drive o downloadURL Storage) */
  url: string;
  /** URL de vista (Drive webViewLink o misma url para Storage) */
  viewUrl: string;
  fecha: string;
  subidoPor?: string;
  momento?: MomentoFotoFicha;
}

export interface FichaPropiedad {
  id: string;
  /** Número correlativo (FPC-0001) */
  numero: string;
  // --- Qué ingresó ---
  /** FK → sistemas (si el módulo es conocido) */
  sistemaId?: string | null;
  sistemaNombre?: string | null;
  /** FK → modulos del sistema */
  moduloId?: string | null;
  moduloNombre?: string | null;
  /** Descripción libre si no está en el sistema */
  descripcionLibre?: string | null;
  /** Part number / código de artículo */
  codigoArticulo?: string | null;
  serie?: string | null;
  accesorios: AccesorioFicha[];
  condicionFisica?: string | null;
  // --- Quién / Cómo llegó ---
  clienteId: string;
  clienteNombre: string;
  establecimientoId?: string | null;
  establecimientoNombre?: string | null;
  viaIngreso: ViaIngreso;
  /** Nombre del ingeniero o empresa de transporte */
  traidoPor: string;
  fechaIngreso: string;
  /** OT que originó la ficha */
  otReferencia?: string | null;
  // --- Problema ---
  descripcionProblema: string;
  sintomasReportados?: string | null;
  // --- Ciclo de vida ---
  estado: EstadoFicha;
  historial: HistorialFicha[];
  derivaciones: DerivacionProveedor[];
  repuestosPendientes: RepuestoPendiente[];
  // --- Devolución ---
  remitoDevolucionId?: string | null;
  fechaEntrega?: string | null;
  // --- Loaner vinculado ---
  loanerId?: string | null;
  loanerCodigo?: string | null;
  // --- Fotos (metadata, archivos en Google Drive) ---
  fotos?: FotoFicha[];
  // --- OTs vinculadas ---
  otIds: string[];
  // --- Audit ---
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Loaner (Equipos en préstamo) ---
// =============================================

export type EstadoLoaner = 'en_base' | 'en_cliente' | 'en_transito' | 'vendido' | 'baja';

export const ESTADO_LOANER_LABELS: Record<EstadoLoaner, string> = {
  en_base: 'En base',
  en_cliente: 'En cliente',
  en_transito: 'En tránsito',
  vendido: 'Vendido',
  baja: 'Baja',
};

export const ESTADO_LOANER_COLORS: Record<EstadoLoaner, string> = {
  en_base: 'bg-green-100 text-green-800',
  en_cliente: 'bg-blue-100 text-blue-800',
  en_transito: 'bg-yellow-100 text-yellow-800',
  vendido: 'bg-slate-100 text-slate-600',
  baja: 'bg-red-100 text-red-800',
};

export interface PrestamoLoaner {
  id: string;
  clienteId: string;
  clienteNombre: string;
  establecimientoId?: string | null;
  establecimientoNombre?: string | null;
  motivo: string;
  /** FK → fichasPropiedad (si el préstamo es por reparación) */
  fichaId?: string | null;
  fichaNumero?: string | null;
  fechaSalida: string;
  fechaRetornoPrevista?: string | null;
  fechaRetornoReal?: string | null;
  condicionRetorno?: string | null;
  /** Remito de salida */
  remitoSalidaId?: string | null;
  remitoSalidaNumero?: string | null;
  /** Remito de devolución */
  remitoRetornoId?: string | null;
  remitoRetornoNumero?: string | null;
  estado: 'activo' | 'devuelto' | 'cancelado';
}

export interface ExtraccionLoaner {
  id: string;
  fecha: string;
  descripcion: string;
  codigoArticulo?: string | null;
  /** Destino libre: "OT 25660", "Stock", etc. */
  destino: string;
  otNumber?: string | null;
  extraidoPor: string;
}

export interface VentaLoaner {
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  precio?: number | null;
  moneda?: 'ARS' | 'USD' | null;
  presupuestoId?: string | null;
  presupuestoNumero?: string | null;
  notas?: string | null;
}

export interface Loaner {
  id: string;
  /** Código correlativo (LNR-0001) */
  codigo: string;
  descripcion: string;
  /** FK → articulos (si está en stock) */
  articuloId?: string | null;
  articuloCodigo?: string | null;
  articuloDescripcion?: string | null;
  serie?: string | null;
  categoriaEquipo?: string | null;
  condicion: string;
  estado: EstadoLoaner;
  prestamos: PrestamoLoaner[];
  extracciones: ExtraccionLoaner[];
  venta?: VentaLoaner | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Posiciones Arancelarias (catálogo) ---
// =============================================

export interface PosicionArancelaria {
  id: string;
  codigo: string; // formato SIM: "9027.90.99.999A"
  descripcion: string;
  tratamiento: TratamientoArancelario;
  notas?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// --- Requerimientos de Compra ---
// =============================================

export type EstadoRequerimiento = 'pendiente' | 'aprobado' | 'en_compra' | 'comprado' | 'cancelado';
export type OrigenRequerimiento = 'manual' | 'presupuesto' | 'stock_minimo' | 'ingeniero';

export const ESTADO_REQUERIMIENTO_LABELS: Record<EstadoRequerimiento, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  en_compra: 'En compra',
  comprado: 'Comprado',
  cancelado: 'Cancelado',
};

export const ESTADO_REQUERIMIENTO_COLORS: Record<EstadoRequerimiento, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  aprobado: 'bg-blue-100 text-blue-700',
  en_compra: 'bg-teal-100 text-teal-700',
  comprado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
};

export const ORIGEN_REQUERIMIENTO_LABELS: Record<OrigenRequerimiento, string> = {
  manual: 'Manual',
  presupuesto: 'Presupuesto',
  stock_minimo: 'Stock mínimo',
  ingeniero: 'Ingeniero',
};

export interface RequerimientoCompra {
  id: string;
  numero: string; // REQ-0001
  articuloId?: string | null;
  articuloCodigo?: string | null;
  articuloDescripcion: string;
  cantidad: number;
  unidadMedida: string;
  motivo: string;
  origen: OrigenRequerimiento;
  origenRef?: string | null;
  estado: EstadoRequerimiento;
  proveedorSugeridoId?: string | null;
  proveedorSugeridoNombre?: string | null;
  ordenCompraId?: string | null;
  ordenCompraNumero?: string | null;
  solicitadoPor: string;
  fechaSolicitud: string;
  fechaAprobacion?: string | null;
  urgencia?: UrgenciaRequerimiento;
  presupuestoId?: string | null;
  presupuestoNumero?: string | null;
  notas?: string | null;
  /**
   * (Phase 8 FLOW-03) Si true, el requerimiento está ligado al acceptance del presupuesto
   * y se cancela automáticamente si éste se anula. Solo aplica a requerimientos generados
   * desde `aceptado` de un presupuesto con ítems de importación.
   */
  condicional?: boolean;
  /** Razón de cancelación automática (p.ej. al anular el presupuesto origen). */
  canceladoPor?: 'presupuesto_anulado' | 'manual' | string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

export type UrgenciaRequerimiento = 'baja' | 'media' | 'alta' | 'critica';

// =============================================
// --- Importaciones (Comercio Exterior) ---
// =============================================

export type EstadoImportacion = 'preparacion' | 'embarcado' | 'en_transito' | 'en_aduana'
  | 'despachado' | 'recibido' | 'cancelado';

export const ESTADO_IMPORTACION_LABELS: Record<EstadoImportacion, string> = {
  preparacion: 'Preparación',
  embarcado: 'Embarcado',
  en_transito: 'En tránsito',
  en_aduana: 'En aduana',
  despachado: 'Despachado',
  recibido: 'Recibido',
  cancelado: 'Cancelado',
};

export const ESTADO_IMPORTACION_COLORS: Record<EstadoImportacion, string> = {
  preparacion: 'bg-slate-100 text-slate-600',
  embarcado: 'bg-blue-100 text-blue-700',
  en_transito: 'bg-amber-100 text-amber-700',
  en_aduana: 'bg-purple-100 text-purple-700',
  despachado: 'bg-cyan-100 text-cyan-700',
  recibido: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
};

export interface DocumentoImportacion {
  id: string;
  tipo: string; // 'invoice' | 'packing_list' | 'bl' | 'certificado_origen' | 'otro'
  nombre: string;
  url?: string | null;
  fecha?: string | null;
  notas?: string | null;
}

export interface GastoImportacion {
  id: string;
  concepto: string; // 'flete_internacional' | 'seguro' | 'despachante' | 'flete_interno' | 'vep' | 'otro'
  descripcion?: string | null;
  monto: number;
  moneda: 'ARS' | 'USD' | 'EUR';
  fecha?: string | null;
  comprobante?: string | null;
}

export interface ItemImportacion {
  id: string;                                    // uuid local, not FK to another collection
  itemOCId: string;                              // ItemOC.id de origen
  articuloId?: string | null;                    // desnormalizado de ItemOC.articuloId
  articuloCodigo?: string | null;                // desnormalizado de ItemOC.articuloCodigo
  descripcion: string;                           // ItemOC.descripcion
  cantidadPedida: number;                        // cantidad solicitada en este embarque
  cantidadRecibida?: number | null;              // se completa al ingresar al stock
  unidadMedida: string;
  precioUnitario?: number | null;                // ItemOC.precioUnitario
  moneda?: 'ARS' | 'USD' | 'EUR' | null;        // ItemOC.moneda
  costoUnitarioConGastos?: number | null;        // calculado al ingresar stock
  requerimientoId?: string | null;               // ItemOC.requerimientoId para cierre automático
}

export interface Importacion {
  id: string;
  numero: string; // IMP-0001
  estado: EstadoImportacion;
  // OC vinculada
  ordenCompraId: string;
  ordenCompraNumero: string;
  proveedorId: string;
  proveedorNombre: string;
  // Embarque
  puertoOrigen?: string | null;
  puertoDestino?: string | null;
  naviera?: string | null;
  booking?: string | null;
  contenedor?: string | null;
  fechaEmbarque?: string | null;
  fechaEstimadaArribo?: string | null;
  fechaArriboReal?: string | null;
  incoterm?: string | null;
  // Aduana
  despachante?: string | null;
  despachoNumero?: string | null;
  fechaDespacho?: string | null;
  // VEP
  vepNumero?: string | null;
  vepMonto?: number | null;
  vepMoneda?: 'ARS' | 'USD' | null;
  vepFechaPago?: string | null;
  // Costeo
  gastos: GastoImportacion[];
  costoTotalARS?: number | null;
  // Documentos
  documentos: DocumentoImportacion[];
  // Recepción
  numeroGuia?: string | null;          // número de guía aérea/marítima
  items?: ItemImportacion[] | null;    // ítems de este embarque (subconjunto de la OC)
  fechaRecepcion?: string | null;      // ISO string — obligatoria para transición a 'recibido'
  stockIngresado?: boolean | null;     // true cuando el alta de stock ya fue ejecutada
  // Audit
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Autenticacion y Roles ---
// =============================================

export type UserRole = 'admin' | 'ingeniero_soporte' | 'admin_soporte' | 'admin_ing_soporte' | 'admin_contable' | 'administracion' | 'ventas';
export type UserStatus = 'pendiente' | 'activo' | 'deshabilitado';

// ── Ingreso a Empresas ──────────────────────────────────────────────────

/** Estado de un documento requerido para ingreso a empresa */
export type DocumentoIngresoStatus =
  | 'no_requerido'
  | 'requerido'
  | 'con_contrato'
  | 'con_nomina'
  | 'con_contrato_y_nomina';

export const DOCUMENTO_INGRESO_LABELS: Record<DocumentoIngresoStatus, string> = {
  no_requerido: 'No requerido',
  requerido: 'Requerido',
  con_contrato: 'Con Contrato',
  con_nomina: 'Con Nómina',
  con_contrato_y_nomina: 'Con Contrato y Nómina',
};

/** Tipo de cliente para ingreso */
export type TipoIngresoCliente = 'PI' | 'CNT';

export const TIPO_INGRESO_LABELS: Record<TipoIngresoCliente, string> = {
  PI: 'Planta Industrial',
  CNT: 'Contratista',
};

/** Documentos requeridos para ingreso a una empresa */
export interface DocumentacionIngreso {
  art: DocumentoIngresoStatus;
  cnr: DocumentoIngresoStatus;
  svo: DocumentoIngresoStatus;
  altaTemprana: DocumentoIngresoStatus;
  anexoN2: DocumentoIngresoStatus;
  avisoObra: DocumentoIngresoStatus;
  f931: DocumentoIngresoStatus;
  estudioMedico: DocumentoIngresoStatus;
  epp: DocumentoIngresoStatus;
  planPagos: DocumentoIngresoStatus;
  sueldos: DocumentoIngresoStatus;
  hojaMembreteada: DocumentoIngresoStatus;
}

export const DOCUMENTACION_INGRESO_KEYS: { key: keyof DocumentacionIngreso; label: string }[] = [
  { key: 'art', label: 'ART' },
  { key: 'cnr', label: 'CNR' },
  { key: 'svo', label: 'SVO' },
  { key: 'altaTemprana', label: 'Alta Temprana' },
  { key: 'anexoN2', label: 'Anexo N°2' },
  { key: 'avisoObra', label: 'Aviso de Obra + Programa' },
  { key: 'f931', label: 'F.931' },
  { key: 'estudioMedico', label: 'Estudio Médico' },
  { key: 'epp', label: 'EPP' },
  { key: 'planPagos', label: 'Plan Pagos' },
  { key: 'sueldos', label: 'Sueldos' },
  { key: 'hojaMembreteada', label: 'Hoja Membretada' },
];

export const DEFAULT_DOCUMENTACION: DocumentacionIngreso = {
  art: 'no_requerido',
  cnr: 'no_requerido',
  svo: 'no_requerido',
  altaTemprana: 'no_requerido',
  anexoN2: 'no_requerido',
  avisoObra: 'no_requerido',
  f931: 'no_requerido',
  estudioMedico: 'no_requerido',
  epp: 'no_requerido',
  planPagos: 'no_requerido',
  sueldos: 'no_requerido',
  hojaMembreteada: 'no_requerido',
};

export interface IngresoEmpresa {
  id: string;
  clienteId: string;
  clienteNombre: string;
  tipo: TipoIngresoCliente;
  induccion: {
    requerida: boolean;
    descripcion: string;
    duracion?: string;
    horario?: string;
  };
  contacto: string;
  documentacion: DocumentacionIngreso;
  notas: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// ── Dispositivos (celulares, computadoras, etc.) ────────────────────────

export type TipoDispositivo = 'celular' | 'computadora' | 'tablet' | 'otro';

export interface Dispositivo {
  id: string;
  tipo: TipoDispositivo;
  marca: string;
  modelo: string;
  serie: string;
  descripcion?: string | null;
  asignadoAId?: string | null;
  asignadoANombre?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// ── Seguimiento Vehicular ───────────────────────────────────────────────

/** Criterio de servicio periódico para un vehículo */
export interface CriterioServicioVehiculo {
  servicio: string;
  cadaKm?: number | null;
  cadaTiempo?: string | null;
  kmReemplazo?: number | null;
  comentario: string;
}

/** Vencimiento con fecha */
export interface VencimientoVehiculo {
  tipo: string;
  fecha: string;
  notas?: string;
}

/** Registro de un servicio realizado (estado actual de cada tipo) */
export interface ServicioVehiculo {
  id: string;
  vehiculoId: string;
  servicio: string;
  kmRealizacion: number;
  extensionKm: number;
  fechaRealizacion: string;
  fechaEstimativa: string;
  createdAt: string;
  updatedAt: string;
}

/** Visita al taller */
export interface VisitaTaller {
  id: string;
  vehiculoId: string;
  taller: string;
  fecha: string;
  km?: number | null;
  factura?: string | null;
  monto?: number | null;
  descripcion: string;
  createdAt: string;
  updatedAt: string;
}

/** Registro mensual de kilometraje */
export interface RegistroKm {
  id: string;
  vehiculoId: string;
  fecha: string;
  km: number;
  createdAt: string;
}

export interface Vehiculo {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio?: number | null;
  color?: string | null;
  asignadoA: string;
  criteriosServicio: CriterioServicioVehiculo[];
  vencimientos: VencimientoVehiculo[];
  kmActual?: number | null;
  notas?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

/** Identificadores de app para control de acceso */
export type AppId = 'sistema-modular' | 'portal-ingeniero' | 'reportes-ot';

/** Identificadores de módulo (agrupan rutas relacionadas) */
export type ModuloId =
  | 'clientes'
  | 'establecimientos'
  | 'equipos'
  | 'ordenes-trabajo'
  | 'leads'
  | 'presupuestos'
  | 'stock'
  | 'fichas'
  | 'loaners'
  | 'instrumentos'
  | 'table-catalog'
  | 'ingreso-empresas'
  | 'dispositivos'
  | 'vehiculos'
  | 'agenda'
  | 'pendientes'
  | 'facturacion'
  | 'contratos'
  | 'calificacion-proveedores'
  | 'usuarios'
  | 'admin';

/** Permisos por defecto de cada rol — apps y módulos accesibles */
export const ROLE_DEFAULTS: Record<UserRole, { apps: AppId[]; modulos: ModuloId[] }> = {
  admin: {
    apps: ['sistema-modular', 'portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'leads', 'presupuestos', 'stock', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda', 'pendientes', 'facturacion', 'contratos', 'calificacion-proveedores', 'usuarios', 'admin'],
  },
  ingeniero_soporte: {
    apps: ['portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda'],
  },
  admin_soporte: {
    apps: ['sistema-modular', 'portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'leads', 'presupuestos', 'stock', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda', 'pendientes', 'contratos'],
  },
  admin_ing_soporte: {
    apps: ['sistema-modular', 'portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'leads', 'presupuestos', 'stock', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda', 'pendientes', 'contratos'],
  },
  ventas: {
    apps: ['sistema-modular'],
    modulos: ['clientes', 'establecimientos', 'leads', 'presupuestos'],
  },
  admin_contable: {
    apps: ['sistema-modular'],
    modulos: ['leads', 'presupuestos', 'stock', 'facturacion', 'calificacion-proveedores'],
  },
  administracion: {
    apps: ['sistema-modular'],
    modulos: ['leads', 'presupuestos', 'stock', 'facturacion', 'calificacion-proveedores'],
  },
};

/** Mapeo de ruta → módulo (para ProtectedRoute) */
export const RUTA_MODULO: Record<string, ModuloId> = {
  '/clientes': 'clientes',
  '/establecimientos': 'establecimientos',
  '/equipos': 'equipos',
  '/categorias-equipo': 'equipos',
  '/ordenes-trabajo': 'ordenes-trabajo',
  '/tipos-servicio': 'ordenes-trabajo',
  '/leads': 'leads',
  '/presupuestos': 'presupuestos',
  '/stock': 'stock',
  '/fichas': 'fichas',
  '/loaners': 'loaners',
  '/instrumentos': 'instrumentos',
  '/table-catalog': 'table-catalog',
  '/ingreso-empresas': 'ingreso-empresas',
  '/dispositivos': 'dispositivos',
  '/vehiculos': 'vehiculos',
  '/agenda': 'agenda',
  '/pendientes': 'pendientes',
  '/facturacion': 'facturacion',
  '/contratos': 'contratos',
  '/calificacion-proveedores': 'calificacion-proveedores',
  '/usuarios': 'usuarios',
  '/admin': 'admin',
};

/** Labels para UI */
export const MODULO_LABELS: Record<ModuloId, string> = {
  'clientes': 'Clientes',
  'establecimientos': 'Establecimientos',
  'equipos': 'Equipos',
  'ordenes-trabajo': 'Ordenes de Trabajo',
  'leads': 'Leads',
  'presupuestos': 'Presupuestos',
  'stock': 'Stock',
  'fichas': 'Fichas Técnicas',
  'loaners': 'Loaners',
  'instrumentos': 'Instrumentos',
  'table-catalog': 'Biblioteca de Tablas',
  'ingreso-empresas': 'Ingreso a Empresas',
  'dispositivos': 'Dispositivos',
  'vehiculos': 'Vehículos',
  'agenda': 'Agenda',
  'pendientes': 'Pendientes',
  'facturacion': 'Facturación',
  'contratos': 'Contratos',
  'calificacion-proveedores': 'Calif. Proveedores',
  'usuarios': 'Usuarios',
  'admin': 'Administración',
};

export const APP_LABELS: Record<AppId, string> = {
  'sistema-modular': 'Sistema Modular',
  'portal-ingeniero': 'Portal Ingeniero',
  'reportes-ot': 'Reportes OT',
};

/**
 * Resuelve los permisos efectivos de un usuario.
 * Si tiene overrides en `permisos`, usa esos. Si no, usa los defaults del rol.
 * Admin SIEMPRE tiene acceso total (no se puede restringir).
 */
export function getUserPermissions(usuario: UsuarioAGS): { apps: AppId[]; modulos: ModuloId[] } {
  if (!usuario.role) return { apps: [], modulos: [] };
  if (usuario.role === 'admin') return ROLE_DEFAULTS.admin;

  const defaults = ROLE_DEFAULTS[usuario.role];
  if (!usuario.permisos) return defaults;

  return {
    apps: usuario.permisos.apps ?? defaults.apps,
    modulos: usuario.permisos.modulos ?? defaults.modulos,
  };
}

/** Verifica si un usuario puede acceder a un módulo específico */
export function canAccessModulo(usuario: UsuarioAGS, modulo: ModuloId): boolean {
  const { modulos } = getUserPermissions(usuario);
  return modulos.includes(modulo);
}

/** Verifica si un usuario puede acceder a una app específica */
export function canAccessApp(usuario: UsuarioAGS, app: AppId): boolean {
  const { apps } = getUserPermissions(usuario);
  return apps.includes(app);
}

/** Dado un pathname, devuelve el módulo al que pertenece (o null) */
export function getModuloFromPath(pathname: string): ModuloId | null {
  // Busca el prefijo más largo que coincida
  for (const [prefix, modulo] of Object.entries(RUTA_MODULO)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return modulo;
    }
  }
  return null;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  ingeniero_soporte: 'Ingeniero de Soporte',
  admin_soporte: 'Admin de Soporte',
  admin_ing_soporte: 'Admin Ing. de Soporte',
  ventas: 'Ventas',
  admin_contable: 'Admin Contable',
  administracion: 'Administración',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  deshabilitado: 'Deshabilitado',
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  activo: 'bg-green-100 text-green-700',
  deshabilitado: 'bg-red-100 text-red-700',
};

/** Permisos override por usuario — si undefined, usa defaults del rol */
export interface UserPermissionsOverride {
  apps?: AppId[];
  modulos?: ModuloId[];
  /** Áreas de ticket que este usuario puede ver (además de sus propios tickets) */
  ticketAreasVisibles?: TicketArea[];
}

export interface UsuarioAGS {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  /** Roles adicionales (permite multi-rol) */
  roles?: UserRole[];
  status: UserStatus;
  /** Permisos personalizados (override de los defaults del rol) */
  permisos?: UserPermissionsOverride | null;
  /** Firma digital del usuario (base64 PNG dataUrl) */
  firmaBase64?: string | null;
  /** Nombre/aclaración que aparece debajo de la firma en reportes */
  nombreAclaracion?: string | null;
  /** Preferencias de notificaciones push */
  notificationPreferences?: NotificationPreferences | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

// --- Notification Preferences ---

export interface NotificationPreferences {
  /** Master toggle — desactiva todas las push */
  pushEnabled: boolean;
  /** Cuando me asignan un ticket */
  notifyOnAssigned: boolean;
  /** Cuando me derivan un ticket */
  notifyOnDerived: boolean;
  /** Comentario en mis tickets */
  notifyOnComment: boolean;
  /** Ticket cerrado donde participo */
  notifyOnFinalized: boolean;
  /** Tickets marcados urgente */
  notifyOnUrgent: boolean;
  /** Solo para admins: 'mine' = solo mis tickets, 'all' = todos */
  scope: 'mine' | 'all';
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  notifyOnAssigned: true,
  notifyOnDerived: true,
  notifyOnComment: true,
  notifyOnFinalized: true,
  notifyOnUrgent: true,
  scope: 'mine',
};

// --- FCM Token ---

export interface FCMTokenRecord {
  token: string;
  device: 'desktop' | 'mobile';
  browser: string;
  createdAt: string;
  lastRefreshed: string;
}

// --- Audit Log ---

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  collection: string;
  documentId: string;
  userId: string;
  userName: string;
  timestamp: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
}

// --- Agenda ---

export type EstadoAgenda = 'pendiente' | 'tentativo' | 'confirmado' | 'en_progreso' | 'completado' | 'cancelado';

export const ESTADO_AGENDA_LABELS: Record<EstadoAgenda, string> = {
  pendiente: 'Pendiente',
  tentativo: 'Tentativo',
  confirmado: 'Confirmado',
  en_progreso: 'En progreso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export const ESTADO_AGENDA_COLORS: Record<EstadoAgenda, string> = {
  pendiente: 'bg-slate-200 text-slate-700',
  tentativo: 'bg-amber-200 text-amber-800',
  confirmado: 'bg-blue-200 text-blue-800',
  en_progreso: 'bg-teal-200 text-teal-800',
  completado: 'bg-emerald-200 text-emerald-800',
  cancelado: 'bg-red-100 text-red-600',
};

export interface AgendaEntry {
  id: string;
  fechaInicio: string;           // 'YYYY-MM-DD'
  fechaFin: string;              // 'YYYY-MM-DD' (same as fechaInicio for single-day)
  quarterStart: 1 | 2 | 3 | 4;
  quarterEnd: 1 | 2 | 3 | 4;
  ingenieroId: string;
  ingenieroNombre: string;
  otNumber: string;
  clienteNombre: string;
  tipoServicio: string;
  sistemaNombre: string | null;
  establecimientoNombre: string | null;
  equipoModelo?: string | null;  // e.g. "HPLC 1100"
  equipoAgsId?: string | null;   // equipo visible ID (AGS-XXXX)
  estadoAgenda: EstadoAgenda;
  notas: string | null;
  titulo: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

export interface AgendaNota {
  id: string;
  fecha: string;           // 'YYYY-MM-DD'
  ingenieroId: string;
  ingenieroNombre: string;
  texto: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

export type ZoomLevel = 'week' | '2weeks' | 'month' | '2months' | 'year';

// =============================================
// --- Pendientes (recordatorios por cliente/equipo) ---
// =============================================

/** Scope de cuándo aparece un pendiente — dispara el banner en presupuestos y/o OTs */
export type PendienteTipo = 'presupuesto' | 'visita' | 'ambos';

/** Estado de un pendiente */
export type PendienteEstado = 'pendiente' | 'completada' | 'descartada';

/** Tipo de documento que resolvió un pendiente al cerrarse */
export type PendienteResolucionDocType = 'presupuesto' | 'ot';

export const PENDIENTE_TIPO_LABELS: Record<PendienteTipo, string> = {
  presupuesto: 'Presupuesto',
  visita: 'Visita',
  ambos: 'Ambos',
};

export const PENDIENTE_TIPO_COLORS: Record<PendienteTipo, string> = {
  presupuesto: 'bg-blue-100 text-blue-700',
  visita: 'bg-amber-100 text-amber-700',
  ambos: 'bg-purple-100 text-purple-700',
};

export const PENDIENTE_ESTADO_LABELS: Record<PendienteEstado, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  descartada: 'Descartada',
};

export const PENDIENTE_ESTADO_COLORS: Record<PendienteEstado, string> = {
  pendiente: 'bg-slate-200 text-slate-700',
  completada: 'bg-emerald-100 text-emerald-700',
  descartada: 'bg-red-100 text-red-600',
};

export interface Pendiente {
  id: string;

  // Scope
  clienteId: string;
  clienteNombre: string;              // denormalizado para listas
  equipoId?: string | null;           // opcional: pendiente específica de un equipo
  equipoNombre?: string | null;       // denormalizado
  equipoAgsId?: string | null;        // visible ID del equipo si aplica

  // Contenido
  tipo: PendienteTipo;
  descripcion: string;
  estado: PendienteEstado;

  // Origen
  origenTicketId?: string | null;
  origenTicketRazonSocial?: string | null;

  // Cierre por completado (incluida en presupuesto/OT o marcada manual)
  completadaEn?: string | null;
  completadaPor?: string | null;
  completadaPorNombre?: string | null;
  resolucionDocType?: PendienteResolucionDocType | null;
  resolucionDocId?: string | null;
  resolucionDocLabel?: string | null; // "P-2026-042" o "OT-2705"

  // Cierre por descarte
  descartadaEn?: string | null;
  descartadaPor?: string | null;
  descartadaPorNombre?: string | null;
  descartadaMotivo?: string | null;

  // Audit trail estándar
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Tipos ligeros para selectores (reportes-ot) ---
// =============================================

export interface ClienteOption {
  id: string;
  razonSocial: string;
  cuit?: string | null;
  requiereTrazabilidad?: boolean;
}

export interface EstablecimientoOption {
  id: string;
  clienteCuit: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  sectores?: string[];
}

export interface ContactoOption {
  id: string;
  nombre: string;
  email: string;
  esPrincipal: boolean;
  sector?: string;
}

export interface SistemaOption {
  id: string;
  establecimientoId: string;
  nombre: string;
  codigoInternoCliente: string;
  sector?: string | null;
}

export interface ModuloOption {
  id: string;
  sistemaId: string;
  nombre: string;
  marca?: string;
  descripcion?: string;
  serie?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

// =============================================
// --- Instrumento/Patrón (vista ligera para selectores) ---
// =============================================

/** Instrumento o patrón (solo campos para lectura/selección por el técnico) */
export interface InstrumentoPatronOption {
  id: string;
  nombre: string;
  tipo: 'instrumento' | 'patron';
  marca: string;
  modelo: string;
  serie: string;
  /** Solo patrones: número de lote (en lugar de serie) */
  lote?: string | null;
  categorias: string[];
  certificadoEmisor?: string | null;
  certificadoVencimiento?: string | null;
  certificadoUrl?: string | null;
  /** URL del documento de trazabilidad PDF — solo instrumentos */
  trazabilidadUrl?: string | null;
}

/**
 * Patrón seleccionado en un reporte — representa un lote específico de un patrón.
 * Se genera a partir de un `Patron` + un `PatronLote`.
 */
export interface PatronSeleccionado {
  /** ID del documento Patron en Firestore */
  patronId: string;
  /** Código de artículo */
  codigoArticulo: string;
  /** Descripción (ej. "Caffeine Standards Kit for LC/MS OQ/PV") */
  descripcion: string;
  /** Marca */
  marca: string;
  /** Categorías (copia del Patron padre) */
  categorias: string[];
  /** Código de lote seleccionado */
  lote: string;
  /** Fecha de vencimiento del lote */
  fechaVencimiento: string | null;
  /** Emisor del certificado del lote */
  certificadoEmisor?: string | null;
  /** URL del certificado del lote */
  certificadoUrl?: string | null;
}

/**
 * Columna seleccionada en un reporte — representa una unidad física específica de una columna.
 * Se genera a partir de una `Columna` + una `ColumnaSerie`.
 */
export interface ColumnaSeleccionada {
  /** ID del documento Columna en Firestore */
  columnaId: string;
  /** Código de artículo */
  codigoArticulo: string;
  /** Descripción (dimensiones, fase, etc.) */
  descripcion: string;
  /** Marca */
  marca: string;
  /** Categorías (copia de la Columna padre) */
  categorias: string[];
  /** Número de serie físico seleccionado */
  serie: string;
  /** Fecha de vencimiento del certificado (opcional) */
  fechaVencimiento?: string | null;
  /** Emisor del certificado (opcional) */
  certificadoEmisor?: string | null;
  /** URL del certificado (opcional) */
  certificadoUrl?: string | null;
}

// =============================================
// --- Adjuntos (vista ligera para reportes-ot) ---
// =============================================

/** Metadata de un adjunto con URL pública. Usado en reportes-ot. */
export interface AdjuntoMeta {
  id: string;
  otNumber: string;
  tipo: 'foto' | 'archivo';
  storagePath: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  orden: number;
  uploadedAt: string;
}

// =============================================
// --- Tipos legacy (reportes-ot) ---
// =============================================

export interface Module {
  id: string;
  modelo: string;
  descripcion: string;
  nroSerie: string;
}

export interface Customer {
  id: string;
  razonSocial: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
}

export interface Equipment {
  id: string;
  modelo: string;
  marca: string;
  nroSerie: string;
  configuracion: string;
  customerId: string;
  modules?: Module[];
}

// =============================================
// --- Viáticos ---
// =============================================
export type MedioPago = 'efectivo' | 'tarjeta';
export type ViaticoPeriodoEstado = 'abierto' | 'enviado' | 'confirmado';

export const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
};

export const VIATICO_ESTADO_LABELS: Record<ViaticoPeriodoEstado, string> = {
  abierto: 'Abierto',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
};

export const VIATICO_ESTADO_COLORS: Record<ViaticoPeriodoEstado, string> = {
  abierto: 'bg-blue-50 text-blue-700',
  enviado: 'bg-amber-50 text-amber-700',
  confirmado: 'bg-emerald-50 text-emerald-700',
};

export interface GastoViatico {
  id: string;
  fecha: string; // ISO date (YYYY-MM-DD)
  concepto: string;
  establecimiento?: string | null; // nombre del comercio (Shell, McDonald's, etc.)
  monto: number;
  medioPago: MedioPago;
  notas?: string | null;
}

export interface ViaticoPeriodo {
  id: string;
  ingenieroId: string;
  ingenieroNombre: string;
  mes: number;  // 1-12
  anio: number;
  estado: ViaticoPeriodoEstado;
  gastos: GastoViatico[];
  totalEfectivo: number;
  totalTarjeta: number;
  total: number;
  enviadoAt?: string | null;
  confirmadoAt?: string | null;
  confirmadoPor?: string | null;
  confirmadoPorNombre?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceReport {
  id: string;
  otNumber: string;
  budgetNumber: string;
  fechaInicio: string;
  fechaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  customerId: string;
  equipmentId: string;
  reporteTecnico: string;
  articulos: Part[];
  accionesTomar: string;
  esFacturable: boolean;
  tieneContrato: boolean;
}

// --- Contratos de Servicio ---

export type TipoLimiteContrato = 'visitas' | 'horas' | 'ilimitado';
export type EstadoContrato = 'activo' | 'vencido' | 'suspendido' | 'cancelado';

export const ESTADO_CONTRATO_LABELS: Record<EstadoContrato, string> = {
  activo: 'Activo',
  vencido: 'Vencido',
  suspendido: 'Suspendido',
  cancelado: 'Cancelado',
};

export const ESTADO_CONTRATO_COLORS: Record<EstadoContrato, string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  vencido: 'bg-red-100 text-red-700',
  suspendido: 'bg-amber-100 text-amber-700',
  cancelado: 'bg-slate-200 text-slate-500',
};

export const TIPO_LIMITE_CONTRATO_LABELS: Record<TipoLimiteContrato, string> = {
  visitas: 'Por visitas',
  horas: 'Por horas',
  ilimitado: 'Ilimitado',
};

export interface ServicioContrato {
  tipoServicioId: string;
  tipoServicioNombre: string;
  entregables?: string[] | null;
}

export interface Contrato {
  id: string;
  numero: string;
  clienteId: string;
  clienteNombre: string;
  sistemaIds: string[];
  presupuestoId: string | null;
  presupuestoNumero: string | null;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoContrato;
  serviciosIncluidos: ServicioContrato[];
  tipoLimite: TipoLimiteContrato;
  maxVisitas: number | null;
  visitasUsadas: number;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

// =============================================
// --- Documentos QF (registro y versionado) ---
// =============================================

/** Familias de documentos controlados. Por ahora solo QF; QI/QD/QP reservados para futura extensión. */
export type QFTipo = 'QF' | 'QI' | 'QD' | 'QP';
export type QFEstado = 'vigente' | 'obsoleto';

export const QF_TIPO_LABELS: Record<QFTipo, string> = {
  QF: 'QF',
  QI: 'QI',
  QD: 'QD',
  QP: 'QP',
};

/** Entrada de historial — una por versión. */
export interface QFHistorialEntry {
  version: string;
  fecha: string;
  usuarioEmail: string;
  usuarioNombre?: string | null;
  cambios: string;
}

/**
 * Documento controlado con numeración QF(fam).(numero).(version) — p.ej. QF7.0404.02.
 * `numeroCompleto` actúa como clave natural (sin versión, tipo+familia+numero).
 */
export interface QFDocumento {
  id: string;
  tipo: QFTipo;
  familia: number;
  numero: string;
  numeroCompleto: string;
  versionActual: string;
  nombre: string;
  descripcion?: string | null;
  estado: QFEstado;
  fechaCreacion: string;
  fechaUltimaActualizacion: string;
  ultimoUsuarioEmail: string;
  ultimoUsuarioNombre?: string | null;
  historial: QFHistorialEntry[];
}

/** Formatea "QF7.0404" (sin versión). */
export function formatQFNumeroCompleto(tipo: QFTipo, familia: number, numero: string): string {
  return `${tipo}${familia}.${numero}`;
}

/** Formatea "QF7.0404.02" (completo con versión). */
export function formatQFNumeroConVersion(tipo: QFTipo, familia: number, numero: string, version: string): string {
  return `${tipo}${familia}.${numero}.${version}`;
}

/** Incrementa "02" → "03". Preserva padding a 2 dígitos. */
export function incrementQFVersion(version: string): string {
  const n = parseInt(version, 10);
  if (isNaN(n)) return '01';
  return String(n + 1).padStart(2, '0');
}

