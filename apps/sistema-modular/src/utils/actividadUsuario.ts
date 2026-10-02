/**
 * Actividad del usuario para la pestaña nueva (2026-10-01): qué pantallas usa
 * más y qué documentos abrió último. Funciones puras; el guardado vive en
 * `services/actividadStore.ts`.
 */
import type { ActividadUsuario } from '@ags/shared';

export const ACTIVIDAD_VACIA: ActividadUsuario = { pantallas: [], recientes: [] };

/** Vida media del puntaje: una visita de hace 14 días vale la mitad que una de hoy. */
const VIDA_MEDIA_DIAS = 14;
const MAX_PANTALLAS = 40;
const MAX_RECIENTES = 10;
const DIA_MS = 86_400_000;

/** Puntaje de una pantalla a una fecha: el contador decae desde su última visita. */
export function puntaje(p: { n: number; t: string }, ahora: Date): number {
  const dias = Math.max(0, (ahora.getTime() - new Date(p.t).getTime()) / DIA_MS);
  return p.n * Math.pow(0.5, dias / VIDA_MEDIA_DIAS);
}

export function registrarPantalla(act: ActividadUsuario, path: string, ahora: Date): ActividadUsuario {
  const previa = act.pantallas.find(p => p.path === path);
  const n = (previa ? puntaje(previa, ahora) : 0) + 1;
  const pantallas = [{ path, n: Math.round(n * 1000) / 1000, t: ahora.toISOString() }, ...act.pantallas.filter(p => p.path !== path)]
    .sort((a, b) => puntaje(b, ahora) - puntaje(a, ahora))
    .slice(0, MAX_PANTALLAS);
  return { ...act, pantallas };
}

export function registrarReciente(
  act: ActividadUsuario,
  doc: { path: string; titulo: string; tipo: string },
  ahora: Date,
): ActividadUsuario {
  const titulo = doc.titulo.trim();
  if (!titulo) return act;
  const recientes = [{ ...doc, titulo, t: ahora.toISOString() }, ...act.recientes.filter(r => r.path !== doc.path)]
    .slice(0, MAX_RECIENTES);
  return { ...act, recientes };
}

/** Pantallas ordenadas por uso, solo las que el usuario todavía puede ver. */
export function masUsadas(act: ActividadUsuario, permitidas: Set<string>, ahora: Date, cantidad: number): string[] {
  return act.pantallas
    .filter(p => permitidas.has(p.path))
    .sort((a, b) => puntaje(b, ahora) - puntaje(a, ahora))
    .slice(0, cantidad)
    .map(p => p.path);
}

/**
 * Pantalla del menú a la que pertenece una ruta: la entrada más larga que es
 * prefijo ("/stock/requerimientos/x" → "/stock/requerimientos"). null si
 * ninguna coincide.
 */
export function pantallaDeRuta(pathname: string, pantallas: string[]): string | null {
  let mejor: string | null = null;
  for (const p of pantallas) {
    if (pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/')) {
      if (!mejor || p.length > mejor.length) mejor = p;
    }
  }
  return mejor;
}

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
export function haceCuanto(iso: string, ahora: Date): string {
  const min = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
