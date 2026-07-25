import { useEffect, useState } from 'react';
import type { OrdenDetalle, RequerimientoDetalle } from './types';

/**
 * Mock de detalles (requerimientos y órdenes de compra).
 * TODO(datos): reemplazar por servicios Firestore scopeados por el proveedor del token.
 */

const REQUERIMIENTOS: RequerimientoDetalle[] = [
  {
    id: 'REQ-2041',
    parte: 'Lámpara de deuterio (D2)',
    cantidad: 1,
    estado: 'nuevo',
    asignado: '22 jul 2026',
    urgencia: 'Alta · equipo en reparación',
    equipoNombre: 'Espectrofotómetro UV-1900',
    equipoMarca: 'Shimadzu',
    equipoSerie: 'SG-1102',
    notasAgs:
      'Se requiere lámpara original o equivalente compatible con UV-1900. Confirmar disponibilidad y plazo — el equipo del cliente está detenido a la espera de este repuesto.',
  },
  {
    id: 'REQ-2038',
    parte: 'Kit de sellos de bomba',
    cantidad: 2,
    estado: 'cotizado',
    asignado: '20 jul 2026',
    urgencia: 'Media',
    equipoNombre: 'HPLC 1260',
    equipoMarca: 'Agilent Technologies',
    equipoSerie: 'SG-2214-A',
    notasAgs: 'Sellos para bomba cuaternaria. Preferentemente original Agilent.',
    cotizacion: { precioUnitario: '380', marca: 'Agilent — original', plazo: '7 días hábiles' },
  },
  {
    id: 'REQ-2035',
    parte: 'Válvula de inyección',
    cantidad: 1,
    estado: 'nuevo',
    asignado: '18 jul 2026',
    urgencia: 'Alta · equipo en reparación',
    equipoNombre: 'Cromatógrafo GC-2030',
    equipoMarca: 'Shimadzu',
    equipoSerie: 'GC30-8891',
    notasAgs: 'Pérdida de presión en el sistema de inyección. Confirmar compatibilidad con GC-2030.',
  },
];

const ORDENES: OrdenDetalle[] = [
  {
    numero: 'OC-0912',
    estado: 'confirmada',
    emitida: '24 jul 2026',
    cliente: 'AGS Analítica S.A.',
    entrega: null,
    condicionPago: '30 días fecha factura',
    moneda: 'USD',
    requerimientos: 'REQ-2041, REQ-2035',
    total: 'USD 3.240',
    items: [
      { articulo: 'Lámpara de deuterio', equipo: 'UV-1900', cantidad: 1, precioUnit: 'USD 1.240', subtotal: 'USD 1.240' },
      { articulo: 'Kit de sellos de bomba', equipo: 'HPLC 1260', cantidad: 2, precioUnit: 'USD 380', subtotal: 'USD 760' },
      { articulo: 'Filtro de solvente', equipo: 'Genérico', cantidad: 4, precioUnit: 'USD 145', subtotal: 'USD 580' },
      { articulo: 'Vial autosampler x100', equipo: 'GC-2030', cantidad: 2, precioUnit: 'USD 330', subtotal: 'USD 660' },
    ],
  },
  {
    numero: 'OC-0908',
    estado: 'en_preparacion',
    emitida: '18 jul 2026',
    cliente: 'AGS Analítica S.A.',
    entrega: '02 ago 2026',
    condicionPago: '30 días fecha factura',
    moneda: 'USD',
    requerimientos: 'REQ-2029',
    total: 'USD 1.150',
    items: [
      { articulo: 'Electrodo de pH', equipo: 'pH-700', cantidad: 1, precioUnit: 'USD 690', subtotal: 'USD 690' },
      { articulo: 'Solución buffer x6', equipo: 'Genérico', cantidad: 2, precioUnit: 'USD 230', subtotal: 'USD 460' },
    ],
  },
  {
    numero: 'OC-0905',
    estado: 'despachada',
    emitida: '10 jul 2026',
    cliente: 'AGS Analítica S.A.',
    entrega: '28 jul 2026',
    condicionPago: '30 días fecha factura',
    moneda: 'USD',
    requerimientos: 'REQ-2018, REQ-2021',
    total: 'USD 4.120',
    items: [
      { articulo: 'Módulo de detección UV', equipo: 'HPLC 1260', cantidad: 1, precioUnit: 'USD 2.480', subtotal: 'USD 2.480' },
      { articulo: 'Set de tubería PEEK', equipo: 'HPLC 1260', cantidad: 3, precioUnit: 'USD 320', subtotal: 'USD 960' },
    ],
  },
];

export function useRequerimiento(id: string | undefined): {
  req: RequerimientoDetalle | null;
  loading: boolean;
} {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(t);
  }, [id]);
  return { req: id ? REQUERIMIENTOS.find((r) => r.id === id) ?? null : null, loading };
}

export function useOrden(numero: string | undefined): {
  orden: OrdenDetalle | null;
  loading: boolean;
} {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(t);
  }, [numero]);
  return { orden: numero ? ORDENES.find((o) => o.numero === numero) ?? null : null, loading };
}
