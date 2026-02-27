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
}

export interface Part {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  origen: string;
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
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
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
  createdBy?: string;
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

/** Helper: devuelve true si el nombre del sistema indica que es un GC */
export function esGaseoso(nombreSistema: string): boolean {
  return nombreSistema.toLowerCase().includes('gaseoso');
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
  createdBy?: string;
}

// --- Motivo del llamado (Leads) ---
export type MotivoLlamado = 'ventas' | 'soporte' | 'insumos' | 'administracion' | 'otros';

// --- Estados del Lead (postas / grilla) ---
export type LeadEstado = 'nuevo' | 'en_revision' | 'derivado' | 'en_proceso' | 'finalizado' | 'perdido';

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
  estado: LeadEstado;
  postas: Posta[];
  asignadoA: string | null;
  derivadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizadoAt?: string | null;
}

// --- Usuario (catálogo postas) ---
export interface UsuarioPosta {
  id: string;
  nombre: string;
  email?: string;
  area?: string;
}

// --- Estados de Presupuesto ---
export type PresupuestoEstado =
  | 'borrador'
  | 'enviado'
  | 'en_seguimiento'
  | 'pendiente_oc'
  | 'aceptado'
  | 'pendiente_certificacion'
  | 'aguarda';

// --- Item de Presupuesto ---
export interface PresupuestoItem {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string; // 'unidad', 'hora', 'servicio', etc.
  precioUnitario: number;
  categoriaPresupuestoId?: string; // Referencia a categoría para aplicar reglas tributarias
  subtotal: number;
}

// --- Orden de Compra (OC) ---
export interface OrdenCompra {
  id: string;
  numero: string; // OC-0000
  presupuestoIds: string[]; // Varios presupuestos pueden tener la misma OC
  archivoUrl?: string; // URL del archivo adjunto en Firebase Storage
  archivoNombre?: string;
  fechaRecepcion: string;
  notas?: string;
  createdAt: string;
  updatedAt: string;
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

// --- Presupuestos ---
export interface Presupuesto {
  id: string;
  numero: string; // PRE-0000 (generado automáticamente)
  clienteId: string; // CUIT o LEGACY-xxx
  establecimientoId?: string | null; // Establecimiento/sede del presupuesto
  sistemaId?: string | null;
  contactoId?: string | null;
  estado: PresupuestoEstado;
  items: PresupuestoItem[];
  subtotal: number;
  total: number;
  tipoCambio?: number; // Tipo de cambio (si aplica)
  condicionPagoId?: string; // Referencia a condición de pago
  ordenesCompraIds: string[]; // Array de IDs de OCs vinculadas
  notasTecnicas?: string;
  validUntil?: string; // Fecha de validez
  fechaEnvio?: string; // Fecha de envío del presupuesto
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
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
  operator: '<=' | '>=' | '<' | '>' | '==' | '!=';
  factoryThreshold: string | number;
  unit?: string | null;
  targetColumn: string;
  valueIfPass: string;
  valueIfFail: string;
}

export interface TableCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  sysType: string;
  isDefault: boolean;
  tableType: 'validation' | 'informational' | 'instruments';
  columns: TableCatalogColumn[];
  templateRows: TableCatalogRow[];
  validationRules: TableCatalogRule[];
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

// --- Usuarios AGS (roles y autenticación) ---

export type RolUsuario = 'admin' | 'tecnico' | 'readonly';

/** Documento en /usuarios/{uid} (uid = Firebase Auth UID). */
export interface UsuarioAGS {
  uid: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
