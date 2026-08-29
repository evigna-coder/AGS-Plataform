/**
 * Lista estándar de tipos de servicio: réplica de la del reporte de servicio
 * (reportes-ot → ServiceReportSection) + proveedores externos y entrega de insumos.
 * El botón "Cargar tipos estándar" crea solo los que falten (match por nombre normalizado).
 */
export const TIPOS_SERVICIO_ESTANDAR = [
  'Calibración',
  'Calificación de instalación',
  'Calificación de operación',
  'Calificación de operación de software',
  'Capacitación',
  'Cortesía',
  'Desinstalación',
  'Instalación',
  'Limpieza de fuente de Iones',
  'Mantenimiento preventivo con consumibles',
  'Mantenimiento preventivo sin consumibles',
  'Mantenimiento preventivo sin consumibles, incluye limpieza de módulos',
  'Otros',
  'Recalificación post reparación',
  'Reparación en bench',
  'Trabajo en bench',
  'Visita de diagnóstico / reparación',
  'Aznarez',
  'ELS',
  'Entrega de insumos',
  // Ampliación 2026-07-29 (apertura de OT). OJO: estos tipos NO existen en el
  // <select> congelado del reporte técnico (reportes-ot) — si el técnico abre
  // esa OT, ve el desplegable en blanco. Son para OTs administrativas /
  // proveedor externo / entregas, que el técnico normalmente no completa.
  'Proveedor externo ELS',
  'Proveedor externo AZN',
  'Alquiler',
  'Venta concretada',
  // 'Recalificación de operación' se dio de BAJA (2026-08-28): duplicaba
  // 'Recalificación post reparación' (el único válido — es el que conocen el
  // reporte técnico y la biblioteca de tablas). No re-agregarlo.
  'Entrega de lámpara',
];
