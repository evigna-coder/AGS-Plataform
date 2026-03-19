import type { Request, Response } from 'express';
/** Validate CUIT/CUIL checksum (mod 11 algorithm). */
export declare function isValidCuitChecksum(cuit: string): boolean;
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
export declare function handleValidateCuit(req: Request, res: Response): Promise<void>;
