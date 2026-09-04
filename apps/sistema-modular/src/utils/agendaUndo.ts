import type { AgendaEntry } from '@ags/shared';

/**
 * Deshacer en la agenda (2026-09-04, pedido de coordinación): Ctrl+Z vuelve
 * atrás los últimos movimientos, como en Excel. Acá vive la parte PURA —la
 * pila y cómo se arma cada paso—; el hook `useAgendaUndo` la conecta con las
 * escrituras reales.
 *
 * Cada acción guarda lo necesario para revertirla:
 *   - crear   → se borra la entrada creada;
 *   - editar  → se vuelven a escribir los campos tal como estaban;
 *   - borrar  → se recrea la entrada con los mismos datos (con id nuevo).
 */
export type AccionAgenda =
  | { tipo: 'crear'; id: string; etiqueta: string; otNumber: string | null }
  | { tipo: 'editar'; id: string; antes: Partial<AgendaEntry>; etiqueta: string; otNumber: string | null }
  | { tipo: 'borrar'; entry: AgendaEntry; etiqueta: string };

export interface PasoDeshacer {
  /** Momento de la primera acción del paso (ms). */
  t: number;
  acciones: AccionAgenda[];
}

/** Cuántos pasos se recuerdan. "Al menos 10 como mucho", textual. */
export const MAX_PASOS_DESHACER = 10;

/**
 * Acciones que caen dentro de esta ventana se agrupan en UN paso: pegar tres
 * OTs o cambiar el estado de toda una celda son un solo movimiento para quien
 * lo hizo, y un solo Ctrl+Z tiene que revertirlo entero. Las escrituras de un
 * mismo gesto salen en paralelo y resuelven con decenas de ms de diferencia;
 * dos gestos distintos de la coordinadora nunca caen tan juntos.
 */
export const VENTANA_AGRUPADO_MS = 400;

/** Agrega una acción a la pila: al último paso si es del mismo gesto, o como paso nuevo. */
export function registrarAccion(pila: PasoDeshacer[], accion: AccionAgenda, ahora: number): PasoDeshacer[] {
  const ultimo = pila[pila.length - 1];
  if (ultimo && ahora - ultimo.t <= VENTANA_AGRUPADO_MS) {
    return [...pila.slice(0, -1), { ...ultimo, acciones: [...ultimo.acciones, accion] }];
  }
  const nueva = [...pila, { t: ahora, acciones: [accion] }];
  return nueva.length > MAX_PASOS_DESHACER ? nueva.slice(nueva.length - MAX_PASOS_DESHACER) : nueva;
}

/**
 * Valores previos de los campos que toca un cambio. Un campo que la entrada no
 * tenía vuelve como `null`: Firestore descarta `undefined`, y con eso el campo
 * quedaría con el valor nuevo después de deshacer.
 */
export function valoresPrevios(entry: AgendaEntry, cambio: Partial<AgendaEntry>): Partial<AgendaEntry> {
  const antes: Record<string, unknown> = {};
  for (const k of Object.keys(cambio)) {
    if (k === 'id') continue;
    const v = (entry as unknown as Record<string, unknown>)[k];
    antes[k] = v === undefined ? null : v;
  }
  return antes as Partial<AgendaEntry>;
}

/** Cómo se nombra una entrada en el aviso de "deshecho". */
export function etiquetaDeshacer(e: { otNumber?: string | null; titulo?: string | null; clienteNombre?: string | null }): string {
  if (e.otNumber) return `OT ${e.otNumber}`;
  return e.titulo || e.clienteNombre || 'entrada';
}

/** Texto del aviso al deshacer un paso. */
export function describirPaso(paso: PasoDeshacer): string {
  const VERBO = { crear: 'alta', editar: 'cambio', borrar: 'borrado' } as const;
  const etiquetas = Array.from(new Set(paso.acciones.map(a => a.etiqueta)));
  const tipos = Array.from(new Set(paso.acciones.map(a => a.tipo)));
  const que = tipos.length === 1 ? VERBO[tipos[0]] : 'movimiento';
  const quien = etiquetas.length <= 2 ? etiquetas.join(', ') : `${etiquetas.length} entradas`;
  return `Deshecho: ${que} de ${quien}`;
}

/** Datos con los que se recrea una entrada borrada (sin id ni trazas). */
export function datosParaRecrear(entry: AgendaEntry): Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'> {
  const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _cb, createdByName: _cbn, updatedBy: _ub, updatedByName: _ubn, ...datos } = entry;
  return datos;
}
