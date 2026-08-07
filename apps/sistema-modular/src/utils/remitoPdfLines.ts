import type { UnidadSalida } from '../components/remitos/RemitoStockPicker';
import { partirCodigoDescripcion } from './inventarioToRemitoItem';

/**
 * Código y descripción finales de una línea. Si el item no trae código propio
 * pero lo tiene escrito al principio del texto ("G7129A — Inyector automático"),
 * se lo pasa a la columna Producto en vez de imprimir S/C (2026-08-07).
 */
function resolver(codigo: string | null | undefined, descripcion: string): { codigo: string; descripcion: string } {
  if (codigo) return { codigo, descripcion };
  const partido = partirCodigoDescripcion(descripcion);
  return partido.codigo
    ? { codigo: partido.codigo, descripcion: partido.resto }
    : { codigo: SIN_CODIGO, descripcion };
}

/** Columna "Producto" cuando el artículo no tiene código (2026-08-07). */
export const SIN_CODIGO = 'S/C';

export interface RemitoPdfLinea {
  numero: number;
  cantidad: number;
  producto: string;
  descripcion: string;
}

interface ParteInput {
  articuloCodigo?: string | null;
  descripcion: string;
  serie?: string | null;
}

interface LineaConPartes {
  articuloCodigo?: string | null;
  descripcion: string;
  origenLabel?: string;
  partes?: ParteInput[];
}

/**
 * Arma las líneas impresas del remito de derivación / devolución.
 *
 * Reglas del papel, todas pedidas por el dueño el 2026-08-07:
 * - Columna Producto = SOLO código de artículo / N° de parte. Sin código → "S/C".
 * - Ningún identificador interno de AGS se declara: ni el número de ficha
 *   (FPC-xxxx) ni el código de loaner (LNR-xxxx) — antes eran el fallback y
 *   terminaron impresos en remitos reales.
 * - El "(de …)" del módulo de origen solo se agrega si hay descripción real.
 */
export function buildRemitoPdfLines(
  items: LineaConPartes[],
  loaners: LineaConPartes[],
  unidades: UnidadSalida[],
): RemitoPdfLinea[] {
  const out: RemitoPdfLinea[] = [];

  const pushConPartes = (entrada: LineaConPartes) => {
    if (entrada.partes && entrada.partes.length > 0) {
      for (const p of entrada.partes) {
        const parte = resolver(p.articuloCodigo, `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''}`);
        out.push({
          numero: out.length + 1,
          cantidad: 1,
          producto: parte.codigo,
          descripcion: [
            parte.descripcion,
            entrada.origenLabel ? `(de ${entrada.origenLabel})` : null,
          ].filter(Boolean).join(' '),
        });
      }
      return;
    }
    const linea = resolver(entrada.articuloCodigo, entrada.descripcion);
    out.push({
      numero: out.length + 1,
      cantidad: 1,
      producto: linea.codigo,
      descripcion: linea.descripcion,
    });
  };

  for (const it of items) pushConPartes(it);
  // Loaners después de las fichas, y las partes propias de stock al final.
  for (const l of loaners) pushConPartes(l);
  for (const u of unidades) {
    out.push({
      numero: out.length + 1,
      cantidad: u.cantidad,
      producto: u.articuloCodigo || SIN_CODIGO,
      descripcion: [
        u.articuloDescripcion,
        u.serie ? `S/N ${u.serie}` : null,
        u.motivo.trim() || null,
      ].filter(Boolean).join(' · '),
    });
  }

  return out;
}
