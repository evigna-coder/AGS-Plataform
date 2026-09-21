import type { Loaner, PrestamoLoaner } from '@ags/shared';

/**
 * Historial de movimientos de loaners (2026-09-21). Cada préstamo, parte
 * prestada, asignación a ingeniero, derivación a proveedor, extracción y venta
 * de todos los loaners, aplanados en una sola lista buscable: "¿qué detector
 * estuvo en Bagó?" se responde con un buscador en vez de abrir loaner por loaner.
 * Puro: sin Firestore, testeable con `test:loaner-movimientos`.
 */
export type TipoMovimientoLoaner = 'prestamo' | 'parte' | 'asignacion' | 'derivacion' | 'extraccion' | 'venta';

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimientoLoaner, string> = {
  prestamo: 'Préstamo',
  parte: 'Parte prestada',
  asignacion: 'Parte a ingeniero',
  derivacion: 'Proveedor externo',
  extraccion: 'Extracción',
  venta: 'Venta',
};

export const TIPO_MOVIMIENTO_COLORS: Record<TipoMovimientoLoaner, string> = {
  prestamo: 'bg-blue-100 text-blue-700',
  parte: 'bg-violet-100 text-violet-700',
  asignacion: 'bg-indigo-100 text-indigo-700',
  derivacion: 'bg-amber-100 text-amber-800',
  extraccion: 'bg-orange-100 text-orange-700',
  venta: 'bg-emerald-100 text-emerald-700',
};

export type EstadoMovimientoLoaner = 'abierto' | 'cerrado' | 'cancelado';

export interface MovimientoLoaner {
  id: string;
  tipo: TipoMovimientoLoaner;
  loanerId: string;
  loanerCodigo: string;
  loanerDescripcion: string;
  loanerSerie: string | null;
  moduloCodigo: string | null;
  /** Cliente, proveedor, ingeniero o destino de la extracción. */
  destino: string;
  establecimiento: string | null;
  parteDescripcion: string | null;
  parteCodigo: string | null;
  parteSerie: string | null;
  fechaSalida: string;
  fechaRetorno: string | null;
  estado: EstadoMovimientoLoaner;
  otNumber: string | null;
  remitoSalida: string | null;
  remitoRetorno: string | null;
  /** Todo lo buscable, ya normalizado. */
  texto: string;
}

export function normalizarTexto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function texto(...partes: unknown[]): string {
  return normalizarTexto(partes.filter(p => p !== null && p !== undefined && p !== '').join(' '));
}

function estadoPrestamo(p: PrestamoLoaner): EstadoMovimientoLoaner {
  if (p.estado === 'cancelado') return 'cancelado';
  return p.estado === 'devuelto' ? 'cerrado' : 'abierto';
}

