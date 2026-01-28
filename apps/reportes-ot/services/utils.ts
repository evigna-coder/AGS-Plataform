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

/**
 * Incrementa el sufijo de una OT (ej: 25660.02 -> 25660.03)
 */
export const incrementSuffix = (ot: string): string => {
  const m = ot.match(/^(.+)\.(\d{2,})$/);
  if (m) {
    const base = m[1];
    const num = Number(m[2]);
    const padded = String(num + 1).padStart(m[2].length, '0');
    return `${base}.${padded}`;
  }
  return `${ot}.02`;
};

/**
 * Busca la siguiente OT disponible que no exista o que esté en BORRADOR
 * Si la OT sugerida ya existe y está FINALIZADA, busca la siguiente disponible
 * 
 * @param baseOt - OT base (ej: "30000.01")
 * @param firebase - Instancia de FirebaseService
 * @param maxAttempts - Número máximo de intentos para evitar loops infinitos (default: 10)
 * @returns Promise con la siguiente OT disponible
 */
export const findNextAvailableOT = async (
  baseOt: string,
  firebase: any,
  maxAttempts: number = 10
): Promise<string> => {
  let currentOt = incrementSuffix(baseOt);
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const report = await firebase.getReport(currentOt);
      
      // Si la OT no existe, está disponible
      if (!report) {
        return currentOt;
      }

      // Si la OT existe pero está en BORRADOR, está disponible (se puede editar)
      if (report.status === 'BORRADOR' || !report.status) {
        return currentOt;
      }

      // Si la OT existe y está FINALIZADA, buscar la siguiente
      if (report.status === 'FINALIZADO') {
        currentOt = incrementSuffix(currentOt);
        attempts++;
        continue;
      }

      // Por defecto, si tiene otro status, considerar disponible
      return currentOt;
    } catch (error) {
      // Si hay error al consultar, asumir que no existe y está disponible
      console.warn(`Error al verificar OT ${currentOt}:`, error);
      return currentOt;
    }
  }

  // Si se agotaron los intentos, retornar la última OT calculada
  console.warn(`Se alcanzó el máximo de intentos buscando OT disponible. Retornando: ${currentOt}`);
  return currentOt;
};
