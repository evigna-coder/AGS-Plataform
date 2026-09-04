import type { EstadoAgenda } from '@ags/shared';

// Colores 2026-07-30: tentativo pasó al GRIS (igual a pendiente, pedido user);
// los estados "interior" (clientes a +200 km de CABA) se diferencian con
// marrón verdoso (tentativo) y azul grisáceo (confirmado).
const CELL_BG: Record<EstadoAgenda, string> = {
  pendiente: 'bg-slate-300',
  tentativo: 'bg-slate-300',
  tentativo_interior: 'bg-[#a09a4e]',
  confirmado: 'bg-blue-300',
  // 2026-08-12: verde agua pálido (muestra del user) — antes azul #6d8ec9.
  confirmado_interior: 'bg-[#B8D2CC]',
  en_progreso: 'bg-teal-300',
  // La familia interior sigue hasta el final del ciclo (2026-08-08): el color no
  // se pierde al pasar a en progreso / completado, que es cuando se liquida el
  // desarraigo. Mismo criterio de tono que los interior de arriba.
  en_progreso_interior: 'bg-[#5a9d94]',
  completado: 'bg-emerald-300',
  completado_interior: 'bg-[#589a70]',
  cancelado: 'bg-red-200',
};

const CELL_TEXT: Record<EstadoAgenda, string> = {
  pendiente: 'text-slate-800',
  tentativo: 'text-slate-800',
  tentativo_interior: 'text-[#26240c]',
  confirmado: 'text-blue-900',
  // Fondo claro desde 2026-08-12 → texto oscuro (antes blanco sobre azul).
  confirmado_interior: 'text-[#1f3a35]',
  en_progreso: 'text-teal-900',
  en_progreso_interior: 'text-white',
  completado: 'text-emerald-900',
  completado_interior: 'text-white',
  cancelado: 'text-red-700',
};

interface ReglaColor {
  /** Contra qué campo del entry se testea. */
  campo: 'tipoServicio' | 'titulo';
  test: RegExp;
  bg: string;
  text: string;
}

/**
 * Eventos cuyo color lo manda el TIPO DE SERVICIO o el TÍTULO, por encima del
 * estado de agenda: acá el color identifica *de qué se trata el día*, no en qué
 * punto del ciclo está.
 *
 * `cancelado` nunca entra a esta tabla — mantiene su rojo tachado para que la
 * baja se note igual que en el resto de la grilla.
 *
 * Primera regla que matchea gana. El orden solo importa entre reglas que puedan
 * matchear el mismo entry.
 */
/**
 * Trabajo/reparación en bench: el equipo está en el taller, no en el cliente.
 * Fuente única del criterio (la usan el color de celda, el popover y la barra
 * superior, que además muestran el detalle de la falla — 2026-08-12).
 * El catálogo dice "bench"; se acepta "bch".
 */
export const BENCH_TEST = /bench|bch/i;

export function esTrabajoEnBench(tipoServicio?: string | null): boolean {
  return BENCH_TEST.test(tipoServicio ?? '');
}

