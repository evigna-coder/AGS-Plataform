import type { PresupuestoItem } from '@ags/shared';

export interface GrupoSistemaPDF {
  grupo: number;
  sistemaNombre: string;
  items: PresupuestoItem[];
  servicios: PresupuestoItem[];
  totalGrupo: number;
}

export function agruparPorSistema(items: PresupuestoItem[]): GrupoSistemaPDF[] {
  const grupos: Record<number, GrupoSistemaPDF> = {};

  for (const item of items) {
    const g = item.grupo || 0;
    if (!grupos[g]) {
      grupos[g] = {
        grupo: g,
        sistemaNombre: item.sistemaNombre || (g === 0 ? 'Servicios generales' : 'Sin sistema'),
        items: [],
        servicios: [],
        totalGrupo: 0,
      };
    }
    const subNum = parseFloat(item.subItem || '0');
    if (subNum >= 1.2 && subNum < 2) {
      grupos[g].servicios.push(item);
    } else {
      grupos[g].items.push(item);
    }
    grupos[g].totalGrupo += item.subtotal || 0;
  }

  return Object.values(grupos).sort((a, b) => a.grupo - b.grupo);
}

/** Simplified grouping for standard PDF (no servicio split) */
export interface GrupoSistemaSimple {
  grupo: number;
  sistemaNombre: string;
  items: PresupuestoItem[];
  totalGrupo: number;
}

export function agruparPorSistemaSimple(items: PresupuestoItem[]): GrupoSistemaSimple[] {
  const grupos: Record<number, GrupoSistemaSimple> = {};

  for (const item of items) {
    const g = item.grupo || 0;
    if (!grupos[g]) {
      grupos[g] = {
        grupo: g,
        sistemaNombre: item.sistemaNombre || (g === 0 ? 'Servicios generales' : 'Sin sistema'),
        items: [],
        totalGrupo: 0,
      };
    }
    grupos[g].items.push(item);
    grupos[g].totalGrupo += item.subtotal || 0;
  }

  return Object.values(grupos).sort((a, b) => a.grupo - b.grupo);
}
