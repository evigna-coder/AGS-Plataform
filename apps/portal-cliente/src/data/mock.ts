import type { BienvenidaData, ClientePortal } from './types';

/**
 * Datos de demostración para la fundación del portal.
 * TODO(datos): reemplazar por servicios Firestore scopeados por `clienteId`
 * (claim del token) — ver functions/setClientClaims + reglas multi-tenant.
 */

export const MOCK_CLIENTE: ClientePortal = {
  id: '30-11122333-4',
  razonSocial: 'Farmacéutica del Plata',
  iniciales: 'FP',
  establecimientosCount: 3,
};

export const MOCK_BIENVENIDA: BienvenidaData = {
  cliente: MOCK_CLIENTE,
  fleet: {
    total: 42,
    operativos: 36,
    enBench: 4,
    informesNuevos: 5,
    proximosServicios: 6,
  },
  actividad: [
    {
      id: 'a1',
      tone: 'teal',
      title: 'OT-14827 finalizada — informe PDF disponible',
      meta: 'Hace 2 h · UV-1900 · descargar',
    },
    {
      id: 'a2',
      tone: 'success',
      title: 'Ficha FPC-0044 lista para entrega',
      meta: 'Hoy 08:40 · pHmetro pH-700',
    },
    {
      id: 'a3',
      tone: 'info',
      title: 'Nuevo servicio programado en agenda',
      meta: 'Ayer · HPLC 1260 · 12 ago',
    },
    {
      id: 'a4',
      tone: 'warn',
      title: 'Ficha FPC-0041 ingresó al bench',
      meta: '21/07 · Balanza XPR206',
    },
    {
      id: 'a5',
      tone: 'teal',
      title: 'OT-14790 finalizada — informe PDF disponible',
      meta: '18/07 · GC-2030 · descargar',
    },
  ],
  actualizadoAt: '2026-07-25T09:14:00-03:00',
};
