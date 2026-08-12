import type { Minikit, EstadoMinikit } from '@ags/shared';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Minikits (Excel + PDF vía ExportarButton).
 * ESTADO_MINIKIT_LABELS vivía en MinikitsList; la página lo importa de acá
 * (los colores del badge quedan en la página).
 */
export const ESTADO_MINIKIT_LABELS: Record<EstadoMinikit, string> = {
  en_base: 'En base', en_campo: 'En campo', en_transito: 'En tránsito', en_revision: 'En revisión',
};

/** Línea "Filtros: …" del export — refleja los filtros activos de MinikitsList. */
export function buildMinikitsFiltrosExport(f: { q: string; showInactive: boolean }): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': f.q.trim() ? `'${f.q.trim()}'` : '',
    'Incluye inactivos': f.showInactive,
  });
}

export const MINIKITS_EXPORT_COLUMNS: ExportColumn<Minikit>[] = [
  { header: 'Código',      width: 12, get: mk => mk.codigo },
  { header: 'Nombre',      width: 26, get: mk => mk.nombre },
  { header: 'Descripción', width: 32, get: mk => mk.descripcion || '' },
  { header: 'Estado',      width: 12, get: mk => ESTADO_MINIKIT_LABELS[mk.estado] ?? mk.estado },
  // Mismo formato que la celda "Asignado a" de la tabla.
  { header: 'Asignado a',  width: 24, get: mk => mk.asignadoA
      ? `${mk.asignadoA.tipo === 'ingeniero' ? 'Ing.' : 'OT'} ${mk.asignadoA.nombre}` : '' },
];
