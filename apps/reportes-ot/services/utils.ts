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

/**
 * Convierte fecha de formato YYYY-MM-DD (ISO) a DD/MM/YYYY
 * @param isoDate - Fecha en formato ISO (YYYY-MM-DD)
 * @returns Fecha en formato DD/MM/YYYY
 */
export const formatDateToDDMMYYYY = (isoDate: string): string => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Convierte fecha de formato DD/MM/YYYY a YYYY-MM-DD (ISO)
 * @param ddmmDate - Fecha en formato DD/MM/YYYY
 * @returns Fecha en formato ISO (YYYY-MM-DD) o string vacío si es inválida
 */
export const parseDDMMYYYYToISO = (ddmmDate: string): string => {
  if (!ddmmDate) return '';
  
  // Remover espacios y caracteres no numéricos excepto /
  const cleaned = ddmmDate.replace(/[^\d/]/g, '');
  const parts = cleaned.split('/');
  
  if (parts.length !== 3) return '';
  
  const [day, month, year] = parts;
  
  // Validar que sean números
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return '';
  
  // Validar rangos
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
    return '';
  }
  
  // Formatear con padding
  const formattedDay = String(dayNum).padStart(2, '0');
  const formattedMonth = String(monthNum).padStart(2, '0');
  const formattedYear = String(yearNum).padStart(4, '0');
  
  return `${formattedYear}-${formattedMonth}-${formattedDay}`;
};

/**
 * Valida formato de fecha DD/MM/YYYY
 * @param dateString - String a validar
 * @returns true si el formato es válido
 */
export const isValidDDMMYYYY = (dateString: string): boolean => {
  if (!dateString) return false;
  const iso = parseDDMMYYYYToISO(dateString);
  if (!iso) return false;
  
  // Validar que la fecha sea válida (ej: no 31/02/2024)
  const date = new Date(iso);
  return date instanceof Date && !isNaN(date.getTime());
};
