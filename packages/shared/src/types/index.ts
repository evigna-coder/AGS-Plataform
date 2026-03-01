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
  /** FK opcional a artículos de stock (integración futura) */
  stockArticuloId?: string | null;
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

export interface TableCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  sysType: string;
  isDefault: boolean;
  tableType: 'validation' | 'informational' | 'instruments' | 'checklist';
  columns: TableCatalogColumn[];
  templateRows: TableCatalogRow[];
  validationRules: TableCatalogRule[];
  /**
   * Cuando es `true`, el ingeniero puede activar "Ver especificación del cliente":
   * el valor de fábrica (templateRows) se muestra como referencia y el ingeniero
   * escribe su propia especificación, que es la que se usa para calcular Conclusión.
   */
  allowClientSpec?: boolean;
  /**
   * Tipos de servicio con los que se asocia esta tabla (ej. "Calificación de operación").
   * Si está vacío o ausente, la tabla no se filtra por servicio y aparece siempre.
   */
  tipoServicio?: string[];
  /**
   * Ítems del checklist (solo cuando tableType === 'checklist').
   */
  checklistItems?: ChecklistItem[];
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
  createdBy?: string;
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

export interface Proveedor {
  id: string;
  nombre: string;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  pais?: string | null;
  cuit?: string | null;
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
  createdBy?: string;
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
  createdBy?: string;
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
  createdBy?: string;
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
  createdBy?: string;
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
  createdBy?: string;
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
  createdBy?: string;
}