const REGLAS: ReglaColor[] = [
  // Capacitación (2026-08-03) — rosa oscuro.
  { campo: 'tipoServicio', test: /capacitaci/i, bg: 'bg-[#e59a8e]', text: 'text-[#4a1710]' },
  // BCH / trabajo en bench (2026-08-21): amarillo pálido, el mismo que Oficina.
  // Antes era #e0c878, que sobre la grilla tiraba a naranja.
  { campo: 'tipoServicio', test: BENCH_TEST, bg: 'bg-[#FEF3C7]', text: 'text-[#4a3c10]' },
  // Firma de recibos (2026-08-05) — evento mensual que reserva agenda, violeta clarito.
  { campo: 'titulo', test: /firma de recibos/i, bg: 'bg-[#d9c9f2]', text: 'text-[#3b2364]' },
  // Oficina (2026-08-21): amarillo pálido — el MISMO relleno que las tarjetas
  // de la cola "a programar", un punto más oscuro (amber-100) porque el 50
  // sobre la grilla se lee casi blanco. Mismo tono que bench.
  { campo: 'titulo', test: /\boficina\b/i, bg: 'bg-[#FEF3C7]', text: 'text-[#4a3c10]' },
  // Permisos especiales (2026-08-09) — marrón oscuro; el texto va claro porque
  // sobre este fondo el slate-800 del resto de la grilla no se lee.
  { campo: 'titulo', test: /permisos?\s+especial/i, bg: 'bg-[#5c4033]', text: 'text-[#f2e8e2]' },
  // Día por enfermedad (2026-08-09) — verde chillón, para que salte en la grilla.
  { campo: 'titulo', test: /enfermedad/i, bg: 'bg-[#7cfc00]', text: 'text-[#1a3300]' },
  // Estudios médicos (2026-08-09) — AMARILLO PATITO. El primer intento fue
  // #f5c518, que con tanto rojo se leía naranja. Este levanta el verde y suma
  // algo de azul para sacarle el tinte ámbar. Distinto del amarillo de bench y
  // oficina (#FEF3C7), que es mucho más pálido.
  { campo: 'titulo', test: /estudios m[ée]dicos/i, bg: 'bg-[#ffe23f]', text: 'text-[#3d3300]' },
  // Vacaciones (2026-08-12) — naranja Claude.
  { campo: 'titulo', test: /vacaciones/i, bg: 'bg-[#D97757]', text: 'text-[#401c10]' },
  // Autos (2026-09-04): VTV, service, cualquier trámite del vehículo — violeta
  // OSCURO, el único tono que no tenía la grilla (Firma de recibos es el
  // violeta claro). `\b` para no pintar "autoclave" ni "autosampler".
  { campo: 'titulo', test: /\bautos?\b/i, bg: 'bg-[#5b21b6]', text: 'text-[#ede9fe]' },
];

/**
 * Clase de fondo que le va a corresponder a la celda de un evento fijo, para
 * mostrarla como referencia en el menú contextual (2026-08-09). Sale de la MISMA
 * tabla de reglas que pinta la celda: sin esto habría que repetir los
 * hexadecimales en el menú y se desincronizarían al primer retoque de color.
 *
 * Devuelve null si el título no matchea ninguna regla de color.
 */
export function colorDeTituloFijo(titulo: string): string | null {
  for (const r of REGLAS) {
    if (r.campo === 'titulo' && r.test.test(titulo)) return r.bg;
  }
  return null;
}

/** Verde agua institucional (teal-700) — el mismo de los botones. */
const VENTA_CONCRETADA = { bg: 'bg-[#0D6E6E]', text: 'text-white' };

/** Per Incident (2026-08-12) — verde oliva (muestra del user), celda entera. */
const PER_INCIDENT = { bg: 'bg-[#7C9A4F]', text: 'text-white' };

/**
 * Espera importación (2026-08-20) — azul fuerte, celda entera.
 *
 * Deliberadamente MÁS CLARO y saturado que el azul marino #1e3a8a de la diagonal
 * de pago adelantado: los dos pueden convivir en la misma celda y si fueran el
 * mismo tono la diagonal desaparecería.
 */
const ESPERA_IMPORTACION = { bg: 'bg-[#1D4ED8]', text: 'text-white' };

/**
 * Resuelve el fondo y el color de texto de una celda de agenda. Devuelve strings
 * de clases Tailwind vacíos cuando la celda no tiene entry.
 */
export function colorDeCeldaAgenda(params: {
  estado?: EstadoAgenda;
  tipoServicio?: string | null;
  titulo?: string | null;
  /** Flag manual: gana sobre todo lo demás salvo `cancelado`. */
  ventaConcretada?: boolean;
  /** Flag manual Per Incident: ídem, debajo de ventaConcretada en prioridad. */
  perIncident?: boolean;
  /** Flag manual Espera importación: ídem, último de los tres. */
  esperaImportacion?: boolean;
}): { bg: string; text: string } {
  const { estado, tipoServicio, titulo, ventaConcretada, perIncident, esperaImportacion } = params;
  if (estado !== 'cancelado') {
    // Marca explícita del usuario: pisa las reglas derivadas de tipo/título.
    if (ventaConcretada) return { ...VENTA_CONCRETADA };
    if (perIncident) return { ...PER_INCIDENT };
    if (esperaImportacion) return { ...ESPERA_IMPORTACION };
    for (const r of REGLAS) {
      const valor = r.campo === 'tipoServicio' ? tipoServicio : titulo;
      if (valor && r.test.test(valor)) return { bg: r.bg, text: r.text };
    }
  }
  return estado ? { bg: CELL_BG[estado], text: CELL_TEXT[estado] } : { bg: '', text: '' };
}
