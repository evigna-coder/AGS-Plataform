import type { BadgeTone } from '@/components/ui/Badge';

/**
 * View-models del portal proveedores.
 * TODO(datos): mapear desde Firestore — requerimientos (derivaciones a proveedor sobre
 * FichaPropiedad) + `ordenesCompra` scopeadas por el proveedor autenticado.
 */

export interface ProveedorPortal {
  id: string;
  razonSocial: string;
  iniciales: string;
}

export type RequerimientoEstado = 'nuevo' | 'cotizado';

export interface Requerimiento {
  id: string;
  parte: string;
  equipo: string;
  cantidad: number;
  estado: RequerimientoEstado;
}

export type OcEstado = 'confirmada' | 'en_preparacion' | 'despachada';

export interface OrdenCompra {
  numero: string;
  itemsCount: number;
  monto: string;
  estado: OcEstado;
  /** Fecha de entrega informada; null = todavía falta informarla. */
  entrega: string | null;
}

export interface Kpi {
  label: string;
  value: string;
  sub: string;
  tone: BadgeTone;
  icon: string;
}

export interface DashboardData {
  proveedor: ProveedorPortal;
  kpis: Kpi[];
  requerimientos: Requerimiento[];
  ocs: OrdenCompra[];
  actualizadoAt: string;
}

export const REQ_BADGE: Record<RequerimientoEstado, { label: string; tone: BadgeTone }> = {
  nuevo: { label: 'Nuevo', tone: 'info' },
  cotizado: { label: 'Cotizado', tone: 'success' },
};

export const OC_BADGE: Record<OcEstado, { label: string; tone: BadgeTone }> = {
  confirmada: { label: 'Confirmada', tone: 'info' },
  en_preparacion: { label: 'En preparación', tone: 'warn' },
  despachada: { label: 'Despachada', tone: 'success' },
};

// ─── Detalles ───────────────────────────────────────────────────────

export interface RequerimientoDetalle {
  id: string;
  parte: string;
  cantidad: number;
  estado: RequerimientoEstado;
  asignado: string;
  urgencia: string;
  equipoNombre: string;
  equipoMarca: string;
  equipoSerie: string;
  notasAgs: string;
  /** Si ya fue cotizado, precarga el formulario. */
  cotizacion?: { precioUnitario: string; marca: string; plazo: string };
}

export interface OcItem {
  articulo: string;
  equipo: string;
  cantidad: number;
  precioUnit: string;
  subtotal: string;
}

export interface OrdenDetalle {
  numero: string;
  estado: OcEstado;
  emitida: string;
  cliente: string;
  items: OcItem[];
  total: string;
  entrega: string | null;
  condicionPago: string;
  moneda: string;
  requerimientos: string;
}
