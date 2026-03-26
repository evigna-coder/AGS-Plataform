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
  direccion: string;
  localidad: string;
  provincia: string;
  sistema: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloSerie: string;
  codigoInternoCliente: string;
  fechaInicio: string;
  fechaFin: string;
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
  createdAt?: string;
  createdBy?: string;
  fechaAsignacion?: string;
  fechaCierre?: string;
  materialesParaServicio?: string;
  problemaFallaInicial?: string;
  ingenieroAsignadoId?: string | null;
  ingenieroAsignadoNombre?: string | null;
  // --- Cierre administrativo ---
  cierreAdmin?: CierreAdministrativo;
}

/** Datos del cierre administrativo de la OT */
export interface CierreAdministrativo {
  horasConfirmadas: boolean;
  horasLabAjustadas?: string;       // Hs laboratorio ajustadas (si difieren del reporte)
  horasViajeAjustadas?: string;     // Hs viaje ajustadas
  partesConfirmadas: boolean;
  stockDeducido: boolean;
  notasCierre?: string;
  avisoAdminEnviado: boolean;       // Se envió mail a administración para facturación
  avisoAdminFecha?: string;         // Fecha ISO del envío del aviso
  fechaCierreAdmin?: string;        // ISO date de cuando se cerró administrativamente
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
  | 'PTV';  // Programmed Temperature Vaporization

/** Tipos de detector para GC */
export type DetectorType =
  | 'FID'   // Flame Ionization Detector
  | 'NCD'   // Nitrogen/Phosphorus Detector
  | 'FPD'   // Flame Photometric Detector
  | 'ECD'   // Electron Capture Detector
  | 'SCD'   // Sulfur Chemiluminescence Detector
  | 'TCD';  // Thermal Conductivity Detector

export interface ConfiguracionGC {
  puertoInyeccionFront?: InletType | null;
  puertoInyeccionBack?: InletType | null;
  detectorFront?: DetectorType | null;
  detectorBack?: DetectorType | null;
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
};

/** Etiquetas legibles para DetectorType */
export const DETECTOR_LABELS: Record<DetectorType, string> = {
  FID: 'FID (Flame Ionization Detector)',
  NCD: 'NCD (Nitrogen/Phosphorus Detector)',
  FPD: 'FPD (Flame Photometric Detector)',
  ECD: 'ECD (Electron Capture Detector)',
  SCD: 'SCD (Sulfur Chemiluminescence Detector)',
  TCD: 'TCD (Thermal Conductivity Detector)',
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
  software?: string; // Nombre del software (ej: ChemStation, OpenLab, MassHunter)
  softwareRevision?: string; // Revisión del software (ej: B.04.03)
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

// --- Motivo del llamado (Leads) ---
export type MotivoLlamado = 'ventas' | 'soporte' | 'insumos' | 'administracion' | 'capacitacion';

export const MOTIVO_LLAMADO_LABELS: Record<MotivoLlamado, string> = {
  ventas: 'Ventas',
  soporte: 'Soporte',
  insumos: 'Insumos',
  administracion: 'Administración',
  capacitacion: 'Capacitación',
};

export const MOTIVO_LLAMADO_COLORS: Record<MotivoLlamado, string> = {
  ventas: 'bg-green-100 text-green-700',
  soporte: 'bg-blue-100 text-blue-700',
  insumos: 'bg-orange-100 text-orange-700',
  administracion: 'bg-violet-100 text-violet-700',
  capacitacion: 'bg-teal-100 text-teal-700',
};

// --- Áreas destino (Leads) ---
export type LeadArea =
  | 'presupuesto_ventas'
  | 'agenda_coordinacion'
  | 'materiales_comex'
  | 'ingeniero_soporte'
  | 'facturacion'
  | 'pago_proveedores';

export const LEAD_AREA_LABELS: Record<LeadArea, string> = {
  presupuesto_ventas: 'Presupuestos y ventas',
  agenda_coordinacion: 'Agenda y coordinación',
  materiales_comex: 'Materiales y comercio exterior',
  ingeniero_soporte: 'Ingeniero de soporte',
  facturacion: 'Facturación',
  pago_proveedores: 'Pago a proveedores',
};

export const LEAD_AREA_COLORS: Record<LeadArea, string> = {
  presupuesto_ventas: 'bg-indigo-100 text-indigo-700',
  agenda_coordinacion: 'bg-cyan-100 text-cyan-700',
  materiales_comex: 'bg-amber-100 text-amber-700',
  ingeniero_soporte: 'bg-teal-100 text-teal-700',
  facturacion: 'bg-emerald-100 text-emerald-700',
  pago_proveedores: 'bg-rose-100 text-rose-700',
};

// --- Prioridad ---
export type LeadPrioridad = 'alta' | 'media' | 'baja';

export const LEAD_PRIORIDAD_LABELS: Record<LeadPrioridad, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export const LEAD_PRIORIDAD_COLORS: Record<LeadPrioridad, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-emerald-100 text-emerald-700',
};

/** Agrupación visual de áreas para selectores */
export const LEAD_AREA_GROUPS: { label: string; areas: LeadArea[] }[] = [
  { label: 'Soporte', areas: ['presupuesto_ventas', 'agenda_coordinacion', 'materiales_comex', 'ingeniero_soporte'] },
  { label: 'Administración', areas: ['facturacion', 'pago_proveedores'] },
];

/** Mapeo de UserRole → áreas de lead que ese rol puede gestionar */
export const ROLE_LEAD_AREAS: Record<UserRole, LeadArea[]> = {
  admin: [], // admin tiene acceso total, no necesita mapeo
  admin_soporte: ['presupuesto_ventas', 'agenda_coordinacion', 'materiales_comex', 'ingeniero_soporte'],
  ingeniero_soporte: ['ingeniero_soporte'],
  admin_contable: ['facturacion', 'pago_proveedores'],
  administracion: ['facturacion', 'pago_proveedores'],
};

/**
 * Determina si un usuario puede modificar/derivar un lead.
 * Reglas:
 * 1. Admin siempre puede.
 * 2. Si el lead está asignado a un usuario específico, solo ese usuario puede.
 * 3. Si el lead tiene área pero no usuario asignado, cualquier usuario del sector puede.
 * 4. Si el lead no tiene ni usuario ni área, cualquiera puede (lead nuevo sin asignar).
 */
export function canUserModifyLead(
  lead: { asignadoA: string | null; areaActual?: LeadArea | null },
  user: { id: string; role: UserRole | null },
): boolean {
  // Admin siempre puede
  if (user.role === 'admin') return true;
  // Si está asignado a un usuario específico, solo ese usuario
  if (lead.asignadoA) return lead.asignadoA === user.id;
  // Si tiene área pero no usuario, verificar si el rol del usuario cubre esa área
  if (lead.areaActual && user.role) {
    const areasDelRol = ROLE_LEAD_AREAS[user.role] ?? [];
    return areasDelRol.includes(lead.areaActual);
  }
  // Sin asignar a nadie — cualquiera puede
  return true;
}

// --- Estados del Lead ---
export type LeadEstado =
  | 'nuevo'
  | 'pendiente_info'
  | 'en_presupuesto'
  | 'presupuesto_enviado'
  | 'esperando_oc'
  | 'espera_importacion'
  | 'pendiente_entrega'
  | 'en_coordinacion'
  | 'en_proceso'
  | 'finalizado'
  | 'no_concretado';

export const LEAD_ESTADO_LABELS: Record<LeadEstado, string> = {
  nuevo: 'Nuevo',
  pendiente_info: 'Pendiente info',
  en_presupuesto: 'En presupuesto',
  presupuesto_enviado: 'Presupuesto enviado',
  esperando_oc: 'Esperando OC',
  espera_importacion: 'Espera importación',
  pendiente_entrega: 'Pendiente entrega',
  en_coordinacion: 'En coordinación',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
  no_concretado: 'No concretado',
};

export const LEAD_ESTADO_COLORS: Record<LeadEstado, string> = {
  nuevo: 'bg-blue-100 text-blue-800',
  pendiente_info: 'bg-amber-100 text-amber-800',
  en_presupuesto: 'bg-indigo-100 text-indigo-800',
  presupuesto_enviado: 'bg-violet-100 text-violet-800',
  esperando_oc: 'bg-orange-100 text-orange-800',
  espera_importacion: 'bg-yellow-100 text-yellow-800',
  pendiente_entrega: 'bg-lime-100 text-lime-800',
  en_coordinacion: 'bg-cyan-100 text-cyan-800',
  en_proceso: 'bg-sky-100 text-sky-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  no_concretado: 'bg-red-100 text-red-600',
};

/** Orden para tabs y filtros */
export const LEAD_ESTADO_ORDER: LeadEstado[] = [
  'nuevo', 'pendiente_info', 'en_presupuesto', 'presupuesto_enviado',
  'esperando_oc', 'espera_importacion', 'pendiente_entrega',
  'en_coordinacion', 'en_proceso', 'finalizado', 'no_concretado',
];

// --- Posta (derivación) ---
export interface Posta {
  id: string;
  fecha: string; // ISO
  deUsuarioId: string;
  deUsuarioNombre: string;
  aUsuarioId: string;       // '' si se asigna solo a área
  aUsuarioNombre: string;   // '' si se asigna solo a área
  aArea?: LeadArea;         // área destino
  comentario?: string;
  estadoAnterior: LeadEstado;
  estadoNuevo: LeadEstado;
  accionRequerida?: string; // ej: "Averiguar N° parte", "Enviar presupuesto"
}


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

// --- Adjunto Lead ---
export interface AdjuntoLead {
  id: string;
  nombre: string;
  url: string;
  tipo: 'imagen' | 'archivo';
  size: number; // bytes
  fechaCarga: string;
}

export const LEAD_MAX_ADJUNTOS = 10;

// --- Lead refinado ---
export interface Lead {
  id: string;
  clienteId: string | null;
  contactoId: string | null;
  razonSocial: string;
  contacto: string;
  email: string;
  telefono: string;
  motivoLlamado: MotivoLlamado;
  motivoContacto: string;
  sistemaId: string | null; // FK sistemas (equipo involucrado si aplica)
  moduloId?: string | null; // FK módulo dentro del sistema
  estado: LeadEstado;
  postas: Posta[];
  asignadoA: string | null;
  asignadoNombre?: string | null;
  derivadoPor: string | null;
  areaActual?: LeadArea | null;        // área donde está el lead actualmente
  accionPendiente?: string | null;     // qué falta hacer (derivado de última posta)
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizadoAt?: string | null;
  descripcion?: string | null;
  prioridad?: LeadPrioridad | null;
  proximoContacto?: string | null;
  valorEstimado?: number | null;
  presupuestosIds?: string[];
  otIds?: string[];
  /** Archivos adjuntos (fotos, documentos) — máximo 10 */
  adjuntos?: AdjuntoLead[];
  /** Origen del lead: qr = sticker QR, portal = portal cliente, manual = creado manualmente */
  source?: 'qr' | 'portal' | 'manual' | null;
  /** ID AGS visible del sistema cuando el lead viene de un QR */
  sistemaAgsVisibleId?: string | null;
}

// --- Usuario (catálogo postas) ---
export interface UsuarioPosta {
  id: string;
  nombre: string;
  email?: string;
  area?: string;
}

// --- Presupuesto: Tipos auxiliares ---
export type TipoPresupuesto = 'servicio' | 'partes' | 'ventas' | 'contrato' | 'mixto';
export type MonedaPresupuesto = 'USD' | 'ARS' | 'EUR';
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
};

