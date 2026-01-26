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
  clienteId?: string; // Referencia al cliente en sistema modular
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

// --- Condición de pago (Clientes) ---
export type CondicionPago =
  | 'contado'
  | 'pago_anticipado'
  | '30_dias'
  | '60_dias'
  | '90_dias'
  | 'otro';

// --- Tipo de servicio (Clientes) ---
export type TipoServicioCliente =
  | 'contrato'
  | 'per_incident';

// --- Módulo Clientes ---
export interface ContactoCliente {
  id: string;
  nombre: string;
  cargo: string;
  sector: string; // Sector del contacto (laboratorio, control de calidad, compras, etc.)
  telefono: string;
  interno?: string; // Interno del teléfono
  email: string;
  esPrincipal: boolean;
}

export interface Cliente {
  id: string;
  razonSocial: string;
  cuit?: string;
  pais: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal?: string;
  rubro: string;
  condicionIva?: CondicionIva;
  ingresosBrutos?: string;
  convenioMultilateral?: boolean;
  infoPagos?: string;
  pagaEnTiempo?: boolean;
  sueleDemorarse?: boolean;
  condicionPago?: CondicionPago;
  tipoServicio?: TipoServicioCliente; // 'contrato' | 'per_incident' - afecta tiempo de respuesta y si OT requiere presupuesto
  contactos: ContactoCliente[];
  notas?: string;
  activo: boolean;
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
  clienteId: string;
  categoriaId: string;
  nombre: string; // ej. HPLC 1260 (ahora viene de modelos de categoría)
  descripcion?: string; // Campo eliminado - el nombre del modelo es suficiente
  codigoInternoCliente: string; // asignado por cliente o provisorio editable
  software?: string; // Información del software del sistema
  observaciones?: string;
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
  clienteId: string;
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
