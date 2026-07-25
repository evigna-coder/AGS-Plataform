import { useEffect, useState } from 'react';
import type { EquipoDetalle, EquipoResumen, SeguimientoEvento } from './types';

/**
 * Mock de equipos del cliente (colección `sistemas` scopeada por `clienteId`).
 * TODO(datos): reemplazar por un servicio Firestore (query por establecimientoId ∈
 * token.establecimientoIds) + joins con `fichas` (bench), `workorders` (historial) y agenda.
 */

const SEG_UV: SeguimientoEvento[] = [
  {
    tone: 'warn',
    title: 'En reparación · repuesto solicitado',
    fecha: '22 jul · 11:20',
    nota: 'Se identificó falla en la lámpara de deuterio; se solicitó el repuesto al proveedor.',
  },
  {
    tone: 'teal',
    title: 'Diagnóstico completado',
    fecha: '19 jul · 16:05',
    nota: 'Deriva de línea de base confirmada. Se define reemplazo de lámpara.',
  },
  {
    tone: 'teal',
    title: 'Recibido en bench AGS',
    fecha: '18 jul · 09:30',
    nota: 'Ingreso registrado. Equipo de préstamo LN-012 entregado.',
  },
];

const DETALLES: EquipoDetalle[] = [
  {
    id: 'AGS-EQ-1043',
    nombre: 'HPLC 1260',
    categoria: 'Cromatógrafos',
    marca: 'Agilent Technologies',
    establecimiento: 'Planta 1 — Pilar',
    sector: 'Control de Calidad',
    estado: 'operativo',
    contrato: true,
    otsCount: 14,
    icon: 'activity',
    serie: 'SG-2214-A',
    software: 'OpenLab CDS 2.7',
    ultimoServicio: '12 jun 2026',
    proximoServicio: '12 ago 2026',
    otsPorAnio: [
      { anio: '2022', cantidad: 3 },
      { anio: '2023', cantidad: 4 },
      { anio: '2024', cantidad: 2 },
      { anio: '2025', cantidad: 3 },
      { anio: '2026', cantidad: 2 },
    ],
    ultimasOts: [
      { id: 'OT-14827', tipo: 'Calibración', fecha: '12/06/2026', pdf: true },
      { id: 'OT-14512', tipo: 'Mantenimiento preventivo', fecha: '03/03/2026', pdf: true },
      { id: 'OT-14201', tipo: 'Reparación', fecha: '18/11/2025', pdf: true },
    ],
  },
  {
    id: 'AGS-EQ-1051',
    nombre: 'Espectrofotómetro UV-1900',
    categoria: 'Espectrofotómetros',
    marca: 'Shimadzu',
    establecimiento: 'Planta 1 — Pilar',
    sector: 'Control de Calidad',
    estado: 'en_reparacion',
    contrato: true,
    otsCount: 9,
    icon: 'scan-line',
    serie: 'SG-1102',
    software: 'LabSolutions UV-Vis',
    ultimoServicio: '19 jul 2026',
    otsPorAnio: [
      { anio: '2023', cantidad: 2 },
      { anio: '2024', cantidad: 3 },
      { anio: '2025', cantidad: 2 },
      { anio: '2026', cantidad: 2 },
    ],
    ultimasOts: [
      { id: 'OT-14803', tipo: 'Diagnóstico', fecha: '19/07/2026', pdf: true },
      { id: 'OT-14311', tipo: 'Calibración', fecha: '20/01/2026', pdf: true },
    ],
    ficha: {
      numero: 'FPC-0043',
      ingreso: '18 jul 2026',
      etaEntrega: '30 jul 2026',
      loaner: 'LN-012',
      repuestoPendiente: 'Lámpara de deuterio — en compra al proveedor',
      sintomas: 'Deriva de línea de base y error de calibración de longitud de onda al encender.',
      pasoActual: 'Reparación',
      totalPasos: 6,
      pasos: [
        { label: 'Recibido', fecha: '18 jul', status: 'done' },
        { label: 'Diagnóstico', fecha: '19 jul', status: 'done' },
        { label: 'Reparación', fecha: '22 jul', status: 'current' },
        { label: 'Esperando repuesto', status: 'pending' },
        { label: 'Listo p/ entrega', status: 'pending' },
        { label: 'Entregado', status: 'pending' },
      ],
      seguimiento: SEG_UV,
    },
  },
  {
    id: 'AGS-EQ-1067',
    nombre: 'Balanza analítica XPR206',
    categoria: 'Balanzas analíticas',
    marca: 'Mettler Toledo',
    establecimiento: 'Planta 1 — Pilar',
    sector: 'Pesada',
    estado: 'en_diagnostico',
    contrato: true,
    otsCount: 6,
    icon: 'scale',
    serie: 'B4477120',
    ultimoServicio: '21 jul 2026',
    otsPorAnio: [
      { anio: '2024', cantidad: 2 },
      { anio: '2025', cantidad: 2 },
      { anio: '2026', cantidad: 2 },
    ],
    ultimasOts: [{ id: 'OT-14829', tipo: 'Diagnóstico', fecha: '21/07/2026', pdf: false }],
    ficha: {
      numero: 'FPC-0041',
      ingreso: '21 jul 2026',
      etaEntrega: '01 ago 2026',
      sintomas: 'Lecturas inestables y error de nivelación reportado por el operador.',
      pasoActual: 'Diagnóstico',
      totalPasos: 6,
      pasos: [
        { label: 'Recibido', fecha: '21 jul', status: 'done' },
        { label: 'Diagnóstico', fecha: '22 jul', status: 'current' },
        { label: 'Reparación', status: 'pending' },
        { label: 'Esperando repuesto', status: 'pending' },
        { label: 'Listo p/ entrega', status: 'pending' },
        { label: 'Entregado', status: 'pending' },
      ],
      seguimiento: [
        {
          tone: 'info',
          title: 'En diagnóstico',
          fecha: '22 jul · 10:10',
          nota: 'Se inicia la revisión de la celda de pesada y el sistema de nivelación.',
        },
        {
          tone: 'teal',
          title: 'Recibido en bench AGS',
          fecha: '21 jul · 15:40',
          nota: 'Ingreso registrado.',
        },
      ],
    },
  },
  {
    id: 'AGS-EQ-1044',
    nombre: 'Cromatógrafo GC-2030',
    categoria: 'Cromatógrafos',
    marca: 'Shimadzu',
    establecimiento: 'Planta 2 — Escobar',
    sector: 'I+D',
    estado: 'esperando_repuesto',
    contrato: false,
    otsCount: 11,
    icon: 'activity',
    serie: 'GC30-8891',
    ultimoServicio: '09 jul 2026',
    otsPorAnio: [
      { anio: '2023', cantidad: 3 },
      { anio: '2024', cantidad: 3 },
      { anio: '2025', cantidad: 3 },
      { anio: '2026', cantidad: 2 },
    ],
    ultimasOts: [
      { id: 'OT-14760', tipo: 'Reparación', fecha: '09/07/2026', pdf: true },
      { id: 'OT-14402', tipo: 'Mantenimiento preventivo', fecha: '14/02/2026', pdf: true },
    ],
    ficha: {
      numero: 'FPC-0039',
      ingreso: '09 jul 2026',
      etaEntrega: '30 jul 2026',
      repuestoPendiente: 'Válvula de inyección — importación en curso',
      sintomas: 'Pérdida de presión en el sistema de inyección.',
      pasoActual: 'Esperando repuesto',
      totalPasos: 6,
      pasos: [
        { label: 'Recibido', fecha: '09 jul', status: 'done' },
        { label: 'Diagnóstico', fecha: '11 jul', status: 'done' },
        { label: 'Reparación', fecha: '15 jul', status: 'done' },
        { label: 'Esperando repuesto', fecha: '16 jul', status: 'current' },
        { label: 'Listo p/ entrega', status: 'pending' },
        { label: 'Entregado', status: 'pending' },
      ],
      seguimiento: [
        {
          tone: 'danger',
          title: 'Esperando repuesto',
          fecha: '16 jul · 09:00',
          nota: 'Válvula de inyección solicitada al proveedor (importación).',
        },
        {
          tone: 'teal',
          title: 'Diagnóstico completado',
          fecha: '11 jul · 14:20',
          nota: 'Se confirma reemplazo de la válvula de inyección.',
        },
      ],
    },
  },
  {
    id: 'AGS-EQ-1072',
    nombre: 'pHmetro pH-700',
    categoria: 'pHmetros',
    marca: 'Hanna',
    establecimiento: 'Planta 1 — Pilar',
    sector: 'Control de Calidad',
    estado: 'listo_entrega',
    contrato: true,
    otsCount: 4,
    icon: 'droplet',
    serie: 'HN70-2231',
    ultimoServicio: '22 jul 2026',
    otsPorAnio: [
      { anio: '2024', cantidad: 1 },
      { anio: '2025', cantidad: 1 },
      { anio: '2026', cantidad: 2 },
    ],
    ultimasOts: [{ id: 'OT-14830', tipo: 'Reparación', fecha: '22/07/2026', pdf: false }],
    ficha: {
      numero: 'FPC-0044',
      ingreso: '22 jul 2026',
      loaner: 'LN-020',
      pasoActual: 'Listo para entrega',
      totalPasos: 6,
      pasos: [
        { label: 'Recibido', fecha: '22 jul', status: 'done' },
        { label: 'Diagnóstico', fecha: '22 jul', status: 'done' },
        { label: 'Reparación', fecha: '24 jul', status: 'done' },
        { label: 'Listo p/ entrega', fecha: '25 jul', status: 'current' },
        { label: 'Entregado', status: 'pending' },
      ],
      seguimiento: [
        {
          tone: 'success',
          title: 'Listo para entrega',
          fecha: '25 jul · 08:40',
          nota: 'Reparación finalizada. Coordinar retiro o envío.',
        },
      ],
    },
  },
  {
    id: 'AGS-EQ-1080',
    nombre: 'Autoclave 3870',
    categoria: 'Autoclaves',
    marca: 'Tuttnauer',
    establecimiento: 'Planta 2 — Escobar',
    sector: 'Microbiología',
    estado: 'operativo',
    contrato: false,
    otsCount: 7,
    icon: 'flame',
    serie: 'TU38-4410',
    ultimoServicio: '30 may 2026',
    proximoServicio: '03 sep 2026',
    otsPorAnio: [
      { anio: '2023', cantidad: 2 },
      { anio: '2024', cantidad: 2 },
      { anio: '2025', cantidad: 2 },
      { anio: '2026', cantidad: 1 },
    ],
    ultimasOts: [
      { id: 'OT-14680', tipo: 'Mantenimiento preventivo', fecha: '30/05/2026', pdf: true },
    ],
  },
  {
    id: 'AGS-EQ-1090',
    nombre: 'Centrífuga 5804',
    categoria: 'Centrífugas',
    marca: 'Eppendorf',
    establecimiento: 'Planta 1 — Pilar',
    sector: 'Control de Calidad',
    estado: 'operativo',
    contrato: true,
    otsCount: 3,
    icon: 'disc-3',
    serie: 'EP58-1180',
    ultimoServicio: '15 abr 2026',
    proximoServicio: '15 oct 2026',
    otsPorAnio: [
      { anio: '2024', cantidad: 1 },
      { anio: '2025', cantidad: 1 },
      { anio: '2026', cantidad: 1 },
    ],
    ultimasOts: [{ id: 'OT-14590', tipo: 'Calibración', fecha: '15/04/2026', pdf: true }],
  },
  {
    id: 'AGS-EQ-1101',
    nombre: 'Freezer -80',
    categoria: 'Ultracongeladores',
    marca: 'Thermo Scientific',
    establecimiento: 'Planta 3 — Depósito',
    sector: 'Almacenamiento',
    estado: 'operativo',
    contrato: false,
    otsCount: 2,
    icon: 'snowflake',
    serie: 'TH80-9902',
    ultimoServicio: '10 mar 2026',
    otsPorAnio: [
      { anio: '2025', cantidad: 1 },
      { anio: '2026', cantidad: 1 },
    ],
    ultimasOts: [{ id: 'OT-14520', tipo: 'Mantenimiento preventivo', fecha: '10/03/2026', pdf: true }],
  },
];

const RESUMENES: EquipoResumen[] = DETALLES.map((d) => ({
  id: d.id,
  nombre: d.nombre,
  categoria: d.categoria,
  marca: d.marca,
  establecimiento: d.establecimiento,
  sector: d.sector,
  estado: d.estado,
  contrato: d.contrato,
  otsCount: d.otsCount,
  icon: d.icon,
}));

export function useEquipos(): { equipos: EquipoResumen[]; loading: boolean } {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(t);
  }, []);
  return { equipos: RESUMENES, loading };
}

export function useEquipoDetalle(id: string | undefined): {
  equipo: EquipoDetalle | null;
  loading: boolean;
} {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(t);
  }, [id]);
  const equipo = id ? DETALLES.find((d) => d.id === id) ?? null : null;
  return { equipo, loading };
}

export const PRIMER_EQUIPO_ID = RESUMENES[0].id;
