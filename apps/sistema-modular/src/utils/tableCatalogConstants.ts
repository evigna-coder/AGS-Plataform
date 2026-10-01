/**
 * Constantes de la Biblioteca de Tablas (2026-10-01).
 * Estaban copiadas en la lista, el editor y el importador.
 */
export const SYS_TYPES = ['HPLC', 'GC', 'MSD', 'HSS', 'SCD', 'UV', 'OSMOMETRO', 'POLARIMETRO', 'HTA', 'OTRO'];

/**
 * Tipos de servicio con protocolo cuando el catálogo `tipos_servicio` todavía no
 * cargó o no tiene ninguno marcado con `requiresProtocol`. Es la misma lista fija
 * que usa reportes-ot como piso (`CATALOG_SERVICE_TYPES`).
 */
export const SERVICIO_TYPES_FALLBACK = [
  'Calibración',
  'Calificación de instalación',
  'Calificación de operación',
  'Calificación de operación de software',
  'Limpieza de fuente de Iones',
  'Mantenimiento preventivo con consumibles',
  'Mantenimiento preventivo sin consumibles',
  'Mantenimiento preventivo sin consumibles, incluye limpieza de módulos',
  'Recalificación post reparación',
];

export const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Archivada' };
export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  published: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  archived: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};
export const TABLE_TYPE_LABELS: Record<string, string> = {
  validation: 'Validación', informational: 'Informacional', instruments: 'Instrumentos',
  checklist: 'Checklist', text: 'Texto', signatures: 'Firmas', cover: 'Carátula',
};
