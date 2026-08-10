import type { EstadoAgenda } from '@ags/shared';

// Colores 2026-07-30: tentativo pasó al GRIS (igual a pendiente, pedido user);
// los estados "interior" (clientes a +200 km de CABA) se diferencian con
// marrón verdoso (tentativo) y azul grisáceo (confirmado).
const CELL_BG: Record<EstadoAgenda, string> = {
  pendiente: 'bg-slate-300',
  tentativo: 'bg-slate-300',
  tentativo_interior: 'bg-[#a09a4e]',
  confirmado: 'bg-blue-300',
  // Azul grisáceo más AZUL (2026-08-04: "#7d90a8 parece gris oscuro").
  confirmado_interior: 'bg-[#6d8ec9]',
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
  confirmado_interior: 'text-white',
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
const REGLAS: ReglaColor[] = [
  // Capacitación (2026-08-03) — rosa oscuro.
  { campo: 'tipoServicio', test: /capacitaci/i, bg: 'bg-[#e59a8e]', text: 'text-[#4a1710]' },
  // BCH (2026-08-05) — amarillo opaco. El catálogo dice "bench"; se acepta "bch".
  { campo: 'tipoServicio', test: /bench|bch/i, bg: 'bg-[#e0c878]', text: 'text-[#4a3c10]' },
  // Firma de recibos (2026-08-05) — evento mensual que reserva agenda, violeta clarito.
  { campo: 'titulo', test: /firma de recibos/i, bg: 'bg-[#d9c9f2]', text: 'text-[#3b2364]' },
  // Oficina (2026-08-06) — mismo amarillo que bench.
  { campo: 'titulo', test: /\boficina\b/i, bg: 'bg-[#e0c878]', text: 'text-[#4a3c10]' },
  // Permisos especiales (2026-08-09) — marrón oscuro; el texto va claro porque
  // sobre este fondo el slate-800 del resto de la grilla no se lee.
  { campo: 'titulo', test: /permisos?\s+especial/i, bg: 'bg-[#5c4033]', text: 'text-[#f2e8e2]' },
  // Día por enfermedad (2026-08-09) — verde chillón, para que salte en la grilla.
  { campo: 'titulo', test: /enfermedad/i, bg: 'bg-[#7cfc00]', text: 'text-[#1a3300]' },
  // Estudios médicos (2026-08-09) — amarillo fuerte. Distinto del amarillo
  // opaco de bench/oficina, que es mucho más apagado.
  { campo: 'titulo', test: /estudios m[ée]dicos/i, bg: 'bg-[#f5c518]', text: 'text-[#3d2f00]' },
];

/** Verde agua institucional (teal-700) — el mismo de los botones. */
const VENTA_CONCRETADA = { bg: 'bg-[#0D6E6E]', text: 'text-white' };

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
}): { bg: string; text: string } {
  const { estado, tipoServicio, titulo, ventaConcretada } = params;
  if (estado !== 'cancelado') {
    // Marca explícita del usuario: pisa las reglas derivadas de tipo/título.
    if (ventaConcretada) return { ...VENTA_CONCRETADA };
    for (const r of REGLAS) {
      const valor = r.campo === 'tipoServicio' ? tipoServicio : titulo;
      if (valor && r.test.test(valor)) return { bg: r.bg, text: r.text };
    }
  }
  return estado ? { bg: CELL_BG[estado], text: CELL_TEXT[estado] } : { bg: '', text: '' };
}
