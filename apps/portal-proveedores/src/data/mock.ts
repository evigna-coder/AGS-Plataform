import { useEffect, useState } from 'react';
import type { DashboardData, ProveedorPortal } from './types';

/**
 * Datos de demostración para la fundación del portal proveedores.
 * TODO(datos): reemplazar por servicios Firestore scopeados por el proveedor del token.
 */

export const MOCK_PROVEEDOR: ProveedorPortal = {
  id: '30-99887766-5',
  razonSocial: 'Repuestos Científicos SRL',
  iniciales: 'RC',
};

export const MOCK_DASHBOARD: DashboardData = {
  proveedor: MOCK_PROVEEDOR,
  kpis: [
    { label: 'REQUERIMIENTOS NUEVOS', value: '3', sub: 'por cotizar', tone: 'info', icon: 'inbox' },
    { label: 'ÓRDENES ACTIVAS', value: '5', sub: 'en curso', tone: 'teal', icon: 'clipboard-list' },
    { label: 'ENTREGAS ESTA SEMANA', value: '2', sub: 'a despachar', tone: 'warn', icon: 'truck' },
    { label: 'ÍTEMS PENDIENTES', value: '14', sub: 'en 5 OCs', tone: 'neutral', icon: 'package' },
  ],
  requerimientos: [
    {
      id: 'REQ-2041',
      parte: 'Lámpara de deuterio',
      equipo: 'UV-1900 · Espectrofotómetros',
      cantidad: 1,
      estado: 'nuevo',
    },
    {
      id: 'REQ-2038',
      parte: 'Kit de sellos de bomba',
      equipo: 'HPLC 1260 · Cromatógrafos',
      cantidad: 2,
      estado: 'cotizado',
    },
    {
      id: 'REQ-2035',
      parte: 'Válvula de inyección',
      equipo: 'GC-2030 · Cromatógrafos',
      cantidad: 1,
      estado: 'nuevo',
    },
  ],
  ocs: [
    { numero: 'OC-0912', itemsCount: 4, monto: 'USD 3.240', estado: 'confirmada', entrega: null },
    { numero: 'OC-0908', itemsCount: 2, monto: 'USD 1.150', estado: 'en_preparacion', entrega: '02 ago 2026' },
    { numero: 'OC-0905', itemsCount: 6, monto: 'USD 4.120', estado: 'despachada', entrega: '28 jul 2026' },
  ],
  actualizadoAt: '2026-07-25T09:14:00-03:00',
};

export function useDashboard(): { data: DashboardData | null; loading: boolean } {
  const [state, setState] = useState<{ data: DashboardData | null; loading: boolean }>({
    data: null,
    loading: true,
  });
  useEffect(() => {
    const t = setTimeout(() => setState({ data: MOCK_DASHBOARD, loading: false }), 150);
    return () => clearTimeout(t);
  }, []);
  return state;
}
