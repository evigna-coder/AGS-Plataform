// Tipos compartidos entre reportes-ot y sistema-modular

// Tipos de OT (Work Order) - Versión extendida para Sistema Modular
export interface WorkOrder {
  otNumber: string; // Formato: 5 dígitos + opcional .NN (ej: 25660.02)
  status: 'BORRADOR' | 'FINALIZADO';
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
  // Campos adicionales para integración con Sistema Modular
  clienteId?: string; // Referencia al cliente (CUIT o LEGACY-xxx)
  establecimientoId?: string; // Referencia al establecimiento donde se realiza la OT
  sistemaId?: string; // Referencia al sistema/equipo en sistema modular
  moduloId?: string; // Referencia al módulo específico (opcional)
  createdAt?: string;
  createdBy?: string;
  fechaAsignacion?: string; // Fecha de asignación (futuro - cuando se implemente agenda)
  fechaCierre?: string; // Fecha de cierre/finalización
  materialesParaServicio?: string; // Materiales necesarios para el servicio (texto libre)
  problemaFallaInicial?: string; // Problema o falla inicial declarada en la OT (comentario)
  ingenieroAsignadoId?: string | null; // FK a ingeniero asignado via agenda
  ingenieroAsignadoNombre?: string | null;
}

export interface Part {
  id: string;
  codigo: string;
  descripcion: string;
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
  telefono: string;
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
  | 'SCD';  // Sulfur Chemiluminescence Detector

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
};

// --- Módulo de sistema ---
export interface ModuloSistema {
  id: string;
  sistemaId: string;
  nombre: string; // Bomba, Inyector, Detector
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
  software?: string; // Información del software del sistema
  observaciones?: string;
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
}

// --- Motivo del llamado (Leads) ---
export type MotivoLlamado = 'ventas' | 'soporte' | 'insumos' | 'administracion' | 'otros';

export const MOTIVO_LLAMADO_LABELS: Record<MotivoLlamado, string> = {
  ventas: 'Ventas',
  soporte: 'Soporte',
  insumos: 'Insumos',
  administracion: 'Administración',
  otros: 'Otros',
};

export const MOTIVO_LLAMADO_COLORS: Record<MotivoLlamado, string> = {
  ventas: 'bg-green-100 text-green-700',
  soporte: 'bg-blue-100 text-blue-700',
  insumos: 'bg-orange-100 text-orange-700',
  administracion: 'bg-violet-100 text-violet-700',
  otros: 'bg-slate-100 text-slate-600',
};

// --- Estados del Lead (postas / grilla) ---
export type LeadEstado = 'nuevo' | 'en_revision' | 'derivado' | 'en_proceso' | 'finalizado' | 'perdido';

export const LEAD_ESTADO_LABELS: Record<LeadEstado, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  derivado: 'Derivado',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
  perdido: 'Perdido',
};

export const LEAD_ESTADO_COLORS: Record<LeadEstado, string> = {
  nuevo: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-amber-100 text-amber-800',
  derivado: 'bg-purple-100 text-purple-800',
  en_proceso: 'bg-cyan-100 text-cyan-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  perdido: 'bg-red-100 text-red-600',
};

// --- Posta (derivación) ---
export interface Posta {
  id: string;
  fecha: string; // ISO
  deUsuarioId: string;
  deUsuarioNombre: string;
  aUsuarioId: string;
  aUsuarioNombre: string;
  comentario?: string;
  estadoAnterior: LeadEstado;
  estadoNuevo: LeadEstado;
}

// --- Postas Workflow (derivaciones entre usuarios) ---

export type PostaCategoria = 'administracion' | 'soporte_tecnico';

export const POSTA_CATEGORIA_LABELS: Record<PostaCategoria, string> = {
  administracion: 'Administración',
  soporte_tecnico: 'Soporte Técnico',
};

export const POSTA_CATEGORIA_COLORS: Record<PostaCategoria, string> = {
  administracion: 'bg-violet-100 text-violet-700',
  soporte_tecnico: 'bg-cyan-100 text-cyan-700',
};

export type PostaTipoEntidad = 'orden_compra' | 'importacion' | 'presupuesto' | 'requerimiento' | 'agenda';

export const POSTA_TIPO_ENTIDAD_LABELS: Record<PostaTipoEntidad, string> = {
  orden_compra: 'Orden de Compra',
  importacion: 'Importación',
  presupuesto: 'Presupuesto',
  requerimiento: 'Requerimiento',
  agenda: 'Agenda',
};

export type PostaEstado = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada';

