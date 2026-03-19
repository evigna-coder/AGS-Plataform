"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCuitChecksum = isValidCuitChecksum;
exports.handleValidateCuit = handleValidateCuit;
// ---------------------------------------------------------------------------
// CUIT validation: local checksum (mod 11)
// AFIP desactivó su API pública sr-padron en 2026. Cuando haya alternativa
// (WSAA con certificado o servicio de terceros), reactivar lookupAfip().
// ---------------------------------------------------------------------------
const CUIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
/** Validate CUIT/CUIL checksum (mod 11 algorithm). */
function isValidCuitChecksum(cuit) {
    const digits = cuit.replace(/\D/g, '');
    if (digits.length !== 11)
        return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(digits[i], 10) * CUIT_MULTIPLIERS[i];
    }
    const remainder = sum % 11;
    const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
    return checkDigit === parseInt(digits[10], 10);
}
/** Normalize CUIT: strip dashes/dots, return only digits. */
function normalizeCuit(raw) {
    return raw.replace(/\D/g, '');
}
/** Detect person type from CUIT prefix. */
function getTipoPersona(cuit) {
    const prefix = cuit.substring(0, 2);
    if (['30', '33', '34'].includes(prefix))
        return 'JURIDICA';
    if (['20', '23', '24', '27'].includes(prefix))
        return 'FISICA';
    return 'DESCONOCIDO';
}
/** Express handler: POST /validate-cuit  body: { cuit: string } */
async function handleValidateCuit(req, res) {
    const rawCuit = typeof req.body?.cuit === 'string' ? req.body.cuit.trim() : '';
    if (!rawCuit) {
        res.status(400).json({ valid: false, error: 'Se requiere el campo "cuit"' });
        return;
    }
    const cuit = normalizeCuit(rawCuit);
    const checksumOk = isValidCuitChecksum(cuit);
    if (!checksumOk) {
        const result = {
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
    const result = {
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
