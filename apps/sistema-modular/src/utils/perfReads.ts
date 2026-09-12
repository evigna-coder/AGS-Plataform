/**
 * Medición de lecturas de Firestore por sesión y por pantalla (fase 0 de la
 * estrategia de tiempos de respuesta, 2026-09-11 — .claude/plans/performance.md).
 *
 * Alimentado por `services/firestoreInstrumented.ts` (shim del SDK que Vite
 * enchufa en lugar de 'firebase/firestore'). Cuenta consultas, documentos y
 * milisegundos por colección, en total y para la pantalla activa (la fija
 * `TabRouterBridge` al cambiar de ruta). Se consulta desde la consola:
 *   __agsPerf.tabla()        → tabla por colección, sesión completa
 *   __agsPerf.pantallas()    → tabla por pantalla (docs, consultas, ms al primer render)
 *   __agsPerf.reset()
 * En dev, además, cada pantalla loguea su resumen 5 s después de abrirse.
 */

export interface LecturaStats { consultas: number; docs: number; ms: number; }

interface PantallaStats extends LecturaStats {
  path: string;
  abiertaAt: number;
  primerRenderMs: number | null;
  porColeccion: Record<string, LecturaStats>;
}

const total: Record<string, LecturaStats> = {};
const pantallas: PantallaStats[] = [];
let actual: PantallaStats | null = null;
let sesionInicio = performance.now();

const sumar = (acc: Record<string, LecturaStats>, coleccion: string, docs: number, ms: number) => {
  const s = acc[coleccion] ?? (acc[coleccion] = { consultas: 0, docs: 0, ms: 0 });
  s.consultas += 1; s.docs += docs; s.ms += ms;
};

/** Registra una lectura terminada (getDoc, getDocs o cada entrega de onSnapshot). */
export function registrarLectura(coleccion: string, docs: number, ms: number, origen: 'get' | 'snapshot' = 'get'): void {
  const clave = origen === 'snapshot' ? `${coleccion} (snapshot)` : coleccion;
  sumar(total, clave, docs, ms);
  if (actual) {
    sumar(actual.porColeccion, clave, docs, ms);
    actual.consultas += 1; actual.docs += docs; actual.ms += ms;
  }
}

/** La pantalla activa cambió: cierra la anterior y abre un bucket nuevo. */
export function marcarPantalla(path: string): void {
  if (actual?.path === path) return;
  actual = { path, abiertaAt: performance.now(), primerRenderMs: null, consultas: 0, docs: 0, ms: 0, porColeccion: {} };
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
    pantalla: p.path, docs: p.docs, consultas: p.consultas, msLectura: Math.round(p.ms), primerRenderMs: p.primerRenderMs,
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
    topColecciones: filasTotal().slice(0, 8),
    pantallas: filasPantallas().slice(-10),
  }),
  reset: () => { for (const k of Object.keys(total)) delete total[k]; pantallas.length = 0; actual = null; sesionInicio = performance.now(); },
};

if (typeof window !== 'undefined') {
  (window as unknown as { __agsPerf: typeof perfReads }).__agsPerf = perfReads;
}