export const MONEDA_SIMBOLO: Record<MonedaPresupuesto, string> = {
  USD: 'U$S',
  ARS: '$',
  EUR: '€',
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
  | 'en_seguimiento'
  | 'pendiente_oc'
  | 'aceptado'
  | 'autorizado'
  | 'pendiente_certificacion'
  | 'rechazado'
  | 'vencido'
  | 'aguarda'
  | 'anulado';

export const ESTADO_PRESUPUESTO_LABELS: Record<PresupuestoEstado, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_seguimiento: 'En seguimiento',
  pendiente_oc: 'Pendiente OC',
  aceptado: 'Aceptado',
  autorizado: 'Autorizado',
  pendiente_certificacion: 'Pend. certificación',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
  aguarda: 'Aguarda',
  anulado: 'Anulado',
};

export const ESTADO_PRESUPUESTO_COLORS: Record<PresupuestoEstado, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-700',
  en_seguimiento: 'bg-yellow-100 text-yellow-700',
  pendiente_oc: 'bg-orange-100 text-orange-700',
  aceptado: 'bg-emerald-100 text-emerald-700',
  autorizado: 'bg-green-100 text-green-700',
  pendiente_certificacion: 'bg-purple-100 text-purple-700',
  rechazado: 'bg-red-100 text-red-700',
  vencido: 'bg-rose-100 text-rose-600',
  aguarda: 'bg-red-100 text-red-700',
  anulado: 'bg-slate-200 text-slate-500',
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
  enviada_proveedor: 'bg-indigo-100 text-indigo-700',
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
  // --- Audit ---
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
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
  | 'select_input';

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
}

