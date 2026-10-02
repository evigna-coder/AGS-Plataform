/**
 * Registro de actividad de la sesión (2026-10-01): un único dueño en memoria
 * para las pantallas más usadas y los documentos recientes. Si cada pantalla
 * guardara su copia de la preferencia, dos pestañas se pisarían. Se guarda en
 * `usuarios/{id}.preferencias.actividad` agrupando los cambios (5 s).
 */
import type { ActividadUsuario } from '@ags/shared';
import { usuariosService } from './personalService';
import { ACTIVIDAD_VACIA, registrarPantalla, registrarReciente } from '../utils/actividadUsuario';

const DEMORA_GUARDADO_MS = 5000;

let estado: ActividadUsuario = ACTIVIDAD_VACIA;
let usuarioId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const oyentes = new Set<() => void>();

const emitir = () => oyentes.forEach(fn => fn());

function guardar() {
  timer = null;
  if (!usuarioId) return;
  usuariosService.updatePreferencias(usuarioId, { actividad: estado })
    .catch(err => console.warn('[actividad] no se pudo guardar', err));
}

function programarGuardado() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(guardar, DEMORA_GUARDADO_MS);
}

export const actividadStore = {
  /** Toma la actividad guardada del usuario al loguearse (una vez por usuario). */
  iniciar(id: string | null, inicial: ActividadUsuario | null | undefined) {
    if (id === usuarioId) return;
    if (timer) { clearTimeout(timer); guardar(); }
    usuarioId = id;
    estado = {
      pantallas: Array.isArray(inicial?.pantallas) ? inicial!.pantallas : [],
      recientes: Array.isArray(inicial?.recientes) ? inicial!.recientes : [],
    };
    emitir();
  },
  get: (): ActividadUsuario => estado,
  suscribir(fn: () => void): () => void {
    oyentes.add(fn);
    return () => { oyentes.delete(fn); };
  },
  registrarPantalla(path: string) {
    if (!usuarioId) return;
    estado = registrarPantalla(estado, path, new Date());
    emitir();
    programarGuardado();
  },
  registrarReciente(doc: { path: string; titulo: string; tipo: string }) {
    if (!usuarioId) return;
    const siguiente = registrarReciente(estado, doc, new Date());
    if (siguiente === estado) return;
    estado = siguiente;
    emitir();
    programarGuardado();
  },
};
