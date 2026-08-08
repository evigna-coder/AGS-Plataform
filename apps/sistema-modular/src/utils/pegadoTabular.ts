/**
 * Pegado de celdas de Excel en un campo de texto plano (2026-08-08).
 *
 * Excel pone en el portapapeles un TSV: columnas separadas por TAB, filas por
 * salto de línea. En un textarea eso queda como un chorizo ilegible, porque el
 * tab no alinea nada.
 *
 * Acá se convierte a columnas de ancho fijo rellenando con espacios: el texto
 * sigue siendo plano —sin HTML que sanitizar ni estilos que se rompan— y las
 * celdas quedan alineadas al mostrarlo con tipografía monoespaciada.
 *
 * No se intenta conservar colores ni bordes: para eso habría que guardar HTML
 * del portapapeles, que es justamente lo que el editor rico del presupuesto
 * evita porque rompe el PDF.
 */

/** ¿El texto pegado viene de una grilla (tiene TABs)? */
export function pareceTabular(texto: string): boolean {
  return texto.includes('\t');
}

/**
 * TSV → columnas alineadas con espacios. Las celdas numéricas se alinean a la
 * derecha, que es como se leen los precios.
 */
export function alinearTsv(texto: string): string {
  const filas = texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.split('\t'));

  const columnas = Math.max(...filas.map(f => f.length));
  const anchos: number[] = [];
  for (let c = 0; c < columnas; c++) {
    anchos[c] = Math.max(...filas.map(f => (f[c] ?? '').trim().length));
  }

  // Una columna es numérica si TODAS sus celdas no vacías parecen números
  // (con separadores de miles/decimales, signo, %, símbolo de moneda).
  const esNumerica = (c: number) => {
    const celdas = filas.map(f => (f[c] ?? '').trim()).filter(Boolean);
    if (celdas.length === 0) return false;
    return celdas.every(v => /^[-+]?\s*[$€]?\s*[\d.,]+\s*%?$/.test(v));
  };
  const numericas = new Set<number>();
  for (let c = 0; c < columnas; c++) if (esNumerica(c)) numericas.add(c);

  return filas
    .map(f => {
      const celdas: string[] = [];
      for (let c = 0; c < columnas; c++) {
        const v = (f[c] ?? '').trim();
        // La última columna no se rellena: evita espacios colgando al final.
        if (c === columnas - 1) { celdas.push(v); break; }
        celdas.push(numericas.has(c) ? v.padStart(anchos[c]) : v.padEnd(anchos[c]));
      }
      return celdas.join('  ').trimEnd();
    })
    .join('\n');
}

/**
 * Inserta `texto` en la posición del cursor de un textarea y devuelve el valor
 * resultante + la nueva posición del cursor.
 */
export function insertarEnCursor(
  el: HTMLTextAreaElement,
  texto: string,
): { valor: string; cursor: number } {
  const inicio = el.selectionStart ?? el.value.length;
  const fin = el.selectionEnd ?? inicio;
  const valor = el.value.slice(0, inicio) + texto + el.value.slice(fin);
  return { valor, cursor: inicio + texto.length };
}
