// Tipos locales para instrumentos/patrones y adjuntos.
// Espejo parcial de @ags/shared — reportes-ot no usa el paquete shared.

/** Instrumento o patrón (solo campos para lectura/selección por el técnico) */
export interface InstrumentoPatronOption {
  id: string;
  nombre: string;
  tipo: 'instrumento' | 'patron';
  marca: string;
  modelo: string;
  serie: string;
  categorias: string[];
  certificadoEmisor?: string | null;
  certificadoVencimiento?: string | null;
  certificadoUrl?: string | null;
}

/** Metadata de un adjunto. El binario vive en Firebase Storage. */
export interface AdjuntoMeta {
  id: string;
  otNumber: string;
  tipo: 'foto' | 'archivo';
  storagePath: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  orden: number;
  uploadedAt: string;
}