export const POSTA_ESTADO_LABELS: Record<PostaEstado, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const POSTA_ESTADO_COLORS: Record<PostaEstado, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  en_proceso: 'bg-blue-100 text-blue-800',
  completada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-red-100 text-red-600',
};

export type PostaPrioridad = 'baja' | 'normal' | 'alta' | 'urgente';

export const POSTA_PRIORIDAD_LABELS: Record<PostaPrioridad, string> = {
  baja: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente',
};

export const POSTA_PRIORIDAD_COLORS: Record<PostaPrioridad, string> = {
  baja: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-50 text-blue-600',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

export interface PostaHandoff {
  fecha: string;
  deUsuarioId: string;
  deUsuarioNombre: string;
  aUsuarioId: string;
  aUsuarioNombre: string;
  accion: string;
  comentario: string | null;
}

export interface PostaWorkflow {
  id: string;
  tipoEntidad: PostaTipoEntidad;
  entidadId: string;
  entidadNumero: string;
  entidadDescripcion: string;
  categoria: PostaCategoria;
  responsableId: string;
  responsableNombre: string;
  creadoPorId: string;
  creadoPorNombre: string;
  estado: PostaEstado;
  prioridad: PostaPrioridad;
  accionRequerida: string;
  historial: PostaHandoff[];
  comentario: string | null;
  fechaCreacion: string;
  fechaVencimiento: string | null;
  fechaCompletada: string | null;
  createdAt: string;
  updatedAt: string;
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
  derivadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizadoAt?: string | null;
  descripcion?: string | null;
  presupuestosIds?: string[];
  otIds?: string[];
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
  | 'aguarda';

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
};

// --- Item de Presupuesto ---
export interface PresupuestoItem {
  id: string;
  codigoProducto?: string | null; // Part number (ej: G1312-60067)
  descripcion: string;
  cantidad: number;
  unidad: string; // 'unidad', 'hora', 'servicio', etc.
  precioUnitario: number;
  categoriaPresupuestoId?: string; // Referencia a categoría para aplicar reglas tributarias
  subtotal: number;
  /** FK opcional a artículos de stock (integración futura) */
  stockArticuloId?: string | null;
  /** FK opcional al catálogo de conceptos de servicio */
  conceptoServicioId?: string | null;
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
  // --- Textos ---
  notasTecnicas?: string;
  condicionesComerciales?: string | null;
  // --- Fechas y validez ---
  validezDias: number; // Días de validez (default 15)
  validUntil?: string;
  fechaEnvio?: string;
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
  | 'pass_fail';

export interface TableCatalogColumn {
  key: string;
  label: string;
  type: TableCatalogColumnType;
  unit?: string | null;
  required: boolean;
  expectedValue?: string | null;
  /** Admin-defined fixed value shown to techs (for type='fixed_text') */
  fixedValue?: string | null;
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
export type ChecklistItemType = 'checkbox' | 'value_input' | 'pass_fail';

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
}

/** Respuesta del técnico para un ítem de checklist */
export type ChecklistItemAnswer =
  | { itemType: 'checkbox'; checked: boolean }
  | { itemType: 'value_input'; value: string }
  | { itemType: 'pass_fail'; result: 'CUMPLE' | 'NO_CUMPLE' | 'NA' | '' };

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
  tableType: 'validation' | 'informational' | 'instruments' | 'checklist' | 'text';
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
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// --- Selecciones de protocolo (tablas completadas por el técnico en una OT) ---

/** Una tabla del catálogo completada por el técnico durante la ejecución de una OT. */
export interface ProtocolSelection {
  /** FK a /tableCatalog/{tableId} */
  tableId: string;
  /** Filas completadas con los valores medidos por el técnico */
  completedRows: TableCatalogRow[];
  observaciones?: string | null;
  resultado: 'CONFORME' | 'NO_CONFORME' | 'PENDIENTE';
  completadoAt: string;
  /** Respuestas del técnico para checklists (tableType === 'checklist') */
  checklistData?: Record<string, ChecklistItemAnswer>;
  /** Valores seleccionados en los campos de encabezado (fieldId → valor) */
  headerData?: Record<string, string>;
  /** itemIds de secciones marcadas "No Aplica" por el técnico */
  collapsedSections?: string[];
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
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
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
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

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

export type UserRole = 'admin' | 'ingeniero_soporte' | 'admin_soporte' | 'administracion';
export type UserStatus = 'pendiente' | 'activo' | 'deshabilitado';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  ingeniero_soporte: 'Ingeniero de Soporte',
  admin_soporte: 'Admin de Soporte',
  administracion: 'Administracion',
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

export interface UsuarioAGS {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole | null;
  status: UserStatus;
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
