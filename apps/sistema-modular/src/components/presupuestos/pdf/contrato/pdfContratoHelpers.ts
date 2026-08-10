import type { Presupuesto, PresupuestoCuota, PresupuestoItem } from '@ags/shared';

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
      // Grupo 0 = items sin sistema (bonificaciones) — van al FINAL, no al
      // principio (UAT contrato 2026-08-04: "la bonificación aparece primero").
      sistemas: Array.from(gmap.values()).sort(
        (a, b) => (a.grupo === 0 ? 1 : 0) - (b.grupo === 0 ? 1 : 0) || a.grupo - b.grupo),
    });
  }
  // Mismo criterio a nivel sector: un sector compuesto SOLO por grupos sin
  // sistema (la bonificación suelta) se muestra después de los sectores reales.
  const soloSinSistema = (s: SectorGroup) => s.sistemas.every(g => g.grupo === 0);
  return result.sort((a, b) => (soloSinSistema(a) ? 1 : 0) - (soloSinSistema(b) ? 1 : 0));
}

/**
 * Totales por moneda (excluye items S/L).
 *
 * `monedaBase` = la del presupuesto, y es el fallback para los items que no
 * traen moneda propia. Antes el fallback era `'USD'` hardcodeado (2026-08-09):
 * un contrato en PESOS cuyos items no tenían `moneda` salía rotulado en dólares
 * en la portada y en el total por equipo. Solo un presupuesto MIXTA obliga a que
 * cada item declare su moneda; en los de moneda única los items suelen venir sin
 * el campo, que es justo el caso que se rompía.
 */
export function totalsByCurrency(
  items: PresupuestoItem[],
  monedaBase?: string,
): Record<string, number> {
  const fallback = monedaBase && monedaBase !== 'MIXTA' ? monedaBase : 'USD';
  const m: Record<string, number> = {};
  for (const it of items) {
    if (it.esSinCargo) continue;
    const cur = it.moneda || fallback;
    m[cur] = (m[cur] || 0) + (it.subtotal || 0);
  }
  return m;
}

// ── Plan de cuotas (UAT contrato 2026-08-04) ──
export interface PlanCuotas {
  /** Cuotas iguales por moneda → resumen "N pagos de $X" (va en la portada).
   *  `ajusteRedondeo`: una cuota difiere en centavos (reparto del redondeo). */
  uniformes: { cur: string; n: number; monto: number; ajusteRedondeo: boolean }[];
  /** Cuotas genuinamente desparejas por moneda (difieren en más de $1). */
  desparejas: [string, PresupuestoCuota[]][];
}

/** Resume el plan de cuotas: desde `cuotas[]` si están armadas; si solo hay
 *  cantidad definida, deriva el monto del total por moneda (sin IVA). */
export function planCuotas(p: Presupuesto): PlanCuotas {
  const cuotas = p.cuotas || [];
  const uniformes: PlanCuotas['uniformes'] = [];
  const desparejas: PlanCuotas['desparejas'] = [];
  if (cuotas.length > 0) {
    const by = new Map<string, PresupuestoCuota[]>();
    for (const c of cuotas) {
      if (!by.has(c.moneda)) by.set(c.moneda, []);
      by.get(c.moneda)!.push(c);
    }
    for (const [cur, list] of by.entries()) {
      // "Iguales" con tolerancia de $1: el generador reparte el redondeo en una
      // cuota (ej. #1 1.414,63 y el resto 1.414,67) y eso NO es un plan
      // desparejo (UAT 2026-08-04: listaba las 12 en la carátula).
      const montos = list.map(c => c.monto);
      const min = Math.min(...montos);
      const max = Math.max(...montos);
      if (max - min <= 1) {
        // Monto representativo: el más frecuente (la cuota de ajuste es la excepción).
        const freq = new Map<number, number>();
        for (const m of montos) freq.set(m, (freq.get(m) ?? 0) + 1);
        const moda = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        uniformes.push({ cur, n: list.length, monto: moda, ajusteRedondeo: max - min > 0.001 });
      } else {
        desparejas.push([cur, list]);
      }
    }
  } else {
    const totals = totalsByCurrency(p.items, p.moneda);
    for (const [cur, tot] of Object.entries(totals)) {
      const n = p.cantidadCuotasPorMoneda?.[cur] ?? p.cantidadCuotas ?? 0;
      if (n > 0) uniformes.push({ cur, n, monto: tot / n, ajusteRedondeo: false });
    }
  }
  return { uniformes, desparejas };
}