export interface TableCatalogRow {
  rowId: string;
  cells: Record<string, string | number | boolean | null>;
  /** True = full-width section title row; uses titleText instead of cells */
  isTitle?: boolean;
  titleText?: string | null;
}

export interface TableCatalogRule {
  ruleId: string;
  description: string;
  sourceColumn: string;
  /**
   * '<=' | '>=' | '<' | '>' | '==' | '!=' : compare sourceColumn value against factoryThreshold
   * 'vs_spec' : compare sourceColumn (Resultado) value against the per-row value in specColumn (Especificación)
   */
  operator: '<=' | '>=' | '<' | '>' | '==' | '!=' | 'vs_spec';
  /** Fixed numeric/string threshold. For 'vs_spec', stores the specColumn key as a human-readable reference. */
  factoryThreshold: string | number;
  /** For 'vs_spec': key of the column that holds the expected spec value per row. */
  specColumn?: string | null;
  unit?: string | null;
  targetColumn: string;
  valueIfPass: string;
  valueIfFail: string;
}

// --- Checklist types (para tableType: 'checklist') ---

/**
 * Tipo de interacción de cada ítem de checklist:
 * - 'checkbox'    : tarea simple para tildar
 * - 'value_input' : campo con etiqueta y unidad opcional (ej. "Nro. de serie: ___")
 * - 'pass_fail'   : resultado con opciones CUMPLE / NO_CUMPLE / NA
 */
