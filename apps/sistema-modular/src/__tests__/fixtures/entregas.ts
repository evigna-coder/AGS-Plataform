/**
 * Phase 16 — Fixtures para test:entregas.
 * Patrón: builders puros que devuelven shapes válidos del modelo @ags/shared.
 * Sin Firestore, sin Date.now() — fechas hardcoded para tests determinísticos.
 */
import type {
  Presupuesto,
  PresupuestoItem,
  RequerimientoCompra,
  Importacion,
} from '@ags/shared';

// Fecha base "hoy" para tests determinísticos: 2026-06-01
export const FIXTURE_NOW = new Date('2026-06-01T12:00:00.000Z');

// ENT-01 / ENT-02 helpers — fechaAceptacion = 2026-05-15 (17 días antes de "hoy")
// Si etaDiasEstimados = 30 → etaFecha = 2026-06-14 → diasRestantes = 13 → verde
// Si etaDiasEstimados = 20 → etaFecha = 2026-06-04 →  3 → amarillo
// Si etaDiasEstimados = 10 → etaFecha = 2026-05-25 → -7 → rojo

export function makePresupuestoBase(overrides: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 'PPTO-001',
    numero: 'PRE-0001',
    tipo: 'partes',
    moneda: 'USD',
    clienteId: 'CLI-001',
    estado: 'aceptado',
    items: [],
    subtotal: 0,
    total: 0,
    ordenesCompraIds: [],
    adjuntos: [],
    validezDias: 15,
    fechaAceptacion: '2026-05-15T10:00:00.000Z',
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-05-15T10:00:00.000Z',
    ...overrides,
  } as Presupuesto;
}

export function makeItem(overrides: Partial<PresupuestoItem> = {}): PresupuestoItem {
  return {
    id: 'ITEM-1',
    descripcion: 'Columna HPLC Eclipse XDB-C18',
    cantidad: 1,
    unidad: 'unidad',
    precioUnitario: 1200,
    subtotal: 1200,
    moneda: 'USD',
    disponibilidad: 'a_importar',
    etaDiasEstimados: 30,
    ...overrides,
  } as PresupuestoItem;
}

export function makeRequerimiento(overrides: Partial<RequerimientoCompra> = {}): RequerimientoCompra {
  return {
    id: 'REQ-001',
    numero: 'REQ-0001',
    articuloId: 'ART-1',
    articuloCodigo: 'G1312-60067',
    articuloDescripcion: 'Columna HPLC Eclipse XDB-C18',
    cantidad: 1,
    unidadMedida: 'unidad',
    motivo: 'Auto',
    origen: 'presupuesto',
    estado: 'pendiente',
    solicitadoPor: 'Sistema',
    fechaSolicitud: '2026-05-15T10:00:00.000Z',
    presupuestoId: 'PPTO-001',
    presupuestoItemId: 'ITEM-1',     // ENT-03 critical: join key
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-15T10:00:00.000Z',
    ...overrides,
  } as RequerimientoCompra;
}

export function makeOC(overrides: { id?: string; numero?: string; items?: Array<{ id: string; requerimientoId?: string | null }> } = {}) {
  return {
    id: 'OC-001',
    numero: 'OC-2025-0042',
    items: [{ id: 'OCITEM-1', requerimientoId: 'REQ-001' }],
    ...overrides,
  };
}

export function makeImportacion(overrides: Partial<Importacion> = {}): Importacion {
  return {
    id: 'IMP-001',
    numero: 'IMP-0001',
    estado: 'en_transito',
    ordenCompraId: 'OC-001',
    ordenCompraNumero: 'OC-2025-0042',
    proveedorId: 'PROV-1',
    proveedorNombre: 'Agilent',
    gastos: [],
    documentos: [],
    items: [
      {
        id: 'IMPITEM-1',
        itemOCId: 'OCITEM-1',
        articuloId: 'ART-1',
        articuloCodigo: 'G1312-60067',
        descripcion: 'Columna HPLC',
        cantidadPedida: 1,
        cantidadRecibida: 0,
        unidadMedida: 'unidad',
        requerimientoId: 'REQ-001',
      },
    ],
    createdAt: '2026-05-16T10:00:00.000Z',
    updatedAt: '2026-05-16T10:00:00.000Z',
    ...overrides,
  } as unknown as Importacion;
}

export const CLIENTE_NOMBRE_BY_ID = new Map<string, string>([
  ['CLI-001', 'Bayer S.A.'],
]);
