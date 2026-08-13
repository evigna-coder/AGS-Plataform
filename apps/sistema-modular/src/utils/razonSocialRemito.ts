/**
 * Razón social del destinatario tal como va IMPRESA en el remito (2026-08-12).
 *
 * El nombre del establecimiento entre paréntesis identifica la planta a la que
 * se entrega — en un cliente multi-planta ("YPF S.A.") el nombre solo no dice
 * dónde va la mercadería. Estaba acordado y salía en la vista de remitos, pero
 * NO en el papel.
 *
 * A diferencia del sufijo de las listas (`useEstablecimientoSuffix`, que solo
 * lo agrega cuando hay más de un establecimiento activo para no meter ruido),
 * en el papel se pone SIEMPRE que se conozca: es un dato de entrega, no una
 * desambiguación de pantalla.
 */
export function razonSocialConEstablecimiento(
  razonSocial: string | null | undefined,
  establecimientoNombre: string | null | undefined,
): string {
  const base = (razonSocial ?? '').trim();
  const est = (establecimientoNombre ?? '').trim();
  if (!est) return base;
  // Sin redundancia: hay clientes de una sola planta cuyo establecimiento se
  // llama igual que la razón social — "ACME (ACME)" no aporta nada.
  if (!base || est.toLowerCase() === base.toLowerCase()) return base || est;
  return `${base} (${est})`;
}
