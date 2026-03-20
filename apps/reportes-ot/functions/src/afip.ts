import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// CUIT validation: local checksum (mod 11)
// AFIP desactivó su API pública sr-padron en 2026. Cuando haya alternativa
// (WSAA con certificado o servicio de terceros), reactivar lookupAfip().
// ---------------------------------------------------------------------------

const CUIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Validate CUIT/CUIL checksum (mod 11 algorithm). */
export function isValidCuitChecksum(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * CUIT_MULTIPLIERS[i];
  }
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  return checkDigit === parseInt(digits[10], 10);
}

/** Normalize CUIT: strip dashes/dots, return only digits. */
function normalizeCuit(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Detect person type from CUIT prefix. */
function getTipoPersona(cuit: string): string {
  const prefix = cuit.substring(0, 2);
  if (['30', '33', '34'].includes(prefix)) return 'JURIDICA';
  if (['20', '23', '24', '27'].includes(prefix)) return 'FISICA';
  return 'DESCONOCIDO';
}

export interface CuitValidationResult {
  valid: boolean;
  cuit: string;
  checksumOk: boolean;
  afipFound: boolean;
  razonSocial: string | null;
  tipoPersona: string | null;
  estadoClave: string | null;
  domicilioFiscal: {
    direccion: string | null;
    localidad: string | null;
    codPostal: string | null;
    provincia: string | null;
  } | null;
  error?: string;
}

/** Express handler: POST /validate-cuit  body: { cuit: string } */
export async function handleValidateCuit(req: Request, res: Response): Promise<void> {
  const rawCuit = typeof req.body?.cuit === 'string' ? req.body.cuit.trim() : '';

  if (!rawCuit) {
    res.status(400).json({ valid: false, error: 'Se requiere el campo "cuit"' });
    return;
  }

  const cuit = normalizeCuit(rawCuit);
  const checksumOk = isValidCuitChecksum(cuit);

  if (!checksumOk) {
    const result: CuitValidationResult = {
      valid: false,
      cuit,
      checksumOk: false,
      afipFound: false,
      razonSocial: null,
      tipoPersona: null,
      estadoClave: null,
      domicilioFiscal: null,
      error: 'CUIT inválido: dígito verificador incorrecto',
    };
    res.status(200).json(result);
    return;
  }

  // Checksum OK — AFIP lookup disabled (API pública desactivada)
  const result: CuitValidationResult = {
    valid: true,
    cuit,
    checksumOk: true,
    afipFound: false,
    razonSocial: null,
    tipoPersona: getTipoPersona(cuit),
    estadoClave: null,
    domicilioFiscal: null,
  };

  res.status(200).json(result);
}
