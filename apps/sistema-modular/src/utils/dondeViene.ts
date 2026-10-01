/**
 * "¿Dónde viene?" (2026-09-30): para un artículo, todas las líneas donde está
 * en camino o en stock, SIN sumar: cada importación, cada línea de OC todavía
 * no embarcada, cada requerimiento sin OC y cada tanda de unidades, con para
 * quién es (cliente / presupuesto / reposición). Puro, sin Firestore.
 */
import type { Importacion, OrdenCompra, RequerimientoCompra, UnidadStock } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_OC_LABELS, ESTADO_REQUERIMIENTO_LABELS, ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';

export type FuenteDondeViene = 'importacion' | 'oc' | 'requerimiento' | 'unidad';

export interface LineaDondeViene {
  fuente: FuenteDondeViene;
  id: string;
  /** N° de OC (también para importaciones: es lo que se reconoce), REQ-0450, o el depósito para unidades. */
  referencia: string;
  estado: string;
  estadoLabel: string;
  /** Fecha estimada de arribo / entrega, 'YYYY-MM-DD' o null. */
  fecha: string | null;
  cantidad: number;
  /** Código del envase si la cantidad no está en unidad base. */
  presentacion?: string | null;
  /** Para quién: "Synthon (P3-005063)", "Reposición de stock mínimo"… */
  para: string[];
  nota?: string | null;
  /** Ruta interna para abrir el documento. */
  ruta: string | null;
}

export interface FuentesDondeViene {
  importaciones: Importacion[];
  ocs: OrdenCompra[];
  /** Requerimientos del artículo (sirven para resolver el "para quién" de OCs e importaciones). */
  requerimientos: RequerimientoCompra[];
  unidades: UnidadStock[];
}

const IMPORTACION_EN_CURSO = new Set(['preparacion', 'en_origen', 'embarcado', 'en_transito', 'en_aduana', 'despachado']);
const OC_ABIERTA = new Set(['borrador', 'pendiente_aprobacion', 'aprobada', 'enviada_proveedor', 'confirmada', 'en_transito', 'recibida_parcial', 'embarcada']);
const REQ_ABIERTO = new Set(['pendiente', 'aprobado']);
const UNIDAD_VISIBLE = new Set(['disponible', 'reservado', 'en_transito', 'asignado']);

/** "Para quién" de un requerimiento: sus líneas de desglose, o el presupuesto, o el origen. */
export function paraDeRequerimiento(r: RequerimientoCompra): string[] {
  const out: string[] = [];
  for (const d of r.desglose ?? []) {
    if (d.concepto === 'cliente') out.push(`${d.clienteNombre || 'Cliente'}${d.presupuestoNumero ? ` (${d.presupuestoNumero})` : ''} × ${d.cantidad}`);
    else out.push(`Reposición de stock mínimo × ${d.cantidad}`);
  }
  if (out.length > 0) return out;
  if (r.presupuestoNumero) return [`Presupuesto ${r.presupuestoNumero}`];
  const origen = ORIGEN_REQUERIMIENTO_LABELS[r.origen] ?? r.origen;
  return [r.origen === 'stock_minimo' ? 'Reposición de stock mínimo' : `Origen: ${origen}`];
}

function paraDeIds(ids: Array<string | null | undefined>, reqById: Map<string, RequerimientoCompra>): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const r = id ? reqById.get(id) : null;
    if (r) paraDeRequerimiento(r).forEach(p => out.add(p));
  }
  return [...out];
}

const dia = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 10) : null);

