import type { EstadoFicha, FichaPropiedad, ItemFicha } from '@ags/shared';

/**
 * El paso siguiente de una ficha, para ofrecerlo desde el listado (2026-08-23).
 *
 * Hasta ahora el listado solo tenía "Ver": para mover una ficha había que
 * entrar al detalle, encontrar el item y buscar el botón. Con el paso a la
 * vista se opera desde la grilla, que es donde se mira el trabajo pendiente.
 *
 * Regla de oro: **si el paso no es obvio, no se ofrece.** Una ficha puede tener
 * varios items en estados distintos y dos derivaciones abiertas a proveedores
 * distintos; adivinar cuál mover sería peor que mandar al detalle. En esos
 * casos devuelve `ambigua` con el motivo, y el listado invita a abrir la ficha.
 */

/** Estado siguiente "natural" de un item y cómo se llama el botón. */
const SIGUIENTE: Partial<Record<EstadoFicha, { hacia: EstadoFicha; label: string }>> = {
  recibido: { hacia: 'en_diagnostico', label: 'A diagnóstico' },
  en_diagnostico: { hacia: 'en_reparacion', label: 'A reparación' },
  en_reparacion: { hacia: 'listo_para_entrega', label: 'Listo para entrega' },
  esperando_repuesto: { hacia: 'en_reparacion', label: 'A reparación' },
  listo_para_entrega: { hacia: 'en_envio', label: 'Marcar en envío' },
  en_envio: { hacia: 'entregado', label: 'Marcar entregado' },
  // `derivado_proveedor` sin derivación abierta quedó desincronizado: se lo
  // devuelve al taller, que es lo que hace `markDerivacionRecibida`.
  derivado_proveedor: { hacia: 'en_reparacion', label: 'A reparación' },
  // `entregado` no tiene siguiente: la ficha terminó.
};

export type ProximaAccionFicha =
  | { tipo: 'devolucion'; label: string; itemId: string; derivacionId: string; proveedor: string; detalle: string }
  | { tipo: 'estado'; label: string; itemId: string; hacia: EstadoFicha; detalle: string }
  | { tipo: 'ambigua'; motivo: string }
  | null;

const itemsVivos = (f: FichaPropiedad): ItemFicha[] =>
  (f.items ?? []).filter(i => i.estado !== 'entregado');

export function proximaAccionFicha(f: FichaPropiedad): ProximaAccionFicha {
  // 1. Lo derivado manda: mientras algo esté en un proveedor, el paso que
  //    importa es que vuelva. Cubre el caso que motivó esto.
  const abiertas = (f.items ?? []).flatMap(i =>
    (i.derivaciones ?? [])
      .filter(d => d.estado === 'enviado')
      .map(d => ({ item: i, deriv: d })));

  if (abiertas.length === 1) {
    const { item, deriv } = abiertas[0];
    const esParte = (deriv.alcance ?? 'modulo_completo') === 'parte';
    return {
      tipo: 'devolucion',
      label: 'Registrar devolución',
      itemId: item.id,
      derivacionId: deriv.id,
      proveedor: deriv.proveedorNombre,
      detalle: `${esParte ? 'La parte' : 'El módulo'} vuelve de ${deriv.proveedorNombre}`,
    };
  }
  if (abiertas.length > 1) {
    return { tipo: 'ambigua', motivo: `${abiertas.length} derivaciones abiertas` };
  }

  // 2. Sin derivaciones: el paso del ciclo, si TODOS los items vivos coinciden.
  const vivos = itemsVivos(f);
  if (vivos.length === 0) return null;

  const estados = [...new Set(vivos.map(i => i.estado))];
  if (estados.length > 1) {
    return { tipo: 'ambigua', motivo: `${estados.length} estados distintos entre los items` };
  }

  const paso = SIGUIENTE[estados[0]];
  if (!paso) return null;

  // Con varios items en el mismo estado no se elige uno: moverlos de a uno
  // desde el listado deja la ficha a mitad de camino sin que se note.
  if (vivos.length > 1) {
    return { tipo: 'ambigua', motivo: `${vivos.length} items en el mismo estado` };
  }

  return {
    tipo: 'estado',
    label: paso.label,
    itemId: vivos[0].id,
    hacia: paso.hacia,
    detalle: `Pasar a "${paso.label.toLowerCase()}"`,
  };
}
