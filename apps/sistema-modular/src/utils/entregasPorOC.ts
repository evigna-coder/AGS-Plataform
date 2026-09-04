import type { EntregaRow, Semaforo } from './entregasResolver';
import { computeSemaforo } from './entregasResolver';

/**
 * Vista de Entregas POR ORDEN DE COMPRA (2026-09-04, pedido de dirección):
 * una fila por OC del cliente en vez de una por artículo. La OC queda
 * pendiente hasta que se entregue el último artículo.
 *
 * Se agrupa por la OC del CLIENTE —el papel con el que compró, que es el
 * compromiso— y no por la OC al proveedor, que es cómo AGS lo consigue. Un
 * presupuesto sin OC cargada agrupa por presupuesto, para que nada quede
 * afuera de la vista.
 */
export interface GrupoEntregaOC {
  /** `oc:<cliente>:<numero>` o `ppto:<presupuestoId>`. */
  key: string;
  clienteId: string;
  clienteNombre: string;
  /** Número de la OC del cliente, o null si el grupo es por presupuesto. */
  ocNumero: string | null;
  ocUrl: string | null;
  presupuestos: string[];
  rows: EntregaRow[];
  totalItems: number;
  entregados: number;
  cantidadTotal: number;
  /** Suma de cantidad × valor unitario, por moneda. */
  importePorMoneda: { moneda: string; monto: number }[];
  /** Menos días entre los pendientes (el que urge). */
  minDias: number | null;
  /** ETA más lejana entre los pendientes: cuándo podría estar completa. */
  etaMax: string | null;
  semaforo: Semaforo;
  completa: boolean;
}

export function claveGrupoOC(r: EntregaRow): string {
  return r.ocCliente?.numero
    ? `oc:${r.clienteId}:${r.ocCliente.numero.trim().toLowerCase()}`
    : `ppto:${r.presupuestoId}`;
}

export function agruparEntregasPorOC(rows: EntregaRow[]): GrupoEntregaOC[] {
  const porClave = new Map<string, EntregaRow[]>();
  for (const r of rows) {
    const k = claveGrupoOC(r);
    const arr = porClave.get(k);
    if (arr) arr.push(r); else porClave.set(k, [r]);
  }
  const grupos: GrupoEntregaOC[] = [];
  for (const [key, items] of porClave) {
    const first = items[0];
    const pendientes = items.filter(r => r.semaforo !== 'entregado');
    const dias = pendientes.map(r => r.diasRestantes).filter((d): d is number => d != null);
    const etas = pendientes.map(r => r.etaFecha).filter((e): e is string => !!e).sort();
    const importe = new Map<string, number>();
    for (const r of items) {
      const m = r.moneda ?? '—';
      importe.set(m, (importe.get(m) ?? 0) + r.cantidad * (r.precioUnitario || 0));
    }
    const minDias = dias.length ? Math.min(...dias) : null;
    grupos.push({
      key,
      clienteId: first.clienteId,
      clienteNombre: first.clienteNombre,
      ocNumero: first.ocCliente?.numero ?? null,
      ocUrl: items.find(r => r.ocCliente?.url)?.ocCliente?.url ?? null,
      presupuestos: [...new Set(items.map(r => r.presupuestoNumero))],
      rows: items,
      totalItems: items.length,
      entregados: items.length - pendientes.length,
      cantidadTotal: items.reduce((s, r) => s + r.cantidad, 0),
      importePorMoneda: [...importe.entries()].filter(([, v]) => v > 0).map(([moneda, monto]) => ({ moneda, monto })),
      minDias,
      etaMax: etas.length ? etas[etas.length - 1] : null,
      semaforo: pendientes.length === 0 ? 'entregado' : computeSemaforo(minDias),
      completa: pendientes.length === 0,
    });
  }
  // Lo que urge primero: menos días; sin ETA al final; completas al fondo.
  const orden = (g: GrupoEntregaOC) => g.completa ? 3 : g.minDias == null ? 2 : g.minDias < 0 ? 0 : 1;
  return grupos.sort((a, b) =>
    orden(a) - orden(b)
    || ((a.minDias ?? 9999) - (b.minDias ?? 9999))
    || a.clienteNombre.localeCompare(b.clienteNombre));
}