export function buscarDondeViene(articuloId: string, f: FuentesDondeViene): LineaDondeViene[] {
  const reqById = new Map(f.requerimientos.map(r => [r.id, r]));
  const lineas: LineaDondeViene[] = [];

  // Importaciones en curso: lo que ya está embarcado.
  const embarcadoPorItemOC = new Map<string, number>();
  for (const imp of f.importaciones) {
    if (!IMPORTACION_EN_CURSO.has(imp.estado)) continue;
    for (const it of imp.items ?? []) {
      if (it.articuloId !== articuloId) continue;
      const pendiente = Math.max((it.cantidadPedida ?? 0) - (it.cantidadRecibida ?? 0), 0);
      if (pendiente <= 0) continue;
      if (it.itemOCId) embarcadoPorItemOC.set(it.itemOCId, (embarcadoPorItemOC.get(it.itemOCId) ?? 0) + pendiente);
      const ids = [...(it.requerimientoIds ?? []), it.requerimientoId];
      // La referencia es el N° de OC (2026-09-30): es el que se reconoce; el
      // N° de importación va en la nota.
      lineas.push({
        fuente: 'importacion', id: imp.id, referencia: imp.ordenCompraNumero || imp.numero, estado: imp.estado,
        estadoLabel: ESTADO_IMPORTACION_LABELS[imp.estado] ?? imp.estado,
        fecha: dia(imp.fechaEstimadaArribo), cantidad: pendiente, presentacion: it.presentacion?.codigoParte ?? null,
        para: paraDeIds(ids, reqById),
        nota: [`Importación ${imp.numero}`, imp.proveedorNombre ? `Proveedor: ${imp.proveedorNombre}` : null].filter(Boolean).join(' · '),
        ruta: `/stock/importaciones/${imp.id}`,
      });
    }
  }

  // OCs abiertas: lo pedido que todavía no está en ninguna importación.
  for (const oc of f.ocs) {
    if (!OC_ABIERTA.has(oc.estado)) continue;
    for (const it of oc.items ?? []) {
      if (it.articuloId !== articuloId) continue;
      const pendiente = Math.max((it.cantidad ?? 0) - (it.cantidadRecibida ?? 0) - (embarcadoPorItemOC.get(it.id) ?? 0), 0);
      if (pendiente <= 0) continue;
      const ids = [...(it.requerimientoIds ?? []), it.requerimientoId];
      lineas.push({
        fuente: 'oc', id: oc.id, referencia: oc.numero, estado: oc.estado,
        estadoLabel: ESTADO_OC_LABELS[oc.estado as keyof typeof ESTADO_OC_LABELS] ?? oc.estado,
        fecha: dia(oc.fechaEntregaEstimada), cantidad: pendiente, presentacion: it.presentacion?.codigoParte ?? null,
        para: paraDeIds(ids, reqById),
        nota: `${oc.tipo === 'importacion' ? 'Importación' : 'Nacional'} · ${oc.proveedorNombre}${embarcadoPorItemOC.has(it.id) ? ' · parte ya embarcada' : ' · sin embarcar todavía'}`,
        ruta: `/stock/ordenes-compra/${oc.id}`,
      });
    }
  }

  // Requerimientos abiertos sin OC: todavía no se compró.
  for (const r of f.requerimientos) {
    if (r.articuloId !== articuloId || !REQ_ABIERTO.has(r.estado) || r.ordenCompraId) continue;
    lineas.push({
      fuente: 'requerimiento', id: r.id, referencia: r.numero, estado: r.estado,
      estadoLabel: ESTADO_REQUERIMIENTO_LABELS[r.estado] ?? r.estado,
      fecha: null, cantidad: r.cantidad, para: paraDeRequerimiento(r), nota: 'Sin orden de compra todavía',
      ruta: '/stock/requerimientos',
    });
  }

  // Unidades en stock, tanda por tanda (en tránsito, reservadas, disponibles, asignadas).
  for (const u of f.unidades) {
    if (u.articuloId !== articuloId || u.activo === false || !UNIDAD_VISIBLE.has(u.estado)) continue;
    const para: string[] = [];
    if (u.reservadoParaClienteNombre || u.reservadoParaPresupuestoNumero) {
      para.push(`${u.reservadoParaClienteNombre || 'Cliente'}${u.reservadoParaPresupuestoNumero ? ` (${u.reservadoParaPresupuestoNumero})` : ''}`);
    } else if (u.estado === 'asignado') {
      para.push(`Asignado a ${u.ubicacion?.referenciaNombre ?? 'ingeniero'}`);
    } else {
      para.push('Libre');
    }
    const donde = u.estado === 'en_transito' ? (u.importacionNumero ? `Importación ${u.importacionNumero}` : 'En tránsito') : (u.ubicacion?.referenciaNombre ?? 'Sin ubicación');
    lineas.push({
      fuente: 'unidad', id: u.id, referencia: donde, estado: u.estado,
      estadoLabel: ({ disponible: 'Disponible', reservado: 'Reservada', en_transito: 'En tránsito', asignado: 'Asignada' } as Record<string, string>)[u.estado] ?? u.estado,
      fecha: null, cantidad: u.cantidad ?? 1, para,
      nota: [u.nroLote ? `Lote ${u.nroLote}` : null, u.nroSerie ? `Serie ${u.nroSerie}` : null, u.ordenCompraNumero ? `OC ${u.ordenCompraNumero}` : null].filter(Boolean).join(' · ') || null,
      ruta: '/stock/unidades',
    });
  }

  // Documentos por fuente (lo que viene primero) y fecha; unidades: en tránsito, reservadas, disponibles, asignadas.
  const orden: Record<FuenteDondeViene, number> = { importacion: 0, oc: 1, requerimiento: 2, unidad: 3 };
  const ordenEstado: Record<string, number> = { en_transito: 0, reservado: 1, disponible: 2, asignado: 3 };
  return lineas.sort((a, b) => orden[a.fuente] - orden[b.fuente]
    || (ordenEstado[a.estado] ?? 9) - (ordenEstado[b.estado] ?? 9)
    || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999')
    || a.referencia.localeCompare(b.referencia));
}
