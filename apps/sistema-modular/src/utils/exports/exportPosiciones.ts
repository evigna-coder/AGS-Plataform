import type { TipoPosicionStock } from '@ags/shared';
import type { PosicionNode } from '../../hooks/usePosicionesTree';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Posiciones de Stock (Excel + PDF vía ExportarButton).
 * La página lista un árbol; el export lo aplana en orden visual (depth-first)
 * incluyendo TODAS las sub-posiciones que matchean los filtros, estén o no
 * expandidas en pantalla. TIPO_POSICION_LABELS vivía en PosicionesPage.
 */
export const TIPO_POSICION_LABELS: Record<TipoPosicionStock, string> = {
  cajonera: 'Cajonera', estante: 'Estante', deposito: 'Depósito', vitrina: 'Vitrina', otro: 'Otro',
};

export interface PosicionExportRow {
  node: PosicionNode;
  /** Código de la posición padre ('' para raíces). */
  padre: string;
}

export function buildPosicionesExportRows(tree: PosicionNode[]): PosicionExportRow[] {
  const rows: PosicionExportRow[] = [];
  const walk = (nodes: PosicionNode[], padre: string) => {
    for (const n of nodes) {
      rows.push({ node: n, padre });
      walk(n.children, n.codigo);
    }
  };
  walk(tree, '');
  return rows;
}

/** Línea "Filtros: …" del export — refleja los filtros activos de PosicionesPage. */
export function buildPosicionesFiltrosExport(
  f: { busqueda: string; tipo: string; zona: string; showInactive: boolean },
): string[] {
  return filtrosAplicadosDesc({
    'Búsqueda': f.busqueda.trim() ? `'${f.busqueda.trim()}'` : '',
    Tipo: f.tipo ? (TIPO_POSICION_LABELS[f.tipo as TipoPosicionStock] ?? f.tipo) : '',
    Zona: f.zona,
    'Incluye inactivas': f.showInactive,
  });
}

export const POSICIONES_EXPORT_COLUMNS: ExportColumn<PosicionExportRow>[] = [
  { header: 'Código',         width: 14, get: r => r.node.codigo },
  { header: 'Nombre',         width: 28, get: r => r.node.nombre },
  { header: 'Tipo',           width: 12, get: r => TIPO_POSICION_LABELS[r.node.tipo] ?? r.node.tipo },
  { header: 'Zona',           width: 14, get: r => r.node.zona || '' },
  { header: 'Posición padre', width: 14, get: r => r.padre },
  { header: 'Sub-posiciones', width: 13, align: 'right', get: r => r.node.children.length },
  { header: 'Activa',         width: 8,  get: r => r.node.activo ? 'Sí' : 'No' },
];
