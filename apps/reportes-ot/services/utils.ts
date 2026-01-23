/**
 * Genera un ID único basado en timestamp y random
 */
export const uid = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

/**
 * Codifica una cadena Unicode a base64 de forma segura
 * Maneja caracteres especiales que btoa() no puede procesar
 */
export function safeBtoaUnicode(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) =>
      String.fromCharCode(parseInt(p, 16))
    )
  );
}