export type ChecklistItemType = 'checkbox' | 'value_input' | 'pass_fail' | 'selector';

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
  depth: 0 | 1 | 2 | 3;
  /** Si true, el técnico puede marcar esta sección como "No Aplica" */
  canBeNA?: boolean;
  /** Prefijo numérico visible (ej. "3.2.a") */
  numberPrefix?: string | null;
  /** Opciones para itemType 'selector' (ej. ["FID", "ECD", "FPD"]) */
  selectorOptions?: string[] | null;
  /** Condición de visibilidad: solo se muestra si el selector referenciado tiene alguno de los valores indicados */
  visibleWhen?: { selectorItemId: string; values: string[] } | null;
}

/** Respuesta del técnico para un ítem de checklist */
export type ChecklistItemAnswer =
  | { itemType: 'checkbox'; checked: boolean }
  | { itemType: 'value_input'; value: string }
  | { itemType: 'pass_fail'; result: 'CUMPLE' | 'NO_CUMPLE' | 'NA' | '' }
  | { itemType: 'selector'; selected: string };

/** Campo de encabezado que se muestra arriba de la tabla para que el técnico seleccione una opción. */
export interface TableHeaderField {
  fieldId: string;
  label: string;
  options: string[];
}

export interface TableCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  sysType: string;
  isDefault: boolean;
  tableType: 'validation' | 'informational' | 'instruments' | 'checklist' | 'text' | 'signatures';
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

export interface FotoFicha {
  id: string;
  driveFileId: string;
  nombre: string;
  /** URL directa para mostrar la imagen */
  url: string;
  /** URL de vista en Google Drive */
  viewUrl: string;
  fecha: string;
  subidoPor?: string;
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
  en_compra: 'bg-indigo-100 text-indigo-700',
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

export type UserRole = 'admin' | 'ingeniero_soporte' | 'admin_soporte' | 'admin_contable' | 'administracion';
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
  | 'facturacion'
  | 'usuarios'
  | 'admin';

/** Permisos por defecto de cada rol — apps y módulos accesibles */
export const ROLE_DEFAULTS: Record<UserRole, { apps: AppId[]; modulos: ModuloId[] }> = {
  admin: {
    apps: ['sistema-modular', 'portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'leads', 'presupuestos', 'stock', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda', 'facturacion', 'usuarios', 'admin'],
  },
  ingeniero_soporte: {
    apps: ['portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda'],
  },
  admin_soporte: {
    apps: ['sistema-modular', 'portal-ingeniero', 'reportes-ot'],
    modulos: ['clientes', 'establecimientos', 'equipos', 'ordenes-trabajo', 'leads', 'presupuestos', 'stock', 'fichas', 'loaners', 'instrumentos', 'table-catalog', 'ingreso-empresas', 'dispositivos', 'vehiculos', 'agenda'],
  },
  admin_contable: {
    apps: ['sistema-modular'],
    modulos: ['leads', 'presupuestos', 'stock', 'facturacion'],
  },
  administracion: {
    apps: ['sistema-modular'],
    modulos: ['leads', 'presupuestos', 'stock', 'facturacion'],
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
  '/facturacion': 'facturacion',
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
  'facturacion': 'Facturación',
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
}

export interface UsuarioAGS {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  status: UserStatus;
  /** Permisos personalizados (override de los defaults del rol) */
  permisos?: UserPermissionsOverride | null;
  /** Firma digital del usuario (base64 PNG dataUrl) */
  firmaBase64?: string | null;
  /** Nombre/aclaración que aparece debajo de la firma en reportes */
  nombreAclaracion?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
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
  en_progreso: 'bg-indigo-200 text-indigo-800',
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
  estadoAgenda: EstadoAgenda;
  notas: string | null;
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
// --- Tipos ligeros para selectores (reportes-ot) ---
// =============================================

export interface ClienteOption {
  id: string;
  razonSocial: string;
  cuit?: string | null;
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
  categorias: string[];
  certificadoEmisor?: string | null;
  certificadoVencimiento?: string | null;
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
