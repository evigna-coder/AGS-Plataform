/**
 * Medición de lecturas de Firestore por sesión y por pantalla (fase 0 de la
 * estrategia de tiempos de respuesta, 2026-09-11 — .claude/plans/performance.md).
 *
 * Alimentado por `services/firestoreInstrumented.ts` (shim del SDK que Vite
 * enchufa en lugar de 'firebase/firestore'). Cuenta consultas, documentos y
 * milisegundos por colección, en total y por pantalla (la fija
 * `TabRouterBridge` al cambiar de ruta). Se consulta desde la consola:
 *   __agsPerf.tabla()        → tabla por colección, sesión completa
 *   __agsPerf.pantallas()    → tabla por pantalla (docs, consultas, ms al primer render)
 *   __agsPerf.reset()
 * En dev, además, cada pantalla loguea su resumen 5 s después de abrirse.
 *
 * Atribución (2026-09-25): cada lectura se carga a la pantalla que la PIDIÓ,
 * no a la que está activa cuando termina. Las pestañas quedan montadas en
 * segundo plano y sus listeners siguen entregando; antes todo eso caía en la
 * pantalla activa (Órdenes de compra "leía" 800 reportes que eran de la
 * agenda). Las entregas posteriores de un listener cuentan como
 * `actualizaciones`, no como consultas.
 */

export interface LecturaStats { consultas: number; docs: number; ms: number; }

export interface PantallaStats extends LecturaStats {
  path: string;
  abiertaAt: number;
  primerRenderMs: number | null;
  /** Entregas de listeners posteriores a la primera (deltas). */
  actualizaciones: number;
  porColeccion: Record<string, LecturaStats>;
}

const total: Record<string, LecturaStats> = {};
let actualizacionesTotales = 0;
const pantallas: PantallaStats[] = [];
let actual: PantallaStats | null = null;
let sesionInicio = performance.now();

const sumar = (acc: Record<string, LecturaStats>, coleccion: string, docs: number, ms: number, consulta: boolean) => {
  const s = acc[coleccion] ?? (acc[coleccion] = { consultas: 0, docs: 0, ms: 0 });
  if (consulta) s.consultas += 1;
  s.docs += docs; s.ms += ms;
};

/** Pantalla activa en este instante — para atribuirle lecturas que terminan después. */
export function pantallaActual(): PantallaStats | null {
  return actual;
}

/**
 * Registra una lectura terminada (getDoc, getDocs o una entrega de onSnapshot).
 * `pantalla` es el bucket que la pidió (capturado al iniciar la lectura o al
 * suscribirse); si no viene, se usa la activa. `origen === 'actualizacion'`
 * es una entrega posterior de un listener: suma docs, no consultas.
 */
export function registrarLectura(
  coleccion: string, docs: number, ms: number,
  origen: 'get' | 'snapshot' | 'actualizacion' = 'get',
  pantalla: PantallaStats | null = actual,
): void {
  const clave = origen === 'get' ? coleccion : `${coleccion} (snapshot)`;
  const consulta = origen !== 'actualizacion';
  sumar(total, clave, docs, ms, consulta);
  if (!consulta) actualizacionesTotales += 1;
  if (pantalla) {
    sumar(pantalla.porColeccion, clave, docs, ms, consulta);
    if (consulta) pantalla.consultas += 1; else pantalla.actualizaciones += 1;
    pantalla.docs += docs; pantalla.ms += ms;
  }
}

/** La pantalla activa cambió: cierra la anterior y abre un bucket nuevo. */
export function marcarPantalla(path: string): void {
  if (actual?.path === path) return;
  actual = { path, abiertaAt: performance.now(), primerRenderMs: null, consultas: 0, docs: 0, ms: 0, actualizaciones: 0, porColeccion: {} };
  pantallas.push(actual);
  const bucket = actual;
  requestAnimationFrame(() => { if (bucket.primerRenderMs == null) bucket.primerRenderMs = Math.round(performance.now() - bucket.abiertaAt); });
  if (import.meta.env.DEV) {
    setTimeout(() => {
      if (bucket.consultas === 0) return;
      console.info(`[perf] ${bucket.path}: ${bucket.docs} docs en ${bucket.consultas} consultas (${Math.round(bucket.ms)} ms de lectura) · primer render ${bucket.primerRenderMs ?? '?'} ms`);
    }, 5000);
  }
}

function filasTotal() {
  return Object.entries(total)
    .map(([coleccion, s]) => ({ coleccion, consultas: s.consultas, docs: s.docs, ms: Math.round(s.ms) }))
    .sort((a, b) => b.docs - a.docs);
}

function filasPantallas() {
  return pantallas.map(p => ({
    pantalla: p.path, docs: p.docs, consultas: p.consultas, actualizaciones: p.actualizaciones,
    msLectura: Math.round(p.ms), primerRenderMs: p.primerRenderMs,
    top: Object.entries(p.porColeccion).sort((a, b) => b[1].docs - a[1].docs).slice(0, 3).map(([c, s]) => `${c}:${s.docs}`).join(' · '),
  }));
}

export const perfReads = {
  tabla: () => { console.table(filasTotal()); return filasTotal(); },
  pantallas: () => { console.table(filasPantallas()); return filasPantallas(); },
  /** Resumen compacto para adjuntar a Sentry o copiar en un reporte. */
  resumen: () => ({
    segundosSesion: Math.round((performance.now() - sesionInicio) / 1000),
    docsTotales: Object.values(total).reduce((s, x) => s + x.docs, 0),
    consultasTotales: Object.values(total).reduce((s, x) => s + x.consultas, 0),
    actualizacionesTotales,
    topColecciones: filasTotal().slice(0, 8),
    pantallas: filasPantallas().slice(-10),
  }),
  reset: () => {
    for (const k of Object.keys(total)) delete total[k];
    pantallas.length = 0; actual = null; actualizacionesTotales = 0; sesionInicio = performance.now();
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as { __agsPerf: typeof perfReads }).__agsPerf = perfReads;
}
