/**
 * Limpieza del domicilio para el papel del remito (2026-08-18).
 *
 * El papel preimpreso tiene casillas separadas para Domicilio, Localidad y
 * Provincia, pero varios proveedores y clientes tienen la dirección cargada
 * entera en un solo campo: "Arenales 605, B1638 Vicente López, Provincia de
 * Buenos Aires". Al imprimir salía todo junto en Domicilio Y además repetido en
 * las otras dos casillas.
 *
 * Esto saca del domicilio lo que ya va a salir por su cuenta. Es tolerante:
 * ignora mayúsculas, acentos y los separadores que queden colgando. Si no
 * encuentra coincidencia deja el texto como estaba — nunca borra de más.
 */

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function domicilioSinLocalidadNiProvincia(
  domicilio: string | null | undefined,
  localidad?: string | null,
  provincia?: string | null,
): string {
  let out = (domicilio || '').trim();
  if (!out) return '';

  for (const parte of [provincia, localidad]) {
    const p = (parte || '').trim();
    if (p.length < 3) continue;              // "CABA" sí, iniciales sueltas no
    const idx = normalizar(out).indexOf(normalizar(p));
    if (idx < 0) continue;
    // Solo se recorta si aparece DESPUÉS de algo: si el domicilio es solo la
    // localidad, se deja — es el único dato que hay.
    if (idx === 0) continue;
    out = `${out.slice(0, idx)}${out.slice(idx + p.length)}`;
  }

  // Código postal huérfano (2026-08-28): el CP viaja pegado a la localidad
  // ("B1638 Vicente López") y al recortarla queda colgando — el papel no tiene
  // casilla para él. Solo formatos inequívocos, para no tocar el número de
  // calle: CPA (C1425ASD), prefijo de partido (B1638), "CP 1638", entre
  // paréntesis, o token final de 4-5 dígitos DESPUÉS de una coma (el número de
  // calle va pegado al nombre, sin coma).
  out = out
    .replace(/\(\s*[A-Za-z]?\d{4}[A-Za-z]{0,3}\s*\)/g, ' ')
    .replace(/\b(?:CP|C\.?P\.?)\s*:?\s*[A-Za-z]?\d{4}[A-Za-z]{0,3}\b/gi, ' ')
    .replace(/\b[A-Za-z]\d{4}(?:[A-Za-z]{3})?\b/g, ' ')
    .replace(/,\s*\d{4,5}\s*$/, '')
    // Prefijo huérfano: "…, Provincia de Buenos Aires" con provincia guardada
    // como "Buenos Aires" deja "Provincia de" colgando (ídem "Ciudad de").
    .replace(/\b(?:provincia|prov\.?|pcia\.?|ciudad|cdad\.?)\s*(?:de)?\s*(?=[,;]|$)/gi, ' ');

  // Separadores que quedaron sueltos: comas repetidas, coma final, espacios.
  return out
    .replace(/\s*,\s*,+/g, ',')
    .replace(/(^|\s),(\s|$)/g, ' ')
    .replace(/[\s,;·-]+$/g, '')
    .replace(/^[\s,;·-]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
