import type { AutocompleteResult } from '../components/AddressAutocomplete';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Saca del final de la dirección la localidad / provincia / país / CP, que ya
 * tienen su propio campo en el formulario (2026-08-08).
 *
 * Sin esto quedaba "Ruta Nacional 12 km 452 colonia avellaneda, Colonia
 * Avellaneda": el usuario escribe la localidad como parte de la búsqueda y
 * Google la repite normalizada en `formatted_address`.
 */
function quitarSufijosDeUbicacion(texto: string, res: AutocompleteResult): string {
  const sufijos = [res.localidad, res.provincia, res.pais, res.codigoPostal]
    .map(s => (s || '').trim())
    .filter(Boolean);

  // Se trabaja por segmentos separados por coma: es como los arma Google.
  let partes = texto.split(',').map(p => p.trim()).filter(Boolean);
  while (partes.length > 1) {
    const ultima = partes[partes.length - 1];
    const esUbicacion = sufijos.some(s => norm(s) === norm(ultima) || norm(ultima).includes(norm(s)));
    if (!esUbicacion) break;
    partes = partes.slice(0, -1);
  }

  // La localidad puede venir pegada sin coma ("... km 452 colonia avellaneda"):
  // si la última parte TERMINA con la localidad, se recorta.
  let base = partes.join(', ');
  for (const s of sufijos) {
    const re = new RegExp(`\\s+${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    const sinSufijo = base.replace(re, '').trim();
    // Solo si queda algo: "Colonia Avellaneda" a secas es una dirección válida.
    if (sinSufijo && sinSufijo !== base) base = sinSufijo;
  }
  return base.trim();
}

/**
 * Arma la dirección final a partir de un resultado del autocomplete,
 * conservando el complemento que Google no reconoce (2026-08-08).
 *
 * El caso que lo motivó: "Ruta 12 km 452". Google resuelve "Ruta 12" y descarta
 * el km, que es justamente lo único que dice dónde queda. Con esto la dirección
 * queda "Ruta 12 km 452" y además se conservan las coordenadas de la sugerencia,
 * que es lo que necesita el cálculo de distancia.
 *
 * Cuando Google NO reconoce la calle (típico en rutas) se usa lo que el usuario
 * tipeó, no `formatted_address`: ese trae la dirección completa con localidad y
 * provincia, que ya tienen su propio campo, y terminaba duplicando la localidad.
 *
 * @param previa dirección que ya estaba cargada (fallback)
 */
export function direccionDesdeAutocomplete(res: AutocompleteResult, previa = ''): string {
  if (res.street) {
    const base = [res.street, res.number].filter(Boolean).join(' ');
    return [base, res.complemento].filter(Boolean).join(' ').trim();
  }
  const crudo = (res.tipeado || '').trim() || res.formattedAddress || previa;
  const base = quitarSufijosDeUbicacion(crudo, res);
  // El complemento ya está dentro de lo tipeado: no se vuelve a anexar.
  return base || crudo;
}
