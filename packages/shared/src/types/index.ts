// Tipos compartidos entre reportes-ot y sistema-modular

// Tipos de OT (Work Order)
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
  telefono: string;
  email: string;
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
  nombre: string; // ej. HPLC 1260
  descripcion: string; // ej. Cromatógrafo líquido
  codigoInternoCliente: string; // asignado por cliente o provisorio editable
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

// --- Presupuestos ---
export interface Quote {
  id: string;
  leadId?: string;
  clienteId: string;
  sistemaId?: string | null;
  numero: string; // PRE-0000
  items: QuoteItem[];
  total: number;
  status: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'vencido';
  validUntil: string;
  createdAt: string;
  createdBy: string;
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