export function armarMovimientosLoaners(loaners: Loaner[]): MovimientoLoaner[] {
  const out: MovimientoLoaner[] = [];
  for (const l of loaners) {
    const base = {
      loanerId: l.id, loanerCodigo: l.codigo, loanerDescripcion: l.descripcion,
      loanerSerie: l.serie ?? null, moduloCodigo: l.moduloCodigo ?? null,
    };
    const textoLoaner = [l.codigo, l.descripcion, l.serie, l.moduloCodigo, l.moduloDescripcion, l.categoriaModuloNombre, l.articuloCodigo];

    for (const p of l.prestamos ?? []) {
      const partes = (p.partes && p.partes.length > 0) ? p.partes : (p.parte ? [p.parte] : []);
      const esParte = p.alcance === 'parte' || partes.length > 0;
      const aIngeniero = p.destino === 'ingeniero';
      const destino = aIngeniero ? (p.ingenieroNombre || 'Ingeniero') : (p.clienteNombre || '—');
      const comun = {
        ...base,
        destino, establecimiento: p.establecimientoNombre ?? null,
        fechaSalida: p.fechaSalida, fechaRetorno: p.fechaRetornoReal ?? null,
        estado: estadoPrestamo(p), otNumber: p.otNumber ?? null,
        remitoSalida: p.remitoSalidaNumero ?? null, remitoRetorno: p.remitoRetornoNumero ?? null,
      };
      if (!esParte) {
        out.push({ ...comun, id: `${l.id}:p:${p.id}`, tipo: 'prestamo', parteDescripcion: null, parteCodigo: null, parteSerie: null,
          texto: texto(...textoLoaner, destino, p.establecimientoNombre, p.otNumber, p.remitoSalidaNumero, p.remitoRetornoNumero, p.fichaNumero, 'prestamo') });
        continue;
      }
      // Una fila por parte: es lo que se busca ("¿dónde está el motor de la bomba?").
      partes.forEach((parte, i) => {
        const vuelta = parte.fechaReinstalacion ?? parte.fechaVueltaBase ?? p.fechaRetornoReal ?? null;
        out.push({
          ...comun, id: `${l.id}:p:${p.id}:${parte.id ?? i}`, tipo: aIngeniero ? 'asignacion' : 'parte',
          parteDescripcion: parte.descripcion, parteCodigo: parte.codigoArticulo ?? null, parteSerie: parte.serie ?? null,
          fechaRetorno: vuelta,
          estado: p.estado === 'cancelado' ? 'cancelado' : (vuelta ? 'cerrado' : 'abierto'),
          texto: texto(...textoLoaner, destino, p.establecimientoNombre, parte.descripcion, parte.codigoArticulo, parte.serie, p.otNumber, p.remitoSalidaNumero, p.asignacionNumero, 'parte'),
        });
      });
    }

    for (const d of l.derivaciones ?? []) {
      const destino = d.proveedorNombre || 'Proveedor externo';
      out.push({
        ...base, id: `${l.id}:d:${d.id}`, tipo: 'derivacion', destino, establecimiento: null,
        parteDescripcion: d.alcance === 'parte' ? (d.parteDescripcion ?? 'Parte') : null, parteCodigo: null, parteSerie: null,
        fechaSalida: d.fechaEnvio, fechaRetorno: d.fechaRetorno ?? null,
        estado: d.fechaRetorno ? 'cerrado' : 'abierto',
        otNumber: d.otRecalificacionNumber ?? null, remitoSalida: d.remitoNumero ?? null, remitoRetorno: null,
        texto: texto(...textoLoaner, destino, d.parteDescripcion, d.remitoNumero, d.otRecalificacionNumber, 'proveedor derivacion'),
      });
    }

    for (const e of l.extracciones ?? []) {
      out.push({
        ...base, id: `${l.id}:e:${e.id}`, tipo: 'extraccion', destino: e.destino || '—', establecimiento: null,
        parteDescripcion: e.descripcion, parteCodigo: e.codigoArticulo ?? null, parteSerie: null,
        fechaSalida: e.fecha, fechaRetorno: e.fechaReposicion ?? null,
        estado: e.fechaReposicion ? 'cerrado' : 'abierto',
        otNumber: e.otNumber ?? null, remitoSalida: null, remitoRetorno: null,
        texto: texto(...textoLoaner, e.destino, e.descripcion, e.codigoArticulo, e.otNumber, e.extraidoPor, 'extraccion'),
      });
    }

    if (l.venta) {
      const v = l.venta;
      out.push({
        ...base, id: `${l.id}:v`, tipo: 'venta', destino: v.clienteNombre || '—', establecimiento: null,
        parteDescripcion: null, parteCodigo: null, parteSerie: null,
        fechaSalida: v.fecha, fechaRetorno: null, estado: 'cerrado',
        otNumber: null, remitoSalida: null, remitoRetorno: null,
        texto: texto(...textoLoaner, v.clienteNombre, v.presupuestoNumero, 'venta vendido'),
      });
    }
  }
  return out.sort((a, b) => (b.fechaSalida || '').localeCompare(a.fechaSalida || '') || a.loanerCodigo.localeCompare(b.loanerCodigo));
}

/** Filtro de texto: todas las palabras tienen que estar (en cualquier campo). */
export function filtrarMovimientos(movs: MovimientoLoaner[], busqueda: string): MovimientoLoaner[] {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return movs;
  return movs.filter(m => palabras.every(p => m.texto.includes(p)));
}
