// Servicio para validar CUIT contra AFIP via Cloud Function proxy

const AFIP_FUNCTION_URL = import.meta.env.VITE_AFIP_FUNCTION_URL || 'https://afip-bo3bj34f6a-uc.a.run.app';

export interface CuitValidationResult {
  valid: boolean;
  cuit: string;
  checksumOk: boolean;
  afipFound: boolean;
  razonSocial: string | null;
  tipoPersona: string | null; // 'FISICA' | 'JURIDICA'
  estadoClave: string | null; // 'ACTIVO' | 'INACTIVO'
  domicilioFiscal: {
    direccion: string | null;
    localidad: string | null;
    codPostal: string | null;
    provincia: string | null;
  } | null;
  error?: string;
}

/** Validate CUIT locally (mod 11 checksum). */
export function isValidCuitLocal(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * multipliers[i];
  }
  const remainder = sum % 11;
  const check = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  return check === parseInt(digits[10], 10);
}

/** Validate CUIT against AFIP Padrón (via Cloud Function). */
export async function validateCuitAfip(cuit: string): Promise<CuitValidationResult> {
  const res = await fetch(AFIP_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cuit }),
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status} consultando AFIP`);
  }

  return res.json();
}
