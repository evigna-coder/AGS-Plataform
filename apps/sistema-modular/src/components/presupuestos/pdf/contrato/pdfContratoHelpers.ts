import type { PresupuestoItem } from '@ags/shared';

export function fmtNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(val: any): string {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

export function fmtDateISO(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Grouping ──
export interface SistemaGroup {
  grupo: number;
  sistemaId: string | null;
  sistemaNombre: string;
  sistemaCodigoInterno: string | null;
  moduloSeriePrincipal: string | null;
  items: PresupuestoItem[];
}
export interface SectorGroup {
  sectorNombre: string;
  sistemas: SistemaGroup[];
}

/** Group items by sector → sistema, sorted by grupo then numeric subItem suffix. */
export function groupItems(items: PresupuestoItem[]): SectorGroup[] {
  const sectorMap = new Map<string, Map<number, SistemaGroup>>();
  const sorted = [...items].sort((a, b) => {
    const ga = a.grupo ?? 9999;
    const gb = b.grupo ?? 9999;
    if (ga !== gb) return ga - gb;
    const sa = parseFloat((a.subItem || '0').split('.')[1] || '0');
    const sb = parseFloat((b.subItem || '0').split('.')[1] || '0');
    return sa - sb;
  });
  for (const it of sorted) {
    const sector = it.sectorNombre || '';
    const grupo = it.grupo ?? 0;
    if (!sectorMap.has(sector)) sectorMap.set(sector, new Map());
    const gmap = sectorMap.get(sector)!;
    if (!gmap.has(grupo)) {
      gmap.set(grupo, {
        grupo,
        sistemaId: it.sistemaId ?? null,
        sistemaNombre: it.sistemaNombre || 'Sin sistema',
        sistemaCodigoInterno: it.sistemaCodigoInterno ?? null,
        moduloSeriePrincipal: it.moduloSerie ?? null,
        items: [],
      });
    }
    gmap.get(grupo)!.items.push(it);
  }
  const result: SectorGroup[] = [];
  for (const [sectorNombre, gmap] of sectorMap.entries()) {
    result.push({
      sectorNombre,
      sistemas: Array.from(gmap.values()).sort((a, b) => a.grupo - b.grupo),
    });
  }
  return result;
}

/** Per-currency totals (excludes S/L items). */
export function totalsByCurrency(items: PresupuestoItem[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of items) {
    if (it.esSinCargo) continue;
    const cur = it.moneda || 'USD';
    m[cur] = (m[cur] || 0) + (it.subtotal || 0);
  }
  return m;
}
